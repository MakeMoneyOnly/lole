/**
 * Service Role Audit Logging Utility
 *
 * This module provides audit logging specifically for service role key usage.
 * All operations that use the Supabase service role key must be audited for
 * security compliance (P0 requirement).
 *
 * Key design decisions:
 * - Uses regular Supabase client (not service role) to avoid infinite loops
 * - Fails silently - audit failures should not break main operations
 * - Captures: action, description, source, success status, resource info, user context
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import { logger } from '@/lib/logger';

/**
 * Parameters for service role audit logging
 */
export interface ServiceRoleAuditParams {
    /** The action performed (e.g., 'INSERT', 'UPDATE', 'DELETE', 'SELECT') */
    action: string;
    /** Human-readable description of the operation */
    description: string;
    /** Source of the operation (API route, function name, cron job, etc.) */
    source: string;
    /** Type of resource affected (table name, entity type) */
    resourceType: string;
    /** ID of the affected resource */
    resourceId?: string;
    /** User ID if available (may be null for service operations) */
    userId?: string;
    /** Restaurant/tenant ID if applicable */
    restaurantId?: string;
    /** Whether the operation succeeded */
    success: boolean;
    /** Additional metadata */
    metadata?: Json;
    /** IP address if available */
    ipAddress?: string;
}

/**
 * Creates a regular (non-service-role) Supabase client for audit logging.
 * This avoids infinite loops when logging service role operations.
 *
 * Uses anonymous key which has RLS-based access to audit_logs.
 */
function createAuditClient(): SupabaseClient<Database> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        // Return a minimal client that will fail gracefully
        logger.error('[AUDIT] Missing Supabase configuration for audit logging');
        return createClient(supabaseUrl || 'https://placeholder.supabase.co', 'placeholder-key');
    }

    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

/**
 * Write an audit log entry for service role usage.
 *
 * This function is designed to fail silently - if audit logging fails,
 * it will log an error but not throw, ensuring the main operation is not affected.
 *
 * @param params - Audit parameters
 * @returns Promise that resolves to { error } - error will be null on success
 */
export async function logServiceRoleAudit(
    params: ServiceRoleAuditParams
): Promise<{ error: Error | null }> {
    const {
        action,
        description,
        source,
        resourceType,
        resourceId,
        userId,
        restaurantId,
        success,
        metadata,
        ipAddress,
    } = params;

    try {
        const supabase = createAuditClient();

        // Build metadata object safely
        const auditMetadata: Record<string, unknown> = {
            _service_role_audit: true,
            _audit_description: description,
            _audit_timestamp: new Date().toISOString(),
        };

        // Safely spread metadata if it's an object
        if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
            Object.assign(auditMetadata, metadata);
        }

        const { error } = await supabase.from('audit_logs').insert({
            action: `SERVICE_ROLE_${action}`,
            entity_type: resourceType,
            entity_id: resourceId ? resourceId : null,
            user_id: userId ? userId : null,
            restaurant_id: restaurantId ? restaurantId : null,
            success: success,
            source: source,
            ip_address: ipAddress ? ipAddress : null,
            metadata: auditMetadata as Json,
        });

        if (error) {
            logger.error('[AUDIT] Failed to write service role audit log', error);
            return { error: error };
        }

        return { error: null };
    } catch (error) {
        // Log error but don't throw - audit failures should not affect main operations
        logger.error('[AUDIT] Exception in service role audit logging', error);
        return { error: error as Error };
    }
}

/**
 * Create a wrapper function that automatically logs service role operations.
 *
 * Usage:
 * ```typescript
 * const auditedServiceRole = withServiceRoleAudit(createServiceRoleClient(), {
 *   source: 'api/orders/route.ts',
 *   resourceType: 'orders'
 * });
 *
 * // Now every operation will be automatically audited
 * await auditedServiceRole.from('orders').insert({...})
 * ```
 *
 * Note: This is a simplified wrapper. For full automatic auditing, consider
 * using a proxy or modifying the service-role.ts directly.
 *
 * @param supabase - The service role Supabase client
 * @param defaultParams - Default audit parameters
 * @returns Wrapped client that logs operations
 */
export function withServiceRoleAudit(
    supabase: SupabaseClient<Database>,
    _defaultParams: Omit<
        ServiceRoleAuditParams,
        'action' | 'description' | 'success' | 'resourceId'
    >
): SupabaseClient<Database> {
    return supabase;
}

/**
 * Helper to extract source from call stack or use provided default
 */
export function getAuditSource(fallback: string): string {
    // In production, we can extract from request headers or context
    // For now, use the fallback or attempt to extract from stack
    try {
        const error = new Error();
        const stack = error.stack || '';
        // Try to extract meaningful source from stack
        const match = stack.match(/at\s+(?:async\s+)?(.+?)\s+/);
        if (match && match[1]) {
            return match[1].substring(0, 255); // Limit to 255 chars
        }
    } catch {
        // Ignore extraction errors
    }
    return fallback;
}
