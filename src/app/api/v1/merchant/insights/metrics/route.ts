/**
 * System Metrics API Endpoint
 *
 * Provides aggregated metrics for dashboard consumption.
 * This endpoint is intended for internal/monitoring use and returns
 * system-wide statistics without restaurant scoping.
 *
 * Security: Requires API key or HMAC signature verification.
 *
 * @see docs/implementation/observability-setup.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyQRSignature } from '@/lib/security/hmac';
import { METRIC_ACTIONS } from '@/lib/monitoring/metrics';

const METRICS_API_KEY = process.env.METRICS_API_KEY;

// Initialize admin client for system-wide queries
function getSupabaseAdmin() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
}

/**
 * Verify API key authentication
 */
function authenticate(request: NextRequest): boolean {
    // Check API key header
    const apiKey = request.headers.get('x-metrics-api-key');
    if (apiKey && apiKey === METRICS_API_KEY) {
        return true;
    }

    // Check HMAC signature for internal service authentication
    const signature = request.headers.get('x-hmac-signature');
    const timestamp = request.headers.get('x-timestamp');
    if (signature && timestamp) {
        const data = `metrics:${timestamp}`;
        return verifyQRSignature(data, signature);
    }

    return false;
}

/**
 * Get time range for metrics queries
 */
function getTimeRange(range: string | null) {
    const now = new Date();
    let since: Date;

    switch (range) {
        case 'hour':
            since = new Date(now.getTime() - 60 * 60 * 1000);
            break;
        case 'day':
            since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case 'week':
            since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'month':
            since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return { since: since.toISOString(), until: now.toISOString() };
}

/**
 * Calculate percentile from array
 */
function percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

/**
 * Fetch API metrics from audit_logs
 */
async function fetchApiMetrics(since: string, until: string) {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('audit_logs')
        .select('created_at, metadata, restaurant_id')
        .eq('action', METRIC_ACTIONS.API)
        .gte('created_at', since)
        .lte('created_at', until)
        .limit(10000);

    if (error || !data) {
        return {
            requests: 0,
            errors: 0,
            avgLatency: 0,
            p95Latency: 0,
            p99Latency: 0,
            errorRate: 0,
        };
    }

    const durations: number[] = [];
    let errorCount = 0;

    for (const row of data) {
        const meta = row.metadata as Record<string, unknown>;
        const duration = meta?.duration_ms as number | undefined;
        const isError = meta?.is_error as boolean | undefined;

        if (duration !== undefined && duration !== null) {
            durations.push(duration);
        }
        if (isError) {
            errorCount++;
        }
    }

    const requests = data.length;
    const avgLatency =
        durations.length > 0
            ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
            : 0;

    return {
        requests,
        errors: errorCount,
        avgLatency,
        p95Latency: percentile(durations, 95),
        p99Latency: percentile(durations, 99),
        errorRate: requests > 0 ? Number(((errorCount / requests) * 100).toFixed(2)) : 0,
    };
}

/**
 * Fetch order metrics
 */
async function fetchOrderMetrics(since: string, until: string) {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('audit_logs')
        .select('metadata')
        .eq('action', METRIC_ACTIONS.ORDER)
        .gte('created_at', since)
        .lte('created_at', until)
        .limit(5000);

    if (error || !data) {
        return { total: 0, completed: 0, cancelled: 0 };
    }

    let completed = 0;
    let cancelled = 0;

    for (const row of data) {
        const meta = row.metadata as Record<string, unknown>;
        const event = meta?.event as string | undefined;

        if (event === 'completed') completed++;
        if (event === 'cancelled') cancelled++;
    }

    return { total: data.length, completed, cancelled };
}

/**
 * Fetch payment metrics
 */
async function fetchPaymentMetrics(since: string, until: string) {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('audit_logs')
        .select('metadata')
        .eq('action', METRIC_ACTIONS.PAYMENT)
        .gte('created_at', since)
        .lte('created_at', until)
        .limit(5000);

    if (error || !data) {
        return { total: 0, completed: 0, failed: 0, totalAmount: 0 };
    }

    let completed = 0;
    let failed = 0;
    let totalAmount = 0;

    for (const row of data) {
        const meta = row.metadata as Record<string, unknown>;
        const event = meta?.event as string | undefined;
        const amount = meta?.amount as number | undefined;

        if (event === 'completed') completed++;
        if (event === 'failed') failed++;
        if (amount !== undefined && amount !== null) {
            totalAmount += amount;
        }
    }

    return { total: data.length, completed, failed, totalAmount };
}

/**
 * Fetch session metrics (active sessions estimate)
 */
async function fetchSessionMetrics(since: string, until: string) {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('audit_logs')
        .select('metadata, restaurant_id')
        .eq('action', METRIC_ACTIONS.SESSION)
        .gte('created_at', since)
        .lte('created_at', until)
        .limit(5000);

    if (error || !data) {
        return { total: 0, active: 0, closed: 0 };
    }

    let closed = 0;

    for (const row of data) {
        const meta = row.metadata as Record<string, unknown>;
        const event = meta?.event as string | undefined;

        if (event === 'closed' || event === 'timed_out') closed++;
    }

    const opened = data.length - closed;
    return { total: data.length, active: opened, closed };
}

/**
 * Fetch active users count (unique restaurant_ids in the time window)
 */
async function fetchActiveRestaurants(since: string, until: string) {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('audit_logs')
        .select('restaurant_id')
        .gte('created_at', since)
        .lte('created_at', until)
        .not('restaurant_id', 'is', null)
        .limit(10000);

    if (error || !data) {
        return 0;
    }

    const uniqueRestaurants = new Set(data.map(row => row.restaurant_id).filter(Boolean));

    return uniqueRestaurants.size;
}

/**
 * GET /api/metrics
 * Returns aggregated system metrics
 */
export async function GET(request: NextRequest) {
    if (!authenticate(request)) {
        return NextResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'Invalid API key or signature' } },
            { status: 401 }
        );
    }

    try {
        const url = new URL(request.url);
        const range = url.searchParams.get('range') || 'day';
        const { since, until } = getTimeRange(range);

        const [apiMetrics, orderMetrics, paymentMetrics, sessionMetrics, activeRestaurants] =
            await Promise.all([
                fetchApiMetrics(since, until),
                fetchOrderMetrics(since, until),
                fetchPaymentMetrics(since, until),
                fetchSessionMetrics(since, until),
                fetchActiveRestaurants(since, until),
            ]);

        const response = {
            data: {
                period: {
                    range,
                    since,
                    until,
                },
                generated_at: new Date().toISOString(),
                api: apiMetrics,
                orders: orderMetrics,
                payments: paymentMetrics,
                sessions: sessionMetrics,
                business: {
                    active_restaurants: activeRestaurants,
                },
            },
        };

        return NextResponse.json(response);
    } catch (_error) {
        return NextResponse.json(
            {
                error: {
                    code: 'METRICS_FETCH_FAILED',
                    message: 'Failed to fetch system metrics',
                },
            },
            { status: 500 }
        );
    }
}
