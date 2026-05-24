import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendSms, sendOrderStatusSms } from './sms';

describe('sms', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fetchSpy = vi.spyOn(global, 'fetch');
        delete process.env.SMS_PROVIDER;
        delete process.env.AFRICAS_TALKING_API_KEY;
        delete process.env.AFRICAS_TALKING_USERNAME;
        delete process.env.AFRICAS_TALKING_SENDER_ID;
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    // ── sendSms (log provider) ───────────────────────────────────────────────
    describe('sendSms - log provider (default)', () => {
        it('succeeds with log provider when SMS_PROVIDER is not set', async () => {
            const result = await sendSms('+251911234567', 'Test message');
            expect(result.success).toBe(true);
            expect(result.provider).toBe('log');
        });

        it('returns skipped with empty phone', async () => {
            const result = await sendSms('', 'Test message');
            expect(result.success).toBe(false);
            expect(result.skipped).toBe(true);
            expect(result.error).toContain('phone is empty');
        });

        it('normalizes phone by stripping whitespace', async () => {
            const result = await sendSms('  +251 91 123 4567  ', 'Test message');
            expect(result.success).toBe(true);
            expect(result.provider).toBe('log');
        });

        it('strips whitespace-only phone as empty', async () => {
            const result = await sendSms('   ', 'Test message');
            expect(result.success).toBe(false);
            expect(result.skipped).toBe(true);
        });
    });

    // ── sendSms (africas_talking) ────────────────────────────────────────────
    describe('sendSms - africas_talking provider', () => {
        beforeEach(() => {
            process.env.SMS_PROVIDER = 'africas_talking';
        });

        it('returns skipped when credentials are missing', async () => {
            const result = await sendSms('+2519', 'Message');
            expect(result.success).toBe(false);
            expect(result.skipped).toBe(true);
            expect(result.provider).toBe('africas_talking');
        });

        it('normalizes Ethiopian number starting with 0', async () => {
            process.env.AFRICAS_TALKING_API_KEY = 'key';
            process.env.AFRICAS_TALKING_USERNAME = 'user';
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    SMSMessageData: {
                        Recipients: [{ status: 'Success', statusCode: 101 }],
                    },
                }),
            } as Response);

            await sendSms('0911234567', 'Message');

            const bodyStr = (fetchSpy.mock.calls[0][1] as RequestInit).body as string;
            expect(bodyStr).toContain(encodeURIComponent('+251911234567'));
        });

        it('normalizes 9-digit Ethiopian number', async () => {
            process.env.AFRICAS_TALKING_API_KEY = 'key';
            process.env.AFRICAS_TALKING_USERNAME = 'user';
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    SMSMessageData: { Recipients: [{ status: 'Success', statusCode: 101 }] },
                }),
            } as Response);

            await sendSms('911234567', 'Message'); // 9-digit without country code

            const bodyStr = (fetchSpy.mock.calls[0][1] as RequestInit).body as string;
            expect(bodyStr).toContain(encodeURIComponent('+251911234567'));
        });

        it('returns success on successful send', async () => {
            process.env.AFRICAS_TALKING_API_KEY = 'key';
            process.env.AFRICAS_TALKING_USERNAME = 'user';
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    SMSMessageData: { Recipients: [{ status: 'Success', statusCode: 101 }] },
                }),
            } as Response);

            const result = await sendSms('+251911234567', 'Message');
            expect(result.success).toBe(true);
            expect(result.provider).toBe('africas_talking');
        });

        it('returns failure when HTTP response is not ok', async () => {
            process.env.AFRICAS_TALKING_API_KEY = 'key';
            process.env.AFRICAS_TALKING_USERNAME = 'user';
            fetchSpy.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error',
            } as Response);

            const result = await sendSms('+251911234567', 'Message');
            expect(result.success).toBe(false);
            expect(result.provider).toBe('africas_talking');
        });

        it('returns failure when recipient status is not 101', async () => {
            process.env.AFRICAS_TALKING_API_KEY = 'key';
            process.env.AFRICAS_TALKING_USERNAME = 'user';
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    SMSMessageData: {
                        Recipients: [{ status: 'InvalidRecipient', statusCode: 402 }],
                    },
                }),
            } as Response);

            const result = await sendSms('+251911234567', 'Message');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Delivery failed');
        });

        it('includes senderId when configured', async () => {
            process.env.AFRICAS_TALKING_API_KEY = 'key';
            process.env.AFRICAS_TALKING_USERNAME = 'user';
            process.env.AFRICAS_TALKING_SENDER_ID = 'lole';
            fetchSpy.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    SMSMessageData: { Recipients: [{ status: 'Success', statusCode: 101 }] },
                }),
            } as Response);

            await sendSms('+251911234567', 'Message');

            const bodyStr = (fetchSpy.mock.calls[0][1] as RequestInit).body as string;
            expect(bodyStr).toContain('from=lole');
        });

        it('accepts africas-talking hyphenated variant', async () => {
            process.env.SMS_PROVIDER = 'africas-talking';
            const result = await sendSms('+2519', 'Message');
            expect(result.provider).toBe('africas_talking');
        });
    });

    // ── sendOrderStatusSms ───────────────────────────────────────────────────
    describe('sendOrderStatusSms', () => {
        it('sends with "preparing" message', async () => {
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await sendOrderStatusSms({
                toPhone: '+251911111111',
                orderNumber: 'ORD-001',
                status: 'preparing',
            });

            expect(result.success).toBe(true);
            expect(result.provider).toBe('log');
            logSpy.mockRestore();
        });

        it('sends with "ready" message', async () => {
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await sendOrderStatusSms({
                toPhone: '+251911111111',
                orderNumber: 'ORD-002',
                status: 'ready',
            });

            expect(result.success).toBe(true);
            logSpy.mockRestore();
        });

        it('sends with "completed" message for served status', async () => {
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await sendOrderStatusSms({
                toPhone: '+251911111111',
                orderNumber: 'ORD-003',
                status: 'served',
            });

            expect(result.success).toBe(true);
            logSpy.mockRestore();
        });

        it('sends with "cancelled" message', async () => {
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await sendOrderStatusSms({
                toPhone: '+251911111111',
                orderNumber: 'ORD-004',
                status: 'cancelled',
            });

            expect(result.success).toBe(true);
            logSpy.mockRestore();
        });

        it('sends with generic status message for unknown status', async () => {
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

            const result = await sendOrderStatusSms({
                toPhone: '+251911111111',
                orderNumber: 'ORD-005',
                status: 'dispatched',
            });

            expect(result.success).toBe(true);
            logSpy.mockRestore();
        });
    });
});
