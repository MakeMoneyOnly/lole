import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { isIdempotencyKeyValid, resolveIdempotencyKey } from '@/lib/api/idempotency';

const ExternalOrderIdSchema = z.string().uuid();

const AckPayloadSchema = z.object({
    note: z.string().trim().max(240).optional(),
});

export async function POST(
    request: Request,
    routeContext: { params: Promise<{ externalOrderId: string }> }
) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    const explicitIdempotencyKey = request.headers.get('x-idempotency-key');
    if (explicitIdempotencyKey && !isIdempotencyKeyValid(explicitIdempotencyKey)) {
        return apiError('Invalid idempotency key', 400, 'INVALID_IDEMPOTENCY_KEY');
    }
    const idempotencyKey = resolveIdempotencyKey(explicitIdempotencyKey);

    const parsedBody = await parseJsonBody(request, AckPayloadSchema);
    if (!parsedBody.success) {
        return parsedBody.response;
    }

    const { externalOrderId } = await routeContext.params;
    const parsedOrderId = ExternalOrderIdSchema.safeParse(externalOrderId);
    if (!parsedOrderId.success) {
        return apiError(
            'Invalid external order id',
            400,
            'INVALID_EXTERNAL_ORDER_ID',
            parsedOrderId.error.flatten()
        );
    }

    const { data: existing, error: fetchError } = await context.supabase
        .from('external_orders')
        .select('id, restaurant_id, provider, normalized_status, acknowledged_at')
        .eq('id', parsedOrderId.data)
        .eq('restaurant_id', context.restaurantId)
        .maybeSingle();

    if (fetchError) {
        return apiError(
            'Failed to load external order',
            500,
            'EXTERNAL_ORDER_FETCH_FAILED',
            fetchError.message
        );
    }
    if (!existing) {
        return apiError('External order not found', 404, 'EXTERNAL_ORDER_NOT_FOUND');
    }

    if (existing.acknowledged_at) {
        return apiSuccess({
            order_id: existing.id,
            acknowledged: true,
            already_acknowledged: true,
            idempotency_key: idempotencyKey,
        });
    }

    const nextStatus =
        existing.normalized_status === 'new' ? 'acknowledged' : existing.normalized_status;
    const ackedAt = new Date().toISOString();

    const { data: updated, error: updateError } = await context.supabase
        .from('external_orders')
        .update({
            acknowledged_at: ackedAt,
            acked_by: auth.user.id,
            normalized_status: nextStatus,
        })
        .eq('id', existing.id)
        .eq('restaurant_id', context.restaurantId)
        .select('id, provider, normalized_status, acknowledged_at')
        .single();

    if (updateError) {
        return apiError(
            'Failed to acknowledge external order',
            500,
            'EXTERNAL_ORDER_ACK_FAILED',
            updateError.message
        );
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'external_order_acknowledged',
        entity_type: 'external_order',
        entity_id: existing.id,
        old_value: {
            normalized_status: existing.normalized_status,
            acked_at: existing.acknowledged_at,
        },
        new_value: {
            normalized_status: updated.normalized_status,
            acked_at: updated.acknowledged_at,
        },
        metadata: {
            source: 'merchant_dashboard',
            idempotency_key: idempotencyKey,
            note: parsedBody.data.note ?? null,
        },
    });

    return apiSuccess({
        order: updated,
        idempotency_key: idempotencyKey,
    });
}
