import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchKdsPrintJob, normalizeKdsPrintPolicy, type KdsPrintPayload } from './printer';

const BASE_PAYLOAD: KdsPrintPayload = {
    restaurantId: 'rest-1',
    orderId: 'order-1',
    orderNumber: 'ORD-1',
    tableNumber: 'T-1',
    firedAt: new Date().toISOString(),
    reason: 'manual_print',
    items: [{ name: 'Kitfo', quantity: 1, station: 'kitchen', notes: null, status: 'queued' }],
};

describe('kds printer bridge', () => {
    const originalFetch = global.fetch;
    const originalSecret = process.env.KDS_PRINTER_WEBHOOK_SECRET;

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env.KDS_PRINTER_WEBHOOK_SECRET = originalSecret;
    });

    it('normalizes retry config bounds', () => {
        const policy = normalizeKdsPrintPolicy({
            mode: 'fallback',
            provider: 'webhook',
            timeout_ms: 999999,
            max_attempts: 99,
            base_backoff_ms: 1,
        });

        expect(policy.timeout_ms).toBe(20000);
        expect(policy.max_attempts).toBe(8);
        expect(policy.base_backoff_ms).toBe(100);
    });

    it('sends signed headers to webhook bridge', async () => {
        process.env.KDS_PRINTER_WEBHOOK_SECRET = 'a'.repeat(32);

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
        });
        global.fetch = fetchMock as any;

        const policy = normalizeKdsPrintPolicy({
            mode: 'fallback',
            provider: 'webhook',
            webhook_url: 'https://printer.example/bridge',
            max_attempts: 1,
        });

        const result = await dispatchKdsPrintJob(policy, BASE_PAYLOAD);
        expect(result.dispatched).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [, requestInit] = fetchMock.mock.calls[0];
        const headers = requestInit.headers as Record<string, string>;
        expect(headers['x-lole-event']).toBe('kds.ticket.print.v1');
        expect(headers['x-lole-signature-version']).toBe('v1');
        expect(headers['x-lole-signature-sha256']).toMatch(/^[a-f0-9]{64}$/);
        expect(headers['x-lole-body-sha256']).toMatch(/^[a-f0-9]{64}$/);
        expect(headers['x-lole-idempotency-key']).toBe(headers['x-lole-event-id']);
    });

    it('retries retryable status and succeeds', async () => {
        process.env.KDS_PRINTER_WEBHOOK_SECRET = 'b'.repeat(32);

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 503,
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
            });
        global.fetch = fetchMock as any;

        const policy = normalizeKdsPrintPolicy({
            mode: 'fallback',
            provider: 'webhook',
            webhook_url: 'https://printer.example/bridge',
            max_attempts: 2,
            base_backoff_ms: 100,
        });

        const result = await dispatchKdsPrintJob(policy, BASE_PAYLOAD);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.dispatched).toBe(true);
        expect(result.attempts).toBe(2);
    });
});
