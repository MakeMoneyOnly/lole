/**
 * TimescaleDB Analytics Service
 *
 * Provides optimized analytics queries using TimescaleDB hypertables
 * and continuous aggregates for better performance at scale.
 *
 * Key features:
 * - Pre-computed hourly/daily aggregates
 * - Compression for older data
 * - Automatic data retention
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const log = logger.child('timescaleAnalytics');

/**
 * Time range options for analytics queries
 */
export type AnalyticsRange = 'today' | 'week' | 'month' | 'year';

/**
 * Hourly sales data from TimescaleDB
 */
export interface HourlySalesData {
    hour: string;
    total_orders: number;
    completed_orders: number;
    total_revenue: number; // in santim
    avg_revenue: number;
}

/**
 * Daily sales data from TimescaleDB
 */
export interface DailySalesData {
    date: string;
    total_orders: number;
    completed_orders: number;
    total_revenue: number; // in santim
    total_discounts: number;
    total_tips: number;
    net_revenue: number;
    avg_order_value: number;
    payment_method_breakdown: Record<string, number>;
    hourly_distribution: Array<{ hour: number; orders: number; revenue: number }>;
    top_items: Array<{ name: string; quantity: number; revenue: number }>;
    orders_by_status: Record<string, number>;
}

/**
 * Analytics overview metrics
 */
export interface AnalyticsOverview {
    total_revenue: number; // in ETB
    total_orders: number;
    completed_orders: number;
    previous_completed_orders: number;
    pending_orders: number;
    open_requests: number;
    active_tables: number;
    total_tables: number;
    conversion_rate: number;
    avg_order_value: number;
    avg_rating: number;
    total_reviews: number;
    reviews_this_week: number;
    top_items: Array<{ name: string; count: number; revenue: number }>;
    trends: Array<{ label: string; revenue: number; orders: number }>;
}

/**
 * Get the start date for a given range
 */
export function getRangeStart(range: AnalyticsRange): Date {
    const now = new Date();
    const result = new Date(now);

    switch (range) {
        case 'today':
            result.setHours(0, 0, 0, 0);
            break;
        case 'week':
            result.setDate(now.getDate() - 7);
            break;
        case 'month':
            result.setMonth(now.getMonth() - 1);
            break;
        case 'year':
            result.setFullYear(now.getFullYear() - 1);
            break;
    }

    return result;
}

/**
 * Get the previous period start for comparison
 */
export function getPreviousRangeStart(range: AnalyticsRange): Date {
    const currentStart = getRangeStart(range);
    const result = new Date(currentStart);

    switch (range) {
        case 'today':
            result.setDate(result.getDate() - 1);
            break;
        case 'week':
            result.setDate(result.getDate() - 7);
            break;
        case 'month':
            result.setMonth(result.getMonth() - 1);
            break;
        case 'year':
            result.setFullYear(result.getFullYear() - 1);
            break;
    }

    return result;
}

/**
 * Fetch hourly sales data from TimescaleDB
 * Uses continuous aggregate for better performance
 */
export async function getHourlySalesData(
    supabase: SupabaseClient,
    restaurantId: string,
    range: AnalyticsRange
): Promise<HourlySalesData[]> {
    const startDate = getRangeStart(range);
    const _isToday = range === 'today';

    // Try to use continuous aggregate first (faster)
    const { data: aggData, error: aggError } = await supabase
        .from('hourly_sales_agg_30d')
        .select('hour, total_orders, completed_orders, total_revenue, avg_revenue')
        .eq('restaurant_id', restaurantId)
        .gte('hour', startDate.toISOString())
        .order('hour', { ascending: true });

    if (aggError) {
        log.warn('Continuous aggregate not available, falling back to hypertable', { error: aggError });

        // Fallback to hypertable
        const { data, error } = await supabase
            .from('hourly_sales')
            .select('hour_start, total_orders, completed_orders, total_revenue')
            .eq('restaurant_id', restaurantId)
            .gte('hour_start', startDate.toISOString())
            .order('hour_start', { ascending: true });

        if (error) throw error;

        return (data || []).map(row => ({
            hour: new Date(row.hour_start).getHours().toString().padStart(2, '0') + ':00',
            total_orders: row.total_orders || 0,
            completed_orders: row.completed_orders || 0,
            total_revenue: row.total_revenue || 0,
            avg_revenue: row.total_revenue / (row.total_orders || 1),
        }));
    }

    return (aggData || []).map(row => ({
        hour: new Date(row.hour).getHours().toString().padStart(2, '0') + ':00',
        total_orders: row.total_orders || 0,
        completed_orders: row.completed_orders || 0,
        total_revenue: row.total_revenue || 0,
        avg_revenue: row.avg_revenue || 0,
    }));
}

/**
 * Fetch daily sales data from TimescaleDB
 * Uses continuous aggregate for better performance
 */
export async function getDailySalesData(
    supabase: SupabaseClient,
    restaurantId: string,
    range: AnalyticsRange
): Promise<DailySalesData[]> {
    const startDate = getRangeStart(range);

    // Try to use continuous aggregate first (faster)
    const { data: aggData, error: aggError } = await supabase
        .from('daily_sales_agg_1y')
        .select(
            'date, total_orders, completed_orders, total_revenue, total_discounts, total_tips, net_revenue, avg_order_value'
        )
        .eq('restaurant_id', restaurantId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

    if (aggError) {
        log.warn('Continuous aggregate not available, falling back to hypertable', { error: aggError });

        // Fallback to hypertable
        // HIGH-013: Explicit column selection
        const { data, error } = await supabase
            .from('daily_sales')
            .select(
                'date, restaurant_id, total_orders, completed_orders, total_revenue, total_discounts, total_tips, net_revenue, avg_order_value, payment_method_breakdown, hourly_distribution, top_items, orders_by_status'
            )
            .eq('restaurant_id', restaurantId)
            .gte('date', startDate.toISOString().split('T')[0])
            .order('date', { ascending: true });

        if (error) throw error;

        return (data || []).map(row => ({
            date: row.date,
            total_orders: row.total_orders || 0,
            completed_orders: row.completed_orders || 0,
            total_revenue: row.total_revenue || 0,
            total_discounts: row.total_discounts || 0,
            total_tips: row.total_tips || 0,
            net_revenue: row.net_revenue || 0,
            avg_order_value: row.avg_order_value || 0,
            payment_method_breakdown: row.payment_method_breakdown || {},
            hourly_distribution: row.hourly_distribution || [],
            top_items: row.top_items || [],
            orders_by_status: row.orders_by_status || {},
        }));
    }

    return (aggData || []).map(row => ({
        date: row.date,
        total_orders: row.total_orders || 0,
        completed_orders: row.completed_orders || 0,
        total_revenue: row.total_revenue || 0,
        total_discounts: row.total_discounts || 0,
        total_tips: row.total_tips || 0,
        net_revenue: row.net_revenue || 0,
        avg_order_value: row.avg_order_value || 0,
        payment_method_breakdown: {},
        hourly_distribution: [],
        top_items: [],
        orders_by_status: {},
    }));
}

/**
 * Get analytics overview using TimescaleDB
 * Falls back to direct queries if TimescaleDB data not available
 */
export async function getAnalyticsOverview(
    supabase: SupabaseClient,
    restaurantId: string,
    range: AnalyticsRange
): Promise<AnalyticsOverview> {
    const _startDate = getRangeStart(range);
    const _prevStartDate = getPreviousRangeStart(range);
    const isToday = range === 'today';

    // Try to get data from TimescaleDB first
    let timeseriesData: DailySalesData[] = [];
    let useTimeseries = false;

    try {
        timeseriesData = await getDailySalesData(supabase, restaurantId, range);
        useTimeseries = timeseriesData.length > 0;
    } catch (error) {
        log.warn('TimescaleDB data not available, using direct queries', { error });
    }

    if (useTimeseries && timeseriesData.length > 0) {
        // Calculate metrics from timeseries data
        const totalRevenue = timeseriesData.reduce((sum, d) => sum + d.total_revenue, 0) / 100; // Convert to ETB
        const totalOrders = timeseriesData.reduce((sum, d) => sum + d.total_orders, 0);
        const completedOrders = timeseriesData.reduce((sum, d) => sum + d.completed_orders, 0);

        // Get previous period data
        let prevCompletedOrders = 0;
        try {
            const prevData = await getDailySalesData(supabase, restaurantId, range);
            prevCompletedOrders = prevData.reduce((sum, d) => sum + d.completed_orders, 0);
        } catch {
            // Ignore previous period errors
        }

        // Build trends
        const trends: Array<{ label: string; revenue: number; orders: number }> = [];

        if (isToday) {
            // Hourly trends for today
            for (let i = 0; i < 24; i++) {
                const hourData = timeseriesData.find(d => {
                    const hour = new Date(d.date).getHours();
                    return hour === i;
                });
                trends.push({
                    label: i.toString().padStart(2, '0') + ':00',
                    revenue: hourData ? hourData.total_revenue / 100 : 0,
                    orders: hourData ? hourData.total_orders : 0,
                });
            }
        } else {
            // Daily trends for week/month/year
            const now = new Date();
            for (let i = 0; i < (isToday ? 24 : 7); i++) {
                const date = new Date(now.getTime() - (6 - i) * 86400000);
                const dayData = timeseriesData.find(
                    d => d.date === date.toISOString().split('T')[0]
                );
                trends.push({
                    label: date.toLocaleDateString('en-US', { weekday: 'short' }),
                    revenue: dayData ? dayData.total_revenue / 100 : 0,
                    orders: dayData ? dayData.total_orders : 0,
                });
            }
        }

        // Get top items from the most recent day
        const latestDay = timeseriesData[timeseriesData.length - 1];
        const topItems =
            latestDay?.top_items?.slice(0, 5).map(item => ({
                name: item.name,
                count: item.quantity,
                revenue: item.revenue / 100,
            })) || [];

        return {
            total_revenue: totalRevenue,
            total_orders: totalOrders,
            completed_orders: completedOrders,
            previous_completed_orders: prevCompletedOrders,
            pending_orders: 0, // Would need real-time query
            open_requests: 0, // Would need real-time query
            active_tables: 0, // Would need real-time query
            total_tables: 0, // Would need real-time query
            conversion_rate:
                totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0,
            avg_order_value: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
            avg_rating: 0, // Would need real-time query
            total_reviews: 0, // Would need real-time query
            reviews_this_week: 0, // Would need real-time query
            top_items: topItems,
            trends: trends,
        };
    }

    // Fallback: Return empty overview - actual data will be fetched from orders table
    return {
        total_revenue: 0,
        total_orders: 0,
        completed_orders: 0,
        previous_completed_orders: 0,
        pending_orders: 0,
        open_requests: 0,
        active_tables: 0,
        total_tables: 0,
        conversion_rate: 0,
        avg_order_value: 0,
        avg_rating: 0,
        total_reviews: 0,
        reviews_this_week: 0,
        top_items: [],
        trends: [],
    };
}

/**
 * Populate hourly sales data for a specific hour
 * Called by cron job or trigger
 */
export async function populateHourlySales(restaurantId: string, hourStart: Date): Promise<void> {
    const admin = createServiceRoleClient();
    const hourEnd = new Date(hourStart.getTime() + 3600000); // +1 hour

    const { error } = await admin.rpc('populate_hourly_sales', {
        p_restaurant_id: restaurantId,
        p_hour_start: hourStart.toISOString(),
        p_hour_end: hourEnd.toISOString(),
    });

    if (error) {
        log.error('Failed to populate hourly sales', error);
        throw error;
    }
}

/**
 * Populate daily sales data for a specific date
 * Called by EOD report job
 */
export async function populateDailySales(restaurantId: string, date: string): Promise<void> {
    const admin = createServiceRoleClient();

    const { error } = await admin.rpc('populate_daily_sales', {
        p_restaurant_id: restaurantId,
        p_date: date,
    });

    if (error) {
        log.error('Failed to populate daily sales', error);
        throw error;
    }
}

/**
 * Get EOD report data from TimescaleDB
 */
export async function getEODReportFromTimescale(
    supabase: SupabaseClient,
    restaurantId: string,
    date: string
): Promise<DailySalesData | null> {
    // HIGH-013: Explicit column selection
    const { data, error } = await supabase
        .from('daily_sales')
        .select(
            'date, restaurant_id, total_orders, completed_orders, total_revenue, total_discounts, total_tips, net_revenue, avg_order_value, payment_method_breakdown, hourly_distribution, top_items, orders_by_status'
        )
        .eq('restaurant_id', restaurantId)
        .eq('date', date)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // No data for this date
            return null;
        }
        throw error;
    }

    return {
        date: data.date,
        total_orders: data.total_orders || 0,
        completed_orders: data.completed_orders || 0,
        total_revenue: data.total_revenue || 0,
        total_discounts: data.total_discounts || 0,
        total_tips: data.total_tips || 0,
        net_revenue: data.net_revenue || 0,
        avg_order_value: data.avg_order_value || 0,
        payment_method_breakdown: data.payment_method_breakdown || {},
        hourly_distribution: data.hourly_distribution || [],
        top_items: data.top_items || [],
        orders_by_status: data.orders_by_status || {},
    };
}
