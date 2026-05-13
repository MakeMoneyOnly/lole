import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { isIdempotencyKeyValid, resolveIdempotencyKey } from '@/lib/api/idempotency';
import type { Json } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

interface GiftCardRecord {
    id: string;
    restaurant_id: string;
    status: string;
    current_balance: number;
    expires_at: string | null;
    created_at?: string;
    updated_at?: string;
}

const GiftCardIdSchema = z.string().uuid();

const RedeemGiftCardSchema = z.object({
    amount: z.coerce.number().min(0.01).max(500000),
    order_id: z.string().uuid().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(
    request: Request,
    routeContext: { params: Promise<{ giftCardId: string }> }
) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p2' });
    if (!context.ok) {
        return context.response;
    }

    const db = context.supabase as SupabaseClient<Database>;

    const { giftCardId } = await routeContext.params;
    const giftCardIdParsed = GiftCardIdSchema.safeParse(giftCardId);
    if (!giftCardIdParsed.success) {
        return apiError(
            'Invalid gift card id',
            400,
            'INVALID_GIFT_CARD_ID',
            giftCardIdParsed.error.flatten()
        );
    }

    const explicitIdempotencyKey = request.headers.get('x-idempotency-key');
    if (explicitIdempotencyKey && !isIdempotencyKeyValid(explicitIdempotencyKey)) {
        return apiError('Invalid idempotency key', 400, 'INVALID_IDEMPOTENCY_KEY');
    }
    const idempotencyKey = resolveIdempotencyKey(explicitIdempotencyKey);

    const parsed = await parseJsonBody(request, RedeemGiftCardSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { data: giftCard, error: giftCardError } = (await db
        .from('gift_cards')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, code, currency, initial_balance, current_balance, status, expires_at, metadata, created_by, created_at, updated_at'
        )
        .eq('id', giftCardIdParsed.data)
        .eq('restaurant_id', context.restaurantId)
        .maybeSingle()) as { data: GiftCardRecord | null; error: unknown };

    if (giftCardError) {
        return apiError(
            'Failed to load gift card',
            500,
            'GIFT_CARD_FETCH_FAILED',
            (giftCardError as { message?: string })?.message ?? 'Unknown error'
        );
    }
    if (!giftCard) {
        return apiError('Gift card not found', 404, 'GIFT_CARD_NOT_FOUND');
    }
    if (giftCard.status !== 'active') {
        return apiError('Gift card is not active', 409, 'GIFT_CARD_NOT_ACTIVE');
    }

    if (giftCard.expires_at && new Date(giftCard.expires_at).getTime() < Date.now()) {
        return apiError('Gift card is expired', 409, 'GIFT_CARD_EXPIRED');
    }

    const nextBalance =
        Number(Number(giftCard.current_balance).toFixed(2)) - Number(parsed.data.amount.toFixed(2));
    if (nextBalance < 0) {
        return apiError('Insufficient gift card balance', 409, 'GIFT_CARD_INSUFFICIENT_BALANCE');
    }

    const nextStatus = nextBalance === 0 ? 'redeemed' : 'active';

    const { data: updated, error: updateError } = (await db
        .from('gift_cards')
        .update({
            current_balance: nextBalance,
            status: nextStatus,
            updated_at: new Date().toISOString(),
        })
        .eq('id', giftCard.id)
        .eq('restaurant_id', context.restaurantId)
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, code, currency, initial_balance, current_balance, status, expires_at, metadata, created_by, created_at, updated_at'
        )
        .single()) as { data: GiftCardRecord | null; error: unknown };

    if (updateError) {
        return apiError(
            'Failed to redeem gift card',
            500,
            'GIFT_CARD_REDEEM_FAILED',
            (updateError as { message?: string })?.message ?? 'Unknown error'
        );
    }

    const { data: transaction, error: txError } = (await db
        .from('gift_card_transactions')
        .insert({
            restaurant_id: context.restaurantId,
            gift_card_id: giftCard.id,
            order_id: parsed.data.order_id ?? null,
            amount_delta: -Number(parsed.data.amount.toFixed(2)),
            balance_after: nextBalance,
            type: 'redeem',
            metadata: {
                source: 'merchant_dashboard',
                ...parsed.data.metadata,
                idempotency_key: idempotencyKey,
            } as Json,
            created_by: auth.user.id,
        })
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, gift_card_id, order_id, amount_delta, balance_after, type, metadata, created_by, created_at'
        )
        .single()) as { data: { id: string } | null; error: unknown };

    if (txError) {
        return apiError(
            'Failed to create gift card transaction',
            500,
            'GIFT_CARD_TRANSACTION_CREATE_FAILED',
            (txError as { message?: string })?.message ?? 'Unknown error'
        );
    }

    await writeAuditLog(context.supabase as SupabaseClient<Database>, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'gift_card_redeemed',
        entity_type: 'gift_card',
        entity_id: giftCard.id,
        old_value: {
            current_balance: giftCard.current_balance,
            status: giftCard.status,
        },
        new_value: {
            current_balance: (updated as GiftCardRecord).current_balance,
            status: (updated as GiftCardRecord).status,
            amount: parsed.data.amount,
        },
        metadata: {
            order_id: parsed.data.order_id ?? null,
            transaction_id: (transaction as { id: string }).id,
            idempotency_key: idempotencyKey,
        },
    });

    return apiSuccess({
        gift_card: updated,
        transaction,
        idempotency_key: idempotencyKey,
    });
}
