/**
 * Route Utilities - Common Patterns Consolidation (API-REF-04)
 *
 * Consolidates duplicate utility patterns across API routes:
 * - Restaurant ID resolution for authenticated users
 * - Pilot access enforcement
 * - Common response utilities
 */

import { createClient } from '@/lib/supabase/server';
import { enforcePilotAccess } from '@/lib/api/pilotGate';
import { apiError } from '@/lib/api/response';
import type { NextRequest } from 'next/server';

/**
 * Result of restaurant ID resolution
 */
interface RestaurantResolution {
    restaurantId: string | null;
    error?: string;
}

/**
 * Resolve restaurant ID for an authenticated user
 * Checks both restaurant_staff and agency_users tables
 */
export async function resolveRestaurantIdForUser(
    userId: string,
    supabase?: Awaited<ReturnType<typeof createClient>>
): Promise<RestaurantResolution> {
    const client = supabase ?? (await createClient());

    // Parallelize both lookups — only one will have a result
    const [staffResult, agencyResult] = await Promise.all([
        client
            .from('restaurant_staff')
            .select('restaurant_id')
            .eq('user_id', userId)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle(),
        client.from('agency_users').select('restaurant_ids').eq('user_id', userId).maybeSingle(),
    ]);

    if (staffResult.error) {
        return { restaurantId: null, error: staffResult.error.message };
    }

    if (staffResult.data?.restaurant_id) {
        return { restaurantId: staffResult.data.restaurant_id };
    }

    if (agencyResult.error) {
        return { restaurantId: null, error: agencyResult.error.message };
    }

    return { restaurantId: agencyResult.data?.restaurant_ids?.[0] ?? null };
}

/**
 * Get authenticated user from request
 */
export async function getAuthenticatedUser(
    supabase?: Awaited<ReturnType<typeof createClient>>
): Promise<{ user: { id: string } | null; error?: string }> {
    const client = supabase ?? (await createClient());
    const {
        data: { user },
        error: userError,
    } = await client.auth.getUser();

    if (userError) {
        return { user: null, error: userError.message };
    }

    return { user };
}

/**
 * Combined auth check: get user and resolve restaurant
 */
export async function requireRestaurantContext(
    userId: string,
    restaurantIdForPilot?: string,
    request?: NextRequest
): Promise<{ restaurantId: string; error?: ReturnType<typeof apiError> }> {
    const { restaurantId, error } = await resolveRestaurantIdForUser(userId);

    if (error) {
        return {
            restaurantId: '',
            error: apiError(
                'Failed to resolve restaurant context',
                500,
                'RESTAURANT_RESOLVE_FAILED',
                error
            ),
        };
    }

    if (!restaurantId) {
        return {
            restaurantId: '',
            error: apiError('No restaurant found for user', 404, 'RESTAURANT_NOT_FOUND'),
        };
    }

    // Check pilot access if request provided
    if (request && request.method) {
        const pilotGateResponse = enforcePilotAccess(restaurantId, request.method);
        if (pilotGateResponse) {
            return {
                restaurantId,
                error: pilotGateResponse as ReturnType<typeof apiError>,
            };
        }
    }

    return { restaurantId };
}

/**
 * Validate UUID format
 */
export function isValidUuid(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
}
