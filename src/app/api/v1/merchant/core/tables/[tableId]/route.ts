import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';

const UpdateTableSchema = z.object({
    table_number: z.string().trim().min(1).max(20).optional(),
    status: z.enum(['available', 'occupied', 'reserved', 'bill_requested']).optional(),
    capacity: z.number().int().positive().max(50).optional(),
    zone: z.string().trim().max(50).nullable().optional(),
    is_active: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ tableId: string }> }) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const restaurantContext = await getAuthorizedRestaurantContext(auth.user.id);
    if (!restaurantContext.ok) {
        return restaurantContext.response;
    }

    const parsed = await parseJsonBody(request, UpdateTableSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { tableId } = await context.params;
    const { data, error } = await restaurantContext.supabase
        .from('tables')
        .update(parsed.data)
        .eq('id', tableId)
        .eq('restaurant_id', restaurantContext.restaurantId)
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, table_number, status, capacity, zone, qr_code_url, qr_version, active_order_id, is_active, created_at, updated_at'
        )
        .maybeSingle();

    if (error) {
        return apiError('Failed to update table', 500, 'TABLE_UPDATE_FAILED', error.message);
    }
    if (!data) {
        return apiError('Table not found', 404, 'TABLE_NOT_FOUND');
    }

    return apiSuccess(data);
}

export async function DELETE(_request: Request, context: { params: Promise<{ tableId: string }> }) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const restaurantContext = await getAuthorizedRestaurantContext(auth.user.id);
    if (!restaurantContext.ok) {
        return restaurantContext.response;
    }

    const { tableId } = await context.params;
    const { error } = await restaurantContext.supabase
        .from('tables')
        .delete()
        .eq('id', tableId)
        .eq('restaurant_id', restaurantContext.restaurantId);

    if (error) {
        return apiError('Failed to delete table', 500, 'TABLE_DELETE_FAILED', error.message);
    }

    return apiSuccess({ deleted: true, id: tableId });
}
