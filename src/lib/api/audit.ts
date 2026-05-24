import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';

type AuditParams = {
    restaurant_id?: string | null;
    user_id?: string | null;
    action: string;
    entity_type: string;
    entity_id?: string | null;
    metadata?: Json | null;
    old_value?: Json | null;
    new_value?: Json | null;
};

export async function writeAuditLog(
    supabase: SupabaseClient<Database>,
    params: AuditParams
): Promise<{ error: PostgrestError | null }> {
    const { error } = await supabase.from('audit_logs').insert({
        restaurant_id: params.restaurant_id ?? null,
        user_id: params.user_id ?? null,
        action: params.action,
        entity_type: params.entity_type,
        entity_id: params.entity_id ?? null,
        metadata: params.metadata ?? null,
        old_value: params.old_value ?? null,
        new_value: params.new_value ?? null,
    });

    return { error };
}
