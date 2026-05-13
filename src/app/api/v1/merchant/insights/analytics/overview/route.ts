import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import {
    getAnalyticsOverview,
    getRangeStart,
    type AnalyticsRange,
} from '@/lib/services/timescaleAnalyticsService';
import { getCacheHeaders, CACHE_PRESETS } from '@/lib/api/cache';

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
    const rangeParam = (url.searchParams.get('range') as AnalyticsRange) || 'today';
    const since = getRangeStart(rangeParam);

    // Calculate previous period start
    const sinceDate = new Date(since);
    const prevDate = new Date(sinceDate);
    if (rangeParam === 'week') prevDate.setDate(prevDate.getDate() - 7);
    else if (rangeParam === 'month') prevDate.setMonth(prevDate.getMonth() - 1);
    else if (rangeParam === 'year') prevDate.setFullYear(prevDate.getFullYear() - 1);
    else prevDate.setDate(prevDate.getDate() - 1); // Default is today (1 day)

    const prevSince = prevDate.toISOString();

    // Try to get TimescaleDB analytics first (faster for large datasets)
    let timeseriesMetrics: Awaited<ReturnType<typeof getAnalyticsOverview>> | null = null;
    try {
        timeseriesMetrics = await getAnalyticsOverview(
            context.supabase,
            context.restaurantId,
            rangeParam
        );
    } catch (error) {
        console.warn('[analytics/overview] TimescaleDB not available, using direct queries', error);
    }

    // If TimescaleDB has data, use it; otherwise fall back to direct queries
    const useTimeseries = timeseriesMetrics && timeseriesMetrics.total_orders > 0;

    const [ordersRes, prevOrdersRes, requestsRes, tablesRes, reviewsRes] = await Promise.all([
        // Only fetch orders if not using timeseries
        useTimeseries
            ? Promise.resolve({ data: [], error: null })
            : context.supabase
                  .from('orders')
                  .select('id, status, total_price, created_at, order_items(name, quantity, price)')
                  .eq('restaurant_id', context.restaurantId)
                  .gte('created_at', since),
        useTimeseries
            ? Promise.resolve({ count: timeseriesMetrics?.previous_completed_orders || 0 })
            : context.supabase
                  .from('orders')
                  .select('id', { count: 'exact', head: true })
                  .eq('restaurant_id', context.restaurantId)
                  .in('status', ['served', 'completed'])
                  .gte('created_at', prevSince)
                  .lt('created_at', since),
        context.supabase
            .from('service_requests')
            .select('id, status, created_at')
            .eq('restaurant_id', context.restaurantId)
            .gte('created_at', since),
        context.supabase
            .from('tables')
            .select('id, status, is_active')
            .eq('restaurant_id', context.restaurantId),
        context.supabase
            .from('reviews')
            .select('rating, created_at')
            .eq('restaurant_id', context.restaurantId),
    ]);

    if (ordersRes.error) {
        return apiError(
            'Failed to fetch analytics orders data',
            500,
            'ANALYTICS_ORDERS_FETCH_FAILED',
            ordersRes.error.message
        );
    }
    if (requestsRes.error) {
        return apiError(
            'Failed to fetch analytics requests data',
            500,
            'ANALYTICS_REQUESTS_FETCH_FAILED',
            requestsRes.error.message
        );
    }
    if (tablesRes.error) {
        return apiError(
            'Failed to fetch analytics tables data',
            500,
            'ANALYTICS_TABLES_FETCH_FAILED',
            tablesRes.error.message
        );
    }
    // review fetch failure is non-critical, we can default to 0

    const orders = ordersRes.data ?? [];
    const requests = requestsRes.data ?? [];
    const tables = tablesRes.data ?? [];
    const reviews = reviewsRes.data ?? [];

    // total_price is stored in santim — divide by 100 to get ETB
    const totalRevenue =
        orders.reduce((sum, order) => sum + Number(order.total_price ?? 0), 0) / 100;
    const totalOrders = orders.length;
    const completedOrders = orders.filter(order =>
        ['served', 'completed'].includes(order.status ?? '')
    ).length;
    const previousCompletedOrders = prevOrdersRes.count ?? 0;

    const pendingOrders = orders.filter(order =>
        ['pending', 'acknowledged', 'preparing', 'ready'].includes(order.status ?? '')
    ).length;
    const openRequests = requests.filter(r => (r.status ?? 'pending') === 'pending').length;

    // Table Metrics
    const activeTables = tables.filter(
        t => t.is_active !== false && t.status !== 'available'
    ).length;
    const totalTables = tables.length;

    // Review Metrics
    const totalReviews = reviews.length;
    const avgRating =
        totalReviews > 0
            ? Number(
                  (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / totalReviews).toFixed(1)
              )
            : 0;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const reviewsThisWeek = reviews.filter(
        r => r.created_at && new Date(r.created_at) > oneWeekAgo
    ).length;

    // Calculate Top Selling Items
    const itemSales: Record<string, { count: number; revenue: number }> = {};
    orders.forEach(order => {
        const items = order.order_items || [];
        items.forEach((item: { name: string; quantity: number | null; price: number }) => {
            const name = item.name || 'Unknown Item';
            const qty = item.quantity || 1;
            const price = item.price || 0;

            if (!itemSales[name]) {
                itemSales[name] = { count: 0, revenue: 0 };
            }
            itemSales[name].count += qty;
            itemSales[name].revenue += (price / 100) * qty;
        });
    });

    const topItems = Object.entries(itemSales)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // Calculate Trends (buckets)
    const trendBuckets: Record<string, { revenue: number; orders: number }> = {};
    const now = new Date();
    const isToday = !url.searchParams.get('range') || url.searchParams.get('range') === 'today';

    // Initialize buckets
    for (let i = 0; i < (isToday ? 24 : 7); i++) {
        const key = isToday
            ? i.toString().padStart(2, '0') + ':00'
            : new Date(now.getTime() - (6 - i) * 86400000).toLocaleDateString('en-US', {
                  weekday: 'short',
              });
        trendBuckets[key] = { revenue: 0, orders: 0 };
    }

    orders.forEach(order => {
        if (!order.created_at) return;
        const date = new Date(order.created_at);
        let key = '';

        if (isToday) {
            key = date.getHours().toString().padStart(2, '0') + ':00';
        } else {
            key = date.toLocaleDateString('en-US', { weekday: 'short' });
        }

        if (trendBuckets[key]) {
            trendBuckets[key].revenue += Number(order.total_price ?? 0) / 100;
            trendBuckets[key].orders += 1;
        }
    });

    const trends = Object.entries(trendBuckets).map(([label, data]) => ({
        label,
        ...data,
    }));

    return apiSuccess(
        {
            range_start: since,
            metrics: {
                total_revenue: totalRevenue,
                total_orders: totalOrders,
                completed_orders: completedOrders,
                previous_completed_orders: previousCompletedOrders,
                pending_orders: pendingOrders,
                open_requests: openRequests,
                active_tables: activeTables,
                total_tables: totalTables,
                conversion_rate:
                    totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0,
                avg_order_value: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
                avg_rating: avgRating,
                total_reviews: totalReviews,
                reviews_this_week: reviewsThisWeek,
                top_items: topItems,
                trends: trends,
            },
        },
        200,
        getCacheHeaders(CACHE_PRESETS.analytics)
    );
}
