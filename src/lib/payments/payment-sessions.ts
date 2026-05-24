import { createPaymentAdapterRegistry } from '@/lib/payments/adapters';
import type { PaymentProviderName as BasePaymentProviderName } from '@/lib/payments/types';
import type { Json } from '@/types/database';

export const PAYMENT_SESSION_SURFACES = [
    'guest_qr',
    'online_order',
    'waiter_pos',
    'terminal',
] as const;

export const PAYMENT_SESSION_CHANNELS = ['dine_in', 'pickup', 'delivery', 'online'] as const;

export const PAYMENT_SESSION_INTENTS = [
    'pay_now',
    'pay_later',
    'waiter_close_out',
    'staff_recorded',
    'assisted_digital',
] as const;

export const PAYMENT_SESSION_STATUSES = [
    'created',
    'awaiting_method',
    'pending_provider',
    'authorized',
    'captured',
    'failed',
    'cancelled',
    'expired',
] as const;

export type PaymentSessionSurface = (typeof PAYMENT_SESSION_SURFACES)[number];
export type PaymentSessionChannel = (typeof PAYMENT_SESSION_CHANNELS)[number];
export type PaymentSessionIntent = (typeof PAYMENT_SESSION_INTENTS)[number];
export type PaymentSessionStatus = (typeof PAYMENT_SESSION_STATUSES)[number];
export type PaymentSessionMethod =
    | 'cash'
    | 'chapa'
    | 'card'
    | 'other'
    | 'gift_card'
    | 'bank_transfer';
export type PaymentProviderName = Exclude<BasePaymentProviderName, 'internal'>;

export interface PaymentSessionRecord {
    id: string;
    restaurant_id: string;
    order_id: string | null;
    surface: PaymentSessionSurface;
    channel: PaymentSessionChannel;
    intent_type: PaymentSessionIntent;
    status: PaymentSessionStatus;
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
}

type DbResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;

type DbQueryBuilder<T> = {
    eq(column: string, value: string | number | boolean): DbQueryBuilder<T>;
    order(column: string, options?: { ascending?: boolean }): DbQueryBuilder<T>;
    limit(count: number): DbQueryBuilder<T>;
    maybeSingle(): DbResult<T>;
    single(): DbResult<T>;
};

type DbInsertBuilder<T> = {
    select(columns: string): { single(): DbResult<T> };
};

type DbUpdateBuilder<T> = {
    eq(column: string, value: string): { select(columns: string): { single(): DbResult<T> } };
};

type DbFromBuilder = {
    select(columns: string): DbQueryBuilder<Record<string, unknown>>;
    insert(payload: Record<string, unknown>): DbInsertBuilder<Record<string, unknown>>;
    update(payload: Record<string, unknown>): DbUpdateBuilder<Record<string, unknown>>;
};

type DbLike = {
    from(table: string): DbFromBuilder;
};

export function getSurfaceForOrderMode(isOnlineOrder: boolean): PaymentSessionSurface {
    return isOnlineOrder ? 'online_order' : 'guest_qr';
}

export function getDefaultProviderForMethod(_method?: string | null): PaymentProviderName {
    return 'chapa';
}

async function getRestaurantChapaSplitConfig(
    db: DbLike,
    restaurantId: string
): Promise<{
    subaccountId?: string;
    splitValue: number;
    settlementMode: 'subaccount_split' | 'platform_hold';
    merchantPayoutStatus: string;
}> {
    const { data, error } = await db
        .from('restaurants')
        .select(
            'chapa_subaccount_id, chapa_subaccount_status, hosted_checkout_fee_percentage, platform_fee_percentage'
        )
        .eq('id', restaurantId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    const subaccountId = String(data?.chapa_subaccount_id ?? '').trim();
    const merchantPayoutStatus =
        String(data?.chapa_subaccount_status ?? '').trim() || 'not_configured';
    const splitValue =
        typeof data?.hosted_checkout_fee_percentage === 'number'
            ? Number(data.hosted_checkout_fee_percentage)
            : Number(data?.platform_fee_percentage ?? 0.03);
    const canUseSubaccount =
        subaccountId.length > 0 &&
        !['failed', 'verification_required', 'not_configured'].includes(merchantPayoutStatus);

    return {
        ...(canUseSubaccount ? { subaccountId } : {}),
        splitValue,
        settlementMode: canUseSubaccount ? 'subaccount_split' : 'platform_hold',
        merchantPayoutStatus,
    };
}

export async function createPaymentSession(
    db: DbLike,
    input: {
        restaurant_id: string;
        order_id?: string | null;
        surface: PaymentSessionSurface;
        channel: PaymentSessionChannel;
        intent_type: PaymentSessionIntent;
        status?: PaymentSessionStatus;
        selected_method?: string | null;
        selected_provider?: string | null;
        amount: number;
        currency?: string;
        metadata?: Json;
        expires_at?: string | null;
        created_by?: string | null;
    }
): Promise<PaymentSessionRecord> {
    const now = new Date().toISOString();
    const { data, error } = await db
        .from('payment_sessions')
        .insert({
            restaurant_id: input.restaurant_id,
            order_id: input.order_id ?? null,
            surface: input.surface,
            channel: input.channel,
            intent_type: input.intent_type,
            status: input.status ?? 'created',
            selected_method: input.selected_method ?? null,
            selected_provider: input.selected_provider ?? null,
            amount: Number(input.amount.toFixed(2)),
            currency: input.currency ?? 'ETB',
            metadata: (input.metadata ?? {}) as Json,
            expires_at: input.expires_at ?? null,
            created_by: input.created_by ?? null,
            updated_at: now,
        })
        .select(
            'id, restaurant_id, order_id, surface, channel, intent_type, status, selected_method, selected_provider, amount, currency, checkout_url, provider_transaction_id, provider_reference, metadata, authorized_at, captured_at, expires_at, created_at, updated_at'
        )
        .single();

    if (error || !data) {
        throw new Error(error?.message ?? 'Failed to create payment session');
    }

    return data as unknown as PaymentSessionRecord;
}

export async function updatePaymentSession(
    db: DbLike,
    paymentSessionId: string,
    patch: Record<string, unknown>
): Promise<PaymentSessionRecord> {
    const { data, error } = await db
        .from('payment_sessions')
        .update({
            ...patch,
            updated_at: new Date().toISOString(),
        })
        .eq('id', paymentSessionId)
        .select(
            'id, restaurant_id, order_id, surface, channel, intent_type, status, selected_method, selected_provider, amount, currency, checkout_url, provider_transaction_id, provider_reference, metadata, authorized_at, captured_at, expires_at, created_at, updated_at'
        )
        .single();

    if (error || !data) {
        throw new Error(error?.message ?? 'Failed to update payment session');
    }

    return data as unknown as PaymentSessionRecord;
}

export async function findLatestPaymentSessionForOrder(
    db: DbLike,
    restaurantId: string,
    orderId: string
): Promise<PaymentSessionRecord | null> {
    const { data, error } = await db
        .from('payment_sessions')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, order_id, surface, channel, intent_type, status, selected_method, selected_provider, amount, currency, checkout_url, provider_transaction_id, provider_reference, metadata, authorized_at, captured_at, expires_at, created_at, updated_at'
        )
        .eq('restaurant_id', restaurantId)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    return (data ?? null) as PaymentSessionRecord | null;
}

export async function initiateHostedPaymentSession(params: {
    db: DbLike;
    paymentSessionId: string;
    restaurantId: string;
    orderId: string;
    amount: number;
    currency?: string;
    email?: string | null;
    metadata?: Record<string, unknown>;
    returnUrl: string;
    callbackUrl?: string;
}): Promise<{
    paymentSession: PaymentSessionRecord;
    paymentId: string;
    checkoutUrl: string;
    provider: PaymentProviderName;
    transactionReference: string;
    attempts: Array<{ provider: string; ok: boolean; error?: string }>;
    fallbackApplied: boolean;
}> {
    const registry = createPaymentAdapterRegistry();
    const splitConfig = await getRestaurantChapaSplitConfig(params.db, params.restaurantId);
    const initiation = await registry.initiateWithFallback({
        preferredProvider: 'chapa',
        input: {
            amount: Number(params.amount.toFixed(2)),
            currency: (params.currency ?? 'ETB').toUpperCase(),
            email: params.email ?? undefined,
            metadata: {
                ...(params.metadata ?? {}),
                settlement_mode: splitConfig.settlementMode,
                merchant_payout_status: splitConfig.merchantPayoutStatus,
            },
            returnUrl: params.returnUrl,
            callbackUrl: params.callbackUrl,
            ...(splitConfig.subaccountId
                ? {
                      subaccountId: splitConfig.subaccountId,
                      splitType: 'percentage' as const,
                      splitValue: splitConfig.splitValue,
                  }
                : {}),
        },
    });
    const resolvedProvider: PaymentProviderName = 'chapa';

    const paymentInsert = await params.db
        .from('payments')
        .insert({
            restaurant_id: params.restaurantId,
            order_id: params.orderId,
            payment_session_id: params.paymentSessionId,
            method: resolvedProvider,
            provider: resolvedProvider,
            provider_reference: initiation.result.transactionReference,
            amount: Number(params.amount.toFixed(2)),
            currency: (params.currency ?? 'ETB').toUpperCase(),
            status: 'pending',
            metadata: {
                ...(params.metadata ?? {}),
                payment_session_id: params.paymentSessionId,
                provider_attempts: initiation.attempts,
                fallback_applied: initiation.fallbackApplied,
            } as Json,
        })
        .select('id')
        .single();

    if (paymentInsert.error || !paymentInsert.data?.id) {
        throw new Error(paymentInsert.error?.message ?? 'Failed to create pending payment');
    }

    const paymentId = String(paymentInsert.data.id);

    const paymentSession = await updatePaymentSession(params.db, params.paymentSessionId, {
        status: 'pending_provider',
        selected_method: resolvedProvider,
        selected_provider: resolvedProvider,
        checkout_url: initiation.result.checkoutUrl,
        provider_transaction_id: initiation.result.transactionReference,
        metadata: {
            ...(params.metadata ?? {}),
            payment_id: paymentId,
            payment_session_id: params.paymentSessionId,
            provider_attempts: initiation.attempts,
            fallback_applied: initiation.fallbackApplied,
        } as unknown as Json,
    });

    return {
        paymentSession,
        paymentId: paymentId,
        checkoutUrl: initiation.result.checkoutUrl,
        provider: resolvedProvider,
        transactionReference: initiation.result.transactionReference,
        attempts: initiation.attempts,
        fallbackApplied: initiation.fallbackApplied,
    };
}

export async function ensurePaymentSessionForRecordedPayment(
    db: DbLike,
    input: {
        restaurantId: string;
        orderId?: string | null;
        surface: PaymentSessionSurface;
        channel: PaymentSessionChannel;
        method: PaymentSessionMethod;
        provider?: string | null;
        amount: number;
        status:
            | 'pending'
            | 'authorized'
            | 'captured'
            | 'failed'
            | 'voided'
            | 'partially_refunded'
            | 'refunded';
        metadata?: Json;
    }
): Promise<PaymentSessionRecord> {
    const existing =
        input.orderId != null
            ? await findLatestPaymentSessionForOrder(db, input.restaurantId, input.orderId)
            : null;

    const nextStatus: PaymentSessionStatus =
        input.status === 'captured'
            ? 'captured'
            : input.status === 'authorized'
              ? 'authorized'
              : input.status === 'voided'
                ? 'cancelled'
                : input.status === 'partially_refunded' || input.status === 'refunded'
                  ? 'captured'
                  : input.status === 'failed'
                    ? 'failed'
                    : 'pending_provider';

    if (existing) {
        return updatePaymentSession(db, existing.id, {
            status: nextStatus,
            selected_method: input.method,
            selected_provider:
                input.provider && input.provider !== 'internal'
                    ? input.provider
                    : existing.selected_provider,
            amount: Number(input.amount.toFixed(2)),
            metadata: input.metadata ?? existing.metadata,
            ...(nextStatus === 'authorized' ? { authorized_at: new Date().toISOString() } : {}),
            ...(nextStatus === 'captured' ? { captured_at: new Date().toISOString() } : {}),
        });
    }

    return createPaymentSession(db, {
        restaurant_id: input.restaurantId,
        order_id: input.orderId ?? null,
        surface: input.surface,
        channel: input.channel,
        intent_type: input.method === 'chapa' ? 'assisted_digital' : 'staff_recorded',
        status: nextStatus,
        selected_method: input.method,
        selected_provider: input.provider && input.provider !== 'internal' ? input.provider : null,
        amount: input.amount,
        metadata: input.metadata,
    });
}
