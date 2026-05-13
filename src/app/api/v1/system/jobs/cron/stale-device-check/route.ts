/**
 * Stale Device Check Cron Job
 *
 * CRIT-05: Scheduled job to detect and alert on stale devices
 *
 * This endpoint should be called by a cron scheduler every 5-10 minutes.
 * It checks for devices that haven't synced within the configured threshold
 * and sends alerts to the operations team.
 *
 * @see docs/implementation/CRITICAL_IMPLEMENTATION_STRATEGY.md - CRIT-05
 */

import { NextRequest, NextResponse } from 'next/server';
import { runStaleDeviceDetection, StaleDeviceConfig } from '@/lib/sync/stale-device-monitor';
import { sendInfoAlert } from '@/lib/monitoring/alerts';

/**
 * Cron secret validation
 */
function validateCronSecret(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
        console.warn('[stale-device-check] CRON_SECRET not configured');
        return false;
    }

    return authHeader === `Bearer ${cronSecret}`;
}

/**
 * POST /api/jobs/cron/stale-device-check
 *
 * Runs stale device detection and sends alerts.
 * Should be called by Vercel Cron or external scheduler.
 *
 * Headers:
 * - Authorization: Bearer <CRON_SECRET>
 *
 * Query params:
 * - warning_threshold: Minutes before warning alert (default: 30)
 * - critical_threshold: Minutes before critical alert (default: 60)
 * - business_hours_only: Only alert during business hours (default: true)
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
        const config: StaleDeviceConfig = {
            warningThresholdMinutes: parseInt(searchParams.get('warning_threshold') || '30', 10),
            criticalThresholdMinutes: parseInt(searchParams.get('critical_threshold') || '60', 10),
            businessHoursOnly: searchParams.get('business_hours_only') !== 'false',
            maxDevicesPerRun: 100,
        };

        console.warn('[stale-device-check] Starting detection with config:', {
            warningThreshold: config.warningThresholdMinutes,
            criticalThreshold: config.criticalThresholdMinutes,
            businessHoursOnly: config.businessHoursOnly,
        });

        // Run detection
        const result = await runStaleDeviceDetection(config);

        const duration = Date.now() - startTime;

        // Log summary
        console.warn('[stale-device-check] Detection complete:', {
            duration: `${duration}ms`,
            checked: result.checked,
            warning: result.warningDevices.length,
            critical: result.criticalDevices.length,
            alertsSent: result.alertsSent,
            errors: result.errors.length,
        });

        // Send summary alert if there were critical devices
        if (result.criticalDevices.length > 0) {
            await sendInfoAlert('Stale device check completed', {
                critical_devices: result.criticalDevices.length,
                warning_devices: result.warningDevices.length,
                alerts_sent: result.alertsSent,
                duration_ms: duration,
            });
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            duration_ms: duration,
            summary: {
                checked: result.checked,
                warning_devices: result.warningDevices.length,
                critical_devices: result.criticalDevices.length,
                alerts_sent: result.alertsSent,
            },
            errors: result.errors.length > 0 ? result.errors : undefined,
        });
    } catch (error) {
        console.error('[stale-device-check] Error:', error);

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
 * GET /api/jobs/cron/stale-device-check
 *
 * Health check endpoint for the cron job.
 */
export async function GET(_request: NextRequest) {
    // Allow GET for health checks without auth
    return NextResponse.json({
        status: 'healthy',
        endpoint: 'stale-device-check',
        timestamp: new Date().toISOString(),
    });
}
