/**
 * Typed Supabase query helpers
 *
 * Addresses: Type Safety Gaps with Supabase Queries (Medium Priority Audit Finding #7)
 * Provides centralized, type-safe query functions for common database operations
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Type aliases for cleaner code
type Tables = Database['public']['Tables'];

/**
 * Fetch reviews for a specific menu item
 *
 * @param supabase - Supabase client instance
 * @param itemId - The item ID to fetch reviews for
 * @returns Array of reviews ordered by created_at desc
 */
export async function fetchReviews(
    supabase: SupabaseClient<Database>,
    itemId: string
): Promise<{ data: Tables['reviews']['Row'][] | null; error: Error | null }> {
    return supabase
        .from('reviews')
        .select('id, item_id, rating, title, content, author_name, created_at, updated_at')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .returns<Tables['reviews']['Row'][]>();
}

/**
 * Fetch orders for a restaurant within a time range
 *
 * @param supabase - Supabase client instance
 * @param restaurantId - The restaurant ID
 * @param since - ISO timestamp to fetch orders from
 * @returns Array of orders ordered by created_at desc
 */
export async function fetchOrdersSince(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    since: string
): Promise<{ data: Tables['orders']['Row'][] | null; error: Error | null }> {
    return supabase
        .from('orders')
        .select(
            'id, restaurant_id, order_number, table_number, guest_name, guest_phone, status, order_type, subtotal_santim, discount_santim, vat_santim, total_santim, notes, idempotency_key, guest_fingerprint, created_at, updated_at'
        )
        .eq('restaurant_id', restaurantId)
        .gt('created_at', since)
        .order('created_at', { ascending: false })
        .returns<Tables['orders']['Row'][]>();
}

/**
 * Fetch pending service requests for a restaurant
 *
 * @param supabase - Supabase client instance
 * @param restaurantId - The restaurant ID
 * @returns Array of non-completed service requests
 */
export async function fetchPendingServiceRequests(
    supabase: SupabaseClient<Database>,
    restaurantId: string
): Promise<{ data: Tables['service_requests']['Row'][] | null; error: Error | null }> {
    return supabase
        .from('service_requests')
        .select(
            'id, restaurant_id, table_id, session_id, request_type, status, notes, created_at, updated_at'
        )
        .eq('restaurant_id', restaurantId)
        .neq('status', 'completed')
        .order('created_at', { ascending: false })
        .returns<Tables['service_requests']['Row'][]>();
}

/**
 * Fetch menu items by category
 *
 * @param supabase - Supabase client instance
 * @param categoryId - The category ID
 * @returns Array of menu items in the category
 */
export async function fetchItemsByCategory(
    supabase: SupabaseClient<Database>,
    categoryId: string
): Promise<{ data: Tables['menu_items']['Row'][] | null; error: Error | null }> {
    return supabase
        .from('menu_items')
        .select(
            'id, category_id, name, name_am, description, description_am, price_santim, is_available, image_url, station, course, preparation_time_minutes, sort_order, created_at, updated_at'
        )
        .eq('category_id', categoryId)
        .eq('is_available', true)
        .order('name', { ascending: true })
        .returns<Tables['menu_items']['Row'][]>();
}

/**
 * Fetch restaurant with full menu (categories + items)
 *
 * @param supabase - Supabase client instance
 * @param slug - The restaurant slug
 * @returns Restaurant data with nested categories and items
 */
export async function fetchRestaurantWithMenu(
    supabase: SupabaseClient<Database>,
    slug: string
): Promise<{ data: Tables['restaurants']['Row'] | null; error: Error | null }> {
    return supabase
        .from('restaurants')
        .select(
            `
            id, name, slug, description, image_url, is_active, default_locale, currency, phone, email, address, created_at, updated_at,
            categories:categories(
                id, name, name_am, order_index, section, is_active, restaurant_id, created_at, updated_at,
                items:menu_items(id, category_id, name, name_am, description, description_am, price_santim, is_available, image_url, station, course, preparation_time_minutes, sort_order, created_at, updated_at)
            )
        `
        )
        .eq('slug', slug)
        .single();
}

/**
 * Insert a new order with type safety
 *
 * @param supabase - Supabase client instance
 * @param order - Order data to insert
 * @returns Inserted order data
 */
export async function insertOrder(
    supabase: SupabaseClient<Database>,
    order: Tables['orders']['Insert']
): Promise<{ data: Tables['orders']['Row'] | null; error: Error | null }> {
    const { error } = await supabase.from('orders').insert(order);

    // Return early if there's an error
    if (error) {
        return { data: null, error };
    }

    // Since we don't use .select(), we return the input object as the "Row".
    // This avoids triggering RLS SELECT policies which guests don't have.
    // Ensure `id` was generated prior to calling this function.
    return { data: order as Tables['orders']['Row'], error: null };
}

/**
 * Insert a service request with type safety
 *
 * @param supabase - Supabase client instance
 * @param request - Service request data to insert
 * @returns Inserted service request data
 */
export async function insertServiceRequest(
    supabase: SupabaseClient<Database>,
    request: Tables['service_requests']['Insert']
): Promise<{ data: Tables['service_requests']['Row'] | null; error: Error | null }> {
    return supabase
        .from('service_requests')
        .insert(request)
        .select()
        .single()
        .returns<Tables['service_requests']['Row']>();
}

/**
 * Update order status with type safety
 *
 * @param supabase - Supabase client instance
 * @param orderId - The order ID to update
 * @param status - New status value
 * @returns Updated order data
 */
export async function updateOrderStatus(
    supabase: SupabaseClient<Database>,
    orderId: string,
    status: Tables['orders']['Row']['status']
): Promise<{ data: Tables['orders']['Row'] | null; error: Error | null }> {
    return supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .select()
        .single()
        .returns<Tables['orders']['Row']>();
}

/**
 * Check for existing order by idempotency key
 *
 * @param supabase - Supabase client instance
 * @param idempotencyKey - The idempotency key to check
 * @returns Existing order if found, null otherwise
 */
export async function getOrderByIdempotencyKey(
    supabase: SupabaseClient<Database>,
    idempotencyKey: string
): Promise<{ data: Pick<Tables['orders']['Row'], 'id' | 'status'> | null; error: Error | null }> {
    return supabase
        .from('orders')
        .select('id, status')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()
        .returns<Pick<Tables['orders']['Row'], 'id' | 'status'> | null>();
}

/**
 * Fetch items by IDs for validation
 *
 * @param supabase - Supabase client instance
 * @param itemIds - Array of item IDs to fetch
 * @returns Array of items with validation fields
 */
export async function fetchItemsForValidation(
    supabase: SupabaseClient<Database>,
    itemIds: string[]
): Promise<{
    data: Array<{
        id: string;
        name: string;
        price: number;
        is_available: boolean;
        station: string;
        course: string;
    }> | null;
    error: Error | null;
}> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    return db
        .from('menu_items')
        .select('id, name, price, is_available, station, course')
        .in('id', itemIds);
}
