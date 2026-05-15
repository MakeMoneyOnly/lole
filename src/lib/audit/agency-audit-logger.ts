/**
 * MED-005: Agency Audit Logging
 *
 * Provides comprehensive audit logging for agency-level operations:
 * - Cross-restaurant access by agency users
 * - Agency admin actions (create restaurant, manage staff, etc.)
 * - Security-sensitive operations (role changes, permission updates)
 *
 * This ensures accountability and traceability for multi-tenant operations.
 */

import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { logger } from '@/lib/logger';

const log = logger.child('[audit/agency]');

type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert'];
type Json = Database['public']['Tables']['audit_logs']['Row']['old_value'];

/**
 * Helper to cast Record to Json type for Supabase
 */
function toJson(value: Record<string, unknown> | undefined): Json | undefined {
    if (!value) return undefined;
    return value as unknown as Json;
}

/**
 * Agency action types for audit logging
 */
export type AgencyAction =
    | 'agency:user_login'
    | 'agency:user_logout'
    | 'agency:restaurant_access'
    | 'agency:restaurant_create'
    | 'agency:restaurant_update'
    | 'agency:restaurant_delete'
    | 'agency:staff_create'
    | 'agency:staff_update'
    | 'agency:staff_delete'
    | 'agency:role_change'
    | 'agency:permission_grant'
    | 'agency:permission_revoke'
    | 'agency:settings_update'
    | 'agency:billing_access'
    | 'agency:export_data'
    | 'agency:impersonation_start'
    | 'agency:impersonation_end';

/**
 * Agency audit log entry
 */
export interface AgencyAuditEntry {
    /** The agency user performing the action */
    agencyUserId: string;
    /** The agency user's email */
    agencyUserEmail?: string;
    /** The agency user's role */
    agencyUserRole?: string;
    /** The action being performed */
    action: AgencyAction;
    /** The restaurant being accessed (if applicable) */
    restaurantId?: string;
    /** The restaurant name (for readability in logs) */
    restaurantName?: string;
    /** The entity type being affected (e.g., 'staff', 'restaurant', 'menu') */
    entityType: string;
    /** The entity ID being affected */
    entityId: string;
    /** The previous value (for updates) */
    oldValue?: Record<string, unknown>;
    /** The new value (for updates) */
    newValue?: Record<string, unknown>;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
    /** Request ID for tracing */
    requestId?: string;
    /** IP address of the request */
    ipAddress?: string;
    /** User agent of the request */
    userAgent?: string;
}

/**
 * Log an agency-level action to the audit_logs table
 */
export async function logAgencyAction(entry: AgencyAuditEntry): Promise<void> {
    try {
        const supabase = await createClient();

        const auditLog: AuditLogInsert = {
            restaurant_id: entry.restaurantId ?? null,
            user_id: entry.agencyUserId,
            action: entry.action,
            entity_type: entry.entityType,
            entity_id: entry.entityId,
            old_value: toJson(entry.oldValue),
            new_value: toJson(entry.newValue),
            metadata: {
                agency_user_email: entry.agencyUserEmail,
                agency_user_role: entry.agencyUserRole,
                restaurant_name: entry.restaurantName,
                request_id: entry.requestId,
                ip_address: entry.ipAddress,
                user_agent: entry.userAgent,
                ...entry.metadata,
            },
            created_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('audit_logs').insert(auditLog);

if (error) {
        log.error('Database error', { error });
        // Don't throw - audit logging should not break the main operation
    }
    } catch (error) {
        log.error('Failed to log agency action', { error });
        // Don't throw - audit logging should not break the main operation
    }
}

/**
 * Log when an agency user accesses a restaurant
 */
export async function logRestaurantAccess(params: {
    agencyUserId: string;
    agencyUserEmail?: string;
    agencyUserRole?: string;
    restaurantId: string;
    restaurantName?: string;
    accessType: 'view' | 'edit' | 'manage';
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
}): Promise<void> {
    await logAgencyAction({
        agencyUserId: params.agencyUserId,
        agencyUserEmail: params.agencyUserEmail,
        agencyUserRole: params.agencyUserRole,
        action: 'agency:restaurant_access',
        restaurantId: params.restaurantId,
        restaurantName: params.restaurantName,
        entityType: 'restaurant',
        entityId: params.restaurantId,
        metadata: {
            access_type: params.accessType,
        },
        requestId: params.requestId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    });
}

/**
 * Log when an agency admin creates a restaurant
 */
export async function logRestaurantCreate(params: {
    agencyUserId: string;
    agencyUserEmail?: string;
    agencyUserRole?: string;
    restaurantId: string;
    restaurantName: string;
    restaurantData?: Record<string, unknown>;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
}): Promise<void> {
    await logAgencyAction({
        agencyUserId: params.agencyUserId,
        agencyUserEmail: params.agencyUserEmail,
        agencyUserRole: params.agencyUserRole,
        action: 'agency:restaurant_create',
        restaurantId: params.restaurantId,
        restaurantName: params.restaurantName,
        entityType: 'restaurant',
        entityId: params.restaurantId,
        newValue: params.restaurantData,
        requestId: params.requestId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    });
}

/**
 * Log when an agency admin changes a user's role
 */
export async function logRoleChange(params: {
    agencyUserId: string;
    agencyUserEmail?: string;
    agencyUserRole?: string;
    restaurantId?: string;
    targetUserId: string;
    targetUserEmail?: string;
    oldRole: string;
    newRole: string;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
}): Promise<void> {
    await logAgencyAction({
        agencyUserId: params.agencyUserId,
        agencyUserEmail: params.agencyUserEmail,
        agencyUserRole: params.agencyUserRole,
        action: 'agency:role_change',
        restaurantId: params.restaurantId,
        entityType: 'user_role',
        entityId: params.targetUserId,
        oldValue: { role: params.oldRole, target_user_email: params.targetUserEmail },
        newValue: { role: params.newRole, target_user_email: params.targetUserEmail },
        metadata: {
            target_user_id: params.targetUserId,
            target_user_email: params.targetUserEmail,
        },
        requestId: params.requestId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    });
}

/**
 * Log when an agency user exports data
 */
export async function logDataExport(params: {
    agencyUserId: string;
    agencyUserEmail?: string;
    agencyUserRole?: string;
    restaurantId?: string;
    restaurantName?: string;
    exportType: string;
    recordCount?: number;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
}): Promise<void> {
    await logAgencyAction({
        agencyUserId: params.agencyUserId,
        agencyUserEmail: params.agencyUserEmail,
        agencyUserRole: params.agencyUserRole,
        action: 'agency:export_data',
        restaurantId: params.restaurantId,
        restaurantName: params.restaurantName,
        entityType: 'export',
        entityId: params.requestId ?? crypto.randomUUID(),
        metadata: {
            export_type: params.exportType,
            record_count: params.recordCount,
        },
        requestId: params.requestId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    });
}

/**
 * Log when an agency admin starts impersonating a user
 */
export async function logImpersonationStart(params: {
    agencyUserId: string;
    agencyUserEmail?: string;
    agencyUserRole?: string;
    targetUserId: string;
    targetUserEmail?: string;
    targetRestaurantId?: string;
    reason?: string;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
}): Promise<void> {
    await logAgencyAction({
        agencyUserId: params.agencyUserId,
        agencyUserEmail: params.agencyUserEmail,
        agencyUserRole: params.agencyUserRole,
        action: 'agency:impersonation_start',
        restaurantId: params.targetRestaurantId,
        entityType: 'impersonation',
        entityId: params.targetUserId,
        metadata: {
            target_user_id: params.targetUserId,
            target_user_email: params.targetUserEmail,
            reason: params.reason,
        },
        requestId: params.requestId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    });
}

/**
 * Log when an agency admin stops impersonating a user
 */
export async function logImpersonationEnd(params: {
    agencyUserId: string;
    agencyUserEmail?: string;
    targetUserId: string;
    targetUserEmail?: string;
    durationMs?: number;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
}): Promise<void> {
    await logAgencyAction({
        agencyUserId: params.agencyUserId,
        agencyUserEmail: params.agencyUserEmail,
        action: 'agency:impersonation_end',
        entityType: 'impersonation',
        entityId: params.targetUserId,
        metadata: {
            target_user_id: params.targetUserId,
            target_user_email: params.targetUserEmail,
            duration_ms: params.durationMs,
        },
        requestId: params.requestId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
    });
}

/**
 * Query agency audit logs
 */
export async function queryAgencyAuditLogs(params: {
    agencyUserId?: string;
    restaurantId?: string;
    action?: AgencyAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}): Promise<{
    logs: Array<Database['public']['Tables']['audit_logs']['Row']>;
    total: number;
}> {
    try {
        const supabase = await createClient();

        let query = supabase
            .from('audit_logs')
            .select('*', { count: 'exact' })
            .like('action', 'agency:%')
            .order('created_at', { ascending: false });

        if (params.agencyUserId) {
            query = query.eq('user_id', params.agencyUserId);
        }
        if (params.restaurantId) {
            query = query.eq('restaurant_id', params.restaurantId);
        }
        if (params.action) {
            query = query.eq('action', params.action);
        }
        if (params.startDate) {
            query = query.gte('created_at', params.startDate.toISOString());
        }
        if (params.endDate) {
            query = query.lte('created_at', params.endDate.toISOString());
        }

        const limit = params.limit ?? 50;
        const offset = params.offset ?? 0;
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            log.error('Query error', { error });
            return { logs: [], total: 0 };
        }

        return { logs: data ?? [], total: count ?? 0 };
    } catch (error) {
        log.error('Failed to query audit logs', { error });
        return { logs: [], total: 0 };
    }
}

const agencyAuditLoggerExports = {
    logAgencyAction,
    logRestaurantAccess,
    logRestaurantCreate,
    logRoleChange,
    logDataExport,
    logImpersonationStart,
    logImpersonationEnd,
    queryAgencyAuditLogs,
};

export default agencyAuditLoggerExports;
