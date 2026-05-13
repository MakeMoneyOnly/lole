import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';

const UpdateGiftCardSchema = z.object({
    status: z.enum(['active', 'redeemed', 'expired', 'archived', 'voided']).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ giftCardId: string }> }
) {
    const { giftCardId } = await params;

    const auth = await getAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p2' });
    if (!context.ok) return context.response;

    const parsed = await parseJsonBody(request, UpdateGiftCardSchema);
    if (!parsed.success) return parsed.response;

    const db = context.supabase as SupabaseClient<Database>;

    const { data: giftCard, error: fetchError } = await db
        .from('gift_cards')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, code, currency, initial_balance, current_balance, status, expires_at, metadata, created_by, created_at, updated_at'
        )
        .eq('id', giftCardId)
        .eq('restaurant_id', context.restaurantId)
        .single();

    if (fetchError || !giftCard) {
        return apiError('Gift card not found', 404, 'GIFT_CARD_NOT_FOUND');
    }

    const updateData = {
        ...parsed.data,
        metadata: parsed.data.metadata ? (parsed.data.metadata as Json) : undefined,
        updated_at: new Date().toISOString(),
    };
    const { data, error } = await db
        .from('gift_cards')
        .update(updateData)
        .eq('id', giftCardId)
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, code, currency, initial_balance, current_balance, status, expires_at, metadata, created_by, created_at, updated_at'
        )
        .single();

    if (error) {
        return apiError(
            'Failed to update gift card',
            500,
            'GIFT_CARD_UPDATE_FAILED',
            error.message
        );
    }

    await writeAuditLog(context.supabase as SupabaseClient<Database>, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'gift_card_updated',
        entity_type: 'gift_card',
        entity_id: giftCardId,
        old_value: giftCard,
        new_value: data,
        metadata: { source: 'merchant_dashboard' },
    });

    return apiSuccess({ gift_card: data });
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ giftCardId: string }> }
) {
    const { giftCardId } = await params;

    const auth = await getAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p2' });
    if (!context.ok) return context.response;

    const db = context.supabase as SupabaseClient<Database>;

    const { error } = await db
        .from('gift_cards')
        .delete()
        .eq('id', giftCardId)
        .eq('restaurant_id', context.restaurantId);

    if (error) {
        return apiError(
            'Failed to delete gift card',
            500,
            'GIFT_CARD_DELETE_FAILED',
            error.message
        );
    }

    await writeAuditLog(context.supabase as SupabaseClient<Database>, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'gift_card_deleted',
        entity_type: 'gift_card',
        entity_id: giftCardId,
        metadata: { source: 'merchant_dashboard' },
    });

    return apiSuccess({ deleted: true });
}
