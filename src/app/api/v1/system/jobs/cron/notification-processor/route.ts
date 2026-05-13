/**
 * Notification Processor Cron Job
 *
 * CRIT-11: Queue-based notification processor via event bus
 *
 * This endpoint should be called by a cron scheduler every minute.
 * It processes pending notifications from the queue and cleans up old processed notifications.
 *
 * @see docs/implementation/CRITICAL_IMPLEMENTATION_STRATEGY.md - CRIT-11
 */

import { NextRequest, NextResponse } from 'next/server';
import { processQueue, getQueueStats, type ProcessResult } from '@/lib/notifications/queue';
import { clearOldEntries } from '@/lib/notifications/deduplication';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Cron secret validation
 */
function validateCronSecret(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
        console.warn('[notification-processor] CRON_SECRET not configured');
        return false;
    }

    return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Clean up old processed notifications
 */
async function cleanupOldNotifications(olderThanDays: number = 7): Promise<number> {
    const supabase = createServiceRoleClient();
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

    // Delete old sent/cancelled notifications
    const { data, error } = await supabase
        .from('notification_queue')
        .delete()
        .in('status', ['sent', 'cancelled'])
        .lt('created_at', cutoffDate);

    if (error) {
        console.error('[notification-processor] Failed to cleanup old notifications:', error);
        return 0;
    }

    return Array.isArray(data) ? (data as unknown[]).length : 0;
}

/**
 * POST /api/jobs/cron/notification-processor
 *
 * Processes pending notifications and cleans up old records.
 * Should be called by Vercel Cron or external scheduler every minute.
 *
 * Headers:
 * - Authorization: Bearer <CRON_SECRET>
 *
 * Query params:
 * - limit: Max notifications to process (default: 50)
 * - cleanup_days: Days to keep sent/cancelled notifications (default: 7)
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now();

    // Validate cron secret
    if (!validateCronSecret(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Parse optional config from query params
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const cleanupDays = parseInt(searchParams.get('cleanup_days') || '7', 10);

        console.warn('[notification-processor] Starting notification processing:', {
            limit,
            cleanupDays,
        });

        // Get queue stats before processing
        const statsBefore = await getQueueStats();

        // Process pending notifications
        const processResult: ProcessResult = await processQueue(limit);

        // Get queue stats after processing
        const statsAfter = await getQueueStats();

        // Clean up old notifications
        const cleanedUp = await cleanupOldNotifications(cleanupDays);

        // Clear old deduplication entries
        const dedupCleared = await clearOldEntries(cleanupDays * 24);

        const duration = Date.now() - startTime;

        // Log summary
        console.warn('[notification-processor] Processing complete:', {
            duration: `${duration}ms`,
            processed: processResult.processed,
            sent: processResult.sent,
            failed: processResult.failed,
            retried: processResult.retried,
            cleanedUp,
            dedupCleared,
            statsBefore,
            statsAfter,
        });

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            duration_ms: duration,
            processing: {
                processed: processResult.processed,
                sent: processResult.sent,
                failed: processResult.failed,
                retried: processResult.retried,
                errors: processResult.errors.length > 0 ? processResult.errors : undefined,
            },
            cleanup: {
                notifications_deleted: cleanedUp,
                dedup_entries_cleared: dedupCleared,
            },
            queue_stats: {
                before: statsBefore,
                after: statsAfter,
            },
        });
    } catch (error) {
        console.error('[notification-processor] Error:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/jobs/cron/notification-processor
 *
 * Health check endpoint for the cron job.
 * Returns queue statistics.
 */
export async function GET(_request: NextRequest) {
    try {
        // Get queue stats
        const stats = await getQueueStats();

        return NextResponse.json({
            status: 'healthy',
            endpoint: 'notification-processor',
            timestamp: new Date().toISOString(),
            queue_stats: stats,
        });
    } catch (error) {
        return NextResponse.json(
            {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}
