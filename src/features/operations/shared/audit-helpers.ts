import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import { writeAuditLog } from '@/lib/api/audit';

export interface AuditEventParams {
    action: string;
    entityType: string;
    entityId?: string;
    userId: string;
    restaurantId: string;
    oldValues?: Json;
    newValues?: Json;
    metadata?: Json;
}

export async function auditAction(
    supabase: SupabaseClient<Database>,
    params: AuditEventParams
): Promise<{ error: { message: string } | null }> {
    const { error } = await writeAuditLog(supabase, {
        restaurant_id: params.restaurantId,
        user_id: params.userId,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId ?? null,
        old_value: params.oldValues ?? null,
        new_value: params.newValues ?? null,
        metadata: params.metadata ?? null,
    });

    return { error };
}

export async function auditOrderAction(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    params: {
        action: string;
        orderId: string;
        userId: string;
        changes?: Json;
    }
): Promise<{ error: { message: string } | null }> {
    return auditAction(supabase, {
        action: params.action,
        entityType: 'order',
        entityId: params.orderId,
        userId: params.userId,
        restaurantId,
        metadata: params.changes,
    });
}

export async function auditStatusTransition(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    params: {
        orderId: string;
        userId: string;
        fromStatus: string;
        toStatus: string;
    }
): Promise<{ error: { message: string } | null }> {
    return auditAction(supabase, {
        action: 'order_status_updated',
        entityType: 'order',
        entityId: params.orderId,
        userId: params.userId,
        restaurantId,
        oldValues: { status: params.fromStatus },
        newValues: { status: params.toStatus },
        metadata: {
            from_status: params.fromStatus,
            to_status: params.toStatus,
        },
    });
}

export async function auditWaitlistEntry(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    params: {
        entryId: string;
        userId: string;
        action: 'created' | 'notified' | 'seated' | 'cancelled';
        partySize?: number;
    }
): Promise<{ error: { message: string } | null }> {
    return auditAction(supabase, {
        action: `waitlist_${params.action}`,
        entityType: 'waitlist_entry',
        entityId: params.entryId,
        userId: params.userId,
        restaurantId,
        metadata: params.partySize ? { party_size: params.partySize } : undefined,
    });
}

export async function auditTableSession(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    params: {
        sessionId: string;
        userId: string;
        action: 'opened' | 'closed' | 'transferred';
        tableId?: string;
    }
): Promise<{ error: { message: string } | null }> {
    return auditAction(supabase, {
        action: `table_session_${params.action}`,
        entityType: 'table_session',
        entityId: params.sessionId,
        userId: params.userId,
        restaurantId,
        metadata: params.tableId ? { table_id: params.tableId } : undefined,
    });
}

export async function auditServiceRequest(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    params: {
        requestId: string;
        userId: string;
        action: 'created' | 'updated' | 'resolved';
        requestType?: string;
    }
): Promise<{ error: { message: string } | null }> {
    return auditAction(supabase, {
        action: `service_request_${params.action}`,
        entityType: 'service_request',
        entityId: params.requestId,
        userId: params.userId,
        restaurantId,
        metadata: params.requestType ? { request_type: params.requestType } : undefined,
    });
}
