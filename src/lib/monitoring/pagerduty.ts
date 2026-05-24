/**
 * PagerDuty Integration
 *
 * Provides on-call alerting via PagerDuty for production incidents.
 * Implements escalation policy: Sev1 → Primary → Secondary → Manager
 *
 * @see docs/09-runbooks/incident-triage-rubric.md
 */

import { logger } from '@/lib/logger';

/**
 * PagerDuty severity mapping
 */
export type PagerDutySeverity = 'critical' | 'error' | 'warning' | 'info';

/**
 * Alert level to PagerDuty severity mapping
 */
function mapSeverity(level: 'critical' | 'warning' | 'info'): PagerDutySeverity {
    switch (level) {
        case 'critical':
            return 'critical';
        case 'warning':
            return 'warning';
        default:
            return 'info';
    }
}

/**
 * PagerDuty configuration
 */
interface PagerDutyConfig {
    routingKey: string | undefined;
    enabled: boolean;
}

function getPagerDutyConfig(): PagerDutyConfig {
    const routingKey = process.env.PAGERDUTY_ROUTING_KEY;
    return {
        routingKey,
        enabled: !!routingKey,
    };
}

/**
 * PagerDuty Events API v2 payload
 */
interface PagerDutyPayload {
    routing_key: string;
    event_action: 'trigger' | 'acknowledge' | 'resolve';
    dedup_key?: string;
    client?: string;
    client_url?: string;
    severity: PagerDutySeverity;
    source: string;
    component?: string;
    group?: string;
    class?: string;
    timestamp?: string;
    custom_details?: Record<string, string | number | boolean>;
    links?: Array<{ href: string; text: string }>;
}

/**
 * Alert context type
 */
interface AlertContext {
    [key: string]: string | number | boolean | undefined;
}

/**
 * Generate deduplication key for PagerDuty
 * Uses hash of message + key context fields
 */
function generateDedupKey(message: string, context?: AlertContext): string {
    const parts = [message];
    if (context) {
        // Include key identifiers for deduplication
        const keyFields = ['restaurant_id', 'order_id', 'payment_id', 'error', 'service'];
        for (const field of keyFields) {
            if (context[field] !== undefined) {
                parts.push(`${field}:${context[field]}`);
            }
        }
    }
    const hash = parts.join('|');
    // Simple hash for dedup key (max 255 chars)
    return hash.length > 255 ? hash.slice(0, 255) : hash;
}

/**
 * Send alert to PagerDuty
 *
 * @param level - Alert severity level
 * @param message - Alert message
 * @param context - Optional additional context
 * @returns Promise<boolean> - Whether the alert was sent successfully
 */
export async function sendPagerDutyAlert(
    level: 'critical' | 'warning' | 'info',
    message: string,
    context?: AlertContext
): Promise<{ success: boolean; dedupKey?: string; error?: string }> {
    const config = getPagerDutyConfig();

    if (!config.enabled) {
        logger.debug('[PagerDuty] Integration not configured. Skipping alert.', { message });
        return { success: false, error: 'PagerDuty not configured' };
    }

    const dedupKey = generateDedupKey(message, context);

    const payload: PagerDutyPayload = {
        routing_key: config.routingKey!,
        event_action: 'trigger',
        dedup_key: dedupKey,
        client: 'lole Restaurant OS',
        client_url: process.env.NEXT_PUBLIC_APP_URL || 'https://lole.app',
        severity: mapSeverity(level),
        source: 'lole-api',
        timestamp: new Date().toISOString(),
        custom_details: context as Record<string, string | number | boolean>,
    };

    // Add relevant links if context has IDs
    if (context?.restaurant_id) {
        payload.links = [
            {
                href: `${process.env.NEXT_PUBLIC_APP_URL}/merchant/dashboard?restaurant=${context.restaurant_id}`,
                text: 'View Restaurant Dashboard',
            },
        ];
    }

    try {
        const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('[PagerDuty] Failed to send alert', {
                status: response.status,
                error: errorText,
                message,
            });
            return { success: false, dedupKey, error: errorText };
        }

        const result = (await response.json()) as { dedup_key?: string; message?: string };
        logger.info('[PagerDuty] Alert sent successfully', {
            dedupKey: result.dedup_key || dedupKey,
            level,
            message,
        });

        return { success: true, dedupKey: result.dedup_key || dedupKey };
    } catch (error) {
        logger.error('[PagerDuty] Exception sending alert', {
            error: error instanceof Error ? error.message : 'Unknown error',
            message,
        });
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Acknowledge a PagerDuty incident
 *
 * @param dedupKey - Deduplication key from original alert
 */
export async function acknowledgePagerDutyIncident(dedupKey: string): Promise<boolean> {
    const config = getPagerDutyConfig();

    if (!config.enabled) {
        return false;
    }

    const payload: PagerDutyPayload = {
        routing_key: config.routingKey!,
        event_action: 'acknowledge',
        dedup_key: dedupKey,
        severity: 'info',
        source: 'lole-api',
    };

    try {
        const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Resolve a PagerDuty incident
 *
 * @param dedupKey - Deduplication key from original alert
 */
export async function resolvePagerDutyIncident(dedupKey: string): Promise<boolean> {
    const config = getPagerDutyConfig();

    if (!config.enabled) {
        return false;
    }

    const payload: PagerDutyPayload = {
        routing_key: config.routingKey!,
        event_action: 'resolve',
        dedup_key: dedupKey,
        severity: 'info',
        source: 'lole-api',
    };

    try {
        const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Check if PagerDuty is configured
 */
export function isPagerDutyEnabled(): boolean {
    return getPagerDutyConfig().enabled;
}

/**
 * PagerDuty alert utilities
 */
export const PagerDuty = {
    send: sendPagerDutyAlert,
    acknowledge: acknowledgePagerDutyIncident,
    resolve: resolvePagerDutyIncident,
    isEnabled: isPagerDutyEnabled,
};

export default PagerDuty;
