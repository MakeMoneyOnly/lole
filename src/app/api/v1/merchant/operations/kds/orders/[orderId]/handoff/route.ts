import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';

const HandoffParamsSchema = z.object({
    orderId: z.string().uuid(),
});

const HandoffBodySchema = z.object({
    action: z.literal('bump'),
    reason: z.string().trim().min(2).max(240).optional(),
});

const EXPEDITOR_HANDOFF_ROLES = new Set(['owner', 'admin', 'manager']);

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const restaurantContext = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!restaurantContext.ok) {
        return restaurantContext.response;
    }

    const parsedParams = HandoffParamsSchema.safeParse(await context.params);
    if (!parsedParams.success) {
        return apiError('Invalid order id', 400, 'INVALID_ORDER_ID', parsedParams.error.flatten());
    }

    const parsedBody = await parseJsonBody(request, HandoffBodySchema);
    if (!parsedBody.success) {
        return parsedBody.response;
    }

    const db = restaurantContext.supabase;
    const { orderId } = parsedParams.data;
    const { reason } = parsedBody.data;

    const { data: staffRoleRow, error: staffRoleError } = await db
        .from('restaurant_staff')
        .select('role')
        .eq('restaurant_id', restaurantContext.restaurantId)
        .eq('user_id', auth.user.id)
        .eq('is_active', true)
        .maybeSingle();

    if (staffRoleError) {
        return apiError(
            'Failed to verify expeditor permissions',
            500,
            'EXPEDITOR_PERMISSION_CHECK_FAILED',
            staffRoleError.message
        );
    }

    const actorRole = String(staffRoleRow?.role ?? '');
    if (!EXPEDITOR_HANDOFF_ROLES.has(actorRole)) {
        return apiError(
            'Final handoff is restricted to expeditor override roles',
            403,
            'KDS_HANDOFF_FORBIDDEN'
        );
    }

    const [{ data: order, error: orderError }, { data: kdsItems, error: kdsItemsError }] =
        await Promise.all([
            db
                .from('orders')
                .select('id, status')
                .eq('id', orderId)
                .eq('restaurant_id', restaurantContext.restaurantId)
                .maybeSingle(),
            db
                .from('kds_order_items')
                .select('id, status')
                .eq('order_id', orderId)
                .eq('restaurant_id', restaurantContext.restaurantId),
        ]);

    if (orderError) {
        return apiError('Failed to fetch order', 500, 'ORDER_FETCH_FAILED', orderError.message);
    }
    if (!order) {
        return apiError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    if (kdsItemsError) {
        return apiError(
            'Failed to verify KDS ticket readiness',
            500,
            'KDS_ITEMS_FETCH_FAILED',
            kdsItemsError.message
        );
    }

    const normalizedKdsItems = ((kdsItems ?? []) as Array<{ status?: string }>).map(item =>
        String(item.status ?? 'queued')
    );
    if (normalizedKdsItems.length > 0 && normalizedKdsItems.some(status => status !== 'ready')) {
        return apiError(
            'Ticket is not fully ready for final handoff',
            409,
            'KDS_HANDOFF_NOT_READY'
        );
    }

    if (['served', 'completed', 'cancelled'].includes(String(order.status ?? ''))) {
        return apiError(
            `Ticket cannot be bumped from "${order.status}"`,
            409,
            'KDS_HANDOFF_INVALID_STATE'
        );
    }
    const currentStatus = String(order.status ?? '');
    if (!currentStatus) {
        return apiError('Ticket status is invalid', 409, 'KDS_HANDOFF_INVALID_STATE');
    }

    const now = new Date().toISOString();
    const { data: updatedOrder, error: updateError } = await db
        .from('orders')
        .update({
            status: 'served',
            updated_at: now,
        })
        .eq('id', order.id)
        .eq('restaurant_id', restaurantContext.restaurantId)
        .eq('status', currentStatus)
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, order_number, table_number, customer_name, status, order_type, total_price, discount_amount, notes, items, metadata, created_at, updated_at'
        )
        .single();

    if (updateError || !updatedOrder) {
        return apiError(
            'Failed to complete final handoff',
            500,
            'KDS_HANDOFF_UPDATE_FAILED',
            updateError?.message
        );
    }

    await Promise.all([
        db.from('order_events').insert({
            restaurant_id: restaurantContext.restaurantId,
            order_id: order.id,
            event_type: 'status_changed',
            from_status: currentStatus,
            to_status: 'served',
            actor_user_id: auth.user.id,
            metadata: {
                source: 'kds_expeditor_handoff',
                action: 'bump',
                reason: reason ?? null,
            },
        }),
        writeAuditLog(db, {
            restaurant_id: restaurantContext.restaurantId,
            user_id: auth.user.id,
            action: 'kds_ticket_bumped',
            entity_type: 'order',
            entity_id: order.id,
            metadata: {
                source: 'kds_expeditor_handoff',
                action: 'bump',
                reason: reason ?? null,
            },
            old_value: { status: currentStatus },
            new_value: { status: 'served' },
        }),
    ]);

    return apiSuccess({
        order: updatedOrder,
    });
}
