import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import {
    getAuthenticatedUser,
    getAuthorizedRestaurantContext,
    getDeviceContext,
} from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';

const CourseFireModeSchema = z.object({
    fire_mode: z.enum(['auto', 'manual']).optional(),
    current_course: z.enum(['appetizer', 'main', 'dessert', 'beverage', 'side']).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ orderId: string }> }) {
    const auth = await getAuthenticatedUser();
    let actorUserId: string | null = null;
    let restaurantId: string;
    let db: Awaited<ReturnType<typeof getAuthorizedRestaurantContext>>['supabase'] | undefined;

    if (auth.ok) {
        const restaurantContext = await getAuthorizedRestaurantContext(auth.user.id);
        if (!restaurantContext.ok) {
            return restaurantContext.response;
        }
        actorUserId = auth.user.id;
        restaurantId = restaurantContext.restaurantId;
        db = restaurantContext.supabase;
    } else {
        const deviceContext = await getDeviceContext(request);
        if (!deviceContext.ok) {
            return auth.response;
        }
        restaurantId = deviceContext.restaurantId;
        db = deviceContext.admin;
    }

    const parsed = await parseJsonBody(request, CourseFireModeSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { orderId } = await context.params;

    // Get current order to check status
    const { data: order, error: orderError } = await db
        .from('orders')
        .select('id, status, fire_mode, current_course')
        .eq('restaurant_id', restaurantId)
        .eq('id', orderId)
        .maybeSingle();

    if (orderError) {
        return apiError('Failed to load order', 500, 'ORDER_FETCH_FAILED', orderError.message);
    }

    if (!order) {
        return apiError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {};

    if (parsed.data.fire_mode !== undefined) {
        updatePayload.fire_mode = parsed.data.fire_mode;
    }

    if (parsed.data.current_course !== undefined) {
        updatePayload.current_course = parsed.data.current_course;
    }

    if (Object.keys(updatePayload).length === 0) {
        return apiError('No valid fields to update', 400, 'NO_FIELDS_TO_UPDATE');
    }

    const { data: updatedOrder, error: updateError } = await db
        .from('orders')
        .update(updatePayload)
        .eq('restaurant_id', restaurantId)
        .eq('id', orderId)
        .select('id, fire_mode, current_course')
        .single();

    if (updateError) {
        return apiError('Failed to update order', 500, 'ORDER_UPDATE_FAILED', updateError.message);
    }

    await writeAuditLog(db, {
        restaurant_id: restaurantId,
        user_id: actorUserId,
        action: 'order_course_fire_updated',
        entity_type: 'order',
        entity_id: orderId,
        metadata: {
            previous_fire_mode: order.fire_mode,
            new_fire_mode: updatedOrder.fire_mode,
            previous_course: order.current_course,
            new_course: updatedOrder.current_course,
        },
    });

    return apiSuccess({
        order: {
            id: updatedOrder.id,
            fire_mode: updatedOrder.fire_mode,
            current_course: updatedOrder.current_course,
        },
    });
}
