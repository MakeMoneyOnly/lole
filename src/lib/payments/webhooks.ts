import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import type { PaymentEventStatus, PaymentLifecycleEventPayload } from '@/lib/events/contracts';
import { createPaymentLifecycleEvent } from '@/lib/events/contracts';
import { publishEvent, enqueueInternalJob } from '@/lib/events/runtime';
import {
    createServiceRoleClient as _createServiceRoleClient,
    createAuditedServiceRoleClient,
} from '@/lib/supabase/service-role';
import { logger } from '@/lib/logger';
import { validationError, notFound } from '@/lib/api/errors';
import { verifyTelebirrWebhookSignature as telebirrVerifySignature } from './telebirr';

const log = logger.child('webhook');

type PaymentProvider = 'chapa' | 'telebirr';

type PaymentContext = {
    restaurant_id: string;
    order_id: string | null;
    payment_id: string | null;
    payment_session_id: string | null;
};

interface ParsedWebhookPayload {
    provider: PaymentProvider;
    provider_transaction_id: string;
    status: PaymentEventStatus;
    amount: number | null;
    currency: string | null;
    metadata: Record<string, unknown>;
    raw_payload: Record<string, unknown>;
}

function safeJsonParse(value: string): Record<string, unknown> {
    try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        // Ignore parse failures and let callers handle invalid payloads.
    }

    return {};
}

function getString(record: Record<string, unknown>, ...keys: string[]): string | null {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
        }
    }

    return null;
}

function getNestedRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    return {};
}

function getAmount(record: Record<string, unknown>, ...keys: string[]): number | null {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && value.trim().length > 0) {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }

    return null;
}

function statusFromRaw(rawStatus: string | null): PaymentEventStatus {
    const normalized = rawStatus?.toLowerCase() ?? '';
    if (
        ['success', 'successful', 'completed', 'paid', 'captured', 'pay_success'].includes(
            normalized
        )
    ) {
        return 'completed';
    }

    return 'failed';
}

function compareSignature(
    secret: string,
    providedSignature: string | null,
    rawBody: string
): boolean {
    if (!providedSignature) {
        return false;
    }

    const normalizedProvided = providedSignature.trim();
    const expectedHex = createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBase64 = createHmac('sha256', secret).update(rawBody).digest('base64');
    const candidates = [expectedHex, expectedBase64];

    return candidates.some(candidate => {
        const candidateBuffer = Buffer.from(candidate);
        const providedBuffer = Buffer.from(normalizedProvided);

        if (candidateBuffer.length !== providedBuffer.length) {
            return false;
        }

        try {
            return timingSafeEqual(candidateBuffer, providedBuffer);
        } catch {
            return false;
        }
    });
}

export function verifyChapaWebhookSignature(
    rawBody: string,
    providedSignature: string | null
): boolean {
    const secret = process.env.CHAPA_WEBHOOK_SECRET;

    // HIGH-011: Require explicit webhook secret even in development
    // If no secret is configured, fail verification
    if (!secret) {
        log.error('CHAPA_WEBHOOK_SECRET is not configured. Webhook verification failed.');
        // In development, allow a dedicated test secret to be used
        const testSecret = process.env.CHAPA_WEBHOOK_TEST_SECRET;
        if (testSecret && process.env.NODE_ENV !== 'production') {
            return compareSignature(testSecret, providedSignature, rawBody);
        }
        return false;
    }

    return compareSignature(secret, providedSignature, rawBody);
}

export function verifyTelebirrWebhookSignature(rawBody: string, signature: string | null): boolean {
    const appKey = process.env.TELEBIRR_APP_KEY ?? '';
    return telebirrVerifySignature(rawBody, signature ?? '', appKey);
}

export function parseChapaWebhook(
    rawBody: string,
    searchParams?: URLSearchParams
): ParsedWebhookPayload {
    const body = safeJsonParse(rawBody);
    const data = getNestedRecord(body, 'data');
    const meta = getNestedRecord(data, 'meta');
    const txRef =
        getString(body, 'trx_ref', 'tx_ref') ??
        getString(data, 'trx_ref', 'tx_ref', 'reference') ??
        searchParams?.get('trx_ref') ??
        searchParams?.get('tx_ref');

    if (!txRef) {
        throw validationError('Missing Chapa transaction reference');
    }

    const status = statusFromRaw(
        getString(body, 'status', 'event') ??
            getString(data, 'status') ??
            searchParams?.get('status') ??
            null
    );

    return {
        provider: 'chapa',
        provider_transaction_id: txRef,
        status,
        amount: getAmount(body, 'amount') ?? getAmount(data, 'amount'),
        currency: getString(body, 'currency') ?? getString(data, 'currency'),
        metadata: meta,
        raw_payload: body,
    };
}

export function parseTelebirrWebhook(
    rawBody: string,
    searchParams?: URLSearchParams
): ParsedWebhookPayload {
    const body = safeJsonParse(rawBody);

    const outTradeNo =
        getString(body, 'outTradeNo', 'tradeNo', 'transactionNo') ??
        searchParams?.get('outTradeNo') ??
        searchParams?.get('tradeNo');

    if (!outTradeNo) {
        throw validationError('Missing Telebirr transaction reference');
    }

    const tradeStatus = getString(body, 'tradeStatus', 'status', 'result');
    const status = statusFromRaw(tradeStatus);

    return {
        provider: 'telebirr',
        provider_transaction_id: outTradeNo,
        status,
        amount: getAmount(body, 'totalAmount', 'amount', 'money'),
        currency: getString(body, 'currency', 'currencyCode') ?? 'ETB',
        metadata: body,
        raw_payload: body,
    };
}

async function resolvePaymentContext(
    provider: PaymentProvider,
    providerTransactionId: string,
    metadata: Record<string, unknown>
): Promise<PaymentContext> {
    // HIGH-010: Use audited service role client for sensitive payment operations
    const admin = createAuditedServiceRoleClient('payment-webhooks', {
        metadata: { provider, providerTransactionId },
    });
    const metadataPaymentSessionId =
        typeof metadata.payment_session_id === 'string' &&
        metadata.payment_session_id.trim().length > 0
            ? metadata.payment_session_id
            : null;
    const metadataOrderId =
        typeof metadata.order_id === 'string' && metadata.order_id.trim().length > 0
            ? metadata.order_id
            : null;
    const metadataPaymentId =
        typeof metadata.payment_id === 'string' && metadata.payment_id.trim().length > 0
            ? metadata.payment_id
            : null;
    const metadataRestaurantId =
        typeof metadata.restaurant_id === 'string' && metadata.restaurant_id.trim().length > 0
            ? metadata.restaurant_id
            : null;

    if (metadataPaymentSessionId) {
        const { data } = await admin
            .from('payment_sessions')
            .select('id, restaurant_id, order_id')
            .eq('id', metadataPaymentSessionId)
            .maybeSingle();

        if (data?.restaurant_id) {
            return {
                restaurant_id: data.restaurant_id,
                order_id: data.order_id,
                payment_id: metadataPaymentId,
                payment_session_id: data.id,
            };
        }
    }

    if (metadataPaymentId) {
        const { data } = await admin
            .from('payments')
            .select('id, order_id, restaurant_id, payment_session_id')
            .eq('id', metadataPaymentId)
            .maybeSingle();

        if (data?.restaurant_id) {
            return {
                restaurant_id: data.restaurant_id,
                order_id: data.order_id,
                payment_id: data.id,
                payment_session_id:
                    (data as { payment_session_id?: string | null }).payment_session_id ?? null,
            };
        }
    }

    if (metadataOrderId) {
        const { data } = await admin
            .from('orders')
            .select('id, restaurant_id')
            .eq('id', metadataOrderId)
            .maybeSingle();

        if (data?.restaurant_id) {
            return {
                restaurant_id: data.restaurant_id,
                order_id: data.id,
                payment_id: null,
                payment_session_id: metadataPaymentSessionId,
            };
        }
    }

    const { data: paymentSession } = await admin
        .from('payment_sessions')
        .select('id, order_id, restaurant_id')
        .eq('selected_provider', provider)
        .eq('provider_transaction_id', providerTransactionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (paymentSession?.restaurant_id) {
        return {
            restaurant_id: paymentSession.restaurant_id,
            order_id: paymentSession.order_id,
            payment_id: metadataPaymentId,
            payment_session_id: paymentSession.id,
        };
    }

    const { data: payment } = await admin
        .from('payments')
        .select('id, order_id, restaurant_id, payment_session_id')
        .eq('provider', provider)
        .eq('provider_reference', providerTransactionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (payment?.restaurant_id) {
        return {
            restaurant_id: payment.restaurant_id,
            order_id: payment.order_id,
            payment_id: payment.id,
            payment_session_id:
                (payment as { payment_session_id?: string | null }).payment_session_id ?? null,
        };
    }

    const { data: order } = await admin
        .from('orders')
        .select('id, restaurant_id')
        .or(`chapa_tx_ref.eq.${providerTransactionId},telebirr_tx_ref.eq.${providerTransactionId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (order?.restaurant_id) {
        return {
            restaurant_id: order.restaurant_id,
            order_id: order.id,
            payment_id: null,
            payment_session_id: metadataPaymentSessionId,
        };
    }

    if (!metadataRestaurantId) {
        throw notFound('PaymentContext', `${provider}:${providerTransactionId}`);
    }

    return {
        restaurant_id: metadataRestaurantId,
        order_id: metadataOrderId,
        payment_id: metadataPaymentId,
        payment_session_id: metadataPaymentSessionId,
    };
}

export async function publishPaymentWebhookEvent(parsed: ParsedWebhookPayload): Promise<{
    eventId: string;
    jobMessageId?: string;
}> {
    const context = await resolvePaymentContext(
        parsed.provider,
        parsed.provider_transaction_id,
        parsed.metadata
    );
    const payload: PaymentLifecycleEventPayload = {
        restaurant_id: context.restaurant_id,
        order_id: context.order_id,
        payment_id: context.payment_id,
        payment_session_id: context.payment_session_id,
        provider: parsed.provider,
        provider_transaction_id: parsed.provider_transaction_id,
        idempotency_key:
            (typeof parsed.metadata.idempotency_key === 'string' &&
                parsed.metadata.idempotency_key.trim().length > 0 &&
                parsed.metadata.idempotency_key.trim()) ||
            randomUUID(),
        status: parsed.status,
        amount: parsed.amount,
        currency: parsed.currency,
        metadata: parsed.metadata,
        raw_payload: parsed.raw_payload,
    };

    const event = createPaymentLifecycleEvent(parsed.status, payload);
    await publishEvent(event);
    const jobMessageId = await enqueueInternalJob({
        path: '/api/v1/system/jobs/payments/complete',
        body: event as unknown as Record<string, unknown>,
        deduplicationKey: event.id,
    });

    return {
        eventId: event.id,
        jobMessageId,
    };
}
