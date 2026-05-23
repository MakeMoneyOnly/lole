import { apiError, apiSuccess, handleApiError } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { staffApplicationService } from '@/domains/staff/application/staff-application-service';
import { logger } from '@/lib/logger';

const log = logger.child('merchant-core-staff');

export async function GET(_request: Request): Promise<Response> {
    let restaurantIdForError: string | undefined;
    try {
        const auth = await getAuthenticatedUser();
        if (!auth.ok) {
            return auth.response;
        }

        const context = await getAuthorizedRestaurantContext(auth.user.id);
        if (!context.ok) {
            return context.response;
        }

        restaurantIdForError = context.restaurantId;

        const result = await staffApplicationService.getStaff({
            restaurantId: context.restaurantId,
            limit: 200,
        });

        if (!result.success) {
            log.error('Failed to fetch staff list', result.error, {
                source: '[staff/api]',
                restaurantId: context.restaurantId,
            });
            return apiError(
                result.error?.message ?? 'Failed to fetch staff list',
                500,
                result.error?.code ?? 'STAFF_FETCH_FAILED'
            );
        }

        const staff = result.data!.staff.map(row => ({
            id: row.id,
            user_id: row.user_id,
            role: row.role,
            is_active: row.is_active,
            created_at: row.created_at,
            name: row.name ?? null,
            full_name: null,
            first_name: null,
            last_name: null,
            email: null,
            pin_code: row.pin_code ?? null,
            assigned_zones: row.assigned_zones ?? [],
        }));

        return apiSuccess({ staff });
    } catch (error) {
        return handleApiError(error, {
            operation: 'merchant-core-staff.GET',
            restaurantId: restaurantIdForError,
        });
    }
}
