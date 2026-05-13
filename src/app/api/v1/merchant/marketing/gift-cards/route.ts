import { randomBytes } from 'crypto';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody, parseQuery } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { isIdempotencyKeyValid, resolveIdempotencyKey } from '@/lib/api/idempotency';
import { isSchemaNotReadyError } from '@/lib/api/schemaFallback';
import type { Json } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const GiftCardsQuerySchema = z.object({
    status: z.enum(['active', 'redeemed', 'expired', 'voided']).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

const CreateGiftCardSchema = z.object({
    code: z.string().trim().min(6).max(32).optional(),
    currency: z.string().trim().min(3).max(3).optional().default('ETB'),
    initial_balance: z.coerce.number().min(1).max(500000),
    expires_at: z.string().datetime().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

function generateGiftCardCode() {
    return `GC-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function GET(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p2' });
    if (!context.ok) {
        return context.response;
    }

    const db = context.supabase as SupabaseClient<Database>;

    const url = new URL(request.url);
    const parsed = parseQuery(
        {
            status: url.searchParams.get('status') ?? undefined,
            limit: url.searchParams.get('limit') ?? undefined,
        },
        GiftCardsQuerySchema
    );
    if (!parsed.success) {
        return parsed.response;
    }

    let query = db
        .from('gift_cards')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, code, currency, initial_balance, current_balance, status, expires_at, metadata, created_by, created_at, updated_at'
        )
        .eq('restaurant_id', context.restaurantId)
        .order('created_at', { ascending: false })
        .limit(parsed.data.limit);

    if (parsed.data.status) {
        query = query.eq('status', parsed.data.status);
    }

    const { data, error } = await query;

    if (error) {
        if (isSchemaNotReadyError(error)) {
            return apiSuccess({ gift_cards: [] });
        }
        return apiError(
            'Failed to fetch gift cards',
            500,
            'GIFT_CARDS_FETCH_FAILED',
            error.message
        );
    }

    return apiSuccess({ gift_cards: data ?? [] });
}

export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p2' });
    if (!context.ok) {
        return context.response;
    }

    const db = context.supabase as SupabaseClient<Database>;

    const explicitIdempotencyKey = request.headers.get('x-idempotency-key');
    if (explicitIdempotencyKey && !isIdempotencyKeyValid(explicitIdempotencyKey)) {
        return apiError('Invalid idempotency key', 400, 'INVALID_IDEMPOTENCY_KEY');
    }
    const idempotencyKey = resolveIdempotencyKey(explicitIdempotencyKey);

    const parsed = await parseJsonBody(request, CreateGiftCardSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const code = parsed.data.code?.trim().toUpperCase() || generateGiftCardCode();
    const balance = Number(parsed.data.initial_balance.toFixed(2));

    const { data: giftCard, error } = await db
        .from('gift_cards')
        .insert({
            restaurant_id: context.restaurantId,
            code,
            currency: parsed.data.currency.toUpperCase(),
            initial_balance: balance,
            current_balance: balance,
            status: 'active',
            expires_at: parsed.data.expires_at ?? null,
            metadata: (parsed.data.metadata ?? {}) as Json,
            created_by: auth.user.id,
        })
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, code, currency, initial_balance, current_balance, status, expires_at, metadata, created_by, created_at, updated_at'
        )
        .single();

    if (error) {
        return apiError(
            'Failed to create gift card',
            500,
            'GIFT_CARD_CREATE_FAILED',
            error.message
        );
    }

    const { error: txError } = await db.from('gift_card_transactions').insert({
        restaurant_id: context.restaurantId,
        gift_card_id: giftCard.id,
        amount_delta: balance,
        balance_after: balance,
        type: 'issue',
        metadata: { source: 'merchant_dashboard', idempotency_key: idempotencyKey } as Json,
        created_by: auth.user.id,
    });

    if (txError) {
        return apiError(
            'Failed to write gift card transaction',
            500,
            'GIFT_CARD_TRANSACTION_CREATE_FAILED',
            txError.message
        );
    }

    await writeAuditLog(context.supabase as SupabaseClient<Database>, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'gift_card_created',
        entity_type: 'gift_card',
        entity_id: giftCard.id,
        new_value: {
            code: giftCard.code,
            initial_balance: giftCard.initial_balance,
            current_balance: giftCard.current_balance,
            currency: giftCard.currency,
        },
        metadata: {
            source: 'merchant_dashboard',
            idempotency_key: idempotencyKey,
        },
    });

    return apiSuccess({ gift_card: giftCard, idempotency_key: idempotencyKey }, 201);
}
