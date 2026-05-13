/**
 * Test Alerts API Endpoint
 *
 * Provides a way to test Telegram alert configuration.
 * Should be disabled in production or require authentication.
 *
 * @see docs/implementation/observability-setup.md
 */

import { NextResponse } from 'next/server';
import { testAlerts, areAlertsEnabled } from '@/lib/monitoring';

/**
 * GET /api/test-alerts
 * Check if alerts are configured
 */
export async function GET() {
    // Only allow in development or with secret key
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (!isDevelopment) {
        return NextResponse.json(
            {
                error: 'Not available in production',
                message: 'Use POST with authorization to test alerts in production',
            },
            { status: 403 }
        );
    }

    return NextResponse.json({
        configured: areAlertsEnabled(),
        message: areAlertsEnabled()
            ? 'Telegram alerts are configured. Use POST to send a test alert.'
            : 'Telegram alerts are not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_ALERT_CHAT_ID.',
    });
}

/**
 * POST /api/test-alerts
 * Send a test alert to Telegram
 *
 * In production, this requires an authorization header with a valid secret.
 */
export async function POST(request: Request) {
    const isDevelopment = process.env.NODE_ENV === 'development';

    // In production, require authorization
    if (!isDevelopment) {
        const authHeader = request.headers.get('authorization');
        const expectedAuth = `Bearer ${process.env.TEST_ALERTS_SECRET}`;

        if (!authHeader || authHeader !== expectedAuth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const result = await testAlerts();

    return NextResponse.json(result, {
        status: result.success ? 200 : 500,
    });
}
