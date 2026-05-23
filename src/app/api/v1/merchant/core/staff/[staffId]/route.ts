import { apiError, apiSuccess, handleApiError } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { writeAuditLog } from '@/lib/api/audit';
import { staffApplicationService } from '@/domains/staff/application/staff-application-service';

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ staffId: string }> }
): Promise<Response> {
    try {
        const { staffId } = await params;

        const auth = await getAuthenticatedUser();
        if (!auth.ok) return auth.response;

        const context = await getAuthorizedRestaurantContext(auth.user.id);
        if (!context.ok) return context.response;

        const result = await staffApplicationService.getStaffById({
            staffId,
            restaurantId: context.restaurantId,
        });

        if (!result.success) {
            return apiError(
                result.error?.message ?? 'Staff member not found or access denied',
                result.error?.code === 'STAFF_NOT_FOUND' ? 404 : 500,
                result.error?.code ?? 'STAFF_NOT_FOUND'
            );
        }

        const staffMember = result.data!;

        const deleteResult = await staffApplicationService.deleteStaff({
            staffId,
            restaurantId: context.restaurantId,
        });

        if (!deleteResult.success) {
            return apiError(
                deleteResult.error?.message ?? 'Failed to delete staff member',
                500,
                deleteResult.error?.code ?? 'STAFF_DELETE_FAILED'
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
    } catch (error) {
        return handleApiError(error, {
            operation: 'merchant-core-staff.DELETE',
        });
    }
}
