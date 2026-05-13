import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const ItemIdSchema = z.string().uuid();

const UpsellQuerySchema = z.object({
    guest_id: z.string().uuid().optional(),
    cart_items: z.string().optional(), // JSON string of cart item IDs
    limit: z.coerce.number().int().min(1).max(10).default(4),
});

interface UpsellRecommendation {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    category_name: string;
    reason: 'complementary' | 'popular' | 'category_based' | 'personalized';
    reason_text: string;
    order_count: number | null;
}

/**
 * GET /api/menu/items/[itemId]/upsell
 *
 * Returns upsell recommendations for a menu item.
 * Uses rule-based logic (no AI/ML):
 * 1. Complementary items (manually configured)
 * 2. Popular items (most ordered)
 * 3. Category-based items
 * 4. Personalized (based on guest history)
 */
export async function GET(request: Request, routeContext: { params: Promise<{ itemId: string }> }) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const { itemId } = await routeContext.params;
    const itemIdParsed = ItemIdSchema.safeParse(itemId);
    if (!itemIdParsed.success) {
        return apiError('Invalid item id', 400, 'INVALID_ITEM_ID', itemIdParsed.error.flatten());
    }

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const parsedQuery = UpsellQuerySchema.safeParse(queryParams);

    if (!parsedQuery.success) {
        return apiError(
            'Invalid query parameters',
            400,
            'VALIDATION_ERROR',
            parsedQuery.error.flatten()
        );
    }

    const { guest_id, cart_items, limit } = parsedQuery.data;
    const db = context.supabase as SupabaseClient<Database>;

    try {
        // Get the current item details
        const { data: currentItem, error: itemError } = await db
            .from('menu_items')
            .select('id, name, category_id, upsell_tags, complementary_items, categories(name)')
            .eq('id', itemIdParsed.data)
            .eq('restaurant_id', context.restaurantId)
            .maybeSingle();

        if (itemError) {
            return apiError('Failed to fetch item', 500, 'ITEM_FETCH_FAILED', itemError.message);
        }

        if (!currentItem) {
            return apiError('Item not found', 404, 'ITEM_NOT_FOUND');
        }

        const recommendations: UpsellRecommendation[] = [];
        const addedItemIds = new Set<string>([itemIdParsed.data]);

        // Parse cart items if provided
        let cartItemIds: string[] = [];
        if (cart_items) {
            try {
                cartItemIds = JSON.parse(cart_items);
                cartItemIds.forEach(id => addedItemIds.add(id));
            } catch {
                // Invalid JSON, ignore
            }
        }

        // 1. Complementary items (manually configured)
        if (currentItem.complementary_items && Array.isArray(currentItem.complementary_items)) {
            const complementaryIds = currentItem.complementary_items.filter(
                (id: string) => !addedItemIds.has(id)
            );

            if (complementaryIds.length > 0) {
                const { data: complementaryItems } = await db
                    .from('menu_items')
                    .select('id, name, price, image_url, categories(name), order_count')
                    .in('id', complementaryIds)
                    .eq('restaurant_id', context.restaurantId)
                    .eq('is_available', true);

                for (const item of complementaryItems ?? []) {
                    if (recommendations.length >= limit) break;
                    if (addedItemIds.has(item.id)) continue;

                    recommendations.push({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        image_url: item.image_url,
                        category_name: item.categories?.name ?? '',
                        reason: 'complementary',
                        reason_text: `Pairs well with ${currentItem.name}`,
                        order_count: item.order_count,
                    });
                    addedItemIds.add(item.id);
                }
            }
        }

        // 2. Popular items (most ordered globally)
        if (recommendations.length < limit) {
            const { data: popularItems } = await db
                .from('menu_items')
                .select('id, name, price, image_url, categories(name), order_count')
                .eq('restaurant_id', context.restaurantId)
                .eq('is_available', true)
                .not(
                    'id',
                    'in',
                    `(${Array.from(addedItemIds)
                        .map(id => `'${id}'`)
                        .join(',')})`
                )
                .order('order_count', { ascending: false })
                .limit(limit - recommendations.length);

            for (const item of popularItems ?? []) {
                if (recommendations.length >= limit) break;

                recommendations.push({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    image_url: item.image_url,
                    category_name: item.categories?.name ?? '',
                    reason: 'popular',
                    reason_text: 'Popular with other guests',
                    order_count: item.order_count,
                });
                addedItemIds.add(item.id);
            }
        }

        // 3. Category-based items (from same category)
        if (recommendations.length < limit && currentItem.category_id) {
            const { data: categoryItems } = await db
                .from('menu_items')
                .select('id, name, price, image_url, categories(name), order_count')
                .eq('restaurant_id', context.restaurantId)
                .eq('category_id', currentItem.category_id)
                .eq('is_available', true)
                .not(
                    'id',
                    'in',
                    `(${Array.from(addedItemIds)
                        .map(id => `'${id}'`)
                        .join(',')})`
                )
                .order('order_count', { ascending: false })
                .limit(limit - recommendations.length);

            for (const item of categoryItems ?? []) {
                if (recommendations.length >= limit) break;

                recommendations.push({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    image_url: item.image_url,
                    category_name: item.categories?.name ?? '',
                    reason: 'category_based',
                    reason_text: `More from ${item.categories?.name ?? 'this category'}`,
                    order_count: item.order_count,
                });
                addedItemIds.add(item.id);
            }
        }

        // 4. Personalized recommendations (based on guest history)
        if (recommendations.length < limit && guest_id) {
            // Get items the guest has ordered before
            const { data: guestOrders } = await db
                .from('orders')
                .select('id')
                .eq('guest_id', guest_id)
                .eq('restaurant_id', context.restaurantId)
                .order('created_at', { ascending: false })
                .limit(10);

            if (guestOrders && guestOrders.length > 0) {
                const orderIds = guestOrders.map((o: { id: string }) => o.id);

                // Get items from these orders
                const { data: orderItems } = await db
                    .from('order_items')
                    .select('item_id')
                    .in('order_id', orderIds)
                    .not(
                        'item_id',
                        'in',
                        `(${Array.from(addedItemIds)
                            .map(id => `'${id}'`)
                            .join(',')})`
                    );

                if (orderItems && orderItems.length > 0) {
                    // Group and count in JavaScript since Supabase doesn't have typed .group()
                    const itemCounts = orderItems.reduce<Record<string, number>>((acc, oi) => {
                        acc[oi.item_id] = (acc[oi.item_id] ?? 0) + 1;
                        return acc;
                    }, {});
                    const menuItemIds = Object.keys(itemCounts)
                        .sort((a, b) => itemCounts[b] - itemCounts[a])
                        .slice(0, limit - recommendations.length);

                    const { data: guestFavoriteItems } = await db
                        .from('menu_items')
                        .select('id, name, price, image_url, categories(name), order_count')
                        .in('id', menuItemIds)
                        .eq('restaurant_id', context.restaurantId)
                        .eq('is_available', true);

                    for (const item of guestFavoriteItems ?? []) {
                        if (recommendations.length >= limit) break;

                        recommendations.push({
                            id: item.id,
                            name: item.name,
                            price: item.price,
                            image_url: item.image_url,
                            category_name: item.categories?.name ?? '',
                            reason: 'personalized',
                            reason_text: 'Based on your past orders',
                            order_count: item.order_count,
                        });
                        addedItemIds.add(item.id);
                    }
                }
            }
        }

        // Log upsell analytics (async, don't wait)
        if (guest_id) {
            db.from('upsell_analytics')
                .insert({
                    restaurant_id: context.restaurantId,
                    guest_id,
                    item_viewed: itemIdParsed.data,
                    recommended_items: recommendations.map(r => r.id),
                    created_at: new Date().toISOString(),
                })
                .then(
                    () => {},
                    () => {}
                );
        }

        return apiSuccess({
            item_id: itemIdParsed.data,
            recommendations,
            total: recommendations.length,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return apiError('Failed to generate recommendations', 500, 'UPSELL_ERROR', errorMessage);
    }
}

/**
 * POST /api/menu/items/[itemId]/upsell
 *
 * Track upsell interaction (click, add to cart)
 */
export async function POST(
    request: Request,
    routeContext: { params: Promise<{ itemId: string }> }
) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const { itemId } = await routeContext.params;
    const itemIdParsed = ItemIdSchema.safeParse(itemId);
    if (!itemIdParsed.success) {
        return apiError('Invalid item id', 400, 'INVALID_ITEM_ID');
    }

    const body = await request.json().catch(() => ({}));
    const { guest_id, clicked_item, added_to_cart, upsell_analytics_id } = body as {
        guest_id?: string;
        clicked_item?: string;
        added_to_cart?: boolean;
        upsell_analytics_id?: string;
    };

    const db = context.supabase;

    try {
        // Update existing analytics record or create new one
        if (upsell_analytics_id) {
            await (
                db as unknown as {
                    from: (table: string) => {
                        update: (data: unknown) => {
                            eq: (col: string, val: string) => Promise<void>;
                        };
                    };
                }
            )
                .from('upsell_analytics')
                .update({
                    clicked_item: clicked_item ?? null,
                    added_to_cart: added_to_cart ?? false,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', upsell_analytics_id);
        } else if (guest_id) {
            await (
                db as unknown as {
                    from: (table: string) => { insert: (data: unknown) => Promise<void> };
                }
            )
                .from('upsell_analytics')
                .insert({
                    restaurant_id: context.restaurantId,
                    guest_id,
                    item_viewed: itemIdParsed.data,
                    clicked_item: clicked_item ?? null,
                    added_to_cart: added_to_cart ?? false,
                    created_at: new Date().toISOString(),
                });
        }

        return apiSuccess({ tracked: true });
    } catch {
        return apiSuccess({ tracked: false });
    }
}
