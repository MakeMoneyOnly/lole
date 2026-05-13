import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';

const UpdateStaffActiveSchema = z.object({
    is_active: z.boolean(),
});

export async function PATCH(request: Request, context: { params: Promise<{ staffId: string }> }) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const restaurantContext = await getAuthorizedRestaurantContext(auth.user.id);
    if (!restaurantContext.ok) {
        return restaurantContext.response;
    }

    const parsed = await parseJsonBody(request, UpdateStaffActiveSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { staffId } = await context.params;
    const { data: existing, error: existingError } = await restaurantContext.supabase
        .from('restaurant_staff')
        .select('id, is_active')
        .eq('id', staffId)
        .eq('restaurant_id', restaurantContext.restaurantId)
        .maybeSingle();

    if (existingError) {
        return apiError(
            'Failed to load staff member',
            500,
            'STAFF_FETCH_FAILED',
            existingError.message
        );
    }
    if (!existing) {
        return apiError('Staff member not found', 404, 'STAFF_NOT_FOUND');
    }

    const { data, error } = await restaurantContext.supabase
        .from('restaurant_staff')
        .update({ is_active: parsed.data.is_active })
        .eq('id', staffId)
        .eq('restaurant_id', restaurantContext.restaurantId)
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, role, user_id, pin_code, assigned_zones, is_active, created_at'
        )
        .single();

    if (error) {
        return apiError(
            'Failed to update staff status',
            500,
            'STAFF_STATUS_UPDATE_FAILED',
            error.message
        );
    }

    await writeAuditLog(restaurantContext.supabase, {
        restaurant_id: restaurantContext.restaurantId,
        user_id: auth.user.id,
        action: 'staff_active_status_updated',
        entity_type: 'restaurant_staff',
        entity_id: staffId,
        old_value: { is_active: existing.is_active },
        new_value: { is_active: parsed.data.is_active },
        metadata: { source: 'merchant_dashboard' },
    });

    return apiSuccess(data);
}
