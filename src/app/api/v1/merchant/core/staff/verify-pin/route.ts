import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { staffApplicationService } from '@/domains/staff/application/staff-application-service';
import { buildStaffSessionExpiry } from '@/domains/staff/pin';
import { logger } from '@/lib/logger';

const VerifyPinSchema = z.object({
    restaurantId: z.string().uuid(),
    pin: z.string().length(4),
});

export async function POST(request: Request): Promise<Response> {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const parsed = await parseJsonBody(request, VerifyPinSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    if (context.restaurantId !== parsed.data.restaurantId) {
        return apiError('Unauthorized', 403, 'RESTAURANT_MISMATCH');
    }

    const result = await staffApplicationService.verifyPinByRestaurant({
        restaurantId: context.restaurantId,
        pinCode: parsed.data.pin,
    });

    if (!result.success) {
        logger.error('[Verify PIN] PIN verification failed', {
            code: result.error?.code,
            restaurantId: context.restaurantId,
        });
        return apiError('Invalid PIN', 400, result.error?.code ?? 'INVALID_PIN');
    }

    const staff = result.data!;

    return apiSuccess(
        {
            staff: {
                id: staff.id,
                role: staff.role,
                name: staff.name ?? 'Staff',
                user_id: staff.user_id,
                session_expires_at: buildStaffSessionExpiry(),
            },
        },
        200
    );
}
