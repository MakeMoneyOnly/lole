import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';

const UpdateStaffRoleSchema = z.object({
    role: z.enum(['owner', 'admin', 'manager', 'kitchen', 'waiter', 'bar']),
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

    const parsed = await parseJsonBody(request, UpdateStaffRoleSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { staffId } = await context.params;

    const { data: existing, error: existingError } = await restaurantContext.supabase
        .from('restaurant_staff')
        .select('id, role')
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
        .update({ role: parsed.data.role })
        .eq('id', staffId)
        .eq('restaurant_id', restaurantContext.restaurantId)
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, role, user_id, pin_code, assigned_zones, is_active, created_at'
        )
        .single();

    if (error) {
        return apiError(
            'Failed to update staff role',
            500,
            'STAFF_ROLE_UPDATE_FAILED',
            error.message
        );
    }

    await writeAuditLog(restaurantContext.supabase, {
        restaurant_id: restaurantContext.restaurantId,
        user_id: auth.user.id,
        action: 'staff_role_updated',
        entity_type: 'restaurant_staff',
        entity_id: staffId,
        old_value: { role: existing.role },
        new_value: { role: parsed.data.role },
        metadata: { source: 'merchant_dashboard' },
    });

    return apiSuccess(data);
}
