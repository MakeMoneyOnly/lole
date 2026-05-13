/**
 * POST /api/jobs/cron/eod-report
 *
 * Cron job handler for End-of-Day report generation.
 * Generates daily summary reports for each restaurant including:
 * - Total sales
 * - Order counts by status
 * - Payment method breakdown
 * - Top selling items
 * - VAT summary for ERCA compliance
 *
 * This is scheduled via QStash CRON to run daily at midnight or
 * can be triggered manually.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const EODReportJobSchema = z.object({
    restaurant_id: z.string().uuid().optional(),
    report_date: z.string().optional(), // YYYY-MM-DD format
    trigger: z.enum(['cron', 'manual']).default('cron'),
});

function isAuthorized(request: NextRequest): boolean {
    const configuredKey = process.env.QSTASH_TOKEN;
    if (!configuredKey) {
        return process.env.NODE_ENV !== 'production';
    }
    return request.headers.get('x-lole-job-key') === configuredKey;
}

interface EODReportData {
    reportDate: string;
    restaurantId: string;
    restaurantName: string;
    generatedAt: string;
    summary: {
        totalOrders: number;
        completedOrders: number;
        cancelledOrders: number;
        totalRevenue: number;
        totalVat: number;
        totalDiscount: number;
        averageOrderValue: number;
    };
    ordersByStatus: Record<string, number>;
    ordersByPaymentMethod: Record<
        string,
        {
            count: number;
            total: number;
        }
    >;
    topSellingItems: Array<{
        itemId: string;
        name: string;
        quantity: number;
        revenue: number;
    }>;
    paymentBreakdown: Array<{
        method: string;
        count: number;
        amount: number;
        percentage: number;
    }>;
    hourlyDistribution: Record<string, number>;
}

/**
 * Generate EOD report data for a restaurant
 */
async function generateEODReport(
    restaurantId: string,
    reportDate: string
): Promise<EODReportData | { error: string }> {
    const admin = createServiceRoleClient();

    // Get restaurant info
    const { data: restaurant, error: restaurantError } = await admin
        .from('restaurants')
        .select('name, name_am')
        .eq('id', restaurantId)
        .maybeSingle();

    if (restaurantError || !restaurant) {
        return { error: restaurantError?.message || 'Restaurant not found' };
    }

    // Calculate date range for the report
    const startOfDay = `${reportDate}T00:00:00.000Z`;
    const endOfDay = `${reportDate}T23:59:59.999Z`;

    // Get orders for the day
    const { data: orders, error: ordersError } = await admin
        .from('orders')
        .select(
            `
            id,
            status,
            total_price,
            discount_amount,
            created_at,
            payment_method
        `
        )
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);

    if (ordersError) {
        return { error: ordersError.message };
    }

    const completedOrders = orders?.filter(o => o.status === 'completed') || [];
    const cancelledOrders = orders?.filter(o => o.status === 'cancelled') || [];

    // Calculate summary
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
    const totalVat = Math.round(totalRevenue * 0.15); // Ethiopia VAT rate
    const totalDiscount = completedOrders.reduce(
        (sum, o) => sum + (Number(o.discount_amount) || 0),
        0
    );
    const averageOrderValue =
        completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

    // Orders by status
    const ordersByStatus: Record<string, number> = {};
    orders?.forEach(order => {
        const status = order.status || 'unknown';
        ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
    });

    // Orders by payment method
    const ordersByPaymentMethod: Record<string, { count: number; total: number }> = {};
    completedOrders.forEach(order => {
        const method = order.payment_method || 'unknown';
        if (!ordersByPaymentMethod[method]) {
            ordersByPaymentMethod[method] = { count: 0, total: 0 };
        }
        ordersByPaymentMethod[method].count++;
        ordersByPaymentMethod[method].total += Number(order.total_price) || 0;
    });

    // Get top selling items from order_items
    const orderIds = completedOrders.map(o => o.id);
    let topSellingItems: Array<{
        itemId: string;
        name: string;
        quantity: number;
        revenue: number;
    }> = [];

    if (orderIds.length > 0) {
        const { data: items, error: itemsError } = await admin
            .from('order_items')
            .select('menu_item_id, name, quantity, unit_price')
            .in('order_id', orderIds);

        if (!itemsError && items) {
            const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
            items.forEach(item => {
                const key = item.menu_item_id || 'unknown';
                if (!itemMap[key]) {
                    itemMap[key] = { name: item.name || 'Unknown', quantity: 0, revenue: 0 };
                }
                const qty = Number(item.quantity) || 1;
                const price = Number(item.unit_price) || 0;
                itemMap[key].quantity += qty;
                itemMap[key].revenue += qty * price;
            });

            topSellingItems = Object.entries(itemMap)
                .map(([itemId, data]) => ({ itemId, ...data }))
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10);
        }
    }

    // Payment breakdown
    const paymentBreakdown = Object.entries(ordersByPaymentMethod).map(([method, data]) => ({
        method,
        count: data.count,
        amount: data.total,
        percentage: totalRevenue > 0 ? (data.total / totalRevenue) * 100 : 0,
    }));

    // Hourly distribution
    const hourlyDistribution: Record<string, number> = {};
    completedOrders.forEach(order => {
        const hour = new Date(order.created_at).getHours();
        const hourKey = `${String(hour).padStart(2, '0')}:00`;
        hourlyDistribution[hourKey] = (hourlyDistribution[hourKey] || 0) + 1;
    });

    return {
        reportDate,
        restaurantId,
        restaurantName: restaurant.name_am || restaurant.name,
        generatedAt: new Date().toISOString(),
        summary: {
            totalOrders: orders?.length || 0,
            completedOrders: completedOrders.length,
            cancelledOrders: cancelledOrders.length,
            totalRevenue,
            totalVat,
            totalDiscount,
            averageOrderValue,
        },
        ordersByStatus,
        ordersByPaymentMethod,
        topSellingItems,
        paymentBreakdown,
        hourlyDistribution,
    };
}

/**
 * Store EOD report in database
 */
async function storeEODReport(report: EODReportData): Promise<void> {
    const admin = createServiceRoleClient();

    await admin.from('eod_reports').upsert(
        {
            restaurant_id: report.restaurantId,
            report_date: report.reportDate,
            summary: report.summary,
            orders_by_status: report.ordersByStatus,
            orders_by_payment_method: report.ordersByPaymentMethod,
            top_selling_items: report.topSellingItems,
            payment_breakdown: report.paymentBreakdown,
            hourly_distribution: report.hourlyDistribution,
            generated_at: report.generatedAt,
        },
        { onConflict: 'restaurant_id,report_date' }
    );
}

/**
 * Get all restaurants for EOD report generation (admin only)
 */
async function getActiveRestaurants(): Promise<string[]> {
    const admin = createServiceRoleClient();

    const { data, error } = await admin.from('restaurants').select('id').eq('status', 'active');

    if (error) {
        console.error('[EOD] Failed to fetch restaurants:', error);
        return [];
    }

    return data?.map(r => r.id) || [];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isAuthorized(request)) {
        return NextResponse.json(
            {
                error: {
                    code: 'UNAUTHORIZED_JOB',
                    message: 'Job request is not authorized',
                },
            },
            { status: 401 }
        );
    }

    const body = await request.json().catch(() => null);
    const parsed = EODReportJobSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            {
                error: {
                    code: 'INVALID_JOB_PAYLOAD',
                    message: 'Invalid EOD report payload',
                    details: parsed.error.flatten(),
                },
            },
            { status: 400 }
        );
    }

    const { restaurant_id, report_date, trigger } = parsed.data;
    const targetDate = report_date || new Date(Date.now() - 86400000).toISOString().split('T')[0]; // Yesterday by default

    const results: Array<{
        restaurantId: string;
        status: 'success' | 'failed';
        error?: string;
    }> = [];

    let targetRestaurants: string[] = [];

    if (restaurant_id) {
        targetRestaurants = [restaurant_id];
    } else if (trigger === 'cron') {
        // For cron, generate reports for all active restaurants
        targetRestaurants = await getActiveRestaurants();
    }

    for (const rid of targetRestaurants) {
        try {
            const reportResult = await generateEODReport(rid, targetDate);

            if ('error' in reportResult) {
                results.push({
                    restaurantId: rid,
                    status: 'failed',
                    error: reportResult.error,
                });
            } else {
                await storeEODReport(reportResult);
                results.push({
                    restaurantId: rid,
                    status: 'success',
                });
            }
        } catch (error) {
            results.push({
                restaurantId: rid,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    const successCount = results.filter(r => r.status === 'success').length;

    return NextResponse.json({
        data: {
            report_date: targetDate,
            trigger,
            total_restaurants: targetRestaurants.length,
            success_count: successCount,
            failed_count: results.length - successCount,
            results,
        },
    });
}
