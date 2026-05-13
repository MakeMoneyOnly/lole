import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { isIdempotencyKeyValid, resolveIdempotencyKey } from '@/lib/api/idempotency';
import { writeAuditLog } from '@/lib/api/audit';

const KdsItemActionSchema = z.object({
    action: z.enum(['start', 'hold', 'ready', 'recall']),
    reason: z.string().trim().min(2).max(240).optional(),
});

const KdsItemIdParamSchema = z.object({
    kdsItemId: z.string().uuid(),
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    queued: ['start', 'hold'],
    in_progress: ['hold', 'ready'],
    on_hold: ['start'],
    ready: ['recall'],
    recalled: ['start', 'hold', 'ready'],
};

const RECALL_OVERRIDE_ROLES = new Set(['owner', 'admin', 'manager']);

function toKdsStatus(action: z.infer<typeof KdsItemActionSchema>['action']) {
    if (action === 'start') return 'in_progress';
    if (action === 'hold') return 'on_hold';
    if (action === 'ready') return 'ready';
    return 'recalled';
}

function toOrderItemStatus(kdsStatus: string): 'pending' | 'cooking' | 'ready' {
    if (kdsStatus === 'ready') return 'ready';
    if (kdsStatus === 'in_progress' || kdsStatus === 'recalled') return 'cooking';
    return 'pending';
}

function deriveStationStatus(
    items: Array<{ station: string; status: string }>,
    stations: string[]
): string | null {
    const scoped = items.filter(item => stations.includes(item.station));
    if (scoped.length === 0) return null;
    if (scoped.every(item => item.status === 'ready')) return 'ready';
    if (scoped.some(item => item.status === 'in_progress' || item.status === 'recalled'))
        return 'preparing';
    if (scoped.some(item => item.status === 'on_hold')) return 'acknowledged';
    return 'pending';
}

export async function POST(request: Request, context: { params: Promise<{ kdsItemId: string }> }) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const restaurantContext = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!restaurantContext.ok) {
        return restaurantContext.response;
    }

    const parsedParams = KdsItemIdParamSchema.safeParse(await context.params);
    if (!parsedParams.success) {
        return apiError('Invalid item id', 400, 'INVALID_ITEM_ID', parsedParams.error.flatten());
    }

    const explicitIdempotencyKey = request.headers.get('x-idempotency-key');
    if (explicitIdempotencyKey && !isIdempotencyKeyValid(explicitIdempotencyKey)) {
        return apiError('Invalid idempotency key', 400, 'INVALID_IDEMPOTENCY_KEY');
    }
    const idempotencyKey = resolveIdempotencyKey(explicitIdempotencyKey);

    const parsedBody = await parseJsonBody(request, KdsItemActionSchema);
    if (!parsedBody.success) {
        return parsedBody.response;
    }

    const db = restaurantContext.supabase;
    const { kdsItemId } = parsedParams.data;
    const { action, reason } = parsedBody.data;

    const { data: item, error: itemError } = await db
        .from('kds_order_items')
        .select('id, restaurant_id, order_id, order_item_id, station, status')
        .eq('id', kdsItemId)
        .eq('restaurant_id', restaurantContext.restaurantId)
        .maybeSingle();

    if (itemError) {
        return apiError('Failed to load KDS item', 500, 'KDS_ITEM_FETCH_FAILED', itemError.message);
    }
    if (!item) {
        return apiError('KDS item not found', 404, 'KDS_ITEM_NOT_FOUND');
    }

    const allowedActions = ALLOWED_TRANSITIONS[item.status] ?? [];
    if (!allowedActions.includes(action)) {
        return apiError(
            `Invalid item transition from "${item.status}" via "${action}"`,
            409,
            'INVALID_ITEM_TRANSITION'
        );
    }

    if (action === 'recall') {
        const [
            { data: staffRole, error: staffRoleError },
            { data: agencyRole, error: agencyRoleError },
        ] = await Promise.all([
            db
                .from('restaurant_staff')
                .select('role')
                .eq('restaurant_id', restaurantContext.restaurantId)
                .eq('user_id', auth.user.id)
                .eq('is_active', true)
                .maybeSingle(),
            db.from('agency_users').select('role').eq('user_id', auth.user.id).maybeSingle(),
        ]);

        if (staffRoleError || agencyRoleError) {
            return apiError(
                'Failed to verify recall permissions',
                500,
                'KDS_RECALL_PERMISSION_CHECK_FAILED',
                staffRoleError?.message ?? agencyRoleError?.message
            );
        }

        const staffRoleValue = String(staffRole?.role ?? '');
        const agencyRoleValue = String(agencyRole?.role ?? '');
        const canRecall = RECALL_OVERRIDE_ROLES.has(staffRoleValue) || agencyRoleValue === 'admin';

        if (!canRecall) {
            return apiError(
                'Recall is restricted to manager/expeditor override roles',
                403,
                'KDS_RECALL_FORBIDDEN'
            );
        }
    }

    const now = new Date().toISOString();
    const nextStatus = toKdsStatus(action);
    const updatePayload: Record<string, unknown> = {
        status: nextStatus,
        last_action_by: auth.user.id,
        last_action_at: now,
        updated_at: now,
    };
    if (action === 'start') updatePayload.started_at = now;
    if (action === 'hold') updatePayload.held_at = now;
    if (action === 'ready') updatePayload.ready_at = now;
    if (action === 'recall') updatePayload.recalled_at = now;

    const { data: updatedItem, error: updateError } = await restaurantContext.supabase
        .from('kds_order_items')
        .update(updatePayload)
        .eq('id', item.id)
        .eq('restaurant_id', restaurantContext.restaurantId)
        .select(
            'id, restaurant_id, order_id, order_item_id, station, status, name, quantity, notes, modifiers, last_action_by, last_action_at, started_at, held_at, ready_at, recalled_at, created_at, updated_at'
        )
        .single();

    if (updateError || !updatedItem) {
        return apiError(
            'Failed to update KDS item',
            500,
            'KDS_ITEM_UPDATE_FAILED',
            updateError?.message
        );
    }

    const { error: eventError } = await restaurantContext.supabase.from('kds_item_events').insert({
        restaurant_id: restaurantContext.restaurantId,
        kds_order_item_id: updatedItem.id,
        order_id: updatedItem.order_id,
        event_type: action,
        from_status: item.status,
        to_status: updatedItem.status,
        actor_user_id: auth.user.id,
        reason: reason ?? null,
        metadata: {
            source: 'kds_web',
            idempotency_key: idempotencyKey,
        },
    });
    if (eventError) {
        return apiError(
            'Failed to write KDS item event',
            500,
            'KDS_ITEM_EVENT_FAILED',
            eventError.message
        );
    }

    if (updatedItem.order_item_id) {
        await db
            .from('order_items')
            .update({
                status: toOrderItemStatus(updatedItem.status),
                started_at: action === 'start' ? now : undefined,
                completed_at: action === 'ready' ? now : undefined,
            })
            .eq('id', updatedItem.order_item_id);
    }

    const [{ data: siblingItems }, { data: order }] = await Promise.all([
        restaurantContext.supabase
            .from('kds_order_items')
            .select('station, status')
            .eq('order_id', updatedItem.order_id)
            .eq('restaurant_id', restaurantContext.restaurantId),
        db
            .from('orders')
            .select('id, status, kitchen_status, bar_status')
            .eq('id', updatedItem.order_id)
            .maybeSingle(),
    ]);

    const nextOrderUpdate: Record<string, unknown> = {};
    const normalizedSiblings = (
        (siblingItems ?? []) as Array<{ station?: string; status?: string }>
    ).map(row => ({
        station: row.station ?? 'kitchen',
        status: row.status ?? 'queued',
    }));

    if (normalizedSiblings.length > 0 && order) {
        const kitchenStatus = deriveStationStatus(normalizedSiblings, [
            'kitchen',
            'dessert',
            'coffee',
        ]);
        const barStatus = deriveStationStatus(normalizedSiblings, ['bar']);
        if (kitchenStatus) nextOrderUpdate.kitchen_status = kitchenStatus;
        if (barStatus) nextOrderUpdate.bar_status = barStatus;

        const allReady = normalizedSiblings.every(row => row.status === 'ready');
        if (allReady && !['served', 'completed', 'cancelled'].includes(order.status ?? '')) {
            nextOrderUpdate.status = 'ready';
            nextOrderUpdate.completed_at = now;
        } else if (
            (action === 'start' || action === 'recall') &&
            ['pending', 'acknowledged', 'ready'].includes(order.status ?? '')
        ) {
            nextOrderUpdate.status = 'preparing';
        }

        if (Object.keys(nextOrderUpdate).length > 0) {
            nextOrderUpdate.updated_at = now;
            await db.from('orders').update(nextOrderUpdate).eq('id', updatedItem.order_id);
        }
    }

    await writeAuditLog(db, {
        restaurant_id: restaurantContext.restaurantId,
        user_id: auth.user.id,
        action: `kds_item_${action}`,
        entity_type: 'kds_order_item',
        entity_id: updatedItem.id,
        metadata: {
            source: 'kds_web',
            station: updatedItem.station,
            reason: reason ?? null,
            idempotency_key: idempotencyKey,
            order_id: updatedItem.order_id,
        },
        old_value: {
            status: item.status,
        },
        new_value: {
            status: updatedItem.status,
        },
    });

    return apiSuccess({
        item: updatedItem,
        idempotency_key: idempotencyKey,
    });
}
