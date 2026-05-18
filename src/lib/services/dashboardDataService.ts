/**
 * Dashboard Data Service
 *
 * Server-side data fetching service for dashboard pages.
 * This service provides initial data for Server Components,
 * eliminating the loading flash and improving TTI.
 *
 * Architecture:
 * - Called from Server Components for initial render
 * - Returns serializable data (no functions, no sensitive data)
 * - Uses existing API logic for consistency
 * - Supports caching strategies per data type
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

const log = logger.child('DashboardData');

// ============================================================================
// Types
// ============================================================================

export interface ChartPoint {
    label: string;
    income: number;
    previous: number;
}

export interface CommandCenterData {
    restaurant_id: string;
    metrics: {
        orders_in_flight: number;
        avg_ticket_time_minutes: number;
        active_tables: number;
        open_requests: number;
        payment_success_rate: number;
        gross_sales_today: number;
        gross_sales_previous: number;
        total_orders_today: number;
        avg_order_value_etb: number;
        unique_tables_today: number;
    };
    attention_queue: AttentionItem[];
    chart_data: ChartPoint[];
    alert_summary: {
        open_alerts: number;
    };
    filters: {
        range: string;
        since: string;
    };
    sync_status: {
        generated_at: string;
        source: string;
    };
}

export interface AttentionItem {
    id: string;
    type: 'order' | 'service_request' | 'alert';
    label: string;
    status: string;
    severity?: string | null;
    created_at: string | null;
    table_number: string | null;
}

export interface OrdersPageData {
    orders: OrderSummary[];
    service_requests: ServiceRequestSummary[];
    restaurant_id: string;
}

export interface OrderSummary {
    id: string;
    order_number: string | null;
    status: string | null;
    table_number: string | null;
    created_at: string | null;
    total_price: number | null;
    notes: string | null;
}

export interface ServiceRequestSummary {
    id: string;
    request_type: string;
    status: string | null;
    table_number: string | null;
    created_at: string | null;
    notes: string | null;
}

export interface TablesPageData {
    tables: TableSummary[];
    restaurant_id: string;
}

export interface TableSummary {
    id: string;
    table_number: string;
    status: string;
    capacity: number | null;
    is_active: boolean;
}

export interface AnalyticsPageData {
    summary: {
        total_revenue: number;
        total_orders: number;
        avg_order_value: number;
        peak_hour: number | null;
    };
    chart_data: {
        date: string;
        revenue: number;
        orders: number;
    }[];
    restaurant_id: string;
}

export interface MenuPageData {
    categories: CategoryWithItems[];
    restaurant_id: string;
}

export interface CategoryWithItems {
    id: string;
    name: string;
    name_am: string | null;
    section: string | null;
    order_index: number | null;
    items: MenuItemSummary[];
}

export interface MenuItemSummary {
    id: string;
    name: string;
    price: number | null;
    description: string | null;
    is_available: boolean | null;
    category_id: string;
    image_url?: string | null;
}

export interface GuestsPageData {
    guests: GuestSummary[];
    total_count: number;
    restaurant_id: string;
}

export interface GuestSummary {
    id: string;
    name: string | null;
    phone: string | null;
    language: string;
    tags: string[];
    is_vip: boolean;
    visit_count: number;
    lifetime_value: number;
    first_seen_at: string | null;
    last_seen_at: string | null;
}

export interface StaffPageData {
    staff: StaffMemberSummary[];
    devices: DeviceSummary[];
    restaurant_id: string;
}

export interface StaffMemberSummary {
    id: string;
    user_id: string;
    name: string | null;
    email: string | null;
    role: string | null;
    is_active: boolean;
    pin_code: string | null;
    assigned_zones: string[] | null;
}

export interface DeviceSummary {
    id: string;
    name: string;
    device_type: string;
    device_token: string | null;
    pairing_code: string | null;
    last_active_at: string | null;
    assigned_zones: string[] | null;
}

export interface ChannelsPageData {
    summary: {
        delivery_partners: number;
        connected_partners: number;
        degraded_partners: number;
        external_orders_24h: number;
        unacked_orders: number;
    };
    partners: ChannelPartner[];
    orders: ExternalOrderSummary[];
    settings: OnlineOrderingSettings;
    restaurant_id: string;
}

export interface ChannelPartner {
    id: string;
    provider: string;
    status: string;
    updated_at: string;
    last_sync_at: string | null;
}

export interface ExternalOrderSummary {
    id: string;
    provider: string;
    provider_order_id: string;
    normalized_status: string;
    total_amount: number;
    currency: string;
    acknowledged_at: string | null;
    created_at: string;
}

export interface OnlineOrderingSettings {
    enabled: boolean;
    accepts_scheduled_orders: boolean;
    auto_accept_orders: boolean;
    prep_time_minutes: number;
    max_daily_orders: number;
    service_hours: { start: string; end: string };
    order_throttling_enabled: boolean;
    throttle_limit_per_15m: number;
}
function isInFlightStatus(status: string | null | undefined): boolean {
    return ['pending', 'acknowledged', 'preparing', 'ready'].includes(status ?? '');
}

function resolveSince(range: string | null): { range: string; sinceIso: string } {
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
function resolvePriority(item: AttentionItem): number {
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

// ============================================================================
// Restaurant Context Resolution
// ============================================================================

/**
 * Resolves the restaurant ID for the current user.
 * Checks restaurant_staff first, then agency_users.
 */
export async function resolveRestaurantId(): Promise<string | null> {
    const supabase = await createClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return null;
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

    return restaurantId;
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

/**
 * Fetches command center data for the dashboard.
 * This is the main entry point for the merchant dashboard page.
 *
 * @param range - Time range filter ('today', 'week', 'month')
 * @returns Command center data or null if not authorized
 */
export async function getCommandCenterData(
    range: 'today' | 'week' | 'month' = 'today'
): Promise<CommandCenterData | null> {
    const supabase = await createClient();

    const restaurantId = await resolveRestaurantId();
    if (!restaurantId) {
        return null;
    }

    const { range: resolvedRange, sinceIso } = resolveSince(range);

    // Parallel data fetching for performance
    const [ordersRes, requestsRes, tablesRes, alertsRes, prevOrdersRes] = await Promise.all([
        supabase
            .from('orders')
            .select('id, order_number, status, table_number, created_at, completed_at, total_price')
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
        supabase.from('tables').select('id, status, is_active').eq('restaurant_id', restaurantId),
        supabase
            .from('alert_events')
            .select('id, entity_type, entity_id, status, severity, created_at, resolved_at')
            .eq('restaurant_id', restaurantId)
            .is('resolved_at', null)
            .gte('created_at', sinceIso)
            .order('created_at', { ascending: false })
            .limit(50),
        // Fetch previous period gross sales
        supabase
            .from('orders')
            .select('total_price, created_at')
            .eq('restaurant_id', restaurantId)
            .gte('created_at', resolvePreviousRange(range).sinceIso)
            .lt('created_at', resolvePreviousRange(range).untilIso),
    ]);

    // Handle errors gracefully - return partial data if possible
    const orders = ordersRes.data ?? [];
    const requests = requestsRes.data ?? [];
    const tables = tablesRes.data ?? [];
    const alerts = alertsRes.data ?? [];
    const previousOrders = prevOrdersRes.data ?? [];

    // Calculate metrics
    const ordersInFlight = orders.filter(o => isInFlightStatus(o.status)).length;
    const completedOrders = orders.filter(o => o.status === 'completed' || o.status === 'served');
    const activeTables = tables.filter(
        t => t.is_active !== false && t.status !== 'available'
    ).length;
    const openRequests = requests.filter(r => (r.status ?? 'pending') === 'pending').length;
    const grossSalesSantim = orders.reduce((sum, o) => sum + Number(o.total_price ?? 0), 0);
    const grossSales = grossSalesSantim / 100;
    const grossSalesPrevious =
        previousOrders.reduce(
            (sum: number, o: { total_price?: number | null }) => sum + Number(o.total_price ?? 0),
            0
        ) / 100;
    const avgOrderValue = orders.length > 0 ? Math.round(grossSales / orders.length) : 0;
    const uniqueTablesToday = new Set(orders.map(o => o.table_number).filter(Boolean)).size;

    // Calculate average ticket time
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

    // Build attention queue
    const attentionOrders: AttentionItem[] = orders
        .filter(o => isInFlightStatus(o.status))
        .slice(0, 10)
        .map(o => ({
            id: o.id,
            type: 'order' as const,
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
            type: 'service_request' as const,
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
            type: 'alert' as const,
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

    // Build chart data (last 7 days by default for 'today'/'week', last 30 for 'month')
    const chartPoints: ChartPoint[] = [];
    const daysToTrack = range === 'month' ? 30 : 7;
    const now = new Date();

    for (let i = daysToTrack - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const label = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = d.toISOString().split('T')[0];

        // Current period value for this day
        const dayIncome =
            orders
                .filter(o => o.created_at?.startsWith(dateStr))
                .reduce((sum, o) => sum + Number(o.total_price ?? 0), 0) / 100;

        // Previous period value for this equivalent day
        const prevDate = new Date(
            d.getTime() - (range === 'month' ? 30 : range === 'week' ? 7 : 1) * 24 * 60 * 60 * 1000
        );
        const prevDateStr = prevDate.toISOString().split('T')[0];
        const prevIncome =
            previousOrders
                .filter(o => o.created_at?.startsWith(prevDateStr))
                .reduce((sum, o) => sum + Number(o.total_price ?? 0), 0) / 100;

        chartPoints.push({
            label,
            income: Math.floor(dayIncome),
            previous: Math.floor(prevIncome),
        });
    }

    return {
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
        },
        attention_queue: attentionQueue,
        chart_data: chartPoints,
        alert_summary: {
            open_alerts: alerts.length,
        },
        filters: {
            range: resolvedRange,
            since: sinceIso,
        },
        sync_status: {
            generated_at: new Date().toISOString(),
            source: 'postgres',
        },
    };
}

/**
 * Fetches orders page data for initial render.
 * Supports filtering by status and search term.
 *
 * @param status - Filter by order status ('all' for no filter)
 * @param search - Search term for order number or table number
 * @param limit - Maximum number of orders to return
 */
export async function getOrdersPageData(
    status: string = 'all',
    search: string = '',
    limit: number = 100
): Promise<OrdersPageData | null> {
    const supabase = await createClient();

    const restaurantId = await resolveRestaurantId();
    if (!restaurantId) {
        return null;
    }

    // Build orders query
    let ordersQuery = supabase
        .from('orders')
        .select('id, order_number, status, table_number, created_at, total_price, notes')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (status !== 'all') {
        ordersQuery = ordersQuery.eq('status', status);
    }

    if (search.trim()) {
        ordersQuery = ordersQuery.or(
            `order_number.ilike.%${search}%,table_number.ilike.%${search}%`
        );
    }

    // Build service requests query
    let srQuery = supabase
        .from('service_requests')
        .select('id, request_type, status, table_number, created_at, notes')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (status !== 'all') {
        // Map filter status to service request status
        if (status === 'pending') {
            srQuery = srQuery.eq('status', 'pending');
        } else if (status === 'completed') {
            srQuery = srQuery.eq('status', 'completed');
        }
    }

    const [ordersRes, srRes] = await Promise.all([ordersQuery, srQuery]);

    return {
        orders: (ordersRes.data ?? []) as OrderSummary[],
        service_requests: (srRes.data ?? []) as ServiceRequestSummary[],
        restaurant_id: restaurantId,
    };
}

/**
 * Fetches tables page data for initial render.
 */
export async function getTablesPageData(): Promise<TablesPageData | null> {
    const supabase = await createClient();

    const restaurantId = await resolveRestaurantId();
    if (!restaurantId) {
        return null;
    }

    const { data, error } = await supabase
        .from('tables')
        .select('id, table_number, status, capacity, is_active')
        .eq('restaurant_id', restaurantId)
        .order('table_number', { ascending: true });

    if (error) {
        log.error('Failed to fetch tables', error);
        return {
            tables: [],
            restaurant_id: restaurantId,
        };
    }

    return {
        tables: (data ?? []) as TableSummary[],
        restaurant_id: restaurantId,
    };
}

/**
 * Fetches analytics page data for initial render.
 *
 * @param range - Time range ('today', 'week', 'month')
 */
export async function getAnalyticsPageData(
    range: 'today' | 'week' | 'month' = 'today'
): Promise<AnalyticsPageData | null> {
    const supabase = await createClient();

    const restaurantId = await resolveRestaurantId();
    if (!restaurantId) {
        return null;
    }

    const { sinceIso } = resolveSince(range);

    const { data: orders, error } = await supabase
        .from('orders')
        .select('total_price, created_at, status')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', sinceIso);

    if (error) {
        log.error('Failed to fetch analytics data', error);
        return {
            summary: {
                total_revenue: 0,
                total_orders: 0,
                avg_order_value: 0,
                peak_hour: null,
            },
            chart_data: [],
            restaurant_id: restaurantId,
        };
    }

    const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total_price ?? 0), 0) ?? 0;
    const totalOrders = orders?.length ?? 0;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Calculate peak hour
    const hourCounts: Record<number, number> = {};
    orders?.forEach(order => {
        if (order.created_at) {
            const hour = new Date(order.created_at).getHours();
            hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
        }
    });

    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    // Build chart data (daily aggregation)
    const dailyData: Record<string, { revenue: number; orders: number }> = {};
    orders?.forEach(order => {
        if (order.created_at) {
            const date = new Date(order.created_at).toISOString().split('T')[0];
            if (!dailyData[date]) {
                dailyData[date] = { revenue: 0, orders: 0 };
            }
            dailyData[date].revenue += Number(order.total_price ?? 0);
            dailyData[date].orders += 1;
        }
    });

    const chartData = Object.entries(dailyData)
        .map(([date, data]) => ({
            date,
            revenue: data.revenue,
            orders: data.orders,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return {
        summary: {
            total_revenue: totalRevenue,
            total_orders: totalOrders,
            avg_order_value: avgOrderValue,
            peak_hour: peakHour ? parseInt(peakHour) : null,
        },
        chart_data: chartData,
        restaurant_id: restaurantId,
    };
}

/**
 * Fetches menu page data for initial render.
 */
export async function getMenuPageData(): Promise<MenuPageData | null> {
    const supabase = await createClient();

    const restaurantId = await resolveRestaurantId();
    if (!restaurantId) {
        return null;
    }

    const { data, error } = await supabase
        .from('categories')
        .select(
            'id, name, order_index, items:menu_items(id, name, price, description, is_available, category_id)'
        )
        .eq('restaurant_id', restaurantId)
        .order('order_index');

    if (error) {
        log.error('Failed to fetch menu', error);
        return {
            categories: [],
            restaurant_id: restaurantId,
        };
    }

    return {
        categories: (data ?? []) as CategoryWithItems[],
        restaurant_id: restaurantId,
    };
}

/**
 * Fetches guests page data for initial render.
 *
 * @param limit - Maximum number of guests to return
 */
export async function getGuestsPageData(limit: number = 100): Promise<GuestsPageData | null> {
    const supabase = await createClient();

    const restaurantId = await resolveRestaurantId();
    if (!restaurantId) {
        return null;
    }

    const { data, error, count } = await supabase
        .from('guests')
        .select(
            'id, name, language, tags, is_vip, visit_count, lifetime_value, first_seen_at, last_seen_at',
            { count: 'exact' }
        )
        .eq('restaurant_id', restaurantId)
        .order('last_seen_at', { ascending: false })
        .limit(limit);

    if (error) {
        log.error('Failed to fetch guests', error);
        return {
            guests: [],
            total_count: 0,
            restaurant_id: restaurantId,
        };
    }

    return {
        guests: (data ?? []) as unknown as GuestSummary[],
        total_count: count ?? 0,
        restaurant_id: restaurantId,
    };
}

/**
 * Fetches staff page data for initial render.
 */
export async function getStaffPageData(): Promise<StaffPageData | null> {
    const supabase = await createClient();

    const restaurantId = await resolveRestaurantId();
    if (!restaurantId) {
        return null;
    }

    const [staffRes, devicesRes] = await Promise.all([
        supabase
            .from('restaurant_staff')
            .select('id, user_id, name, email, role, is_active, pin_code, assigned_zones')
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: true }),
        supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from('devices' as any)
            .select(
                'id, name, device_type, device_token, pairing_code, last_active_at, assigned_zones'
            )
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: true }),
    ]);

    return {
        staff: (staffRes.data ?? []) as unknown as StaffMemberSummary[],
        devices: (devicesRes.data ?? []) as unknown as DeviceSummary[],
        restaurant_id: restaurantId,
    };
}

/**
 * Fetches channels page data for initial render.
 */
export async function getChannelsPageData(): Promise<ChannelsPageData | null> {
    const supabase = await createClient();

    const restaurantId = await resolveRestaurantId();
    if (!restaurantId) {
        return null;
    }

    const [partnersRes, ordersRes, settingsRes] = await Promise.all([
        supabase
            .from('delivery_partners')
            .select('id, provider, status, updated_at, last_sync_at')
            .eq('restaurant_id', restaurantId),
        supabase
            .from('external_orders')
            .select(
                'id, provider, provider_order_id, normalized_status, total_amount, currency, acknowledged_at, created_at'
            )
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false })
            .limit(100),
        supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from('online_ordering_settings' as any)
            .select(
                'enabled, accepts_scheduled_orders, auto_accept_orders, prep_time_minutes, max_daily_orders, service_hours, order_throttling_enabled, throttle_limit_per_15m'
            )
            .eq('restaurant_id', restaurantId)
            .maybeSingle(),
    ]);

    const partners = (partnersRes.data ?? []) as ChannelPartner[];
    const orders = (ordersRes.data ?? []) as ExternalOrderSummary[];

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const externalOrders24h = orders.filter(o => o.created_at >= since24h).length;
    const unackedOrders = orders.filter(o => !o.acknowledged_at).length;

    const defaultSettings: OnlineOrderingSettings = {
        enabled: true,
        accepts_scheduled_orders: true,
        auto_accept_orders: false,
        prep_time_minutes: 30,
        max_daily_orders: 300,
        service_hours: { start: '08:00', end: '22:00' },
        order_throttling_enabled: false,
        throttle_limit_per_15m: 40,
    };

    const settingsData =
        settingsRes.data && typeof settingsRes.data === 'object'
            ? (settingsRes.data as Record<string, unknown>)
            : {};

    return {
        summary: {
            delivery_partners: partners.length,
            connected_partners: partners.filter(p => p.status === 'active').length,
            degraded_partners: partners.filter(p => p.status === 'degraded').length,
            external_orders_24h: externalOrders24h,
            unacked_orders: unackedOrders,
        },
        partners,
        orders,
        settings: { ...defaultSettings, ...settingsData } as OnlineOrderingSettings,
        restaurant_id: restaurantId,
    };
}
