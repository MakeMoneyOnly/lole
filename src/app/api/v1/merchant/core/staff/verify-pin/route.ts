import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { buildStaffSessionExpiry, verifyStoredStaffPin } from '@/domains/staff/pin';
import { logger } from '@/lib/logger';

const VerifyPinSchema = z.object({
    restaurantId: z.string().uuid(),
    pin: z.string().length(4), // Assume a 4-digit numeric PIN
});

export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const parsed = await parseJsonBody(request, VerifyPinSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    // Usually, the device (iPad) itself has an authenticated session (auth.user.id).
    // We check if this device is authorized for this restaurant.
    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    // We also make sure the device is verifying a PIN for its own restaurant
    if (context.restaurantId !== parsed.data.restaurantId) {
        return apiError('Unauthorized', 403, 'RESTAURANT_MISMATCH');
    }

    // Now, let's find the specific staff member using this PIN
    // Use service role to bypass RLS for this specific verification step
    // to ensure reliable login on shared terminals.
    const adminClient = createServiceRoleClient();

    const { data: staffRows, error } = await adminClient
        .from('restaurant_staff_with_users')
        .select('id, user_id, role, name, email, pin_code, staff_name')
        .eq('restaurant_id', context.restaurantId)
        .eq('is_active', true);

    if (error || !staffRows) {
        logger.error('[Verify PIN] Failed to fetch staff rows', { error: error?.message });
        return apiError('Invalid PIN', 400, 'INVALID_PIN');
    }

    const staff = staffRows.find((candidate: { pin_code: string | null }) =>
        verifyStoredStaffPin(candidate.pin_code, parsed.data.pin)
    );

    if (!staff) {
        return apiError('Invalid PIN', 400, 'INVALID_PIN');
    }

    return apiSuccess(
        {
            staff: {
                id: staff.id,
                role: staff.role,
                name: staff.staff_name || staff.name || staff.email || 'Waitstaff',
                user_id: staff.user_id,
                session_expires_at: buildStaffSessionExpiry(),
            },
        },
        200
    );
}
