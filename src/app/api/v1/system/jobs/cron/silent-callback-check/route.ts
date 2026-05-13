/**
 * Silent Callback Detection Cron Job
 *
 * CRIT-01: Scheduled job to detect payment sessions without callbacks
 * Should be called every 5 minutes by QStash or external scheduler (Vercel Cron)
 *
 * Endpoint: GET /api/jobs/cron/silent-callback-check
 * Authorization: Requires CRON_SECRET header
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    runSilentCallbackDetection,
    getWebhookHealthStats,
} from '@/lib/monitoring/payment-webhook-monitor';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest): Promise<NextResponse> {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');

    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
        return NextResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing cron secret' } },
            { status: 401 }
        );
    }

    try {
        // Run silent callback detection
        const detectionResult = await runSilentCallbackDetection();

        // Get webhook health stats
        const healthStats = await getWebhookHealthStats();

        const response = {
            timestamp: new Date().toISOString(),
            detection: detectionResult,
            health: healthStats,
        };

        // Log for observability
        if (detectionResult.alertsSent > 0) {
            console.warn('[silent-callback-check] Alerts sent:', {
                count: detectionResult.alertsSent,
                silentCallbacks: detectionResult.silentCallbacks.length,
            });
        } else {
            console.warn('[silent-callback-check] Check complete:', {
                pendingSessions: healthStats.pendingSessions,
                recentCallbacks: healthStats.recentCallbacks,
            });
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error('[silent-callback-check] Error:', error);
        return NextResponse.json(
            {
                error: {
                    code: 'CRON_ERROR',
                    message: 'Failed to run silent callback detection',
                    details: error instanceof Error ? error.message : 'Unknown error',
                },
            },
            { status: 500 }
        );
    }
}

// Also support POST for QStash calls
export async function POST(request: NextRequest): Promise<NextResponse> {
    return GET(request);
}
