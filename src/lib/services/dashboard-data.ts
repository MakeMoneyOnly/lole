/**
 * Server-side data fetching utilities for dashboard pages.
 * These functions are designed to be called from Server Components.
 */

import { createClient } from '@/lib/supabase/server';
import {
    calculateLaborMetricsFromTimeEntries,
    getHourlyRateConfig,
} from '@/lib/services/laborReportsService';
import { logger } from '@/lib/logger';

const log = logger.child('Dashboard');

// ============================================================================
// Types
// ============================================================================

export interface CommandCenterMetrics {
    orders_in_flight: number;
    avg_ticket_time_minutes: number;
    active_tables: number;
    open_requests: number;
    payment_success_rate: number;
    gross_sales_today: number;
    total_orders_today: number;
    avg_order_value_etb: number;
    unique_tables_today: number;
    labor_cost_percent: number;
    labor_cost_etb: number;
    tips_distributed_today: number;
}

export interface AttentionItem {
    id: string;
    type: 'order' | 'request' | 'alert';
    label: string;
    status: string;
    severity: 'high' | 'medium' | 'low';
    table_number?: string | null;
    created_at?: string | null;
}

export interface CommandCenterData {
    metrics: CommandCenterMetrics;
    attention_queue: AttentionItem[];
    sync_status: {
        generated_at: string;
        source: 'live' | 'cached';
    };
}

export interface TableGridRow {
    id: string;
    table_number: string;
    status: 'available' | 'occupied' | 'reserved' | 'bill_requested';
    qr_code_url: string | null;
    active_order_id: string | null;
    zone: string | null;
    capacity: number;
}

export interface OccupancyTimelineBucket {
    label: string;
    opens: number;
    closes: number;
}

export interface TablesPageData {
    tables: TableGridRow[];
    zones: string[];
    timeline_buckets: OccupancyTimelineBucket[];
}

export interface OrdersPageData {
    orders: Array<{
        id: string;
        table_number: string | null;
        status: string;
        created_at: string;
        total_price: number;
        order_number: string | null;
        notes: string | null;
    }>;
    service_requests: Array<{
        id: string;
        table_number: string | null;
        status: string;
        created_at: string;
        request_type: string;
        notes: string | null;
    }>;
    staff: Array<{
        id: string;
        user_id: string;
        role: string | null;
        is_active: boolean;
    }>;
}

export interface AnalyticsMetrics {
    total_revenue: number;
    total_orders: number;
    completed_orders: number;
    pending_orders: number;
    open_requests: number;
    active_tables: number;
    total_tables: number;
    conversion_rate: number;
    avg_order_value: number;
    avg_rating: number;
    total_reviews: number;
    top_items: Array<{ name: string; count: number; revenue: number }>;
    reviews_this_week: number;
    trends: Array<{ label: string; revenue: number; orders: number }>;
    previous_completed_orders?: number;
}

export interface AnalyticsPageData {
    metrics: AnalyticsMetrics | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the current user's restaurant ID from the server context.
 */
async function getRestaurantId(): Promise<string | null> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: staff } = await supabase
        .from('restaurant_staff')
        .select('restaurant_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

    return staff?.restaurant_id ?? null;
}

/**
 * Calculate average ticket time in minutes from orders.
 */
function calculateAvgTicketTime(
    orders: Array<{ created_at: string | null; completed_at: string | null }>
): number {
    const completedOrders = orders.filter(o => o.created_at && o.completed_at);
    if (completedOrders.length === 0) return 0;

    const totalMinutes = completedOrders.reduce((sum, order) => {
        const created = new Date(order.created_at!).getTime();
        const completed = new Date(order.completed_at!).getTime();
        return sum + (completed - created) / (1000 * 60);
    }, 0);

    return Math.round(totalMinutes / completedOrders.length);
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

/**
 * Fetch command center data for the main dashboard.
 * This is the primary data fetching function for the merchant dashboard.
 */
export async function getCommandCenterData(
    range: 'today' | 'week' | 'month' = 'today'
): Promise<CommandCenterData | null> {
    const supabase = await createClient();
    const restaurantId = await getRestaurantId();

    if (!restaurantId) {
        return null;
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (range) {
        case 'week':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
            break;
        case 'month':
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        default:
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
    }

    try {
        // Fetch all required data in parallel
        const [
            ordersResult,
            activeOrdersResult,
            tablesResult,
            serviceRequestsResult,
            todayOrdersResult,
            staffResult,
            timeEntriesResult,
            tipAllocationsResult,
        ] = await Promise.all([
            // All orders in range for metrics
            supabase
                .from('orders')
                .select('id, total_price, created_at, status, completed_at')
                .eq('restaurant_id', restaurantId)
                .gte('created_at', startDate.toISOString()),

            // Orders in flight (pending/acknowledged/preparing)
            supabase
                .from('orders')
                .select('id, created_at, status, table_number, order_number')
                .eq('restaurant_id', restaurantId)
                .in('status', ['pending', 'acknowledged', 'preparing'])
                .order('created_at', { ascending: false })
                .limit(20),

            // All tables
            supabase.from('tables').select('id, status').eq('restaurant_id', restaurantId),

            // Open service requests
            supabase
                .from('service_requests')
                .select('id, request_type, status, table_number, created_at')
                .eq('restaurant_id', restaurantId)
                .in('status', ['pending', 'in_progress'])
                .order('created_at', { ascending: false })
                .limit(10),

            // Today's orders for gross sales
            supabase
                .from('orders')
                .select('id, total_price, table_number')
                .eq('restaurant_id', restaurantId)
                .gte('created_at', new Date(now.setHours(0, 0, 0, 0)).toISOString()),
            supabase
                .from('restaurant_staff')
                .select('id, role')
                .eq('restaurant_id', restaurantId)
                .eq('is_active', true),
            supabase
                .from('time_entries')
                .select('staff_id, clock_in_at, clock_out_at')
                .eq('restaurant_id', restaurantId)
                .gte('clock_in_at', startDate.toISOString()),
            supabase
                .from('tip_allocations')
                .select('total_tips_distributed')
                .eq('restaurant_id', restaurantId)
                .gte('period_date', startDate.toISOString().slice(0, 10)),
        ]);

        // Calculate metrics
        const orders = ordersResult.data ?? [];
        const activeOrders = activeOrdersResult.data ?? [];
        const tables = tablesResult.data ?? [];
        const serviceRequests = serviceRequestsResult.data ?? [];
        const todayOrders = todayOrdersResult.data ?? [];
        const staff = staffResult.data ?? [];
        const timeEntries = timeEntriesResult.data ?? [];
        const tipAllocations = tipAllocationsResult.data ?? [];

        const completedOrders = orders.filter((o: { status: string | null }) => o.status === 'completed');
        const grossSales = completedOrders.reduce((sum: number, o: { total_price?: number | null }) => sum + (o.total_price ?? 0), 0);
        const avgTicketTime = calculateAvgTicketTime(orders);
const activeTables = tables.filter((t: { status: string | null }) => t.status === 'occupied').length;
         const hourlyRateConfig = await getHourlyRateConfig(supabase, restaurantId);
         const laborMetrics = calculateLaborMetricsFromTimeEntries({
             salesTotal: grossSales,
             timeEntries: timeEntries.map((entry: { staff_id: string; clock_in_at: string | null; clock_out_at: string | null }) => ({
                 staff_id: entry.staff_id,
                 clock_in_at: entry.clock_in_at ?? '',
                 clock_out_at: entry.clock_out_at,
             })),
             staffRoles: Object.fromEntries(
                 staff.map((member: { id: string; role: string | null }) => [member.id, member.role ?? 'default'])
             ),
             hourlyRateConfig,
             tipAllocations,
             rangeEndAt: new Date().toISOString(),
         });

        // Calculate unique tables today
        const uniqueTablesToday = new Set(
            todayOrders.filter((o: { table_number: string | null }) => o.table_number).map((o: { table_number: string }) => o.table_number)
        ).size;

        // Calculate payment success rate (simplified - would need payment_sessions table)
        const paymentSuccessRate = 95; // Default placeholder

        // Build attention queue
        const attentionQueue: AttentionItem[] = [];

        // Add orders in flight to attention queue
        for (const order of activeOrders) {
            if (!order.created_at || !order.status) continue;

            const ageMinutes = Math.round(
                (Date.now() - new Date(order.created_at).getTime()) / (1000 * 60)
            );

            let severity: 'high' | 'medium' | 'low' = 'low';
            if (ageMinutes > 30) severity = 'high';
            else if (ageMinutes > 15) severity = 'medium';

            attentionQueue.push({
                id: order.id,
                type: 'order',
                label: order.order_number ?? `Order ${order.id.slice(0, 8)}`,
                status: order.status,
                severity,
                table_number: order.table_number,
                created_at: order.created_at,
            });
        }

        // Add service requests to attention queue
        for (const request of serviceRequests) {
            if (!request.status) continue;

            attentionQueue.push({
                id: request.id,
                type: 'request',
                label: `${request.request_type} - Table ${request.table_number ?? 'N/A'}`,
                status: request.status,
                severity: 'medium',
                table_number: request.table_number,
                created_at: request.created_at,
            });
        }

        const metrics: CommandCenterMetrics = {
            orders_in_flight: activeOrders.length,
            avg_ticket_time_minutes: avgTicketTime,
            active_tables: activeTables,
            open_requests: serviceRequests.length,
            payment_success_rate: paymentSuccessRate,
            gross_sales_today: grossSales,
            total_orders_today: orders.length,
            avg_order_value_etb: orders.length > 0 ? Math.round(grossSales / orders.length) : 0,
            unique_tables_today: uniqueTablesToday,
            labor_cost_percent: laborMetrics.laborCostPercent,
            labor_cost_etb: laborMetrics.laborCost,
            tips_distributed_today: laborMetrics.tipsDistributed,
        };

        return {
            metrics,
            attention_queue: attentionQueue,
            sync_status: {
                generated_at: new Date().toISOString(),
                source: 'live',
            },
        };
    } catch (error) {
        log.error('Error fetching command center data', error);
        return null;
    }
}

/**
 * Fetch tables page data including tables, zones, and occupancy timeline.
 */
export async function getTablesPageData(): Promise<TablesPageData | null> {
    const supabase = await createClient();
    const restaurantId = await getRestaurantId();

    if (!restaurantId) {
        return null;
    }

    try {
        // Fetch tables and sessions in parallel
        const [tablesResult, sessionsResult] = await Promise.all([
            supabase
                .from('tables')
                .select('id, table_number, status, qr_code_url, active_order_id, zone, capacity')
                .eq('restaurant_id', restaurantId)
                .order('table_number', { ascending: true }),

            supabase
                .from('table_sessions')
                .select('opened_at, closed_at')
                .eq('restaurant_id', restaurantId)
                .gte('opened_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
                .order('opened_at', { ascending: true })
                .limit(300),
        ]);

        const tables: TableGridRow[] = (tablesResult.data ?? []).map((table: { id: string; table_number: string | null; status: string | null; qr_code_url: string | null; active_order_id: string | null; zone: string | null; capacity: number | null }) => ({
            id: table.id,
            table_number: table.table_number ?? 'N/A',
            status: (table.status as TableGridRow['status']) ?? 'available',
            qr_code_url: table.qr_code_url,
            active_order_id: table.active_order_id,
            zone: table.zone,
            capacity: table.capacity ?? 4,
        }));

        const zones: string[] = Array.from(
            new Set(tables.map(t => t.zone).filter((z): z is string => !!z))
        );

        // Build occupancy timeline buckets
        const bucketsMap = new Map<string, { opens: number; closes: number }>();
        for (let i = 5; i >= 0; i -= 1) {
            const date = new Date(Date.now() - i * 2 * 60 * 60 * 1000);
            const label = `${date.getHours().toString().padStart(2, '0')}:00`;
            bucketsMap.set(label, { opens: 0, closes: 0 });
        }

        for (const row of sessionsResult.data ?? []) {
            const openedAt = row.opened_at ? new Date(row.opened_at) : null;
            const closedAt = row.closed_at ? new Date(row.closed_at) : null;

            if (openedAt) {
                const label = `${openedAt.getHours().toString().padStart(2, '0')}:00`;
                if (bucketsMap.has(label)) {
                    bucketsMap.get(label)!.opens += 1;
                }
            }
            if (closedAt) {
                const label = `${closedAt.getHours().toString().padStart(2, '0')}:00`;
                if (bucketsMap.has(label)) {
                    bucketsMap.get(label)!.closes += 1;
                }
            }
        }

        const timeline_buckets: OccupancyTimelineBucket[] = Array.from(bucketsMap.entries()).map(
            ([label, value]) => ({
                label,
                opens: value.opens,
                closes: value.closes,
            })
        );

        return {
            tables,
            zones,
            timeline_buckets,
        };
    } catch (error) {
        log.error('Error fetching tables page data', error);
        return null;
    }
}

/**
 * Fetch orders page data including orders, service requests, and staff.
 */
export async function getOrdersPageData(
    status?: string,
    _search?: string
): Promise<OrdersPageData | null> {
    const supabase = await createClient();
    const restaurantId = await getRestaurantId();

    if (!restaurantId) {
        return null;
    }

    try {
        // Build orders query
        let ordersQuery = supabase
            .from('orders')
            .select('id, table_number, status, created_at, total_price, order_number, notes')
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (status && status !== 'all') {
            ordersQuery = ordersQuery.eq('status', status);
        }

        // Build service requests query
        let serviceRequestsQuery = supabase
            .from('service_requests')
            .select('id, table_number, status, created_at, request_type, notes')
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (status && status !== 'all') {
            const serviceStatus =
                status === 'pending' ? 'pending' : status === 'completed' ? 'completed' : null;
            if (serviceStatus) {
                serviceRequestsQuery = serviceRequestsQuery.eq('status', serviceStatus);
            }
        }

        // Fetch staff
        const staffQuery = supabase
            .from('restaurant_staff')
            .select('id, user_id, role, is_active')
            .eq('restaurant_id', restaurantId)
            .eq('is_active', true);

        const [ordersResult, serviceRequestsResult, staffResult] = await Promise.all([
            ordersQuery,
            serviceRequestsQuery,
            staffQuery,
        ]);

        return {
            orders: (ordersResult.data ?? []).map((o: { id: string; table_number: string | null; status: string | null; created_at: string | null; total_price: number | null; order_number: string | null; notes: string | null }) => ({
                id: o.id,
                table_number: o.table_number ?? null,
                status: o.status ?? 'pending',
                created_at: o.created_at ?? new Date().toISOString(),
                total_price: o.total_price ?? 0,
                order_number: o.order_number ?? null,
                notes: o.notes ?? null,
            })),
            service_requests: (serviceRequestsResult.data ?? []).map((sr: { id: string; table_number: string | null; status: string | null; created_at: string | null; request_type: string; notes: string | null }) => ({
                id: sr.id,
                table_number: sr.table_number ?? null,
                status: sr.status ?? 'pending',
                created_at: sr.created_at ?? new Date().toISOString(),
                request_type: sr.request_type,
                notes: sr.notes ?? null,
            })),
            staff: (staffResult.data ?? []).map((s: { id: string; user_id: string | null; role: string | null; is_active: boolean | null }) => ({
                id: s.id,
                user_id: s.user_id ?? '',
                role: s.role ?? null,
                is_active: s.is_active ?? false,
            })),
        };
    } catch (error) {
        log.error('Error fetching orders page data', error);
        return null;
    }
}

/**
 * Fetch analytics page data.
 */
export async function getAnalyticsPageData(
    range: 'today' | 'week' | 'month' = 'week'
): Promise<AnalyticsPageData | null> {
    const supabase = await createClient();
    const restaurantId = await getRestaurantId();

    if (!restaurantId) {
        return null;
    }

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date | null = null;

    switch (range) {
        case 'week':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
            previousStartDate = new Date(startDate);
            previousStartDate.setDate(previousStartDate.getDate() - 7);
            break;
        case 'month':
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 1);
            previousStartDate = new Date(startDate);
            previousStartDate.setMonth(previousStartDate.getMonth() - 1);
            break;
        default:
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
    }

    try {
        const [ordersResult, tablesResult, reviewsResult] = await Promise.all([
            supabase
                .from('orders')
                .select('id, total_price, status, created_at')
                .eq('restaurant_id', restaurantId)
                .gte('created_at', startDate.toISOString()),

            supabase.from('tables').select('id, status').eq('restaurant_id', restaurantId),

            supabase
                .from('reviews')
                .select('id, rating, created_at')
                .eq('restaurant_id', restaurantId)
                .gte('created_at', startDate.toISOString()),
        ]);

        const orders = ordersResult.data ?? [];
        const tables = tablesResult.data ?? [];
        const reviews = reviewsResult.data ?? [];

const completedOrders = orders.filter((o: { status: string | null }) => o.status === 'completed');
         const totalRevenue = completedOrders.reduce((sum: number, o: { total_price?: number | null }) => sum + (o.total_price ?? 0), 0);
         const activeTables = tables.filter((t: { status: string | null }) => t.status === 'occupied').length;

        // Build trends data
        const trendsMap = new Map<string, { revenue: number; orders: number }>();
        for (const order of completedOrders) {
            if (!order.created_at) continue;

            const date = new Date(order.created_at);
            const label = date.toLocaleDateString('en-US', { weekday: 'short' });
            const existing = trendsMap.get(label) ?? { revenue: 0, orders: 0 };
            trendsMap.set(label, {
                revenue: existing.revenue + (order.total_price ?? 0),
                orders: existing.orders + 1,
            });
        }

        const avgRating =
            reviews.length > 0
                ? reviews.reduce((sum: number, r: { rating: number | null }) => sum + (r.rating ?? 0), 0) / reviews.length
                : 0;

        const metrics: AnalyticsMetrics = {
            total_revenue: totalRevenue,
            total_orders: orders.length,
            completed_orders: completedOrders.length,
            pending_orders: orders.filter((o: { status: string | null }) => o.status === 'pending').length,
            open_requests: 0, // Would need service_requests query
            active_tables: activeTables,
            total_tables: tables.length,
            conversion_rate:
                tables.length > 0 ? Math.round((activeTables / tables.length) * 100) : 0,
            avg_order_value: orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0,
            avg_rating: Math.round(avgRating * 10) / 10,
            total_reviews: reviews.length,
            top_items: [],
            reviews_this_week: reviews.length,
            trends: Array.from(trendsMap.entries()).map(([label, data]) => ({
                label,
                ...data,
            })),
        };

        return { metrics };
    } catch (error) {
        log.error('Error fetching analytics page data', error);
        return null;
    }
}

/**
 * Get restaurant name for the current user.
 */
export async function getRestaurantName(): Promise<string | null> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: staff } = await supabase
        .from('restaurant_staff')
        .select('restaurants(name)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

    return (staff?.restaurants as { name: string })?.name ?? null;
}
