/**
 * Waitlist Notify API Route
 *
 * Endpoint for notifying a guest that their table is ready.
 * - POST /api/waitlist/:id/notify
 */

import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { writeAuditLog } from '@/lib/api/audit';
import { getWaitlistEntry, notifyGuest } from '@/lib/waitlist/service';
import { logger } from '@/lib/logger';

/**
 * Extract waitlist ID from request
 */
function getWaitlistId(params: { id: string }): string {
    return params.id;
}

/**
 * POST /api/waitlist/:id/notify
 * Notify a guest that their table is ready
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    try {
        const resolvedParams = await params;
        const waitlistId = getWaitlistId(resolvedParams);

        // Get the waitlist entry
        const entry = await getWaitlistEntry(waitlistId);

        if (!entry) {
            return apiError('Waitlist entry not found', 404, 'WAITLIST_NOT_FOUND');
        }

        // Verify the entry belongs to the user's restaurant
        if (entry.restaurant_id !== context.restaurantId) {
            return apiError('Access denied', 403, 'ACCESS_DENIED');
        }

        // Check if already seated or cancelled
        if (entry.status === 'seated') {
            return apiError('Guest has already been seated', 400, 'ALREADY_SEATED');
        }

        if (entry.status === 'cancelled') {
            return apiError('Waitlist entry was cancelled', 400, 'ALREADY_CANCELLED');
        }

        // Send notification
        const result = await notifyGuest(waitlistId);

        if (!result.success) {
            return apiError(
                result.error ?? 'Failed to send notification',
                500,
                'NOTIFICATION_FAILED',
                result.error
            );
        }

        await writeAuditLog(context.supabase, {
            restaurant_id: context.restaurantId,
            user_id: auth.user.id,
            action: 'waitlist_notified',
            entity_type: 'waitlist_entry',
            entity_id: waitlistId,
            metadata: {
                guestName: entry.guest_name,
                guestPhone: entry.guest_phone,
                position: entry.position,
            },
        });

        return apiSuccess({
            message: 'Guest notified successfully',
            notification: {
                success: result.success,
                phone: result.phone,
                message: result.message,
            },
        });
    } catch (error) {
        logger.error('[waitlist] notify Error', error);
        return apiError(
            'Failed to notify guest',
            500,
            'NOTIFICATION_FAILED',
            error instanceof Error ? error.message : 'Unknown error'
        );
    }
}
