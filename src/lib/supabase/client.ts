import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createClient(): SupabaseClient<Database> {
    // Sanitize env vars — Vercel CLI can store values as '"value" \r\n'
    const cleanEnvVar = (val: string | undefined): string => {
        if (!val) return '';
        return val
            .replace(/\r/g, '')
            .replace(/\n/g, '')
            .replace(/^[\"']+/, '')
            .replace(/[\"']+$/, '')
            .trim();
    };

    const supabaseUrl = cleanEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseKey = cleanEnvVar(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

    // During build or if missing, provide safe fallbacks to prevent crash
    if (!supabaseUrl || !supabaseKey) {
        return createBrowserClient<Database>(
            supabaseUrl || 'https://placeholder.supabase.co',
            supabaseKey || 'placeholder-key'
        );
    }

    return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}

// Singleton for client-side usage
let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
    if (!browserClient) {
        browserClient = createClient();
    }
    return browserClient;
}
