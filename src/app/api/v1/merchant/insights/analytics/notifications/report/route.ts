/**
 * Notification Delivery Report API
 *
 * Provides detailed delivery reports with date range filtering:
 * - GET /api/analytics/notifications/report - Get delivery report
 *
 * Requires authentication and restaurant context.
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { getDeliveryReport, type DateRange } from '@/lib/monitoring/notification-metrics';

/**
 * Range options for date filtering
 */
type RangeOption = 'today' | 'week' | 'month' | 'custom';

/**
 * Parse date range from query parameters
 */
function getDateRange(url: URL): DateRange {
    const range = url.searchParams.get('range') as RangeOption | null;
    const now = new Date();
    let endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    let startDate: Date;

    switch (range) {
        case 'today':
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
            break;

        case 'week':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            break;

        case 'month':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 30);
            break;

        case 'custom':
            // Parse custom date range
            const startParam = url.searchParams.get('startDate');
            const endParam = url.searchParams.get('endDate');

            if (startParam && endParam) {
                startDate = new Date(startParam);
                endDate = new Date(endParam);
            } else {
                // Default to week if custom is specified but dates are missing
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 7);
            }
            break;

        default:
            // Default to week
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
    }

    return { startDate, endDate };
}

/**
 * GET /api/analytics/notifications/report
 *
 * Get delivery report for the authenticated restaurant with date range filtering.
 *
 * Query params:
 * - range: 'today' | 'week' | 'month' | 'custom' (default: 'week')
 * - startDate: ISO date string (required if range=custom)
 * - endDate: ISO date string (required if range=custom)
 */
export async function GET(request: Request) {
    // Authenticate user
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    // Get restaurant context (required for delivery reports)
    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const { restaurantId } = context;
    const url = new URL(request.url);
    const range = url.searchParams.get('range') as RangeOption | null;

    try {
        // Get date range
        const dateRange = getDateRange(url);

        // Get delivery report
        const report = await getDeliveryReport(restaurantId, dateRange);

        return NextResponse.json({
            success: true,
            data: report,
            meta: {
                restaurantId,
                range: range || 'week',
                startDate: dateRange.startDate.toISOString(),
                endDate: dateRange.endDate.toISOString(),
                generatedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('[analytics/notifications/report] Error fetching delivery report:', error);

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'DELIVERY_REPORT_ERROR',
                    message: 'Failed to fetch delivery report',
                    details: error instanceof Error ? error.message : undefined,
                },
            },
            { status: 500 }
        );
    }
}
