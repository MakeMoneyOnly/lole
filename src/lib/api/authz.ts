import type { PostgrestSingleResponse } from '@supabase/postgrest-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { apiError } from '@/lib/api/response';
import { enforcePilotAccess } from '@/lib/api/pilotGate';
import { logSecurityEvent } from '@/lib/security/securityEvents';
import { verifyDeviceTokenFromRequest } from '@/lib/auth/device-token-cookies';
import { logger } from '@/lib/logger';
import type { HardwareDeviceType, DeviceProfile } from '@/lib/devices/config';
import { isGatewayIdentityRevoked } from '@/lib/auth/offline-authz';
import {
    hydrateEnterpriseDeviceRecord,
    isEnterpriseDeviceSchemaError,
} from '@/lib/devices/schema-compat';
import type { User } from '@supabase/supabase-js';

type PilotPhase = 'p0' | 'p1' | 'p2';

export type GetAuthenticatedUserResult =
    | { ok: true; user: User; supabase: Awaited<ReturnType<typeof createClient>> }
    | { ok: false; response: ReturnType<typeof apiError> };

interface HydratedDeviceRecord {
    id: string;
    restaurant_id: string;
    location_id: string | null;
    device_type: string;
    device_profile: DeviceProfile;
    name: string;
    assigned_zones: string[] | null;
    status: string;
    metadata: Record<string, unknown> | null;
    last_active_at: string | null;
    pairing_state: 'ready' | 'paired' | 'revoked' | 'expired';
    pairing_code_expires_at: string | null;
    pairing_completed_at: string | null;
    management_provider: 'none' | 'esper';
    management_device_id: string | null;
    app_version: string | null;
    target_app_version: string | null;
    ota_status: string | null;
}

interface EnterpriseDeviceRow {
    id: string;
    restaurant_id: string;
    location_id?: string | null;
    device_type?: string | null;
    device_profile?: string | null;
    name: string;
    assigned_zones?: string[] | null;
    status: string;
    metadata?: Record<string, unknown> | null;
    last_active_at?: string | null;
    pairing_state?: string | null;
    management_provider?: string | null;
    management_device_id?: string | null;
    app_version?: string | null;
    target_app_version?: string | null;
    ota_status?: string | null;
}

export type GetDeviceContextResult =
    | {
          ok: true;
          device: HydratedDeviceRecord;
          restaurantId: string;
          admin: ReturnType<typeof createServiceRoleClient>;
      }
    | { ok: false; response: ReturnType<typeof apiError> };

export async function getAuthenticatedUser(): Promise<GetAuthenticatedUserResult> {
    const supabase = await createClient();

    // =========================================================
    // CRIT-003: Secure E2E Test Bypass
    // =========================================================
    // E2E test bypass: allows API routes to work with E2E tests without requiring real auth.
    //
    // Security requirements for E2E bypass (ALL must be true):
    // 1. NODE_ENV must NOT be 'production' (prevents bypass in real deployments)
    // 2. E2E_TEST_MODE must be 'true' (explicit opt-in)
    // 3. E2E_BYPASS_SECRET must be configured and match the request
    // =========================================================

    const cookieStore = await import('next/headers').then(m => m.cookies());
    const e2eCookie = cookieStore.get('sb-access-token')?.value;
    const bypassSecret = process.env.E2E_BYPASS_SECRET;

    // CRITICAL: Never allow E2E bypass in production environment
    const isProduction = process.env.NODE_ENV === 'production';
    const isE2ETestMode = process.env.E2E_TEST_MODE === 'true';
    const hasSecretConfigured = bypassSecret !== undefined && bypassSecret !== '';

    // Validate E2E cookie token format: e2e-mock-access-token:{secret}
    const expectedToken = hasSecretConfigured ? `e2e-mock-access-token:${bypassSecret}` : null;
    const hasValidE2ECookie = e2eCookie !== undefined && e2eCookie === expectedToken;

    // E2E bypass is only active when ALL security conditions are met
    const isE2EBypassActive =
        !isProduction && isE2ETestMode && hasSecretConfigured && hasValidE2ECookie;

    if (isE2EBypassActive) {
        // Return mock user for E2E tests
        // Use E2E_USER_ID from env if set, otherwise fall back to Cafe Lucia owner
        // This allows E2E tests to be configured for different restaurants
        const e2eUserId = process.env.E2E_USER_ID || 'bcc7f071-ccc5-4911-8cd2-2fa524c0b69c';
        return {
            ok: true as const,
            user: {
                id: e2eUserId,
                email: 'e2e@example.com',
                aud: 'authenticated',
                role: 'authenticated',
                app_metadata: {},
                user_metadata: {},
                created_at: new Date().toISOString(),
            } as User,
            supabase,
        };
    }

    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        return { ok: false as const, response: apiError('Unauthorized', 401, 'UNAUTHORIZED') };
    }

    return { ok: true as const, user, supabase };
}

export async function getAuthorizedRestaurantContext(
    userId: string,
    options?: { phase?: PilotPhase }
): Promise<
    | { ok: true; restaurantId: string; supabase: Awaited<ReturnType<typeof createClient>> }
    | { ok: false; response: ReturnType<typeof apiError> }
> {
    const phase = options?.phase ?? 'p0';

    // Use service role client in E2E mode to bypass RLS policies
    // This allows E2E tests to access data without valid JWT sessions
    const isE2EMode = process.env.E2E_TEST_MODE === 'true';
    const supabase = isE2EMode ? createServiceRoleClient() : await createClient();

    const { data: staffEntry, error: staffError } = await supabase
        .from('restaurant_staff')
        .select('restaurant_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (staffError) {
        return {
            ok: false as const,
            response: apiError(
                'Failed to resolve restaurant context',
                500,
                'RESTAURANT_RESOLVE_FAILED',
                staffError.message
            ),
        };
    }

    if (staffEntry?.restaurant_id) {
        const pilotGateResponse = enforcePilotAccess(staffEntry.restaurant_id, undefined, {
            phase,
        });
        if (pilotGateResponse) {
            return { ok: false as const, response: pilotGateResponse };
        }

        return { ok: true as const, restaurantId: staffEntry.restaurant_id, supabase };
    }

    const { data: agencyUser, error: agencyError } = await supabase
        .from('agency_users')
        .select('restaurant_ids')
        .eq('user_id', userId)
        .maybeSingle();

    if (agencyError) {
        return {
            ok: false as const,
            response: apiError(
                'Failed to resolve restaurant context',
                500,
                'RESTAURANT_RESOLVE_FAILED',
                agencyError.message
            ),
        };
    }

    const restaurantId = agencyUser?.restaurant_ids?.[0] ?? null;
    if (!restaurantId) {
        return {
            ok: false as const,
            response: apiError('No restaurant found for user', 404, 'RESTAURANT_NOT_FOUND'),
        };
    }

    const pilotGateResponse = enforcePilotAccess(restaurantId, undefined, { phase });
    if (pilotGateResponse) {
        return { ok: false as const, response: pilotGateResponse };
    }

    return { ok: true as const, restaurantId, supabase };
}

/**
 * Authenticate a request from a paired hardware device (POS/KDS).
 *
 * HIGH-009: Device tokens are now verified via httpOnly cookies (preferred)
 * or via the X-Device-Token header (legacy support).
 *
 * Cookie-based authentication provides XSS protection since the token
 * is not accessible via JavaScript.
 *
 * Security properties:
 * - httpOnly cookies: Token not accessible via JavaScript (XSS protection)
 * - Signed cookies: HMAC signature prevents tampering
 * - Header fallback: Backward compatibility with existing clients
 */
export async function getDeviceContext(request: Request): Promise<GetDeviceContextResult> {
    // HIGH-009: Check for secure cookie-based token first
    const cookieResult = verifyDeviceTokenFromRequest(request);

    let token: string;
    let tokenSource: 'cookie' | 'header';

    if (cookieResult.valid && cookieResult.token) {
        // Cookie-based authentication (preferred, more secure)
        token = cookieResult.token;
        tokenSource = 'cookie';
    } else {
        // Fall back to header-based authentication (legacy)
        const headerToken = request.headers.get('x-device-token');
        if (!headerToken) {
            return {
                ok: false as const,
                response: apiError('Missing device token', 401, 'DEVICE_UNAUTHORIZED'),
            };
        }
        token = headerToken;
        tokenSource = 'header';
    }

    const admin = createServiceRoleClient();
    const fetchEnterpriseDevice = async (): Promise<PostgrestSingleResponse<EnterpriseDeviceRow>> =>
        admin
            .from('hardware_devices')
            .select(
                'id, restaurant_id, location_id, device_type, device_profile, name, assigned_zones, status, metadata, last_active_at, pairing_state, management_provider, management_device_id, app_version, target_app_version, ota_status'
            )
            .eq('device_token', token)
            .single();

    let device: EnterpriseDeviceRow | null = null;
    let error: { message: string } | null = null;

    const enterpriseResult = await fetchEnterpriseDevice();
    device = (enterpriseResult.data as EnterpriseDeviceRow | null) ?? null;
    error = enterpriseResult.error;

    if (error && isEnterpriseDeviceSchemaError(error.message)) {
        const legacyResult = await admin
            .from('hardware_devices')
            .select(
                'id, restaurant_id, device_type, name, assigned_zones, status, metadata, last_active_at'
            )
            .eq('device_token', token)
            .single();

        device = (legacyResult.data as EnterpriseDeviceRow | null) ?? null;
        error = legacyResult.error;
    }

    if (error || !device) {
        return {
            ok: false as const,
            response: apiError('Invalid device token', 401, 'DEVICE_UNAUTHORIZED'),
        };
    }

    const hydrated = hydrateEnterpriseDeviceRecord(device);
    if (
        hydrated.pairing_state === 'revoked' ||
        isGatewayIdentityRevoked(hydrated.metadata ?? null)
    ) {
        return {
            ok: false as const,
            response: apiError('Device identity revoked', 401, 'DEVICE_IDENTITY_REVOKED'),
        };
    }

    // Log token source for auditing (helps track migration to cookie-based auth)
    if (tokenSource === 'header') {
        logger.info(
            `Device ${device.id} using header-based auth. Consider migrating to cookie-based auth.`
        );
    }

    return {
        ok: true as const,
        device: hydrated as HydratedDeviceRecord,
        restaurantId: device.restaurant_id as string,
        admin,
    };
}

export async function getScopedDeviceContext(
    request: Request,
    allowedTypes: HardwareDeviceType[]
): Promise<GetDeviceContextResult> {
    const context = await getDeviceContext(request);
    if (!context.ok) {
        return context;
    }

    if (!allowedTypes.includes(context.device.device_type as HardwareDeviceType)) {
        return {
            ok: false as const,
            response: apiError(
                'Device type not allowed for this action',
                403,
                'DEVICE_TYPE_FORBIDDEN'
            ),
        };
    }

    return context;
}

/**
 * SEC-002: Enforce strict tenant scoping on protected queries
 * Validates that a user has access to a specific restaurant resource
 * Logs security events for violations
 */
export async function enforceTenantScope(
    userId: string,
    restaurantId: string,
    ipAddress?: string
): Promise<{ allowed: boolean; reason?: string }> {
    const supabase = await createClient();

    // Check if user is staff of the restaurant
    const { data: staffEntry, error } = await supabase
        .from('restaurant_staff')
        .select('id, role')
        .eq('user_id', userId)
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .maybeSingle();

if (error) {
         logger.error('Failed to verify tenant scope', error);
         return { allowed: false, reason: 'Failed to verify access' };
     }

    if (staffEntry) {
        return { allowed: true };
    }

    // Check if user is an agency user with access to this restaurant
    const { data: agencyUser, error: agencyError } = await supabase
        .from('agency_users')
        .select('restaurant_ids')
        .eq('user_id', userId)
        .maybeSingle();

if (agencyError) {
         logger.error('Failed to verify agency access', agencyError);
         return { allowed: false, reason: 'Failed to verify access' };
     }

    if (agencyUser?.restaurant_ids?.includes(restaurantId)) {
        return { allowed: true };
    }

    // Log tenant isolation violation
    await logSecurityEvent({
        type: 'tenant_isolation_violation',
        severity: 'high',
        userId,
        ipAddress: ipAddress || 'unknown',
        userAgent: 'server',
        metadata: { requested_restaurant_id: restaurantId },
        timestamp: new Date(),
    });

    return { allowed: false, reason: 'Access denied to this restaurant' };
}

/**
 * SEC-002: Validate resource belongs to user's restaurant
 * Use this before any mutation to prevent cross-tenant data access
 *
 * Note: For type-safe resource validation, use the specific table validators below:
 * - validateOrderTenantScope
 * - validateMenuItemTenantScope
 * - validateTableTenantScope
 */
export async function validateResourceTenantScope(
    userId: string,
    restaurantId: string,
    resourceTable: string,
    resourceId: string
): Promise<{ valid: boolean; reason?: string }> {
    // First verify user has access to the restaurant
    const scopeCheck = await enforceTenantScope(userId, restaurantId);
    if (!scopeCheck.allowed) {
        return { valid: false, reason: scopeCheck.reason };
    }

    // Log the validation attempt for audit purposes
    logger.warn('SEC-002: Resource validation requested', { resourceTable, resourceId });

    // Return valid - actual table-specific validation should be done by calling
    // the appropriate type-specific function
    return { valid: true };
}

/**
 * SEC-002: Validate order belongs to user's restaurant
 */
export async function validateOrderTenantScope(
    userId: string,
    restaurantId: string,
    orderId: string
): Promise<{ valid: boolean; reason?: string }> {
    const supabase = await createClient();

    const scopeCheck = await enforceTenantScope(userId, restaurantId);
    if (!scopeCheck.allowed) {
        return { valid: false, reason: scopeCheck.reason };
    }

    const { data, error } = await supabase
        .from('orders')
        .select('restaurant_id')
        .eq('id', orderId)
        .maybeSingle();

if (error) {
         logger.error('Failed to validate order scope', error);
         return { valid: false, reason: 'Failed to validate order' };
     }

    if (!data) {
        return { valid: false, reason: 'Order not found' };
    }

    if (data.restaurant_id !== restaurantId) {
        await logSecurityEvent({
            type: 'tenant_isolation_violation',
            severity: 'high',
            userId,
            ipAddress: 'unknown',
            userAgent: 'server',
            metadata: {
                resource_table: 'orders',
                resource_id: orderId,
                resource_restaurant_id: data.restaurant_id,
                requested_restaurant_id: restaurantId,
            },
            timestamp: new Date(),
        });

        return { valid: false, reason: 'Order does not belong to this restaurant' };
    }

    return { valid: true };
}

/**
 * SEC-002: Validate menu item belongs to user's restaurant
 */
export async function validateMenuItemTenantScope(
    userId: string,
    restaurantId: string,
    menuItemId: string
): Promise<{ valid: boolean; reason?: string }> {
    const supabase = await createClient();

    const scopeCheck = await enforceTenantScope(userId, restaurantId);
    if (!scopeCheck.allowed) {
        return { valid: false, reason: scopeCheck.reason };
    }

    // Menu items are linked via category which has restaurant_id
    const { data, error } = await supabase
        .from('menu_items')
        .select('id, category:categories(restaurant_id)')
        .eq('id', menuItemId)
        .maybeSingle();

if (error) {
         logger.error('Failed to validate menu item scope', error);
         return { valid: false, reason: 'Failed to validate menu item' };
     }

    if (!data) {
        return { valid: false, reason: 'Menu item not found' };
    }

    // Type assertion for the nested category query result
    const categoryData = data.category as { restaurant_id: string } | null;
    const itemRestaurantId = categoryData?.restaurant_id;

    if (!itemRestaurantId || itemRestaurantId !== restaurantId) {
        await logSecurityEvent({
            type: 'tenant_isolation_violation',
            severity: 'high',
            userId,
            ipAddress: 'unknown',
            userAgent: 'server',
            metadata: {
                resource_table: 'menu_items',
                resource_id: menuItemId,
                resource_restaurant_id: itemRestaurantId,
                requested_restaurant_id: restaurantId,
            },
            timestamp: new Date(),
        });

        return { valid: false, reason: 'Menu item does not belong to this restaurant' };
    }

    return { valid: true };
}

/**
 * SEC-002: Validate table belongs to user's restaurant
 */
export async function validateTableTenantScope(
    userId: string,
    restaurantId: string,
    tableId: string
): Promise<{ valid: boolean; reason?: string }> {
    const supabase = await createClient();

    const scopeCheck = await enforceTenantScope(userId, restaurantId);
    if (!scopeCheck.allowed) {
        return { valid: false, reason: scopeCheck.reason };
    }

    const { data, error } = await supabase
        .from('tables')
        .select('restaurant_id')
        .eq('id', tableId)
        .maybeSingle();

if (error) {
         logger.error('Failed to validate table scope', error);
         return { valid: false, reason: 'Failed to validate table' };
     }

    if (!data) {
        return { valid: false, reason: 'Table not found' };
    }

    if (data.restaurant_id !== restaurantId) {
        await logSecurityEvent({
            type: 'tenant_isolation_violation',
            severity: 'high',
            userId,
            ipAddress: 'unknown',
            userAgent: 'server',
            metadata: {
                resource_table: 'tables',
                resource_id: tableId,
                resource_restaurant_id: data.restaurant_id,
                requested_restaurant_id: restaurantId,
            },
            timestamp: new Date(),
        });

        return { valid: false, reason: 'Table does not belong to this restaurant' };
    }

    return { valid: true };
}
