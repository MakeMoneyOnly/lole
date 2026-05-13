import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { enforcePilotAccess } from '@/lib/api/pilotGate';

const BulkStatusSchema = z.object({
    order_ids: z.array(z.string().uuid()).min(1).max(50),
    status: z.enum(['acknowledged', 'preparing', 'ready', 'served', 'completed', 'cancelled']),
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pending: ['acknowledged', 'cancelled'],
    acknowledged: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['served', 'cancelled'],
    served: ['completed'],
    completed: [],
    cancelled: [],
};

function canTransition(current: string | null, next: string) {
    if (!current) {
        return false;
    }
    return (ALLOWED_TRANSITIONS[current] || []).includes(next);
}

export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const parsed = await parseJsonBody(request, BulkStatusSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const supabase = auth.supabase;
    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, status, restaurant_id')
        .in('id', parsed.data.order_ids);

    if (ordersError) {
        return apiError('Failed to load orders', 500, 'ORDERS_FETCH_FAILED', ordersError.message);
    }

    if (!orders || orders.length === 0) {
        return apiError('No matching orders found', 404, 'ORDERS_NOT_FOUND');
    }

    const restaurantIds = new Set(orders.map(o => o.restaurant_id));
    if (restaurantIds.size > 1) {
        return apiError(
            'Bulk update requires orders from a single restaurant',
            409,
            'CROSS_RESTAURANT_BULK_NOT_ALLOWED'
        );
    }

    const restaurantId = orders[0].restaurant_id;
    const pilotGateResponse = enforcePilotAccess(restaurantId, request.method);
    if (pilotGateResponse) {
        return pilotGateResponse;
    }

    const invalid = orders.filter(order => !canTransition(order.status, parsed.data.status));
    if (invalid.length > 0) {
        return apiError(
            'One or more orders have invalid status transitions',
            409,
            'INVALID_BULK_TRANSITION',
            invalid.map(item => ({ id: item.id, current_status: item.status }))
        );
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, string> = {
        status: parsed.data.status,
        updated_at: now,
    };
    if (parsed.data.status === 'acknowledged') {
        updatePayload.acknowledged_at = now;
    }
    if (parsed.data.status === 'ready' || parsed.data.status === 'completed') {
        updatePayload.completed_at = now;
    }

    const { data: updated, error: updateError } = await supabase
        .from('orders')
        .update(updatePayload)
        .in('id', parsed.data.order_ids)
        .select('id, status, restaurant_id');

    if (updateError) {
        return apiError('Failed to update orders', 500, 'BULK_UPDATE_FAILED', updateError.message);
    }

    const eventRows = orders.map(order => ({
        restaurant_id: order.restaurant_id,
        order_id: order.id,
        event_type: 'bulk_status_changed',
        from_status: order.status,
        to_status: parsed.data.status,
        actor_user_id: auth.user.id,
        metadata: { source: 'merchant_dashboard' },
    }));

    const { error: eventError } = await supabase.from('order_events').insert(eventRows);
    if (eventError) {
        console.warn(
            '[POST /api/orders/bulk-status] order_events insert failed:',
            eventError.message
        );
    }

    for (const order of orders) {
        await writeAuditLog(supabase, {
            restaurant_id: order.restaurant_id,
            user_id: auth.user.id,
            action: 'orders_bulk_status_updated',
            entity_type: 'order',
            entity_id: order.id,
            old_value: { status: order.status },
            new_value: { status: parsed.data.status },
            metadata: { source: 'merchant_dashboard' },
        });
    }

    return apiSuccess({
        updated_count: updated?.length ?? 0,
        status: parsed.data.status,
        order_ids: parsed.data.order_ids,
    });
}
