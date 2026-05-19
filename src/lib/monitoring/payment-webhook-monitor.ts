/**
 * Payment Webhook Monitor - Silent Callback Detection
 *
 * CRIT-01: Detects payment sessions that haven't received callbacks
 * within the expected threshold and triggers alerts.
 *
 * This addresses the "silent callback gap" requirement:
 * - Detect within 10 minutes when a payment was initiated but no callback received
 * - Alert operations team via Telegram
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { Alerts, sendWarningAlert } from '@/lib/monitoring/alerts';
import { logger } from '@/lib/logger';

export interface SilentCallbackConfig {
    /** Minutes after payment initiation before alerting (default: 10) */
    alertThresholdMinutes: number;
    /** Only alert during business hours (9 AM - 11 PM EAT) */
    businessHoursOnly: boolean;
    /** Minimum amount in santim to trigger alert (avoid noise for small amounts) */
    minimumAmountSantim: number;
}

const DEFAULT_CONFIG: SilentCallbackConfig = {
    alertThresholdMinutes: 10,
    businessHoursOnly: true,
    minimumAmountSantim: 1000, // 10 ETB
};

/**
 * Check if current time is within business hours in Addis Ababa
 * Business hours: 9 AM - 11 PM EAT (UTC+3)
 */
function isWithinBusinessHours(): boolean {
    const now = new Date();
    const addisHour = (now.getUTCHours() + 3) % 24;
    return addisHour >= 9 && addisHour < 23;
}

/**
 * Payment session that may have a silent callback issue
 */
export interface SilentCallbackCandidate {
    id: string;
    restaurant_id: string;
    order_id: string | null;
    amount: number;
    currency: string;
    selected_provider: string;
    provider_transaction_id: string | null;
    created_at: string;
    restaurant_name?: string;
    order_number?: string;
    minutes_since_initiation: number;
}

/**
 * Find payment sessions that were initiated but haven't received callbacks
 * within the expected threshold.
 */
export async function findSilentCallbacks(
    config: SilentCallbackConfig = DEFAULT_CONFIG
): Promise<SilentCallbackCandidate[]> {
    const admin = createServiceRoleClient();
    const thresholdDate = new Date(
        Date.now() - config.alertThresholdMinutes * 60 * 1000
    ).toISOString();

    // Find payment sessions that:
    // 1. Were created more than threshold minutes ago
    // 2. Are still in 'pending' status
    // 3. Have amount >= minimum threshold
    // 4. Haven't had a callback (no captured_at)
    const { data: sessions, error } = await admin
        .from('payment_sessions')
        .select(
            `
            id,
            restaurant_id,
            order_id,
            amount,
            currency,
            selected_provider,
            provider_transaction_id,
            created_at,
            status,
            captured_at,
            restaurants!inner(name),
            orders(order_number)
        `
        )
        .eq('status', 'pending')
        .is('captured_at', null)
        .gte('amount', config.minimumAmountSantim)
        .lt('created_at', thresholdDate)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        logger.error('[payment-webhook-monitor] Error querying payment sessions:', error);
        return [];
    }

    if (!sessions || sessions.length === 0) {
        return [];
    }

    const now = Date.now();

    return sessions.map(
        (
            session: // eslint-disable-next-line @typescript-eslint/no-explicit-any
            any
        ) => ({
            id: session.id,
            restaurant_id: session.restaurant_id,
            order_id: session.order_id,
            amount: session.amount,
            currency: session.currency || 'ETB',
            selected_provider: session.selected_provider || 'chapa',
            provider_transaction_id: session.provider_transaction_id,
            created_at: session.created_at,
            restaurant_name: session.restaurants?.name,
            order_number: session.orders?.order_number,
            minutes_since_initiation: Math.round(
                (now - new Date(session.created_at).getTime()) / 60000
            ),
        })
    );
}

/**
 * Result of silent callback detection run
 */
export interface SilentCallbackDetectionResult {
    checked: number;
    silentCallbacks: SilentCallbackCandidate[];
    alertsSent: number;
    errors: string[];
}

/**
 * Run silent callback detection and send alerts
 *
 * This should be called by a scheduled job (cron) every 5 minutes.
 *
 * @example
 * // In a cron job handler
 * export async function GET() {
 *   const result = await runSilentCallbackDetection();
 *   return Response.json(result);
 * }
 */
export async function runSilentCallbackDetection(
    config: SilentCallbackConfig = DEFAULT_CONFIG
): Promise<SilentCallbackDetectionResult> {
    const result: SilentCallbackDetectionResult = {
        checked: 0,
        silentCallbacks: [],
        alertsSent: 0,
        errors: [],
    };

    // Skip if outside business hours and configured to do so
    if (config.businessHoursOnly && !isWithinBusinessHours()) {
        return result;
    }

    try {
        const silentCallbacks = await findSilentCallbacks(config);
        result.checked = silentCallbacks.length;
        result.silentCallbacks = silentCallbacks;

        // Send alerts for each silent callback
        for (const callback of silentCallbacks) {
            try {
                await Alerts.paymentWebhookSilent(
                    callback.selected_provider,
                    callback.minutes_since_initiation
                );

                // Also log restaurant-specific context
                if (callback.restaurant_name) {
                    await sendWarningAlert(`Payment session ${callback.id} awaiting callback`, {
                        restaurant_id: callback.restaurant_id,
                        restaurant_name: callback.restaurant_name,
                        order_number: callback.order_number || 'N/A',
                        amount_etb: (callback.amount / 100).toFixed(2),
                        provider: callback.selected_provider,
                        session_id: callback.id,
                        minutes_waiting: callback.minutes_since_initiation,
                    });
                }

                result.alertsSent++;
            } catch (alertError) {
                result.errors.push(`Failed to alert for session ${callback.id}: ${alertError}`);
            }
        }
    } catch (error) {
        result.errors.push(
            `Detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }

    return result;
}

/**
 * Get statistics about payment webhook health
 */
export async function getWebhookHealthStats(): Promise<{
    pendingSessions: number;
    oldestPendingMinutes: number | null;
    recentCallbacks: number;
    failedCallbacks: number;
}> {
    const admin = createServiceRoleClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Count pending sessions
    const { count: pendingSessions } = await admin
        .from('payment_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

    // Find oldest pending session
    const { data: oldestPending } = await admin
        .from('payment_sessions')
        .select('created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    // Count recent callbacks (last hour)
    const { count: recentCallbacks } = await admin
        .from('payment_sessions')
        .select('id', { count: 'exact', head: true })
        .not('captured_at', 'is', null)
        .gte('captured_at', oneHourAgo);

    // Count failed callbacks (last hour)
    const { count: failedCallbacks } = await admin
        .from('payment_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('updated_at', oneHourAgo);

    return {
        pendingSessions: pendingSessions ?? 0,
        oldestPendingMinutes: oldestPending
            ? Math.round((Date.now() - new Date(oldestPending.created_at).getTime()) / 60000)
            : null,
        recentCallbacks: recentCallbacks ?? 0,
        failedCallbacks: failedCallbacks ?? 0,
    };
}

export const paymentWebhookMonitor = {
    findSilentCallbacks,
    runSilentCallbackDetection,
    getWebhookHealthStats,
    DEFAULT_CONFIG,
};

export default paymentWebhookMonitor;
