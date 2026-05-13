import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import {
    getAuthenticatedUser,
    getAuthorizedRestaurantContext,
    enforceTenantScope,
} from '@/lib/api/authz';
import { parseJsonBody, parseQuery } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';

const ACTIVE_KDS_STATUSES = ['pending', 'confirmed', 'acknowledged', 'preparing', 'ready'] as const;
const HEARTBEAT_ACTION = 'kds_ws_heartbeat';

const KdsTelemetryQuerySchema = z.object({
    sla_minutes: z.coerce.number().int().min(5).max(180).default(30),
});

const KdsHeartbeatSchema = z.object({
    station: z
        .enum(['kitchen', 'bar', 'dessert', 'coffee', 'grill', 'cold', 'expeditor'])
        .optional(),
    realtime_connected: z.boolean(),
    queue_size: z.number().int().min(0).max(500).optional(),
    breached_tickets: z.number().int().min(0).max(500).optional(),
});

function percentile(values: number[], p: number) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    const safeIndex = Math.max(0, Math.min(sorted.length - 1, index));
    return sorted[safeIndex];
}

function asObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
}

export async function GET(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const url = new URL(request.url);
    const requestedRestaurantId = url.searchParams.get('restaurant_id');

    // If restaurant_id is provided, validate access. Otherwise default to user's primary restaurant.
    let restaurantId: string;
    let supabase = auth.supabase;

    if (requestedRestaurantId) {
        const scope = await enforceTenantScope(auth.user.id, requestedRestaurantId);
        if (!scope.allowed) {
            return apiError(scope.reason ?? 'Forbidden', 403, 'FORBIDDEN');
        }
        restaurantId = requestedRestaurantId;
    } else {
        const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
        if (!context.ok) {
            return context.response;
        }
        restaurantId = context.restaurantId;
        supabase = context.supabase;
    }

    const parsed = parseQuery(
        {
            sla_minutes: url.searchParams.get('sla_minutes') ?? undefined,
        },
        KdsTelemetryQuerySchema
    );
    if (!parsed.success) {
        return parsed.response;
    }
    const { sla_minutes } = parsed.data;

    const now = Date.now();
    const heartbeatWindowStart = new Date(now - 10 * 60_000).toISOString();
    // HIGH-015: Increased healthy window to 3 minutes (180s) to be more resilient to network hiccups
    const healthyWindowThreshold = now - 180_000;

    const [ordersRes, heartbeatRes] = await Promise.all([
        supabase
            .from('orders')
            .select('id, created_at, status')
            .eq('restaurant_id', restaurantId)
            .in('status', [...ACTIVE_KDS_STATUSES]),
        supabase
            .from('audit_logs')
            .select('created_at, metadata')
            .eq('restaurant_id', restaurantId)
            .eq('action', HEARTBEAT_ACTION)
            .gte('created_at', heartbeatWindowStart)
            .order('created_at', { ascending: false })
            .limit(300),
    ]);

    if (ordersRes.error) {
        return apiError(
            'Failed to fetch KDS queue telemetry',
            500,
            'KDS_TELEMETRY_ORDERS_FETCH_FAILED',
            ordersRes.error.message
        );
    }

    if (heartbeatRes.error) {
        return apiError(
            'Failed to fetch KDS websocket telemetry',
            500,
            'KDS_TELEMETRY_HEARTBEAT_FETCH_FAILED',
            heartbeatRes.error.message
        );
    }

    const queueAges = (ordersRes.data ?? [])
        .map(order => {
            if (!order.created_at) return 0;
            return Math.max(0, Math.floor((now - new Date(order.created_at).getTime()) / 60000));
        })
        .filter(value => Number.isFinite(value));

    const breachedCount = queueAges.filter(value => value >= sla_minutes).length;

    const heartbeatRows = (heartbeatRes.data ?? []) as Array<{
        created_at: string | null;
        metadata: unknown;
    }>;

    // SEC-002: Use numeric timestamp comparison instead of string ISO comparison for reliability
    const connectedRecent = heartbeatRows.some(row => {
        if (!row.created_at) return false;
        const rowTime = new Date(row.created_at).getTime();
        if (rowTime < healthyWindowThreshold) return false;
        const metadata = asObject(row.metadata);
        return metadata?.realtime_connected === true;
    });

    const latestHeartbeat = heartbeatRows.find(row => Boolean(row.created_at)) ?? null;
    const connectedStations = new Set<string>();
    for (const row of heartbeatRows) {
        const metadata = asObject(row.metadata);
        if (!metadata || metadata.realtime_connected !== true) continue;
        const station = metadata.station;
        if (typeof station === 'string' && station.length > 0) {
            connectedStations.add(station);
        }
    }

    return apiSuccess({
        generated_at: new Date(now).toISOString(),
        restaurant_id: restaurantId,
        queue_lag: {
            active_tickets: queueAges.length,
            avg_minutes:
                queueAges.length > 0
                    ? Number(
                          (queueAges.reduce((sum, n) => sum + n, 0) / queueAges.length).toFixed(1)
                      )
                    : 0,
            p50_minutes: percentile(queueAges, 50),
            p95_minutes: percentile(queueAges, 95),
            max_minutes: queueAges.length > 0 ? Math.max(...queueAges) : 0,
        },
        sla: {
            threshold_minutes: sla_minutes,
            breached_tickets: breachedCount,
            breached_ratio_percent:
                queueAges.length > 0
                    ? Number(((breachedCount / queueAges.length) * 100).toFixed(2))
                    : 0,
        },
        websocket: {
            status: connectedRecent ? 'healthy' : 'degraded',
            healthy: connectedRecent,
            last_heartbeat_at: latestHeartbeat?.created_at ?? null,
            connected_stations: Array.from(connectedStations),
            samples_in_window: heartbeatRows.length,
        },
    });
}

export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const url = new URL(request.url);
    const requestedRestaurantId = url.searchParams.get('restaurant_id');

    let restaurantId: string;
    let supabase = auth.supabase;

    if (requestedRestaurantId) {
        const scope = await enforceTenantScope(auth.user.id, requestedRestaurantId);
        if (!scope.allowed) {
            return apiError(scope.reason ?? 'Forbidden', 403, 'FORBIDDEN');
        }
        restaurantId = requestedRestaurantId;
    } else {
        const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
        if (!context.ok) {
            return context.response;
        }
        restaurantId = context.restaurantId;
        supabase = context.supabase;
    }

    const parsed = await parseJsonBody(request, KdsHeartbeatSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    // FIX: entity_id in audit_logs is a UUID column in the database.
    // Passing 'kitchen' or 'bar' as a string was causing a cast error (22P02)
    // and preventing the heartbeat from being saved.
    const { error: logError } = await writeAuditLog(supabase, {
        restaurant_id: restaurantId,
        user_id: auth.user.id,
        action: HEARTBEAT_ACTION,
        entity_type: 'kds_realtime',
        entity_id: null, // Don't pass station name as UUID
        metadata: {
            source: 'kds_web',
            station: parsed.data.station, // Keep station in metadata
            ...parsed.data,
        },
    });

    if (logError) {
        console.error('[KDS Telemetry] Failed to write heartbeat log:', logError);
        return apiError('Failed to record telemetry heartbeat', 500, 'KDS_TELEMETRY_RECORD_FAILED');
    }

    return apiSuccess({
        received: true,
        restaurant_id: restaurantId,
    });
}
