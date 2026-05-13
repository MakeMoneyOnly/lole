/**
 * Waitlist Entry API Routes
 *
 * RESTful endpoints for individual waitlist entry operations.
 * - GET /api/waitlist/:id - Get a specific waitlist entry
 * - PATCH /api/waitlist/:id - Update waitlist entry status
 * - DELETE /api/waitlist/:id - Remove from waitlist
 * - POST /api/waitlist/:id/notify - Notify guest that table is ready
 */

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { logger } from '@/lib/logger';
import {
    getWaitlistEntry,
    updateStatus,
    removeFromWaitlist,
    getPosition,
    estimateWaitTime,
} from '@/lib/waitlist/service';

/**
 * Schema for updating waitlist status
 */
const UpdateWaitlistStatusSchema = z.object({
    status: z.enum(['waiting', 'notified', 'seated', 'cancelled', 'expired']),
});

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
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

        // Verify the entry belongs to the user's restaurant
        if (entry.restaurant_id !== context.restaurantId) {
            return apiError('Access denied', 403, 'ACCESS_DENIED');
        }

        // Include position info
        const position = await getPosition(waitlistId);
        const estimatedWait = await estimateWaitTime(position);

        return apiSuccess({
            entry,
            position,
            estimatedWaitMinutes: estimatedWait,
        });
    } catch (error) {
        logger.error('[waitlist] GET entry Error', error);
        return apiError(
            'Failed to fetch waitlist entry',
            500,
            'WAITLIST_FETCH_FAILED',
            error instanceof Error ? error.message : 'Unknown error'
        );
    }
}

/**
 * PATCH /api/waitlist/:id
 * Update waitlist entry status
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const parsed = await parseJsonBody(request, UpdateWaitlistStatusSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    try {
        const resolvedParams = await params;
        const waitlistId = getWaitlistId(resolvedParams);

        const entry = await getWaitlistEntry(waitlistId);

        if (!entry) {
            return apiError('Waitlist entry not found', 404, 'WAITLIST_NOT_FOUND');
        }

        // Verify the entry belongs to the user's restaurant
        if (entry.restaurant_id !== context.restaurantId) {
            return apiError('Access denied', 403, 'ACCESS_DENIED');
        }

        await updateStatus({
            waitlistId,
            status: parsed.data.status,
            updatedBy: auth.user.id,
        });

        await writeAuditLog(context.supabase, {
            restaurant_id: context.restaurantId,
            user_id: auth.user.id,
            action: 'waitlist_status_updated',
            entity_type: 'waitlist_entry',
            entity_id: waitlistId,
            metadata: {
                oldStatus: entry.status,
                newStatus: parsed.data.status,
            },
        });

        return apiSuccess({
            message: 'Status updated successfully',
            status: parsed.data.status,
        });
    } catch (error) {
        logger.error('[waitlist] PATCH Error', error);
        return apiError(
            'Failed to update waitlist entry',
            500,
            'WAITLIST_UPDATE_FAILED',
            error instanceof Error ? error.message : 'Unknown error'
        );
    }
}

/**
 * DELETE /api/waitlist/:id
 * Remove a guest from the waitlist
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

        // Verify the entry belongs to the user's restaurant
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
        logger.error('[waitlist] DELETE Error', error);
        return apiError(
            'Failed to remove from waitlist',
            500,
            'WAITLIST_DELETE_FAILED',
            error instanceof Error ? error.message : 'Unknown error'
        );
    }
}
