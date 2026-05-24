/**
 * Base utilities for domain repositories
 * @see SKILLS/productivity/reducing-entropy/SKILL.md
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

let supabaseClient: SupabaseClient<Database> | null = null;

/**
 * Get or create the Supabase client for repository operations.
 * Uses lazy initialization to avoid creating the client at module load time.
 */
export function getRepositoryClient(): SupabaseClient<Database> {
    if (!supabaseClient) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SECRET_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error(
                `Supabase configuration missing. NEXT_PUBLIC_SUPABASE_URL: ${!!supabaseUrl}, SUPABASE_SECRET_KEY: ${!!supabaseKey}`
            );
        }

        supabaseClient = createClient<Database>(supabaseUrl, supabaseKey);
    }
    return supabaseClient;
}

/**
 * Reset the client (useful for testing)
 */
export function resetRepositoryClient(): void {
    supabaseClient = null;
}

/**
 * Common pagination parameters for repository queries
 */
export interface PaginationParams {
    limit?: number;
    offset?: number;
}

/**
 * Default pagination limits
 */
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

/**
 * Normalize pagination parameters with safety bounds
 */
export function normalizePagination(params?: PaginationParams): Required<PaginationParams> {
    return {
        limit: Math.min(params?.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
        offset: params?.offset ?? 0,
    };
}
