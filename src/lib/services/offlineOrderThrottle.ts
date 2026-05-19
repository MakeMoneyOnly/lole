/**
 * Online Ordering Throttle Service
 *
 * Enforces daily order limits and 15-minute throttle limits for online ordering.
 * Used to prevent overwhelming the kitchen during peak hours.
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export interface ThrottleCheckResult {
    allowed: boolean;
    reason?: string;
    remainingToday?: number;
    nextAvailableAt?: string;
    currentCount?: number;
    maxLimit?: number;
}

export interface OnlineOrderingSettings {
    enabled: boolean;
    max_daily_orders: number | null;
    throttle_minutes: number | null;
    auto_accept_orders: boolean;
    estimated_prep_time_minutes: number;
    free_delivery_threshold: number | null;
}

const DEFAULT_SETTINGS: OnlineOrderingSettings = {
    enabled: true,
    max_daily_orders: null,
    throttle_minutes: null,
    auto_accept_orders: false,
    estimated_prep_time_minutes: 30,
    free_delivery_threshold: null,
};

/**
 * Get online ordering settings for a restaurant
 */
export async function getOnlineOrderingSettings(
    restaurantId: string
): Promise<OnlineOrderingSettings> {
    const supabase = await createClient();

    const { data: restaurant, error } = await supabase
        .from('restaurants')
        .select('settings')
        .eq('id', restaurantId)
        .maybeSingle();

    if (error || !restaurant) {
        return DEFAULT_SETTINGS;
    }

    const settings = (restaurant.settings ?? {}) as Record<string, unknown>;
    const channels = (settings.channels ?? {}) as Record<string, unknown>;
    const onlineOrdering = (channels.online_ordering ?? {}) as Record<string, unknown>;

    return {
        enabled: (onlineOrdering.enabled as boolean) ?? DEFAULT_SETTINGS.enabled,
        max_daily_orders:
            (onlineOrdering.max_daily_orders as number | null) ?? DEFAULT_SETTINGS.max_daily_orders,
        throttle_minutes:
            (onlineOrdering.throttle_minutes as number | null) ?? DEFAULT_SETTINGS.throttle_minutes,
        auto_accept_orders:
            (onlineOrdering.auto_accept_orders as boolean) ?? DEFAULT_SETTINGS.auto_accept_orders,
        estimated_prep_time_minutes:
            (onlineOrdering.estimated_prep_time_minutes as number) ??
            DEFAULT_SETTINGS.estimated_prep_time_minutes,
        free_delivery_threshold:
            (onlineOrdering.free_delivery_threshold as number | null) ??
            DEFAULT_SETTINGS.free_delivery_threshold,
    };
}

/**
 * Check if a new online order is allowed based on throttle settings
 */
export async function checkOrderThrottle(restaurantId: string): Promise<ThrottleCheckResult> {
    const settings = await getOnlineOrderingSettings(restaurantId);

    if (!settings.enabled) {
        return { allowed: false, reason: 'Online ordering is currently disabled' };
    }

    const supabase = await createClient();
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Check daily order limit
    if (settings.max_daily_orders !== null && settings.max_daily_orders > 0) {
        const { count: todayExternalCount, error: externalError } = await supabase
            .from('external_orders')
            .select('id', { count: 'exact', head: true })
            .eq('restaurant_id', restaurantId)
            .gte('created_at', startOfDay.toISOString())
            .neq('normalized_status', 'cancelled');

        if (externalError) {
            logger.error('Failed to count external orders:', externalError);
        }

        const { count: todayDirectCount, error: directError } = await supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('restaurant_id', restaurantId)
            .gte('created_at', startOfDay.toISOString())
            .neq('status', 'cancelled');

        if (directError) {
            logger.error('Failed to count direct orders:', directError);
        }

        const totalToday = (todayExternalCount ?? 0) + (todayDirectCount ?? 0);

        if (totalToday >= settings.max_daily_orders) {
            return {
                allowed: false,
                reason: `Daily order limit reached (${settings.max_daily_orders} orders)`,
                remainingToday: 0,
                currentCount: totalToday,
                maxLimit: settings.max_daily_orders,
            };
        }

        const remainingToday = settings.max_daily_orders - totalToday;

        // Check 15-minute throttle
        if (settings.throttle_minutes !== null && settings.throttle_minutes > 0) {
            const throttleWindowStart = new Date(now.getTime() - settings.throttle_minutes * 60000);

            const { count: recentCount, error: recentError } = await supabase
                .from('external_orders')
                .select('id', { count: 'exact', head: true })
                .eq('restaurant_id', restaurantId)
                .gte('created_at', throttleWindowStart.toISOString())
                .neq('normalized_status', 'cancelled');

            if (recentError) {
                logger.error('Failed to count recent orders:', recentError);
            }

            const THROTTLE_THRESHOLD = 5;
            if ((recentCount ?? 0) >= THROTTLE_THRESHOLD) {
                const nextAvailable = new Date(
                    throttleWindowStart.getTime() + settings.throttle_minutes * 60000
                );

                return {
                    allowed: false,
                    reason: `Too many orders. Please try again in ${Math.ceil((nextAvailable.getTime() - now.getTime()) / 60000)} minutes`,
                    remainingToday,
                    nextAvailableAt: nextAvailable.toISOString(),
                    currentCount: totalToday,
                    maxLimit: settings.max_daily_orders,
                };
            }
        }

        return {
            allowed: true,
            remainingToday,
            currentCount: totalToday,
            maxLimit: settings.max_daily_orders,
        };
    }

    // No daily limit set, check throttle only
    if (settings.throttle_minutes !== null && settings.throttle_minutes > 0) {
        const throttleWindowStart = new Date(now.getTime() - settings.throttle_minutes * 60000);

        const { count: recentCount, error: recentError } = await supabase
            .from('external_orders')
            .select('id', { count: 'exact', head: true })
            .eq('restaurant_id', restaurantId)
            .gte('created_at', throttleWindowStart.toISOString())
            .neq('normalized_status', 'cancelled');

        if (recentError) {
            logger.error('Failed to count recent orders:', recentError);
        }

        const THROTTLE_THRESHOLD = 5;
        if ((recentCount ?? 0) >= THROTTLE_THRESHOLD) {
            const nextAvailable = new Date(
                throttleWindowStart.getTime() + settings.throttle_minutes * 60000
            );

            return {
                allowed: false,
                reason: `Too many orders. Please try again in ${Math.ceil((nextAvailable.getTime() - now.getTime()) / 60000)} minutes`,
                nextAvailableAt: nextAvailable.toISOString(),
            };
        }
    }

    return { allowed: true };
}

/**
 * Get estimated wait time for a new order
 */
export async function getEstimatedWaitTime(restaurantId: string): Promise<number> {
    const settings = await getOnlineOrderingSettings(restaurantId);
    const supabase = await createClient();

    const { count: activeOrders, error } = await supabase
        .from('external_orders')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .in('normalized_status', ['pending', 'confirmed', 'preparing']);

    if (error) {
        logger.error('Failed to count active orders:', error);
        return settings.estimated_prep_time_minutes;
    }

    const baseTime = settings.estimated_prep_time_minutes;
    const additionalTime = Math.min((activeOrders ?? 0) * 5, 30);

    return baseTime + additionalTime;
}
