import { createClient } from './supabase/server';
import type { Database } from '@/types/database';
import { logger } from './logger';

export interface AuditLogEntry {
    restaurant_id: string;
    user_id?: string;
    telegram_user_id?: string;
    action: string;
    entity_type: string;
    entity_id: string;
    old_value?: Database['public']['Tables']['audit_logs']['Row']['old_value'];
    new_value?: Database['public']['Tables']['audit_logs']['Row']['new_value'];
    metadata?: Database['public']['Tables']['audit_logs']['Row']['metadata'];
}

/**
 * Logs an action to the audit_logs table
 */
export async function logAction(entry: AuditLogEntry): Promise<void> {
    try {
        const supabase = await createClient();

        const { error } = await supabase.from('audit_logs').insert({
            ...entry,
            created_at: new Date().toISOString(),
        } as Database['public']['Tables']['audit_logs']['Insert']);

        if (error) {
            logger.error('[AuditLogger] Database error:', error);
        }
    } catch (error) {
        logger.error('[AuditLogger] Failed to log action:', error);
    }
}
