// Guests Domain - Repository Layer
// Database access layer - Supabase queries only, no business logic
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';
import {
    GUEST_LIST_COLUMNS,
    GUEST_DETAIL_COLUMNS,
    columnsToString,
} from '@/lib/constants/query-columns';
import { logger } from '@/lib/logger';

// Lazy initialization of Supabase client
let supabase: SupabaseClient<Database> | null = null;

function getSupabaseClient(): SupabaseClient<Database> {
    if (!supabase) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SECRET_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error(
                `Supabase configuration missing. NEXT_PUBLIC_SUPABASE_URL: ${!!supabaseUrl}, SUPABASE_SECRET_KEY: ${!!supabaseKey}`
            );
        }

        supabase = createClient<Database>(supabaseUrl, supabaseKey);
    }
    return supabase;
}

export type GuestRow = Database['public']['Tables']['guests']['Row'];

export interface GuestListOptions {
    search?: string;
    isVip?: boolean;
    limit?: number;
    offset?: number;
}

export class GuestsRepository {
    /**
     * Get a single guest by ID
     */
    async getGuest(id: string): Promise<GuestRow | null> {
        const { data, error } = await getSupabaseClient()
            .from('guests')
            .select(columnsToString(GUEST_DETAIL_COLUMNS))
            .eq('id', id)
            .maybeSingle();

        if (error) {
            logger.error('[guests/repository] Error fetching guest', error, { source: 'guests/repository' });
            throw new Error(error.message);
        }

        return data as GuestRow | null;
    }

    /**
     * Get paginated list of guests for a restaurant
     */
    async getGuests(restaurantId: string, options: GuestListOptions = {}): Promise<GuestRow[]> {
        const limit = Math.min(options.limit ?? 50, 200);
        const offset = options.offset ?? 0;

        let query = getSupabaseClient()
            .from('guests')
            .select(columnsToString(GUEST_LIST_COLUMNS))
            .eq('restaurant_id', restaurantId)
            .order('last_visit_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (options.isVip !== undefined) {
            // Note: This assumes a 'is_vip' column or tag
            // Adjust based on actual schema
            if (options.isVip) {
                query = query.contains('tags', ['vip']);
            }
        }

        if (options.search) {
            query = query.or(
                `name.ilike.%${options.search}%,phone.ilike.%${options.search}%,email.ilike.%${options.search}%`
            );
        }

        const { data, error } = await query;

        if (error) {
            logger.error('[guests/repository] Error fetching guests list', error, { source: 'guests/repository' });
            throw new Error(error.message);
        }

        return (data as unknown as GuestRow[]) ?? [];
    }

    /**
     * Create a new guest
     */
    async createGuest(data: {
        restaurant_id: string;
        name: string;
        phone?: string;
        email?: string;
        notes?: string;
        tags?: string[];
    }): Promise<GuestRow> {
        const { data: guest, error } = await getSupabaseClient()
            .from('guests')
            .insert({
                restaurant_id: data.restaurant_id,
                name: data.name,
                phone_hash: data.phone ?? null,
                email_hash: data.email ?? null,
                notes: data.notes ?? null,
                tags: data.tags ?? [],
                visit_count: 0,
                identity_key: `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                first_seen_at: new Date().toISOString(),
                last_seen_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            logger.error('[guests/repository] Error creating guest', error, { source: 'guests/repository' });
            throw new Error(error.message);
        }

        return guest!;
    }

    /**
     * Update a guest
     */
    async updateGuest(
        id: string,
        data: {
            name?: string;
            phone?: string;
            email?: string;
            notes?: string;
            tags?: string[];
        }
    ): Promise<GuestRow> {
        const { data: guest, error } = await getSupabaseClient()
            .from('guests')
            .update({
                ...data,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error('[guests/repository] Error updating guest', error, { source: 'guests/repository' });
            throw new Error(error.message);
        }

        return guest!;
    }

    /**
     * Update guest visit statistics
     */
    async updateVisitStats(id: string, amountSpent: number): Promise<GuestRow> {
        // First get current values
        const current = await this.getGuest(id);
        if (!current) {
            throw new Error(`Guest ${id} not found`);
        }

        const { data: guest, error } = await getSupabaseClient()
            .from('guests')
            .update({
                visit_count: (current.visit_count ?? 0) + 1,
                lifetime_value: (current.lifetime_value ?? 0) + amountSpent,
                last_visit_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error('[guests/repository] Error updating visit stats', error, { source: 'guests/repository' });
            throw new Error(error.message);
        }

        return guest!;
    }

    /**
     * Search guests by phone or email (for loyalty lookup)
     */
    async searchGuests(
        restaurantId: string,
        query: string,
        limit: number = 10
    ): Promise<GuestRow[]> {
        const { data, error } = await getSupabaseClient()
            .from('guests')
            .select(columnsToString(GUEST_LIST_COLUMNS))
            .eq('restaurant_id', restaurantId)
            .or(`phone.ilike.%${query}%,email.ilike.%${query}%,name.ilike.%${query}%`)
            .limit(limit);

        if (error) {
            logger.error('[guests/repository] Error searching guests', error, { source: 'guests/repository' });
            throw new Error(error.message);
        }

        return (data as unknown as GuestRow[]) ?? [];
    }

    /**
     * Batch loader: Get guests for multiple IDs
     * Used by DataLoader for N+1 query prevention
     */
    async getGuestsByIds(ids: string[]): Promise<GuestRow[]> {
        if (ids.length === 0) return [];

        const { data, error } = await getSupabaseClient()
            .from('guests')
            .select(columnsToString(GUEST_LIST_COLUMNS))
            .in('id', ids);

        if (error) {
            logger.error('[guests/repository] Error fetching guests by IDs', error, { source: 'guests/repository' });
            throw new Error(error.message);
        }

        return (data as unknown as GuestRow[]) ?? [];
    }
}

export const guestsRepository = new GuestsRepository();
