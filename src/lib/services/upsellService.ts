/**
 * Upsell Service
 * TASK-ONLINE-004: Enhanced Upsells
 *
 * Provides upsell and recommendation logic for menu items
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { logger } from '@/lib/logger';

const log = logger.child('UpsellService');

// =========================================================
// Type Definitions
// =========================================================

export type UpsellReason =
    | 'complementary'
    | 'popular'
    | 'category_based'
    | 'personalized'
    | 'frequently_bought_together';

export interface UpsellRecommendation {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    category_name: string;
    reason: UpsellReason;
    reason_text: string;
    order_count?: number;
    confidence_score?: number;
}

export interface FrequentlyBoughtTogether {
    item_id: string;
    item_name: string;
    co_occurrence_count: number;
    confidence_score: number;
}

// =========================================================
// Frequently Bought Together
// =========================================================

/**
 * Get items frequently bought together with a specific item
 * Uses order co-occurrence analysis
 */
export async function getFrequentlyBoughtTogether(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    itemId: string,
    options?: {
        limit?: number;
        minCoOccurrence?: number;
        excludeItemIds?: string[];
    }
): Promise<UpsellRecommendation[]> {
    // Tables: order_items, menu_items, categories not fully typed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const limit = options?.limit ?? 4;
    const minCoOccurrence = options?.minCoOccurrence ?? 2;
    const excludeIds = options?.excludeItemIds ?? [];

    try {
        // Get orders containing this item
        const { data: orderItems, error } = await db
            .from('order_items')
            .select('order_id, menu_item_id')
            .eq('menu_item_id', itemId);

        if (error || !orderItems || orderItems.length === 0) {
            return [];
        }

        const orderIds = orderItems.map((oi: { order_id: string }) => oi.order_id);

        // Get other items from these orders
        const { data: coOccurringItems, error: coError } = await db
            .from('order_items')
            .select(
                'menu_item_id, menu_items!inner(id, name, price, image_url, is_available, categories(name))'
            )
            .in('order_id', orderIds)
            .neq('menu_item_id', itemId)
            .eq('menu_items.is_available', true);

        if (coError || !coOccurringItems) {
            return [];
        }

        // Count co-occurrences
        const coOccurrenceMap = new Map<
            string,
            {
                count: number;
                item: {
                    id: string;
                    name: string;
                    price: number;
                    image_url: string | null;
                    categories?: { name: string };
                };
            }
        >();

        for (const oi of coOccurringItems) {
            const menuItem = oi.menu_items;
            if (!menuItem || excludeIds.includes(menuItem.id)) continue;

            const existing = coOccurrenceMap.get(menuItem.id);
            if (existing) {
                existing.count++;
            } else {
                coOccurrenceMap.set(menuItem.id, { count: 1, item: menuItem });
            }
        }

        // Sort by co-occurrence count and calculate confidence
        const totalOrders = orderIds.length;
        const results: UpsellRecommendation[] = [];

        const sortedItems = Array.from(coOccurrenceMap.entries())
            .filter(([_, data]) => data.count >= minCoOccurrence)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, limit);

        for (const [id, data] of sortedItems) {
            const confidenceScore = (data.count / totalOrders) * 100;

            results.push({
                id,
                name: data.item.name,
                price: data.item.price,
                image_url: data.item.image_url,
                category_name: data.item.categories?.name ?? '',
                reason: 'frequently_bought_together',
                reason_text: `Frequently ordered together (${Math.round(confidenceScore)}% of orders)`,
                order_count: data.count,
                confidence_score: Math.round(confidenceScore),
            });
        }

        return results;
    } catch (error) {
        log.error('Error getting frequently bought together', error);
        return [];
    }
}

// =========================================================
// Enhanced Recommendations
// =========================================================

/**
 * Get comprehensive upsell recommendations combining all strategies
 */
export async function getEnhancedUpsellRecommendations(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    itemId: string,
    options?: {
        guestId?: string;
        cartItemIds?: string[];
        limit?: number;
        includeFrequentlyBoughtTogether?: boolean;
    }
): Promise<UpsellRecommendation[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const limit = options?.limit ?? 6;
    const recommendations: UpsellRecommendation[] = [];
    const addedItemIds = new Set<string>([itemId, ...(options?.cartItemIds ?? [])]);

    try {
        // Get current item details
        const { data: currentItem } = await db
            .from('menu_items')
            .select('id, name, category_id, complementary_items, categories(name)')
            .eq('id', itemId)
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

        if (!currentItem) {
            return [];
        }

        // 1. Frequently Bought Together (highest priority)
        if (options?.includeFrequentlyBoughtTogether !== false) {
            const frequentlyBought = await getFrequentlyBoughtTogether(
                supabase,
                restaurantId,
                itemId,
                { limit: 3, excludeItemIds: Array.from(addedItemIds) }
            );

            for (const item of frequentlyBought) {
                if (recommendations.length >= limit) break;
                if (addedItemIds.has(item.id)) continue;

                recommendations.push(item);
                addedItemIds.add(item.id);
            }
        }

        // 2. Complementary items (manually configured)
        if (recommendations.length < limit && currentItem.complementary_items) {
            const complementaryIds = (currentItem.complementary_items as string[]).filter(
                id => !addedItemIds.has(id)
            );

            if (complementaryIds.length > 0) {
                const { data: complementaryItems } = await db
                    .from('menu_items')
                    .select('id, name, price, image_url, categories(name), order_count')
                    .in('id', complementaryIds)
                    .eq('restaurant_id', restaurantId)
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

        // 3. Popular items
        if (recommendations.length < limit) {
            const { data: popularItems } = await db
                .from('menu_items')
                .select('id, name, price, image_url, categories(name), order_count')
                .eq('restaurant_id', restaurantId)
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

        // 4. Personalized (guest history)
        if (recommendations.length < limit && options?.guestId) {
            const guestRecs = await getPersonalizedRecommendations(
                supabase,
                restaurantId,
                options.guestId,
                { excludeItemIds: Array.from(addedItemIds), limit: limit - recommendations.length }
            );

            for (const item of guestRecs) {
                if (recommendations.length >= limit) break;
                recommendations.push(item);
                addedItemIds.add(item.id);
            }
        }

        return recommendations;
    } catch (error) {
        log.error('Error getting enhanced recommendations', error);
        return recommendations;
    }
}

/**
 * Get personalized recommendations based on guest order history
 */
export async function getPersonalizedRecommendations(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    guestId: string,
    options?: {
        excludeItemIds?: string[];
        limit?: number;
    }
): Promise<UpsellRecommendation[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const limit = options?.limit ?? 3;
    const excludeIds = options?.excludeItemIds ?? [];

    try {
        // Get guest's past orders
        const { data: guestOrders } = await db
            .from('orders')
            .select('id')
            .eq('guest_id', guestId)
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (!guestOrders || guestOrders.length === 0) {
            return [];
        }

        const orderIds = guestOrders.map((o: { id: string }) => o.id);

        // Get items from these orders with counts
        const { data: orderItems } = await db
            .from('order_items')
            .select('menu_item_id, count:count(*)')
            .in('order_id', orderIds)
            .group('menu_item_id')
            .order('count', { ascending: false });

        if (!orderItems || orderItems.length === 0) {
            return [];
        }

        // Filter out excluded items
        const filteredItems = orderItems
            .filter((oi: { menu_item_id: string }) => !excludeIds.includes(oi.menu_item_id))
            .slice(0, limit);

        if (filteredItems.length === 0) {
            return [];
        }

        const menuItemIds = filteredItems.map((oi: { menu_item_id: string }) => oi.menu_item_id);

        // Get item details
        const { data: items } = await db
            .from('menu_items')
            .select('id, name, price, image_url, categories(name), order_count')
            .in('id', menuItemIds)
            .eq('restaurant_id', restaurantId)
            .eq('is_available', true);

        if (!items) {
            return [];
        }

        // Create a map for counts
        const countMap = new Map<string, number>(
            filteredItems.map((oi: { menu_item_id: string; count: number }) => [
                oi.menu_item_id,
                oi.count,
            ])
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return items.map((item: any) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            image_url: item.image_url,
            category_name: item.categories?.name ?? '',
            reason: 'personalized' as const,
            reason_text: `You've ordered this ${countMap.get(item.id) ?? 0} time${(countMap.get(item.id) ?? 0) > 1 ? 's' : ''}`,
            order_count: item.order_count,
        }));
    } catch (error) {
        log.error('Error getting personalized recommendations', error);
        return [];
    }
}

// =========================================================
// Upsell Analytics
// =========================================================

/**
 * Track upsell impression
 */
export async function trackUpsellImpression(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    data: {
        guestId?: string;
        itemId: string;
        recommendedItems: string[];
        source: string;
    }
): Promise<string | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        const { data: result, error } = await db
            .from('upsell_analytics')
            .insert({
                restaurant_id: restaurantId,
                guest_id: data.guestId ?? null,
                item_viewed: data.itemId,
                recommended_items: data.recommendedItems,
                source: data.source,
                created_at: new Date().toISOString(),
            })
            .select('id')
            .single();

        if (error) {
            log.error('Error tracking impression', error);
            return null;
        }

        return result?.id ?? null;
    } catch (error) {
        log.error('Error tracking impression', error);
        return null;
    }
}

/**
 * Track upsell click
 */
export async function trackUpsellClick(
    supabase: SupabaseClient<Database>,
    analyticsId: string,
    clickedItemId: string
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        await db
            .from('upsell_analytics')
            .update({
                clicked_item: clickedItemId,
                clicked_at: new Date().toISOString(),
            })
            .eq('id', analyticsId);
    } catch (error) {
        log.error('Error tracking click', error);
    }
}

/**
 * Track upsell conversion (add to cart)
 */
export async function trackUpsellConversion(
    supabase: SupabaseClient<Database>,
    analyticsId: string,
    addedItemId: string
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        await db
            .from('upsell_analytics')
            .update({
                added_to_cart: true,
                added_item: addedItemId,
                converted_at: new Date().toISOString(),
            })
            .eq('id', analyticsId);
    } catch (error) {
        log.error('Error tracking conversion', error);
    }
}

/**
 * Get upsell analytics summary
 */
export async function getUpsellAnalytics(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    dateRange?: { start: Date; end: Date }
): Promise<{
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    clickRate: number;
    conversionRate: number;
    topRecommendations: Array<{
        item_id: string;
        item_name: string;
        impressions: number;
        clicks: number;
        conversions: number;
    }>;
}> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        // HIGH-013: Explicit column selection
        let query = db
            .from('upsell_analytics')
            .select(
                'id, restaurant_id, guest_id, item_viewed, recommended_items, source, clicked_item, clicked_at, added_to_cart, added_item, converted_at, created_at'
            )
            .eq('restaurant_id', restaurantId);

        if (dateRange) {
            query = query
                .gte('created_at', dateRange.start.toISOString())
                .lte('created_at', dateRange.end.toISOString());
        }

        const { data, error } = await query;

        if (error || !data) {
            return {
                totalImpressions: 0,
                totalClicks: 0,
                totalConversions: 0,
                clickRate: 0,
                conversionRate: 0,
                topRecommendations: [],
            };
        }

        const totalImpressions = data.length;
        const totalClicks = data.filter(
            (d: { clicked_item: string | null }) => d.clicked_item
        ).length;
        const totalConversions = data.filter(
            (d: { added_to_cart: boolean }) => d.added_to_cart
        ).length;

        // Aggregate by recommended items
        const itemStats = new Map<
            string,
            { impressions: number; clicks: number; conversions: number }
        >();

        for (const record of data) {
            for (const itemId of record.recommended_items ?? []) {
                const existing = itemStats.get(itemId) ?? {
                    impressions: 0,
                    clicks: 0,
                    conversions: 0,
                };
                existing.impressions++;
                if (record.clicked_item === itemId) existing.clicks++;
                if (record.added_to_cart && record.added_item === itemId) existing.conversions++;
                itemStats.set(itemId, existing);
            }
        }

        // Get item names for top recommendations
        const topItemIds = Array.from(itemStats.entries())
            .sort((a, b) => b[1].impressions - a[1].impressions)
            .slice(0, 10)
            .map(([id]) => id);

        const { data: items } = await db.from('menu_items').select('id, name').in('id', topItemIds);

        const itemNames = new Map<string, string>();
        for (const i of (items ?? []) as Array<{ id: string; name: string | null }>) {
            itemNames.set(i.id, i.name ?? 'Unknown');
        }

        const topRecommendations: Array<{
            item_id: string;
            item_name: string;
            impressions: number;
            clicks: number;
            conversions: number;
        }> = topItemIds.map(itemId => {
            const stats = itemStats.get(itemId);
            return {
                item_id: itemId,
                item_name: itemNames.get(itemId) ?? 'Unknown',
                impressions: stats?.impressions ?? 0,
                clicks: stats?.clicks ?? 0,
                conversions: stats?.conversions ?? 0,
            };
        });

        return {
            totalImpressions,
            totalClicks,
            totalConversions,
            clickRate: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
            conversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
            topRecommendations,
        };
    } catch (error) {
        log.error('Error getting analytics', error);
        return {
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            clickRate: 0,
            conversionRate: 0,
            topRecommendations: [],
        };
    }
}
