/**
 * Notification Analytics API
 *
 * Provides endpoints for retrieving notification metrics and delivery reports:
 * - GET /api/analytics/notifications - Get current notification metrics
 * - GET /api/analytics/notifications/report - Get delivery report with date range
 *
 * Requires authentication and restaurant context.
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { getNotificationMetrics, type DateRange } from '@/lib/monitoring/notification-metrics';

/**
 * Range options for date filtering
 */
type RangeOption = 'today' | 'week' | 'month' | 'custom';

/**
 * Parse date range from query parameters
 */
function _getDateRange(url: URL): DateRange {
    const range = url.searchParams.get('range') as RangeOption | null;
    const now = new Date();
    const endDate = new Date(now);
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
                const customEndDate = new Date(endParam);
                customEndDate.setHours(23, 59, 59, 999);
                // Use the endDate object but modify it
                endDate.setTime(customEndDate.getTime());
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
 * GET /api/analytics/notifications
 *
 * Get current notification metrics for the authenticated restaurant.
 * Optionally includes global metrics if no restaurant context.
 *
 * Query params:
 * - range: 'today' | 'week' | 'month' (default: 'week')
 * - channel: 'sms' | 'push' | 'email' (optional filter)
 */
export async function GET(request: Request) {
    // Authenticate user
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    // Get restaurant context (optional - allows global metrics)
    const context = await getAuthorizedRestaurantContext(auth.user.id);
    const restaurantId = context.ok ? context.restaurantId : null;

    const url = new URL(request.url);
    const range = url.searchParams.get('range') as RangeOption | null;
    const channel = url.searchParams.get('channel');

    try {
        // Get metrics for the restaurant or global if no context
        const metrics = await getNotificationMetrics(restaurantId || undefined);

        // Filter by channel if requested
        let filteredMetrics = metrics;
        if (channel && ['sms', 'push', 'email'].includes(channel)) {
            const channelData = metrics.byChannel[channel as keyof typeof metrics.byChannel];
            const totalSent = channelData.sent;
            const totalFailed = channelData.failed;

            filteredMetrics = {
                totalSent,
                totalFailed,
                successRate:
                    totalSent + totalFailed > 0
                        ? Math.round((totalSent / (totalSent + totalFailed)) * 10000) / 100
                        : 0,
                avgLatencyMs: channelData.avgLatencyMs,
                byChannel: {
                    ...metrics.byChannel,
                    [channel]: channelData,
                },
            };
        }

        return NextResponse.json({
            success: true,
            data: filteredMetrics,
            meta: {
                restaurantId: restaurantId || null,
                range: range || 'week',
                channel: channel || 'all',
                generatedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error('[analytics/notifications] Error fetching metrics:', error);

        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'METRICS_FETCH_ERROR',
                    message: 'Failed to fetch notification metrics',
                    details: error instanceof Error ? error.message : undefined,
                },
            },
            { status: 500 }
        );
    }
}
