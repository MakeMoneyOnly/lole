import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { writeAuditLog } from '@/lib/api/audit';

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ staffId: string }> }
) {
    const { staffId } = await params;

    const auth = await getAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) return context.response;

    // Use service role to bypass RLS on restaurant_staff
    const adminClient = createServiceRoleClient();

    // Verify the staff member belongs to this restaurant
    const { data: staffMember, error: fetchError } = await adminClient
        .from('restaurant_staff')
        .select('id, name, role')
        .eq('id', staffId)
        .eq('restaurant_id', context.restaurantId)
        .single();

    if (fetchError || !staffMember) {
        return apiError('Staff member not found or access denied', 404, 'STAFF_NOT_FOUND');
    }

    const { error: deleteError } = await adminClient
        .from('restaurant_staff')
        .delete()
        .eq('id', staffId)
        .eq('restaurant_id', context.restaurantId);

    if (deleteError) {
        return apiError(
            'Failed to delete staff member',
            500,
            'STAFF_DELETE_FAILED',
            deleteError.message
        );
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'staff_deleted',
        entity_type: 'restaurant_staff',
        entity_id: staffId,
        metadata: { name: staffMember.name, role: staffMember.role },
    });

    return apiSuccess({ deleted: true });
}
