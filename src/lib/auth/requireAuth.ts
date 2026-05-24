import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import type { Database } from '@/types/database';

type AgencyUser = Database['public']['Tables']['agency_users']['Row'];

interface AuthResult {
    user: {
        id: string;
        email: string;
    };
    agencyUser: AgencyUser | null;
}

/**
 * Check if running in E2E test mode with proper security validation.
 *
 * Security requirements for E2E bypass:
 * 1. NODE_ENV must NOT be 'production'
 * 2. E2E_TEST_MODE must be 'true'
 * 3. E2E_BYPASS_SECRET must be configured and match the cookie value
 */
async function isE2ETestMode(): Promise<boolean> {
    // CRITICAL: Never allow E2E bypass in production environment
    if (process.env.NODE_ENV === 'production') {
        return false;
    }

    // E2E test mode must be explicitly enabled
    if (process.env.E2E_TEST_MODE !== 'true') {
        return false;
    }

    // E2E_BYPASS_SECRET must be configured
    const bypassSecret = process.env.E2E_BYPASS_SECRET;
    if (!bypassSecret || bypassSecret === '') {
        return false;
    }

    // Check for secure E2E token that includes the secret
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;

    // Token must be in format: e2e-mock-access-token:{secret}
    // This ensures the secret is validated on every request
    const expectedToken = `e2e-mock-access-token:${bypassSecret}`;
    return accessToken === expectedToken;
}

/**
 * Require authentication for a server component
 * Redirects to login if not authenticated
 */
export async function requireAuth(redirectTo: string = '/agency-admin/login'): Promise<AuthResult> {
    // Check for E2E test mode
    const isE2E = await isE2ETestMode();
    if (isE2E) {
        // Return mock user for E2E tests
        return {
            user: {
                id: 'staff-user-1',
                email: 'e2e@example.com',
            },
            agencyUser: null,
        };
    }

    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        logger.warn('Authentication failed: no valid session', { userId: user?.id, redirectTo });
        redirect(redirectTo);
    }

    // Check if user is an agency user
    const { data: agencyUser } = await supabase
        .from('agency_users')
        .select('id, user_id, role, restaurant_ids, created_at')
        .eq('user_id', user.id)
        .single();

    logger.info('Agency user authenticated', {
        userId: user.id,
        agencyRole: agencyUser?.role ?? null,
        restaurantCount: agencyUser?.restaurant_ids?.length ?? 0,
    });

    return {
        user: {
            id: user.id,
            email: user.email || '',
        },
        agencyUser: agencyUser || null,
    };
}

/**
 * Require admin role for a server component
 * Redirects to unauthorized if not an admin
 */
export async function requireAdmin(): Promise<AuthResult> {
    const auth = await requireAuth();

    if (!auth.agencyUser || auth.agencyUser.role !== 'admin') {
        logger.warn('Unauthorized admin access attempt', {
            userId: auth.user.id,
            agencyRole: auth.agencyUser?.role ?? null,
        });
        redirect('/agency-admin/unauthorized');
    }

    return auth;
}

/**
 * Require admin or manager role for a server component
 * Redirects to unauthorized if not admin or manager
 */
export async function requireAdminOrManager(): Promise<AuthResult> {
    const auth = await requireAuth();

    if (
        !auth.agencyUser ||
        !auth.agencyUser.role ||
        !['admin', 'manager'].includes(auth.agencyUser.role)
    ) {
        logger.warn('Unauthorized role access attempt', {
            userId: auth.user.id,
            agencyRole: auth.agencyUser?.role ?? null,
        });
        redirect('/agency-admin/unauthorized');
    }

    return auth;
}

/**
 * Require access to a specific restaurant
 * Redirects to unauthorized if user doesn't have access
 */
export async function requireRestaurantAccess(restaurantId: string): Promise<AuthResult> {
    const auth = await requireAuth();

    // Admin has access to all restaurants
    if (auth.agencyUser?.role === 'admin') {
        return auth;
    }

    // Manager/staff only have access to their assigned restaurants
    if (
        !auth.agencyUser?.restaurant_ids ||
        !auth.agencyUser.restaurant_ids.includes(restaurantId)
    ) {
        logger.warn('Tenant isolation boundary violation attempt', {
            action: 'security:tenant_isolation_violation',
            userId: auth.user.id,
            agencyRole: auth.agencyUser?.role ?? null,
            requestedRestaurantId: restaurantId,
            assignedRestaurantIds: auth.agencyUser?.restaurant_ids ?? [],
        });
        redirect('/agency-admin/unauthorized');
    }

    return auth;
}
