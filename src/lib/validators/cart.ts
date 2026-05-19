/**
 * Cart and localStorage validation schemas
 *
 * Addresses: localStorage Parsing Without Schema Validation (High Priority Audit Finding #6)
 * Location: src/context/CartContext.tsx:46-77
 *
 * CRIT-02: All monetary values are now INTEGER in SANTIM (100 santim = 1 ETB)
 */

import { z } from 'zod';
import { logger } from '@/lib/logger';

/**
 * Cart Item Schema - validates individual cart items
 *
 * CRIT-02: price is now in SANTIM (integer)
 */
export const CartItemSchema = z.object({
    id: z.string().uuid('Invalid item ID'),
    name: z.string().min(1, 'Item name is required'),
    name_am: z.string().nullable().optional(),
    // price is now in SANTIM (integer), not birr
    price: z.number().int().positive('Price must be a positive integer (in santim)'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
    image_url: z.string().nullable().optional(),
    station: z.enum(['kitchen', 'bar', 'dessert', 'coffee']).nullable().optional(),
    notes: z.string().optional(),
    modifiers: z.string().optional(),
});

/**
 * Cart Storage Schema - validates the entire cart stored in localStorage
 */
export const CartStorageSchema = z.object({
    items: z.array(CartItemSchema),
    restaurantSlug: z.string(),
    tableNumber: z.string().nullable(),
});

/**
 * Order History Storage Schema - validates order history in localStorage
 */
export const OrderHistoryStorageSchema = z.object({
    items: z.array(CartItemSchema),
    restaurantSlug: z.string(),
});

/**
 * Type exports
 */
export type ValidatedCartItem = z.infer<typeof CartItemSchema>;
export type ValidatedCartStorage = z.infer<typeof CartStorageSchema>;
export type ValidatedOrderHistoryStorage = z.infer<typeof OrderHistoryStorageSchema>;

/**
 * Safely parse cart data from localStorage with Zod validation
 *
 * @param data - Raw data from localStorage
 * @returns Parsed and validated cart data, or null if invalid
 */
export function safeParseCartStorage(data: unknown): ValidatedCartStorage | null {
    const result = CartStorageSchema.safeParse(data);
    if (result.success) {
        return result.data;
    }

    logger.warn('[CartStorage] Validation failed:', { error: result.error.issues });
    return null;
}

/**
 * Safely parse order history from localStorage with Zod validation
 *
 * @param data - Raw data from localStorage
 * @returns Parsed and validated order history, or null if invalid
 */
export function safeParseOrderHistoryStorage(data: unknown): ValidatedOrderHistoryStorage | null {
    const result = OrderHistoryStorageSchema.safeParse(data);
    if (result.success) {
        return result.data;
    }

    logger.warn('[OrderHistoryStorage] Validation failed:', { error: result.error.issues });
    return null;
}

/**
 * Safely parse JSON from localStorage with error handling
 *
 * @param key - localStorage key
 * @returns Parsed JSON, or null if not found or invalid
 */
export function safeGetLocalStorage<T>(key: string): T | null {
    try {
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        return JSON.parse(stored) as T;
    } catch (e) {
        logger.warn(`[localStorage] Failed to parse ${key}:`, { error: e });
        return null;
    }
}

/**
 * Safely save JSON to localStorage with error handling
 *
 * @param key - localStorage key
 * @param value - Value to store
 * @returns true if successful, false otherwise
 */
export function safeSetLocalStorage(key: string, value: unknown): boolean {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        logger.warn(`[localStorage] Failed to save ${key}:`, { error: e });
        return false;
    }
}
