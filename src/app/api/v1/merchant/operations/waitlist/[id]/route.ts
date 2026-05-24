/**
 * Waitlist Entry API Routes
 *
 * RESTful endpoints for individual waitlist entry operations.
 * - GET /api/waitlist/:id - Get a specific waitlist entry
 * - PATCH /api/waitlist/:id - Update waitlist entry status
 * - DELETE /api/waitlist/:id - Remove from waitlist
 */

import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { writeAuditLog } from '@/lib/api/audit';
import { getWaitlistEntry, removeFromWaitlist } from '@/lib/waitlist/service';

/**
 * Extract waitlist ID from request
 */
function getWaitlistId(params: { id: string }): string {
    return params.id;
}

/**
 * GET /api/waitlist/:id
 * Get a specific waitlist entry
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
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

        const entry = await getWaitlistEntry(waitlistId);

        if (!entry) {
            return apiError('Waitlist entry not found', 404, 'WAITLIST_NOT_FOUND');
        }

        if (entry.restaurant_id !== context.restaurantId) {
            return apiError('Access denied', 403, 'ACCESS_DENIED');
        }

        return apiSuccess({ entry });
    } catch (error) {
        return apiError(
            'Failed to fetch waitlist entry',
            500,
            'WAITLIST_FETCH_FAILED',
            error instanceof Error ? error.message : 'Unknown error'
        );
    }
}

/**
 * DELETE /api/waitlist/:id
 * Remove a guest from the waitlist
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
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

        const entry = await getWaitlistEntry(waitlistId);

        if (!entry) {
            return apiError('Waitlist entry not found', 404, 'WAITLIST_NOT_FOUND');
        }

        if (entry.restaurant_id !== context.restaurantId) {
            return apiError('Access denied', 403, 'ACCESS_DENIED');
        }

        await removeFromWaitlist(waitlistId);

        await writeAuditLog(context.supabase, {
            restaurant_id: context.restaurantId,
            user_id: auth.user.id,
            action: 'waitlist_removed',
            entity_type: 'waitlist_entry',
            entity_id: waitlistId,
            metadata: {
                guestName: entry.guest_name,
                guestPhone: entry.guest_phone,
                position: entry.position,
            },
        });

        return apiSuccess({ message: 'Removed from waitlist' });
    } catch (error) {
        return apiError(
            'Failed to remove from waitlist',
            500,
            'WAITLIST_DELETE_FAILED',
            error instanceof Error ? error.message : 'Unknown error'
        );
    }
}
