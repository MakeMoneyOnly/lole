/**
 * Sentry Context Utilities
 *
 * Provides functions to set and get context for Sentry error tracking.
 * Restaurant ID tagging is critical for production debugging - this ensures
 * every error can be traced back to the specific restaurant that experienced it.
 *
 * @see docs/1. Engineering Foundation/0. ENTERPRISE_MASTER_BLUEPRINT.md - Sprint 1.6
 */

import * as Sentry from '@sentry/core';
import { logger } from '@/lib/logger';

// Storage key for restaurant context in localStorage (client-side)
const RESTAURANT_CONTEXT_KEY = 'lole_restaurant_context';

// Async local storage for server-side context (Edge/Runtime compatible)
let serverRestaurantId: string | null = null;

/**
 * Restaurant context stored in Sentry
 */
export interface RestaurantContext {
    restaurantId: string;
    restaurantName?: string;
    userId?: string;
    deviceType?: 'pos' | 'kds' | 'guest' | 'dashboard';
}

/**
 * Set the restaurant context for Sentry error tagging (Client-side)
 * Call this when a user logs in or switches restaurants
 *
 * @example
 * // When user selects a restaurant
 * setRestaurantContext({ restaurantId: 'rest-123', restaurantName: 'Saba Grill' });
 */
export function setRestaurantContext(context: RestaurantContext): void {
    // Set Sentry tags for filtering in Sentry UI
    Sentry.setTag('restaurant_id', context.restaurantId);
    if (context.restaurantName) {
        Sentry.setTag('restaurant_name', context.restaurantName);
    }
    if (context.deviceType) {
        Sentry.setTag('device_type', context.deviceType);
    }
    if (context.userId) {
        Sentry.setUser({ id: context.userId });
    }

    // Persist to localStorage for page refreshes
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(RESTAURANT_CONTEXT_KEY, JSON.stringify(context));
        } catch {
            // localStorage might be unavailable in private mode
            logger.warn('Failed to persist restaurant context to localStorage');
        }
    }
}

/**
 * Set the restaurant context for Sentry error tagging (Server-side)
 * In server components and API routes, use this to tag errors with restaurant context
 *
 * @example
 * // In an API route
 * setServerRestaurantContext('rest-123', 'pos');
 */
export function setServerRestaurantContext(
    restaurantId: string,
    deviceType?: 'pos' | 'kds' | 'guest' | 'dashboard'
): void {
    serverRestaurantId = restaurantId;
    Sentry.setTag('restaurant_id', restaurantId);
    if (deviceType) {
        Sentry.setTag('device_type', deviceType);
    }
}

/**
 * Get the current restaurant context (Server-side)
 * Used in beforeSend hooks to tag errors
 */
export function getServerRestaurantId(): string | null {
    return serverRestaurantId;
}

/**
 * Clear the restaurant context when user logs out or switches restaurants
 */
export function clearRestaurantContext(): void {
    Sentry.setTag('restaurant_id', undefined);
    Sentry.setTag('restaurant_name', undefined);
    Sentry.setTag('device_type', undefined);
    Sentry.setUser(null);

    serverRestaurantId = null;

    if (typeof window !== 'undefined') {
        try {
            localStorage.removeItem(RESTAURANT_CONTEXT_KEY);
        } catch {
            // Ignore errors
        }
    }
}

/**
 * Restore restaurant context from localStorage (Client-side)
 * Call this on app initialization to restore context after page refresh
 */
export function restoreRestaurantContext(): RestaurantContext | null {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const stored = localStorage.getItem(RESTAURANT_CONTEXT_KEY);
        if (stored) {
            const context = JSON.parse(stored) as RestaurantContext;
            setRestaurantContext(context);
            return context;
        }
    } catch {
        // Invalid JSON or other error
    }

    return null;
}

/**
 * Add breadcrumb for order operations
 * Helps track the sequence of events leading to an error
 */
export function addOrderBreadcrumb(
    orderId: string,
    action: string,
    data?: Record<string, unknown>
): void {
    Sentry.addBreadcrumb({
        category: 'order',
        message: `Order ${orderId}: ${action}`,
        level: 'info',
        data: {
            orderId,
            action,
            ...data,
        },
    });
}

/**
 * Add breadcrumb for payment operations
 */
export function addPaymentBreadcrumb(
    paymentId: string,
    provider: string,
    action: string,
    data?: Record<string, unknown>
): void {
    Sentry.addBreadcrumb({
        category: 'payment',
        message: `Payment ${paymentId} (${provider}): ${action}`,
        level: 'info',
        data: {
            paymentId,
            provider,
            action,
            ...data,
        },
    });
}

/**
 * Add breadcrumb for sync operations (offline-first)
 */
export function addSyncBreadcrumb(
    operation: string,
    status: 'started' | 'completed' | 'failed',
    data?: Record<string, unknown>
): void {
    Sentry.addBreadcrumb({
        category: 'sync',
        message: `Sync: ${operation} - ${status}`,
        level: status === 'failed' ? 'error' : 'info',
        data: {
            operation,
            status,
            ...data,
        },
    });
}
