import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as postChapaWebhook } from '@/app/api/v1/system/webhooks/chapa/route';
import { POST as postPaymentCompleteJob } from '@/app/api/v1/system/jobs/payments/complete/route';
import { processPaymentLifecycleEvent } from '@/lib/payments/payment-event-consumer';

const webhookMocks = vi.hoisted(() => ({
    verifyChapaWebhookSignature: vi.fn(),
    parseChapaWebhook: vi.fn(),
    publishPaymentWebhookEvent: vi.fn(),
}));

vi.mock('@/lib/payments/webhooks', () => ({
    verifyChapaWebhookSignature: webhookMocks.verifyChapaWebhookSignature,
    parseChapaWebhook: webhookMocks.parseChapaWebhook,
    publishPaymentWebhookEvent: webhookMocks.publishPaymentWebhookEvent,
}));

vi.mock('@/lib/payments/payment-event-consumer', () => ({
    processPaymentLifecycleEvent: vi.fn(),
}));

const processPaymentLifecycleEventMock = vi.mocked(processPaymentLifecycleEvent);

describe('payment webhook routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.QSTASH_TOKEN = 'job-key';
    });

    it('rejects Chapa webhooks with invalid signatures', async () => {
        webhookMocks.verifyChapaWebhookSignature.mockReturnValue(false);

        const response = await postChapaWebhook(
            new NextRequest('http://localhost/api/v1/system/webhooks/chapa', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-chapa-signature': 'bad-signature',
                },
                body: JSON.stringify({ tx_ref: 'tx-1', status: 'success' }),
            }) as any
        );

        expect(response.status).toBe(401);
        expect(webhookMocks.parseChapaWebhook).not.toHaveBeenCalled();
        expect(webhookMocks.publishPaymentWebhookEvent).not.toHaveBeenCalled();
    });

    it('accepts valid Chapa webhooks and enqueues payment processing', async () => {
        webhookMocks.verifyChapaWebhookSignature.mockReturnValue(true);
        webhookMocks.parseChapaWebhook.mockReturnValue({
            provider: 'chapa',
            provider_transaction_id: 'tx-1',
            status: 'completed',
            amount: 100,
            currency: 'ETB',
            metadata: { order_id: '11111111-1111-4111-8111-111111111111' },
            raw_payload: { tx_ref: 'tx-1', status: 'success' },
        });
        webhookMocks.publishPaymentWebhookEvent.mockResolvedValue({
            eventId: 'event-1',
            jobMessageId: 'job-1',
        });

        const response = await postChapaWebhook(
            new NextRequest('http://localhost/api/v1/system/webhooks/chapa', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-chapa-signature': 'good-signature',
                },
                body: JSON.stringify({ tx_ref: 'tx-1', status: 'success' }),
            }) as any
        );

        expect(response.status).toBe(200);
        expect(webhookMocks.publishPaymentWebhookEvent).toHaveBeenCalledOnce();
        const payload = await response.json();
        expect(payload?.data?.event_id).toBe('event-1');
        expect(payload?.data?.job_message_id).toBe('job-1');
    });

    it('authorizes and processes queued payment jobs', async () => {
        processPaymentLifecycleEventMock.mockResolvedValue({
            ok: true,
            outcome: 'processed',
            paymentId: '33333333-3333-4333-8333-333333333333',
            orderId: '44444444-4444-4444-8444-444444444444',
        });

        const response = await postPaymentCompleteJob(
            new NextRequest('http://localhost/api/v1/internal/jobs/payments/complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-lole-job-key': 'job-key',
                },
                body: JSON.stringify({
                    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                    version: 1,
                    name: 'payment.completed',
                    occurred_at: '2026-03-07T10:00:00.000Z',
                    trace_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
                    payload: {
                        restaurant_id: '55555555-5555-4555-8555-555555555555',
                        order_id: '44444444-4444-4444-8444-444444444444',
                        payment_id: null,
                        provider: 'chapa',
                        provider_transaction_id: 'tx-1',
                        idempotency_key: 'key-1',
                        status: 'completed',
                        amount: 100,
                        currency: 'ETB',
                        metadata: {},
                        raw_payload: {},
                    },
                }),
            }) as any
        );

        expect(response.status).toBe(200);
        expect(processPaymentLifecycleEventMock).toHaveBeenCalledOnce();
    });
});
