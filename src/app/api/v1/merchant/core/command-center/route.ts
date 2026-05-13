import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError, apiSuccess } from '@/lib/api/response';
import { trackApiMetric } from '@/lib/api/metrics';
import { enforcePilotAccess } from '@/lib/api/pilotGate';
import { getCacheHeaders, CACHE_PRESETS } from '@/lib/api/cache';
import { monitoredQuery } from '@/lib/services/queryMonitor';
import {
    calculateLaborMetricsFromTimeEntries,
    getHourlyRateConfig,
} from '@/lib/services/laborReportsService';

type AttentionItem = {
    id: string;
    type: 'order' | 'service_request' | 'alert';
    label: string;
    status: string;
    severity?: string | null;
    created_at: string | null;
    table_number: string | null;
};

function isInFlightStatus(status: string | null) {
    return ['pending', 'acknowledged', 'preparing', 'ready'].includes(status ?? '');
}

function resolveSince(range: string | null) {
    const now = new Date();
    const fallbackRange = 'today';

    if (range === 'week') {
        return {
            range: 'week',
            sinceIso: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        };
    }

    if (range === 'month') {
        return {
            range: 'month',
            sinceIso: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        };
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return {
        range: fallbackRange,
        sinceIso: startOfToday.toISOString(),
    };
}

function resolvePreviousRange(range: string | null): { sinceIso: string; untilIso: string } {
    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (range === 'week') {
        const until = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        return { sinceIso: since.toISOString(), untilIso: until.toISOString() };
    }

    if (range === 'month') {
        const until = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const since = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        return { sinceIso: since.toISOString(), untilIso: until.toISOString() };
    }

    // Default: Yesterday
    const until = new Date(startOfToday.getTime());
    const since = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
    return { sinceIso: since.toISOString(), untilIso: until.toISOString() };
}

function resolvePriority(item: AttentionItem) {
    if (item.type === 'alert') {
        if (item.severity === 'critical') return 400;
        if (item.severity === 'high') return 350;
        if (item.severity === 'medium') return 300;
        return 250;
    }
    if (item.type === 'service_request') return 200;
    if (item.status === 'ready') return 180;
    if (item.status === 'preparing') return 160;
    if (item.status === 'acknowledged') return 140;
    return 120;
}

export async function GET(request: NextRequest) {
    const startedAt = Date.now();
    let responseStatus = 500;
    let restaurantIdForMetrics: string | null = null;
    let supabaseForMetrics: Awaited<ReturnType<typeof createClient>> | null = null;

    try {
        const supabase = await createClient();
        supabaseForMetrics = supabase;
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            responseStatus = 401;
            return apiError('Unauthorized', 401, 'UNAUTHORIZED');
        }

        const { data: staffEntry } = await supabase
            .from('restaurant_staff')
            .select('restaurant_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

        let restaurantId = staffEntry?.restaurant_id ?? null;

        if (!restaurantId) {
            const { data: agencyUser } = await supabase
                .from('agency_users')
                .select('restaurant_ids')
                .eq('user_id', user.id)
                .maybeSingle();

            if (agencyUser?.restaurant_ids?.[0]) {
                restaurantId = agencyUser.restaurant_ids[0];
            }
        }

        if (!restaurantId) {
            responseStatus = 404;
            return apiError('No restaurant found for user', 404, 'RESTAURANT_NOT_FOUND');
        }
        restaurantIdForMetrics = restaurantId;

        const pilotGateResponse = enforcePilotAccess(restaurantId, request.method);
        if (pilotGateResponse) {
            responseStatus = pilotGateResponse.status;
            return pilotGateResponse;
        }

        const rangeParam = request.nextUrl.searchParams.get('range');
        const { range, sinceIso } = resolveSince(rangeParam);

        const [
            ordersRes,
            requestsRes,
            tablesRes,
            alertsRes,
            prevOrdersRes,
            staffRes,
            timeEntriesRes,
            tipAllocationsRes,
        ] = await monitoredQuery(
            'command-center:fetch-dashboard',
            () =>
                Promise.all([
                    supabase
                        .from('orders')
                        .select(
                            'id, order_number, status, table_number, created_at, completed_at, total_price'
                        )
                        .eq('restaurant_id', restaurantId)
                        .gte('created_at', sinceIso)
                        .order('created_at', { ascending: false })
                        .limit(200),
                    supabase
                        .from('service_requests')
                        .select('id, request_type, status, table_number, created_at')
                        .eq('restaurant_id', restaurantId)
                        .gte('created_at', sinceIso)
                        .order('created_at', { ascending: false })
                        .limit(200),
                    supabase
                        .from('tables')
                        .select('id, status, is_active')
                        .eq('restaurant_id', restaurantId),
                    supabase
                        .from('alert_events')
                        .select(
                            'id, entity_type, entity_id, status, severity, created_at, resolved_at'
                        )
                        .eq('restaurant_id', restaurantId)
                        .is('resolved_at', null)
                        .gte('created_at', sinceIso)
                        .order('created_at', { ascending: false })
                        .limit(50),
                    supabase
                        .from('orders')
                        .select('total_price, created_at')
                        .eq('restaurant_id', restaurantId)
                        .gte('created_at', resolvePreviousRange(rangeParam).sinceIso)
                        .lt('created_at', resolvePreviousRange(rangeParam).untilIso),
                    supabase
                        .from('restaurant_staff')
                        .select('id, role')
                        .eq('restaurant_id', restaurantId)
                        .eq('is_active', true),
                    supabase
                        .from('time_entries')
                        .select('staff_id, clock_in_at, clock_out_at')
                        .eq('restaurant_id', restaurantId)
                        .gte('clock_in_at', sinceIso),
                    supabase
                        .from('tip_allocations')
                        .select('total_tips_distributed')
                        .eq('restaurant_id', restaurantId)
                        .gte('period_date', sinceIso.slice(0, 10)),
                ]),
            { restaurantId }
        );

        if (ordersRes.error) {
            responseStatus = 500;
            return apiError('Failed to load orders', 500, 'ORDERS_FETCH_FAILED');
        }
        if (requestsRes.error) {
            responseStatus = 500;
            return apiError('Failed to load service requests', 500, 'REQUESTS_FETCH_FAILED');
        }
        if (tablesRes.error) {
            responseStatus = 500;
            return apiError('Failed to load tables', 500, 'TABLES_FETCH_FAILED');
        }
        if (alertsRes.error) {
            responseStatus = 500;
            return apiError('Failed to load alerts', 500, 'ALERTS_FETCH_FAILED');
        }

        const orders = ordersRes.data ?? [];
        const requests = requestsRes.data ?? [];
        const tables = tablesRes.data ?? [];
        const alerts = alertsRes.data ?? [];
        const prevOrders = prevOrdersRes.data ?? [];
        const staff = staffRes.data ?? [];
        const timeEntries = timeEntriesRes.data ?? [];
        const tipAllocations = tipAllocationsRes.data ?? [];

        const ordersInFlight = orders.filter(o => isInFlightStatus(o.status)).length;
        const completedOrders = orders.filter(
            o => o.status === 'completed' || o.status === 'served'
        );
        const activeTables = tables.filter(
            t => t.is_active !== false && t.status !== 'available'
        ).length;
        const openRequests = requests.filter(r => (r.status ?? 'pending') === 'pending').length;
        const grossSalesSantim = orders.reduce((sum, o) => sum + Number(o.total_price ?? 0), 0);
        const grossSales = grossSalesSantim / 100;
        const grossSalesPrevious =
            prevOrders.reduce((sum, o) => sum + Number(o.total_price ?? 0), 0) / 100;
        const avgOrderValue = orders.length > 0 ? Math.round(grossSales / orders.length) : 0;
        const uniqueTablesToday = new Set(orders.map(o => o.table_number).filter(Boolean)).size;
        const hourlyRateConfig = await getHourlyRateConfig(supabase, restaurantId);
        const laborMetrics = calculateLaborMetricsFromTimeEntries({
            salesTotal: grossSales,
            timeEntries: timeEntries.map(entry => ({
                staff_id: entry.staff_id,
                clock_in_at: entry.clock_in_at,
                clock_out_at: entry.clock_out_at,
            })),
            staffRoles: Object.fromEntries(
                staff.map(member => [member.id, member.role ?? 'default'])
            ),
            hourlyRateConfig,
            tipAllocations,
            rangeEndAt: new Date().toISOString(),
        });

        let avgTicketMinutes = 0;
        if (completedOrders.length > 0) {
            const totalMinutes = completedOrders.reduce((sum, order) => {
                if (!order.created_at || !order.completed_at) {
                    return sum;
                }

                const created = new Date(order.created_at).getTime();
                const completed = new Date(order.completed_at).getTime();
                const diffMinutes = Math.max(0, Math.round((completed - created) / 60000));
                return sum + diffMinutes;
            }, 0);
            avgTicketMinutes = Math.round(totalMinutes / completedOrders.length);
        }

        const paymentSuccessRate =
            orders.length > 0 ? Math.round((completedOrders.length / orders.length) * 100) : 0;

        const attentionOrders: AttentionItem[] = orders
            .filter(o => isInFlightStatus(o.status))
            .slice(0, 10)
            .map(o => ({
                id: o.id,
                type: 'order',
                label: o.order_number || o.id,
                status: o.status ?? 'pending',
                created_at: o.created_at,
                table_number: o.table_number,
            }));

        const attentionRequests: AttentionItem[] = requests
            .filter(r => (r.status ?? 'pending') === 'pending')
            .slice(0, 10)
            .map(r => ({
                id: r.id,
                type: 'service_request',
                label: r.request_type,
                status: r.status ?? 'pending',
                created_at: r.created_at,
                table_number: r.table_number,
            }));

        const attentionAlerts: AttentionItem[] = alerts
            .filter(alert => (alert.status ?? 'open') !== 'resolved')
            .slice(0, 10)
            .map(alert => ({
                id: alert.id,
                type: 'alert',
                label: `${alert.entity_type} alert`,
                status: alert.status ?? 'open',
                severity: alert.severity ?? 'medium',
                created_at: alert.created_at,
                table_number: null,
            }));

        const attentionQueue = [...attentionAlerts, ...attentionRequests, ...attentionOrders].sort(
            (a, b) => {
                const priorityDiff = resolvePriority(b) - resolvePriority(a);
                if (priorityDiff !== 0) {
                    return priorityDiff;
                }
                const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
                const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
                return bTime - aTime;
            }
        );

        // Build chart data
        const chartPoints: Array<{ label: string; income: number; prevIncome: number }> = [];
        const daysToTrack = rangeParam === 'month' ? 30 : 7;
        const now = new Date();

        for (let i = daysToTrack - 1; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const label = d.toLocaleDateString('en-US', { weekday: 'short' });
            const dateStr = d.toISOString().split('T')[0];

            const dayIncome =
                orders
                    .filter(o => o.created_at?.startsWith(dateStr))
                    .reduce((sum, o) => sum + Number(o.total_price ?? 0), 0) / 100;

            const prevDate = new Date(
                d.getTime() -
                    (rangeParam === 'month' ? 30 : rangeParam === 'week' ? 7 : 1) *
                        24 *
                        60 *
                        60 *
                        1000
            );
            const prevDateStr = prevDate.toISOString().split('T')[0];
            const prevIncome =
                prevOrders
                    .filter(o => o.created_at?.startsWith(prevDateStr))
                    .reduce((sum, o) => sum + Number(o.total_price ?? 0), 0) / 100;

            chartPoints.push({
                label,
                income: Math.floor(dayIncome),
                prevIncome: Math.floor(prevIncome),
            });
        }

        responseStatus = 200;
        return apiSuccess(
            {
                restaurant_id: restaurantId,
                metrics: {
                    orders_in_flight: ordersInFlight,
                    avg_ticket_time_minutes: avgTicketMinutes,
                    active_tables: activeTables,
                    open_requests: openRequests,
                    payment_success_rate: paymentSuccessRate,
                    gross_sales_today: grossSales,
                    gross_sales_previous: grossSalesPrevious,
                    total_orders_today: orders.length,
                    avg_order_value_etb: avgOrderValue,
                    unique_tables_today: uniqueTablesToday,
                    labor_cost_percent: laborMetrics.laborCostPercent,
                    labor_cost_etb: laborMetrics.laborCost,
                    tips_distributed_today: laborMetrics.tipsDistributed,
                },
                attention_queue: attentionQueue,
                chart_data: chartPoints,
                alert_summary: {
                    open_alerts: alerts.length,
                },
                filters: {
                    range,
                    since: sinceIso,
                },
                sync_status: {
                    generated_at: new Date().toISOString(),
                    source: 'postgres',
                },
            },
            200,
            getCacheHeaders(CACHE_PRESETS.dashboard)
        );
    } catch (error) {
        responseStatus = 500;
        return apiError(
            'Internal server error',
            500,
            'INTERNAL_ERROR',
            error instanceof Error ? error.message : 'Unknown error'
        );
    } finally {
        if (supabaseForMetrics) {
            const durationMs = Date.now() - startedAt;
            await trackApiMetric(supabaseForMetrics, {
                restaurantId: restaurantIdForMetrics,
                endpoint: '/api/merchant/command-center',
                method: 'GET',
                statusCode: responseStatus,
                durationMs,
            });
        }
    }
}
