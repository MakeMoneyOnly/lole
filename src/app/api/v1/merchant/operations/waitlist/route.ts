/**
 * Waitlist API Routes
 *
 * RESTful endpoints for table waitlist management.
 * - POST /api/waitlist - Add guest to waitlist
 * - GET /api/waitlist - List waitlist entries (staff)
 */

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { logger } from '@/lib/logger';
import { addToWaitlist, getWaitlist, getWaitlistStats } from '@/lib/waitlist/service';
import type { WaitlistStatus } from '@/lib/waitlist/types';

/**
 * Schema for adding a guest to waitlist
 */
const AddToWaitlistSchema = z.object({
    guestName: z.string().trim().min(1, 'Guest name is required').max(120),
    guestPhone: z.string().regex(/^(\+?251|0)?[9]\d{8}$/, 'Invalid Ethiopian phone number'),
    guestCount: z
        .number()
        .int()
        .min(1, 'At least 1 guest required')
        .max(20, 'Maximum 20 guests allowed'),
    notes: z.string().trim().max(500).optional(),
});

/**
 * GET /api/waitlist
 * List waitlist entries for a restaurant
 */
export async function GET(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') as WaitlistStatus | null;
        const includeStats = searchParams.get('includeStats') === 'true';

        // Validate status if provided
        if (status && !['waiting', 'notified', 'seated', 'cancelled', 'expired'].includes(status)) {
            return apiError('Invalid status filter', 400, 'INVALID_STATUS');
        }

        const entries = await getWaitlist(context.restaurantId, status ?? undefined);

        const responseData: Record<string, unknown> = { entries };

        // Optionally include statistics
        if (includeStats) {
            const stats = await getWaitlistStats(context.restaurantId);
            responseData.stats = stats;
        }

        return apiSuccess(responseData);
    } catch (error) {
        logger.error('[waitlist] GET Error', error);
        return apiError(
            'Failed to fetch waitlist',
            500,
            'WAITLIST_FETCH_FAILED',
            error instanceof Error ? error.message : 'Unknown error'
        );
    }
}

/**
 * POST /api/waitlist
 * Add a guest to the waitlist
 */
export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const parsed = await parseJsonBody(request, AddToWaitlistSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    try {
        const entry = await addToWaitlist({
            restaurantId: context.restaurantId,
            guestName: parsed.data.guestName,
            guestPhone: parsed.data.guestPhone,
            guestCount: parsed.data.guestCount,
            notes: parsed.data.notes,
            createdBy: auth.user.id,
        });

        await writeAuditLog(context.supabase, {
            restaurant_id: context.restaurantId,
            user_id: auth.user.id,
            action: 'waitlist_added',
            entity_type: 'waitlist_entry',
            entity_id: entry.id,
            metadata: {
                guestName: entry.guest_name,
                guestPhone: entry.guest_phone,
                guestCount: entry.guest_count,
                position: entry.position,
            },
        });

        return apiSuccess({ entry }, 201);
    } catch (error) {
        logger.error('[waitlist] POST Error', error);

        // Handle specific error cases
        if (error instanceof Error) {
            if (error.message.includes('Guest count must be between')) {
                return apiError(error.message, 400, 'INVALID_GUEST_COUNT');
            }
        }

        return apiError(
            'Failed to add to waitlist',
            500,
            'WAITLIST_ADD_FAILED',
            error instanceof Error ? error.message : 'Unknown error'
        );
    }
}
