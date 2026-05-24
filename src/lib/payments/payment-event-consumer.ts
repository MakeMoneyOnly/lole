import type { PaymentLifecycleEvent } from '@/lib/events/contracts';
import { writeAuditLog } from '@/lib/api/audit';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import type { Json } from '@/types/database';

export interface PaymentEventProcessingResult {
    ok: boolean;
    outcome: 'processed' | 'already_processed' | 'ignored';
    paymentId: string | null;
    orderId: string | null;
    paymentSessionId?: string | null;
}

type PaymentSessionRow = {
    id: string;
    restaurant_id: string;
    order_id: string | null;
    surface: string;
    channel: string;
    intent_type: string;
    status: string;
    selected_method: string | null;
    selected_provider: string | null;
    amount: number;
    currency: string;
    checkout_url: string | null;
    provider_transaction_id: string | null;
    provider_reference: string | null;
    metadata: Json;
    authorized_at: string | null;
    captured_at: string | null;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
};

type PaymentSessionUpdateResult = {
    error: { message: string } | null;
};

export async function processPaymentLifecycleEvent(
    event: PaymentLifecycleEvent
): Promise<PaymentEventProcessingResult> {
    const admin = createServiceRoleClient();
    const { payload } = event;
    const now = new Date().toISOString();

    const { data: resolvedOrder } = payload.order_id
        ? await admin
              .from('orders')
              .select('id, restaurant_id, status, order_number, total_price, paid_at')
              .eq('id', payload.order_id)
              .maybeSingle()
        : { data: null };

    const { data: resolvedPaymentSession } = payload.payment_session_id
        ? ((await admin
              .from('payment_sessions' as string)
              // HIGH-013: Explicit column selection
              .select(
                  'id, restaurant_id, order_id, surface, channel, intent_type, status, selected_method, selected_provider, amount, currency, checkout_url, provider_transaction_id, provider_reference, metadata, authorized_at, captured_at, expires_at, created_at, updated_at'
              )
              .eq('id', payload.payment_session_id)
              .maybeSingle()) as { data: PaymentSessionRow | null })
        : payload.provider_transaction_id
          ? ((await admin
                .from('payment_sessions' as string)
                // HIGH-013: Explicit column selection
                .select(
                    'id, restaurant_id, order_id, surface, channel, intent_type, status, selected_method, selected_provider, amount, currency, checkout_url, provider_transaction_id, provider_reference, metadata, authorized_at, captured_at, expires_at, created_at, updated_at'
                )
                .eq('selected_provider', payload.provider)
                .eq('provider_transaction_id', payload.provider_transaction_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()) as { data: PaymentSessionRow | null })
          : { data: null };

    const { data: existingPayment } = await admin
        .from('payments')
        .select('id, status, order_id, restaurant_id, payment_session_id, metadata')
        .eq('provider', payload.provider)
        .eq('provider_reference', payload.provider_transaction_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const orderId =
        resolvedOrder?.id ??
        resolvedPaymentSession?.order_id ??
        existingPayment?.order_id ??
        payload.order_id ??
        null;
    const restaurantId =
        resolvedOrder?.restaurant_id ??
        resolvedPaymentSession?.restaurant_id ??
        existingPayment?.restaurant_id ??
        payload.restaurant_id;
    const paymentSessionId =
        resolvedPaymentSession?.id ??
        (existingPayment as { payment_session_id?: string | null } | null)?.payment_session_id ??
        payload.payment_session_id ??
        null;
    const monetaryAmount = payload.amount ?? resolvedOrder?.total_price ?? 0;
    const paymentStatus = payload.status === 'completed' ? 'captured' : 'failed';
    const paymentSessionStatus = payload.status === 'completed' ? 'captured' : 'failed';

    if (existingPayment?.status === paymentStatus) {
        return {
            ok: true,
            outcome: 'already_processed',
            paymentId: existingPayment.id,
            orderId,
            paymentSessionId,
        };
    }

    let paymentId = existingPayment?.id ?? payload.payment_id ?? null;

    if (existingPayment?.id) {
        const { error } = await admin
            .from('payments')
            .update({
                status: paymentStatus,
                captured_at: payload.status === 'completed' ? now : null,
                provider_reference: payload.provider_transaction_id,
                metadata: {
                    ...((existingPayment?.metadata as Record<string, unknown> | undefined) ?? {}),
                    webhook_event_id: event.id,
                    webhook_trace_id: event.trace_id,
                    webhook_status: payload.status,
                },
                payment_session_id: paymentSessionId,
            })
            .eq('id', existingPayment.id);

        if (error) {
            throw new Error(error.message);
        }
    } else {
        const { data, error } = await admin
            .from('payments')
            .insert({
                restaurant_id: restaurantId,
                order_id: orderId,
                payment_session_id: paymentSessionId,
                amount: monetaryAmount,
                currency: payload.currency ?? 'ETB',
                method: payload.provider,
                provider: payload.provider,
                provider_reference: payload.provider_transaction_id,
                status: paymentStatus,
                captured_at: payload.status === 'completed' ? now : null,
                metadata: {
                    ...payload.metadata,
                    webhook_event_id: event.id,
                    webhook_trace_id: event.trace_id,
                    webhook_status: payload.status,
                },
            })
            .select('id')
            .single();

        if (error || !data) {
            throw new Error(error?.message ?? 'Failed to create payment record');
        }

        paymentId = data.id;
    }

    if (paymentSessionId) {
        const sessionMetadata = {
            ...(((resolvedPaymentSession?.metadata as Record<string, unknown> | undefined) ??
                {}) as Record<string, unknown>),
            webhook_event_id: event.id,
            webhook_trace_id: event.trace_id,
            webhook_status: payload.status,
            payment_id: paymentId,
        };

        const { error: paymentSessionError } = (await admin
            .from('payment_sessions' as string)
            .update({
                status: paymentSessionStatus,
                selected_provider: payload.provider,
                provider_transaction_id: payload.provider_transaction_id,
                provider_reference: payload.provider_transaction_id,
                captured_at: payload.status === 'completed' ? now : null,
                metadata: sessionMetadata,
                updated_at: now,
            })
            .eq('id', paymentSessionId)) as PaymentSessionUpdateResult;

        if (paymentSessionError) {
            throw new Error(paymentSessionError.message);
        }
    }

    if (orderId) {
        const nextOrderStatus =
            payload.status === 'completed'
                ? // The current operational UI expects paid orders to move into "pending"
                  // so KDS and waiter views continue to work before the larger status-contract migration.
                  'pending'
                : 'cancelled';
        const orderPatch: Record<string, unknown> = {
            status: nextOrderStatus,
            paid_at: payload.status === 'completed' ? now : null,
        };

        if (payload.provider === 'chapa' && payload.status === 'completed') {
            orderPatch.chapa_verified = true;
        }

        const { error } = await admin.from('orders').update(orderPatch).eq('id', orderId);
        if (error) {
            throw new Error(error.message);
        }
    }

    await writeAuditLog(admin, {
        restaurant_id: restaurantId,
        action: payload.status === 'completed' ? 'payment_confirmed' : 'payment_failed',
        entity_type: 'payment',
        entity_id: paymentId,
        metadata: {
            event_id: event.id,
            trace_id: event.trace_id,
            provider: payload.provider,
            provider_transaction_id: payload.provider_transaction_id,
            idempotency_key: payload.idempotency_key,
            order_id: orderId,
            payment_session_id: paymentSessionId,
        },
        new_value: {
            status: paymentStatus,
            order_status: payload.status === 'completed' ? 'pending' : 'cancelled',
        },
    });

    return {
        ok: true,
        outcome: 'processed',
        paymentId,
        orderId,
        paymentSessionId,
    };
}
