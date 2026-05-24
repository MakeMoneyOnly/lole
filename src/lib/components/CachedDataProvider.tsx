/**
 * Cached Data Provider - Server Component with 'use cache' directive
 *
 * This file demonstrates the React Cache Components pattern for
 * data fetching with automatic caching in Next.js 15+.
 *
 * @see https://nextjs.org/docs/app/building-your-application/rendering/server-components#reducing-server-components-size
 */

'use cache';

import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// ─── Type Definitions ─────────────────────────────────────────────────────────

export interface MenuItem {
    id: string;
    name: string;
    name_am?: string | null;
    description?: string | null;
    description_am?: string | null;
    price_santim: number;
    image_url?: string | null;
    is_available: boolean;
    category_id?: string | null;
    order_index?: number | null;
}

export interface Category {
    id: string;
    name: string;
    name_am?: string | null;
    order_index?: number | null;
    section?: string | null;
}

export interface Restaurant {
    id: string;
    name: string;
    name_am?: string | null;
    description?: string | null;
    phone?: string | null;
    email?: string | null;
    logo_url?: string | null;
    currency?: string | null;
    timezone?: string | null;
}

// ─── Cache Configuration ─────────────────────────────────────────────────────

export const CACHE_TAGS = {
    MENU_ITEMS: 'menu-items',
    CATEGORIES: 'categories',
    RESTAURANT: 'restaurant',
} as const;

export const DEFAULT_REVALIDATE = {
    SECONDS_1_MIN: 60,
    SECONDS_5_MIN: 300,
    SECONDS_15_MIN: 900,
    SECONDS_1_HOUR: 3600,
    SECONDS_24_HOURS: 86400,
} as const;

// ─── Cached Data Functions (Server-only) ───────────────────────────────────

/**
 * Fetch and cache menu items for a restaurant
 * Uses unstable_cache for explicit cache control with tags
 */
async function fetchMenuItems(
    restaurantId: string,
    options?: {
        categoryId?: string;
        availableOnly?: boolean;
        limit?: number;
    }
): Promise<MenuItem[]> {
    const supabase = await createClient();

    let query = supabase
        .from('menu_items')
        .select(
            'id, name, name_am, description, description_am, price_santim, image_url, is_available, category_id, order_index'
        )
        .eq('restaurant_id', restaurantId)
        .order('order_index');

    if (options?.categoryId) {
        query = query.eq('category_id', options.categoryId);
    }

    if (options?.availableOnly) {
        query = query.eq('is_available', true);
    }

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
        if (error.code === 'PGRST116') return [];
        // eslint-disable-next-line no-console
        console.error('Error fetching menu items:', error);
        return [];
    }

    return (data ?? []) as unknown as MenuItem[];
}

/**
 * Cached version of fetchMenuItems with proper cache key and tags
 * Cache key includes restaurantId for tenant isolation
 */
const getRestaurantMenuCached = unstable_cache(
    (input: {
        restaurantId: string;
        options?: { categoryId?: string; availableOnly?: boolean; limit?: number };
    }) => fetchMenuItems(input.restaurantId, input.options),
    ['restaurant-menu-items'],
    {
        tags: [CACHE_TAGS.MENU_ITEMS],
        revalidate: DEFAULT_REVALIDATE.SECONDS_5_MIN,
    }
);

export const getRestaurantMenu = (
    restaurantId: string,
    options?: { categoryId?: string; availableOnly?: boolean; limit?: number }
) => getRestaurantMenuCached({ restaurantId, options });

/**
 * Fetch and cache categories for a restaurant
 */
async function fetchCategories(restaurantId: string): Promise<Category[]> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('categories')
        .select('id, name, name_am, order_index, section')
        .eq('restaurant_id', restaurantId)
        .order('order_index');

    if (error) {
        // eslint-disable-next-line no-console
        console.error('Error fetching categories:', error);
        return [];
    }

    return (data ?? []) as unknown as Category[];
}

/**
 * Cached version of fetchCategories with tenant-isolated cache key
 */
const getRestaurantCategoriesCached = unstable_cache(
    (input: { restaurantId: string }) => fetchCategories(input.restaurantId),
    ['restaurant-categories'],
    {
        tags: [CACHE_TAGS.CATEGORIES],
        revalidate: DEFAULT_REVALIDATE.SECONDS_15_MIN,
    }
);

export const getRestaurantCategories = (restaurantId: string) =>
    getRestaurantCategoriesCached({ restaurantId });

/**
 * Fetch and cache restaurant details
 */
async function fetchRestaurant(restaurantId: string): Promise<Restaurant | null> {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, name_am, description, phone, email, logo_url, currency, timezone')
        .eq('id', restaurantId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        // eslint-disable-next-line no-console
        console.error('Error fetching restaurant:', error);
        return null;
    }

    return data as unknown as Restaurant;
}

/**
 * Cached version of fetchRestaurant with tenant-isolated cache key
 */
const getRestaurantDataCached = unstable_cache(
    (input: { restaurantId: string }) => fetchRestaurant(input.restaurantId),
    ['restaurant-data'],
    {
        tags: [CACHE_TAGS.RESTAURANT],
        revalidate: DEFAULT_REVALIDATE.SECONDS_1_HOUR,
    }
);

export const getCachedRestaurantData = (restaurantId: string) =>
    getRestaurantDataCached({ restaurantId });

// ─── React Server Component ───────────────────────────────────────────────────

export interface CachedDataProviderProps {
    restaurantId: string;
    categoryId?: string;
    availableOnly?: boolean;
    limit?: number;
    children: (data: {
        menuItems: MenuItem[];
        categories: Category[];
        restaurant: Restaurant | null;
        isLoading: boolean;
    }) => React.ReactNode;
}

/**
 * Server Component that fetches and provides cached data to children
 *
 * Usage:
 * ```tsx
 * <CachedDataProvider restaurantId={restaurantId}>
 *   {({ menuItems, categories, restaurant }) => (
 *     <MenuView items={menuItems} categories={categories} />
 *   )}
 * </CachedDataProvider>
 * ```
 */
export async function CachedDataProvider({
    restaurantId,
    categoryId,
    availableOnly = true,
    limit,
    children,
}: CachedDataProviderProps) {
    const [menuItems, categories, restaurant] = await Promise.all([
        getRestaurantMenu(restaurantId, { categoryId, availableOnly, limit }),
        getRestaurantCategories(restaurantId),
        getCachedRestaurantData(restaurantId),
    ]);

    return <>{children({ menuItems, categories, restaurant, isLoading: false })}</>;
}

// ─── Cache Invalidation Utilities ────────────────────────────────────────────

/**
 * Revalidate all menu-related caches for a restaurant
 * Call this when menu items or categories are updated
 */
export async function revalidateRestaurantMenu() {
    const { revalidateTag, revalidatePath } = await import('next/cache');

    // Revalidate tagged caches (Next.js 16 requires profile argument)
    revalidateTag(CACHE_TAGS.MENU_ITEMS, 'hours');
    revalidateTag(CACHE_TAGS.CATEGORIES, 'hours');

    // Also revalidate path-specific caches
    revalidatePath('/', 'layout');
}

/**
 * Revalidate restaurant-specific caches
 */
export async function revalidateRestaurant() {
    const { revalidateTag, revalidatePath } = await import('next/cache');

    revalidateTag(CACHE_TAGS.RESTAURANT, 'hours');
    revalidateTag(CACHE_TAGS.MENU_ITEMS, 'hours');
    revalidateTag(CACHE_TAGS.CATEGORIES, 'hours');

    revalidatePath('/', 'layout');
}
