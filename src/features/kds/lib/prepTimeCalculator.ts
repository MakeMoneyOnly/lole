/**
 * Prep Time Calculator Service
 * TASK-KDS-001: Fire by Prep Time
 *
 * Calculates when items should fire based on their prep duration
 * to complete together.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { logger } from '@/lib/logger';
import { DEFAULT_TARGET_COMPLETION_MS } from '@/lib/constants/kds';

// =========================================================
// Type Definitions
// =========================================================

export type FireStatus = 'pending' | 'fired' | 'completed' | 'cancelled';

export interface OrderItemFireInfo {
    order_item_id: string;
    menu_item_id: string;
    item_name: string;
    quantity: number;
    course: string | null;
    prep_time_minutes: number;
    calculated_fire_at: string | null;
    actual_fired_at: string | null;
    fire_status: FireStatus;
    minutes_until_fire: number | null;
}

export interface FireTimeCalculation {
    order_id: string;
    target_completion_at: string;
    max_prep_time_minutes: number;
    items: OrderItemFireInfo[];
}

export interface ItemsReadyToFire {
    order_id: string;
    order_number: string;
    table_number: string;
    item_id: string;
    item_name: string;
    quantity: number;
    course: string | null;
    prep_time_minutes: number;
    calculated_fire_at: string;
    minutes_until_fire: number;
}

// =========================================================
// Fire Time Calculation
// =========================================================

/**
 * Calculate fire times for all items in an order
 */
export async function calculateOrderFireTimes(
    supabase: SupabaseClient<Database>,
    orderId: string,
    targetTime?: Date
): Promise<
    { success: true; calculation: FireTimeCalculation } | { success: false; error: string }
> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        // Get order details
        const { data: order, error: orderError } = await db
            .from('orders')
            .select('id, restaurant_id, created_at, target_completion_at')
            .eq('id', orderId)
            .maybeSingle();

        if (orderError || !order) {
            return { success: false, error: 'Order not found' };
        }

        // Determine target completion time
        const target =
            targetTime ??
            (order.target_completion_at
                ? new Date(order.target_completion_at)
                : new Date(Date.now() + DEFAULT_TARGET_COMPLETION_MS)); // Default 30 min from now

        // Get all order items with prep times
        const { data: orderItems, error: itemsError } = await db
            .from('order_items')
            .select(
                `
                id,
                menu_item_id,
                quantity,
                course,
                calculated_fire_at,
                actual_fired_at,
                fire_status,
                menu_items(id, name, prep_time_minutes)
            `
            )
            .eq('order_id', orderId);

        if (itemsError) {
            return { success: false, error: 'Failed to fetch order items' };
        }

        if (!orderItems || orderItems.length === 0) {
            return { success: false, error: 'No items in order' };
        }

        // Find max prep time
        const maxPrepTime = Math.max(
            ...orderItems.map(
                (item: { menu_items?: { prep_time_minutes?: number } | null }) =>
                    item.menu_items?.prep_time_minutes ?? 15
            )
        );

        const items: OrderItemFireInfo[] = [];
        const now = new Date();

        // Calculate fire time for each item
        for (const item of orderItems) {
            const prepTime = item.menu_items?.prep_time_minutes ?? 15;
            let fireAt = new Date(target.getTime() - prepTime * 60 * 1000);

            // Don't fire in the past
            if (fireAt < now) {
                fireAt = now;
            }

            // Update the order item
            await db
                .from('order_items')
                .update({
                    calculated_fire_at: fireAt.toISOString(),
                    fire_status: item.fire_status ?? 'pending',
                })
                .eq('id', item.id);

            const minutesUntilFire = Math.max(0, (fireAt.getTime() - now.getTime()) / (1000 * 60));

            items.push({
                order_item_id: item.id,
                menu_item_id: item.menu_item_id,
                item_name: item.menu_items?.name ?? 'Unknown',
                quantity: item.quantity,
                course: item.course,
                prep_time_minutes: prepTime,
                calculated_fire_at: fireAt.toISOString(),
                actual_fired_at: item.actual_fired_at,
                fire_status: item.fire_status ?? 'pending',
                minutes_until_fire: minutesUntilFire,
            });
        }

        // Update order with target completion time
        await db
            .from('orders')
            .update({ target_completion_at: target.toISOString() })
            .eq('id', orderId);

        return {
            success: true,
            calculation: {
                order_id: orderId,
                target_completion_at: target.toISOString(),
                max_prep_time_minutes: maxPrepTime,
                items,
            },
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[PrepTimeCalculator] Error', errorMessage);
        return { success: false, error: errorMessage };
    }
}

/**
 * Get items that are ready to fire (within 5 minutes of fire time)
 */
export async function getItemsReadyToFire(
    supabase: SupabaseClient<Database>,
    restaurantId: string
): Promise<ItemsReadyToFire[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        const { data, error } = await db.rpc('get_items_ready_to_fire', {
            p_restaurant_id: restaurantId,
        });

        if (error) {
            logger.error('[PrepTimeCalculator] Failed to get ready items', error);
            return [];
        }

        return (data ?? []).map(
            (item: {
                order_id: string;
                order_number: string;
                table_number: string;
                item_id: string;
                item_name: string;
                quantity: number;
                course: string | null;
                prep_time_minutes: number;
                calculated_fire_at: string;
                minutes_until_fire: number;
            }) => ({
                order_id: item.order_id,
                order_number: item.order_number,
                table_number: item.table_number,
                item_id: item.item_id,
                item_name: item.item_name,
                quantity: item.quantity,
                course: item.course,
                prep_time_minutes: item.prep_time_minutes,
                calculated_fire_at: item.calculated_fire_at,
                minutes_until_fire: item.minutes_until_fire,
            })
        );
    } catch (error) {
        logger.error('[PrepTimeCalculator] Error', error);
        return [];
    }
}

/**
 * Mark an item as fired
 */
export async function markItemFired(
    supabase: SupabaseClient<Database>,
    orderItemId: string,
    staffId?: string
): Promise<{ success: boolean; firedAt?: string; error?: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        const { data, error } = await db.rpc('mark_item_fired', {
            p_order_item_id: orderItemId,
            p_staff_id: staffId ?? null,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        if (!data?.success) {
            return { success: false, error: data?.error ?? 'Failed to mark item fired' };
        }

        return { success: true, firedAt: data.fired_at };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}

/**
 * Mark multiple items as fired at once
 */
export async function markItemsFired(
    supabase: SupabaseClient<Database>,
    orderItemIds: string[],
    staffId?: string
): Promise<{ success: boolean; firedCount: number; errors: string[] }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _db = supabase as any;
    const errors: string[] = [];
    let firedCount = 0;

    for (const itemId of orderItemIds) {
        const result = await markItemFired(supabase, itemId, staffId);
        if (result.success) {
            firedCount++;
        } else {
            errors.push(`${itemId}: ${result.error}`);
        }
    }

    return { success: firedCount > 0, firedCount, errors };
}

/**
 * Auto-fire all items that are past their fire time
 */
export async function autoFireReadyItems(
    supabase: SupabaseClient<Database>,
    restaurantId: string
): Promise<{ success: boolean; itemsFired: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        const { data, error } = await db.rpc('auto_fire_ready_items', {
            p_restaurant_id: restaurantId,
        });

        if (error) {
            logger.error('[PrepTimeCalculator] Auto-fire failed', error);
            return { success: false, itemsFired: 0 };
        }

        return {
            success: true,
            itemsFired: data?.items_fired ?? 0,
        };
    } catch (error) {
        logger.error('[PrepTimeCalculator] Auto-fire error', error);
        return { success: false, itemsFired: 0 };
    }
}

/**
 * Update prep time for a menu item
 */
export async function updateMenuItemPrepTime(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    menuItemId: string,
    prepTimeMinutes: number
): Promise<{ success: boolean; error?: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        // Verify menu item belongs to restaurant
        const { data: menuItem, error: itemError } = await db
            .from('menu_items')
            .select('id, categories(restaurant_id)')
            .eq('id', menuItemId)
            .maybeSingle();

        if (itemError || !menuItem) {
            return { success: false, error: 'Menu item not found' };
        }

        const categoryData = menuItem.category as { restaurant_id: string } | null;
        if (categoryData?.restaurant_id !== restaurantId) {
            return { success: false, error: 'Menu item does not belong to this restaurant' };
        }

        // Update prep time
        const { error: updateError } = await db
            .from('menu_items')
            .update({ prep_time_minutes: prepTimeMinutes })
            .eq('id', menuItemId);

        if (updateError) {
            return { success: false, error: 'Failed to update prep time' };
        }

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}

/**
 * Get prep time summary for a restaurant's menu
 */
export async function getPrepTimeSummary(
    supabase: SupabaseClient<Database>,
    restaurantId: string
): Promise<{
    items: Array<{
        id: string;
        name: string;
        category: string;
        prep_time_minutes: number;
        order_count: number;
    }>;
    averagePrepTime: number;
    longestPrepTime: number;
}> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        const { data, error } = await db
            .from('menu_items')
            .select(
                `
                id,
                name,
                prep_time_minutes,
                order_count,
                categories(id, name)
            `
            )
            .eq('categories.restaurant_id', restaurantId)
            .eq('is_available', true)
            .order('prep_time_minutes', { ascending: false });

        if (error) {
            logger.error('[PrepTimeCalculator] Failed to get summary', error);
            return { items: [], averagePrepTime: 0, longestPrepTime: 0 };
        }

        const items = (data ?? []).map(
            (item: {
                id: string;
                name: string;
                categories?: { name: string } | null;
                prep_time_minutes?: number;
                order_count?: number;
            }) => ({
                id: item.id,
                name: item.name,
                category: item.categories?.name ?? 'Uncategorized',
                prep_time_minutes: item.prep_time_minutes ?? 15,
                order_count: item.order_count ?? 0,
            })
        );

        const prepTimes = items.map((i: { prep_time_minutes: number }) => i.prep_time_minutes);
        const averagePrepTime =
            prepTimes.length > 0
                ? prepTimes.reduce((a: number, b: number) => a + b, 0) / prepTimes.length
                : 0;
        const longestPrepTime = prepTimes.length > 0 ? Math.max(...prepTimes) : 0;

        return { items, averagePrepTime, longestPrepTime };
    } catch (error) {
        logger.error('[PrepTimeCalculator] Error', error);
        return { items: [], averagePrepTime: 0, longestPrepTime: 0 };
    }
}

// =========================================================
// Course-Based Firing
// =========================================================

/**
 * Calculate staggered fire times for courses
 * Appetizers fire first, then mains, then desserts
 */
export async function calculateCourseFireTimes(
    supabase: SupabaseClient<Database>,
    orderId: string,
    options?: {
        appetizerDelay?: number; // Minutes before appetizers fire
        mainDelay?: number; // Minutes after appetizers for mains
        dessertDelay?: number; // Minutes after mains for desserts
    }
): Promise<{ success: boolean; calculation?: FireTimeCalculation; error?: string }> {
    const opts = {
        appetizerDelay: 0,
        mainDelay: 10, // Mains fire 10 min after appetizers
        dessertDelay: 15, // Desserts fire 15 min after mains
        ...options,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        // Get order items grouped by course
        const { data: orderItems, error } = await db
            .from('order_items')
            .select(
                `
                id,
                menu_item_id,
                quantity,
                course,
                menu_items(id, name, prep_time_minutes)
            `
            )
            .eq('order_id', orderId);

        if (error || !orderItems || orderItems.length === 0) {
            return { success: false, error: 'No items in order' };
        }

        const now = new Date();
        const items: OrderItemFireInfo[] = [];

        // Group items by course
        const courseGroups: Record<string, typeof orderItems> = {
            appetizer: [],
            main: [],
            dessert: [],
            beverage: [],
            side: [],
        };

        for (const item of orderItems) {
            const course = item.course ?? 'main';
            if (courseGroups[course]) {
                courseGroups[course].push(item);
            } else {
                courseGroups.main.push(item);
            }
        }

        // Calculate base fire times for each course
        const courseDelays: Record<string, number> = {
            appetizer: opts.appetizerDelay,
            beverage: opts.appetizerDelay, // Beverages fire with appetizers
            side: opts.appetizerDelay, // Sides fire with appetizers
            main: opts.mainDelay,
            dessert: opts.mainDelay + opts.dessertDelay,
        };

        let maxPrepTime = 0;

        for (const [course, itemsInCourse] of Object.entries(courseGroups)) {
            if (itemsInCourse.length === 0) continue;

            const courseDelay = courseDelays[course] ?? 0;
            const maxCoursePrep = Math.max(
                ...itemsInCourse.map(
                    (item: { menu_items?: { prep_time_minutes?: number } | null }) =>
                        item.menu_items?.prep_time_minutes ?? 15
                )
            );

            maxPrepTime = Math.max(maxPrepTime, maxCoursePrep + courseDelay);

            for (const item of itemsInCourse) {
                const prepTime = item.menu_items?.prep_time_minutes ?? 15;
                let fireAt = new Date(now.getTime() + courseDelay * 60 * 1000);

                // Items with longer prep times fire earlier within their course
                const coursePrepDiff = maxCoursePrep - prepTime;
                fireAt = new Date(fireAt.getTime() - coursePrepDiff * 60 * 1000);

                // Don't fire in the past
                if (fireAt < now) {
                    fireAt = now;
                }

                // Update the order item
                await db
                    .from('order_items')
                    .update({
                        calculated_fire_at: fireAt.toISOString(),
                        fire_status: 'pending',
                    })
                    .eq('id', item.id);

                const minutesUntilFire = Math.max(
                    0,
                    (fireAt.getTime() - now.getTime()) / (1000 * 60)
                );

                items.push({
                    order_item_id: item.id,
                    menu_item_id: item.menu_item_id,
                    item_name: item.menu_items?.name ?? 'Unknown',
                    quantity: item.quantity,
                    course: item.course,
                    prep_time_minutes: prepTime,
                    calculated_fire_at: fireAt.toISOString(),
                    actual_fired_at: null,
                    fire_status: 'pending',
                    minutes_until_fire: minutesUntilFire,
                });
            }
        }

        // Calculate target completion time
        const targetCompletion = new Date(now.getTime() + maxPrepTime * 60 * 1000);

        return {
            success: true,
            calculation: {
                order_id: orderId,
                target_completion_at: targetCompletion.toISOString(),
                max_prep_time_minutes: maxPrepTime,
                items,
            },
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}
