/**
 * Telegram Alerts Module
 *
 * Provides alerting via Telegram for critical production events.
 * Used for:
 * - Health check failures (via Better Uptime integration)
 * - Payment webhook failures
 * - ERCA submission backlogs
 * - EOD reports
 * - Manual operational alerts
 *
 * @see docs/1. Engineering Foundation/0. ENTERPRISE_MASTER_BLUEPRINT.md - Sprint 7.6
 * @see docs/1. Engineering Foundation/6. ENGINEERING_RUNOOK.md - Monitoring Checklist
 */

import { logger } from '@/lib/logger';

const log = logger.child('[alerts/telegram]');

/**
 * Alert severity levels
 */
export type AlertLevel = 'critical' | 'warning' | 'info';

/**
 * Alert context for additional debugging information
 */
export interface AlertContext {
    restaurantId?: string;
    restaurantName?: string;
    orderId?: string;
    paymentId?: string;
    userId?: string;
    deviceType?: 'pos' | 'kds' | 'guest' | 'dashboard';
    error?: string;
    stack?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
}

/**
 * Telegram message payload
 */
interface TelegramMessage {
    chat_id: string;
    text: string;
    parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disable_notification?: boolean;
}

/**
 * Telegram API response
 */
interface TelegramResponse {
    ok: boolean;
    result?: unknown;
    description?: string;
    error_code?: number;
}

/**
 * Get severity emoji for alert level
 */
function getSeverityEmoji(level: AlertLevel): string {
    switch (level) {
        case 'critical':
            return '🚨';
        case 'warning':
            return '⚠️';
        case 'info':
            return 'ℹ️';
        default:
            return '📢';
    }
}

/**
 * Get severity prefix for alert level
 */
function getSeverityPrefix(level: AlertLevel): string {
    switch (level) {
        case 'critical':
            return 'CRITICAL';
        case 'warning':
            return 'WARNING';
        case 'info':
            return 'INFO';
        default:
            return 'ALERT';
    }
}

/**
 * Format alert message for Telegram (HTML format)
 */
function formatMessage(level: AlertLevel, message: string, context?: AlertContext): string {
    const emoji = getSeverityEmoji(level);
    const prefix = getSeverityPrefix(level);
    const timestamp = new Date().toISOString();

    const lines: string[] = [
        `${emoji} <b>[${prefix}]</b>`,
        '',
        `<b>${escapeHtml(message)}</b>`,
        '',
        `<i>Time: ${timestamp}</i>`,
    ];

    // Add environment if available
    if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development') {
        lines.push(`<i>Environment: ${process.env.NODE_ENV}</i>`);
    }

    // Add context
    if (context) {
        lines.push('');
        lines.push('<b>Context:</b>');

        if (context.restaurantId) {
            const restaurantInfo = context.restaurantName
                ? `${context.restaurantName} (${context.restaurantId})`
                : context.restaurantId;
            lines.push(`• Restaurant: ${escapeHtml(restaurantInfo)}`);
        }

        if (context.orderId) {
            lines.push(`• Order: <code>${escapeHtml(context.orderId)}</code>`);
        }

        if (context.paymentId) {
            lines.push(`• Payment: <code>${escapeHtml(context.paymentId)}</code>`);
        }

        if (context.userId) {
            lines.push(`• User: <code>${escapeHtml(context.userId)}</code>`);
        }

        if (context.deviceType) {
            lines.push(`• Device: ${context.deviceType.toUpperCase()}`);
        }

        if (context.error) {
            lines.push(`• Error: <pre>${escapeHtml(context.error)}</pre>`);
        }

        if (context.metadata && Object.keys(context.metadata).length > 0) {
            lines.push('• Additional:');
            for (const [key, value] of Object.entries(context.metadata)) {
                lines.push(`  - ${key}: ${escapeHtml(String(value))}`);
            }
        }
    }

    // Add stack trace if available (truncate to avoid Telegram limits)
    if (context?.stack) {
        lines.push('');
        lines.push('<b>Stack Trace:</b>');
        const truncatedStack =
            context.stack.length > 500 ? context.stack.slice(0, 500) + '...' : context.stack;
        lines.push(`<pre>${escapeHtml(truncatedStack)}</pre>`);
    }

    return lines.join('\n');
}

/**
 * Escape HTML special characters for Telegram
 */
function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Send an alert via Telegram
 *
 * @param level - Alert severity (critical, warning, info)
 * @param message - Human-readable alert message
 * @param context - Additional context for debugging
 * @returns Promise<boolean> - true if sent successfully
 *
 * @example
 * // Critical alert for POS down
 * await sendAlert('critical', 'POS offline at Saba Grill', {
 *   restaurantId: 'rest-123',
 *   restaurantName: 'Saba Grill',
 *   deviceType: 'pos',
 *   error: 'Connection timeout after 30s'
 * });
 *
 * @example
 * // Warning for payment webhook issue
 * await sendAlert('warning', 'Chapa webhook verification failed', {
 *   restaurantId: 'rest-456',
 *   paymentId: 'pay-789',
 *   error: 'Invalid HMAC signature'
 * });
 *
 * @example
 * // Info for EOD report
 * await sendAlert('info', 'EOD report sent for Saba Grill', {
 *   restaurantId: 'rest-123',
 *   metadata: { totalOrders: 47, revenue: 15750 }
 * });
 */
export async function sendAlert(
    level: AlertLevel,
    message: string,
    context?: AlertContext
): Promise<boolean> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;

    // If not configured, log to console in development
    if (!botToken || !chatId) {
        if (process.env.NODE_ENV === 'development') {
            log.warn(`[${level.toUpperCase()}] ${message}`, context ?? {});
        }
        return false;
    }

    // Format message
    const formattedMessage = formatMessage(level, message, context);

    // Prepare Telegram API request
    const payload: TelegramMessage = {
        chat_id: chatId,
        text: formattedMessage,
        parse_mode: 'HTML',
        // Don't notify for info-level alerts during off-hours
        disable_notification: level === 'info',
    };

    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = (await response.json()) as TelegramResponse;

        if (!result.ok) {
            log.error('Telegram alert failed', {
                error_code: result.error_code,
                description: result.description,
            });
            return false;
        }

        return true;
    } catch (error) {
        log.error('Failed to send Telegram alert', error);
        return false;
    }
}

/**
 * Send a critical alert
 * Used for: POS down, payments failing, orders not reaching KDS
 * Expected response time: 10 minutes
 */
export async function sendCriticalAlert(message: string, context?: AlertContext): Promise<boolean> {
    return sendAlert('critical', message, context);
}

/**
 * Send a warning alert
 * Used for: Slow API responses, ERCA backlog, EOD reports not sending
 * Expected response time: 1 hour
 */
export async function sendWarningAlert(message: string, context?: AlertContext): Promise<boolean> {
    return sendAlert('warning', message, context);
}

/**
 * Send an info alert
 * Used for: EOD reports, non-urgent notifications
 */
export async function sendInfoAlert(message: string, context?: AlertContext): Promise<boolean> {
    return sendAlert('info', message, context);
}

/**
 * Send EOD (End of Day) report for a restaurant
 *
 * @param restaurantId - Restaurant identifier
 * @param restaurantName - Human-readable name
 * @param data - EOD summary data
 */
export async function sendEodReport(
    restaurantId: string,
    restaurantName: string,
    data: {
        totalOrders: number;
        totalRevenue: number;
        totalGuests: number;
        topItems: Array<{ name: string; quantity: number }>;
        paymentBreakdown: Record<string, number>;
    }
): Promise<boolean> {
    const lines: string[] = [
        `📊 <b>EOD Report - ${escapeHtml(restaurantName)}</b>`,
        '',
        `<i>${new Date().toLocaleDateString('en-ET', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</i>`,
        '',
        `<b>Orders:</b> ${data.totalOrders}`,
        `<b>Guests:</b> ${data.totalGuests}`,
        `<b>Revenue:</b> ETB ${data.totalRevenue.toLocaleString()}`,
        '',
        '<b>Payment Methods:</b>',
    ];

    for (const [method, amount] of Object.entries(data.paymentBreakdown)) {
        lines.push(`• ${method}: ETB ${amount.toLocaleString()}`);
    }

    if (data.topItems.length > 0) {
        lines.push('');
        lines.push('<b>Top Items:</b>');
        for (const item of data.topItems.slice(0, 5)) {
            lines.push(`• ${escapeHtml(item.name)}: ${item.quantity}x`);
        }
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;

    // Fallback to console in development
    if (!botToken || !chatId) {
        if (process.env.NODE_ENV === 'development') {
            log.warn('[EOD REPORT]', { report: lines.join('\n') });
        }
        return false;
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: lines.join('\n'),
                parse_mode: 'HTML',
            }),
        });

        const result = (await response.json()) as TelegramResponse;
        return result.ok;
    } catch (error) {
        log.error('Failed to send EOD report', error);
        return false;
    }
}

/**
 * Check if Telegram alerts are configured
 */
export function isTelegramConfigured(): boolean {
    return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ALERT_CHAT_ID);
}

/**
 * Test Telegram configuration by sending a test message
 *
 * @returns Promise<boolean> - true if test message sent successfully
 */
export async function testTelegramConnection(): Promise<boolean> {
    if (!isTelegramConfigured()) {
        log.warn('Telegram alerts not configured');
        return false;
    }

    return sendInfoAlert('Telegram alert configuration test - connection successful', {
        metadata: {
            environment: process.env.NODE_ENV || 'unknown',
            timestamp: new Date().toISOString(),
        },
    });
}
