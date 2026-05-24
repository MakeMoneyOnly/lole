/**
 * Tests for Telegram Alert System
 *
 * @see src/lib/monitoring/alerts.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    sendAlert,
    sendCriticalAlert,
    sendWarningAlert,
    sendInfoAlert,
    areAlertsEnabled,
    testAlerts,
    Alerts,
} from './alerts';

// Mock fetch for Telegram API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods
const originalConsole = {
    warn: console.warn,
    error: console.error,
};

describe('Telegram Alert System', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        console.warn = vi.fn();
        console.error = vi.fn();
    });

    afterEach(() => {
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
    });

    describe('areAlertsEnabled', () => {
        it('returns false when TELEGRAM_BOT_TOKEN is not set', () => {
            delete process.env.TELEGRAM_BOT_TOKEN;
            delete process.env.TELEGRAM_ALERT_CHAT_ID;

            expect(areAlertsEnabled()).toBe(false);
        });

        it('returns false when TELEGRAM_ALERT_CHAT_ID is not set', () => {
            process.env.TELEGRAM_BOT_TOKEN = 'test-token';
            delete process.env.TELEGRAM_ALERT_CHAT_ID;

            expect(areAlertsEnabled()).toBe(false);
        });

        it('returns true when both variables are set', () => {
            process.env.TELEGRAM_BOT_TOKEN = 'test-token';
            process.env.TELEGRAM_ALERT_CHAT_ID = 'test-chat-id';

            expect(areAlertsEnabled()).toBe(true);

            // Cleanup
            delete process.env.TELEGRAM_BOT_TOKEN;
            delete process.env.TELEGRAM_ALERT_CHAT_ID;
        });
    });

    describe('sendAlert', () => {
        it('returns false and logs warning when Telegram is not configured', async () => {
            delete process.env.TELEGRAM_BOT_TOKEN;
            delete process.env.TELEGRAM_ALERT_CHAT_ID;

            const result = await sendAlert('warning', 'Test message');

            expect(result).toBe(false);
            expect(console.warn).toHaveBeenCalled();
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('sends alert to Telegram API with correct format', async () => {
            process.env.TELEGRAM_BOT_TOKEN = 'test-token';
            process.env.TELEGRAM_ALERT_CHAT_ID = 'test-chat-id';

            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('{"ok":true}'),
            });

            const result = await sendAlert('critical', 'Test critical message', {
                restaurant_id: 'rest-123',
                error: 'Database connection failed',
            });

            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.telegram.org/bottest-token/sendMessage',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: expect.stringContaining('Test critical message'),
                })
            );

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.chat_id).toBe('test-chat-id');
            expect(callBody.parse_mode).toBe('Markdown');
            expect(callBody.text).toContain('🔴');
            expect(callBody.text).toContain('CRITICAL');

            // Cleanup
            delete process.env.TELEGRAM_BOT_TOKEN;
            delete process.env.TELEGRAM_ALERT_CHAT_ID;
        });

        it('returns false when Telegram API returns error', async () => {
            process.env.TELEGRAM_BOT_TOKEN = 'test-token';
            process.env.TELEGRAM_ALERT_CHAT_ID = 'test-chat-id';

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                text: () => Promise.resolve('Unauthorized'),
            });

            const result = await sendAlert('warning', 'Test message');

            expect(result).toBe(false);
            expect(console.error).toHaveBeenCalled();

            // Cleanup
            delete process.env.TELEGRAM_BOT_TOKEN;
            delete process.env.TELEGRAM_ALERT_CHAT_ID;
        });

        it('handles network errors gracefully', async () => {
            process.env.TELEGRAM_BOT_TOKEN = 'test-token';
            process.env.TELEGRAM_ALERT_CHAT_ID = 'test-chat-id';

            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await sendAlert('info', 'Test message');

            expect(result).toBe(false);
            expect(console.error).toHaveBeenCalled();

            // Cleanup
            delete process.env.TELEGRAM_BOT_TOKEN;
            delete process.env.TELEGRAM_ALERT_CHAT_ID;
        });
    });

    describe('Alert level wrappers', () => {
        beforeEach(() => {
            process.env.TELEGRAM_BOT_TOKEN = 'test-token';
            process.env.TELEGRAM_ALERT_CHAT_ID = 'test-chat-id';
        });

        afterEach(() => {
            delete process.env.TELEGRAM_BOT_TOKEN;
            delete process.env.TELEGRAM_ALERT_CHAT_ID;
        });

        it('sendCriticalAlert sends critical level alert', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('{"ok":true}'),
            });

            await sendCriticalAlert('Critical issue');

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.text).toContain('🔴');
            expect(callBody.text).toContain('CRITICAL');
        });

        it('sendWarningAlert sends warning level alert', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('{"ok":true}'),
            });

            await sendWarningAlert('Warning issue');

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.text).toContain('🟡');
            expect(callBody.text).toContain('Warning');
        });

        it('sendInfoAlert sends info level alert', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('{"ok":true}'),
            });

            await sendInfoAlert('Info message');

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.text).toContain('ℹ️');
            expect(callBody.text).toContain('Info');
        });
    });

    describe('Predefined Alerts', () => {
        beforeEach(() => {
            process.env.TELEGRAM_BOT_TOKEN = 'test-token';
            process.env.TELEGRAM_ALERT_CHAT_ID = 'test-chat-id';
        });

        afterEach(() => {
            delete process.env.TELEGRAM_BOT_TOKEN;
            delete process.env.TELEGRAM_ALERT_CHAT_ID;
        });

        it('Alerts.posOffline sends correct alert', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('{"ok":true}'),
            });

            await Alerts.posOffline('rest-123', 'Saba Grill', 5);

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.text).toContain('POS device');
            expect(callBody.text).toContain('5+ minutes');
            // Markdown escapes hyphens, so check for escaped version
            expect(callBody.text).toContain('rest\\-123');
        });

        it('Alerts.paymentWebhookSilent sends correct alert', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('{"ok":true}'),
            });

            await Alerts.paymentWebhookSilent('chapa', 10);

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.text).toContain('chapa');
            expect(callBody.text).toContain('10 minutes');
        });

        it('Alerts.lowStock sends correct alert', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('{"ok":true}'),
            });

            await Alerts.lowStock('rest-123', 'Saba Grill', 'Tibbs', 5, 10);

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.text).toContain('Low stock');
            expect(callBody.text).toContain('Tibbs');
            expect(callBody.text).toContain('🟡'); // Warning level
        });

        it('Alerts.deployment sends correct alert', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('{"ok":true}'),
            });

            await Alerts.deployment('1.0.0', 'production', 'CI/CD');

            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.text).toContain('Deployment completed');
            // Markdown escapes periods, so check for escaped version
            expect(callBody.text).toContain('1\\.0\\.0');
            expect(callBody.text).toContain('ℹ️'); // Info level
        });
    });

    describe('testAlerts', () => {
        it('returns failure when not configured', async () => {
            delete process.env.TELEGRAM_BOT_TOKEN;
            delete process.env.TELEGRAM_ALERT_CHAT_ID;

            const result = await testAlerts();

            expect(result.success).toBe(false);
            expect(result.message).toContain('No alert channels configured');
        });

        it('sends test alert when configured', async () => {
            process.env.TELEGRAM_BOT_TOKEN = 'test-token';
            process.env.TELEGRAM_ALERT_CHAT_ID = 'test-chat-id';

            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve('{"ok":true}'),
            });

            const result = await testAlerts();

            expect(result.success).toBe(true);
            expect(result.message).toContain('Telegram: OK');

            // Cleanup
            delete process.env.TELEGRAM_BOT_TOKEN;
            delete process.env.TELEGRAM_ALERT_CHAT_ID;
        });
    });
});
