import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { enforcePilotAccess } from '@/lib/api/pilotGate';

const AssignOrderSchema = z.object({
    staff_id: z.string().uuid(),
});

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const parsed = await parseJsonBody(request, AssignOrderSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { orderId } = await context.params;
    const supabase = auth.supabase;

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, restaurant_id')
        .eq('id', orderId)
        .maybeSingle();

    if (orderError) {
        return apiError('Failed to load order', 500, 'ORDER_FETCH_FAILED', orderError.message);
    }
    if (!order) {
        return apiError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    const pilotGateResponse = enforcePilotAccess(order.restaurant_id, request.method);
    if (pilotGateResponse) {
        return pilotGateResponse;
    }

    const { data: staffAssignee, error: assigneeError } = await supabase
        .from('restaurant_staff')
        .select('id, user_id, restaurant_id, is_active')
        .eq('id', parsed.data.staff_id)
        .eq('restaurant_id', order.restaurant_id)
        .eq('is_active', true)
        .maybeSingle();

    if (assigneeError) {
        return apiError(
            'Failed to verify assignee',
            500,
            'ASSIGNEE_LOOKUP_FAILED',
            assigneeError.message
        );
    }
    if (!staffAssignee) {
        return apiError('Assignee not found or inactive', 404, 'ASSIGNEE_NOT_FOUND');
    }

    const { error: eventError } = await supabase.from('order_events').insert({
        restaurant_id: order.restaurant_id,
        order_id: order.id,
        event_type: 'assigned',
        actor_user_id: auth.user.id,
        metadata: {
            assigned_staff_id: staffAssignee.id,
            assigned_user_id: staffAssignee.user_id,
            source: 'merchant_dashboard',
        },
    });
    if (eventError) {
        return apiError(
            'Failed to record assignment event',
            500,
            'ORDER_ASSIGNMENT_EVENT_FAILED',
            eventError.message
        );
    }

    await writeAuditLog(supabase, {
        restaurant_id: order.restaurant_id,
        user_id: auth.user.id,
        action: 'order_assigned',
        entity_type: 'order',
        entity_id: order.id,
        metadata: {
            assigned_staff_id: staffAssignee.id,
            assigned_user_id: staffAssignee.user_id,
            source: 'merchant_dashboard',
        },
        new_value: { assigned_staff_id: staffAssignee.id },
    });

    return apiSuccess({
        order_id: order.id,
        assigned_staff_id: staffAssignee.id,
        assigned_user_id: staffAssignee.user_id,
    });
}
