import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { API_METRIC_ACTION } from '@/lib/api/metrics';
import type { Json } from '@/types/database';

type RangeOption = 'today' | 'week' | 'month';

type EndpointSloTarget = {
    endpoint: string;
    p95_latency_ms: number;
    error_rate_percent: number;
};

const SLO_TARGETS: EndpointSloTarget[] = [
    { endpoint: '/api/v1/merchant/insights/analytics/overview', p95_latency_ms: 500, error_rate_percent: 1 },
    { endpoint: '/api/v1/merchant/operations/orders', p95_latency_ms: 400, error_rate_percent: 1 },
    { endpoint: '/api/v1/merchant/operations/orders/:id/status', p95_latency_ms: 300, error_rate_percent: 0.5 },
];

function getRangeStart(range: string | null) {
    const now = new Date();
    const normalized: RangeOption = range === 'today' || range === 'month' ? range : 'week';

    if (normalized === 'today') {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        return { range: normalized, sinceIso: d.toISOString() };
    }

    if (normalized === 'month') {
        const d = new Date(now);
        d.setDate(now.getDate() - 30);
        return { range: normalized, sinceIso: d.toISOString() };
    }

    const d = new Date(now);
    d.setDate(now.getDate() - 7);
    return { range: normalized, sinceIso: d.toISOString() };
}

function percentile(values: number[], p: number) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    const safeIndex = Math.max(0, Math.min(sorted.length - 1, index));
    return sorted[safeIndex];
}

function formatBucket(dateIso: string, range: RangeOption) {
    const d = new Date(dateIso);
    if (range === 'today') {
        return `${String(d.getHours()).padStart(2, '0')}:00`;
    }
    return d.toISOString().slice(0, 10);
}

function asMetricMetadata(value: Json | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

export async function GET(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const url = new URL(request.url);
    const { range, sinceIso } = getRangeStart(url.searchParams.get('range'));

    const { data, error } = await context.supabase
        .from('audit_logs')
        .select('created_at, metadata')
        .eq('restaurant_id', context.restaurantId)
        .eq('action', API_METRIC_ACTION)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: true })
        .limit(5000);

    if (error) {
        return apiError(
            'Failed to load API metrics',
            500,
            'API_METRICS_FETCH_FAILED',
            error.message
        );
    }

    const endpointMap = new Map<string, { durations: number[]; total: number; errors: number }>();
    const trendMap = new Map<
        string,
        { endpoint: string; bucket: string; total: number; errors: number; durations: number[] }
    >();

    for (const row of data ?? []) {
        const meta = asMetricMetadata(row.metadata);
        if (!meta) continue;

        const endpoint = typeof meta.endpoint === 'string' ? meta.endpoint : null;
        const durationMs = typeof meta.duration_ms === 'number' ? meta.duration_ms : null;
        const isError = typeof meta.is_error === 'boolean' ? meta.is_error : null;
        const createdAt = row.created_at;

        if (!endpoint || durationMs === null || isError === null || !createdAt) {
            continue;
        }

        const endpointEntry = endpointMap.get(endpoint) ?? { durations: [], total: 0, errors: 0 };
        endpointEntry.total += 1;
        endpointEntry.errors += isError ? 1 : 0;
        endpointEntry.durations.push(durationMs);
        endpointMap.set(endpoint, endpointEntry);

        const bucket = formatBucket(createdAt, range);
        const trendKey = `${endpoint}|${bucket}`;
        const trendEntry = trendMap.get(trendKey) ?? {
            endpoint,
            bucket,
            total: 0,
            errors: 0,
            durations: [],
        };
        trendEntry.total += 1;
        trendEntry.errors += isError ? 1 : 0;
        trendEntry.durations.push(durationMs);
        trendMap.set(trendKey, trendEntry);
    }

    const endpointStats = SLO_TARGETS.map(target => {
        const entry = endpointMap.get(target.endpoint) ?? { durations: [], total: 0, errors: 0 };
        const errorRate =
            entry.total > 0 ? Number(((entry.errors / entry.total) * 100).toFixed(2)) : 0;
        const p95 = percentile(entry.durations, 95);
        const p50 = percentile(entry.durations, 50);
        const avg =
            entry.total > 0
                ? Math.round(entry.durations.reduce((sum, n) => sum + n, 0) / entry.total)
                : 0;

        const latencyStatus = entry.total > 0 && p95 > target.p95_latency_ms ? 'breach' : 'healthy';
        const errorStatus =
            entry.total > 0 && errorRate > target.error_rate_percent ? 'breach' : 'healthy';

        return {
            endpoint: target.endpoint,
            requests: entry.total,
            errors: entry.errors,
            error_rate_percent: errorRate,
            latency_ms: {
                p50,
                p95,
                avg,
            },
            slo: {
                latency_target_p95_ms: target.p95_latency_ms,
                error_rate_target_percent: target.error_rate_percent,
                latency_status: entry.total === 0 ? 'no_data' : latencyStatus,
                error_status: entry.total === 0 ? 'no_data' : errorStatus,
            },
        };
    });

    const trend = Array.from(trendMap.values())
        .map(entry => ({
            endpoint: entry.endpoint,
            bucket: entry.bucket,
            requests: entry.total,
            errors: entry.errors,
            error_rate_percent:
                entry.total > 0 ? Number(((entry.errors / entry.total) * 100).toFixed(2)) : 0,
            p95_latency_ms: percentile(entry.durations, 95),
        }))
        .sort((a, b) => a.bucket.localeCompare(b.bucket) || a.endpoint.localeCompare(b.endpoint));

    return apiSuccess({
        range,
        range_start: sinceIso,
        generated_at: new Date().toISOString(),
        endpoints: endpointStats,
        trend,
    });
}
