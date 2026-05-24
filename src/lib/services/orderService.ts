/**
 * Order Service Layer
 *
 * Addresses: No Service Layer - Business Logic Scattered (Strategic Audit Finding #10)
 * Provides centralized business logic for order operations
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import crypto from 'crypto';
import {
    getOrderByIdempotencyKey,
    insertOrder,
    fetchItemsForValidation,
} from '@/lib/supabase/queries';
import { logger } from '@/lib/logger';

const log = logger.child('OrderService');

// Type aliases
type Tables = Database['public']['Tables'];
type Order = Tables['orders']['Row'];
type OrderInsert = Tables['orders']['Insert'];

export interface OrderValidationResult {
    isValid: boolean;
    error?: string;
    calculatedTotal?: number;
    enrichedItems?: Array<{
        id: string;
        name: string;
        quantity: number;
        price: number;
        station?: string;
        course?: 'appetizer' | 'main' | 'dessert' | 'beverage' | 'side';
        notes?: string;
    }>;
}

export interface RateLimitResult {
    allowed: boolean;
    remainingOrders?: number;
    resetTime?: Date;
}

/**
 * Validates order items against database
 * Checks: item existence, availability, price accuracy
 */
export async function validateOrderItems(
    supabase: SupabaseClient<Database>,
    items: Array<{
        id: string;
        name: string;
        quantity: number;
        price: number;
        notes?: string;
        course?: 'appetizer' | 'main' | 'dessert' | 'beverage' | 'side';
    }>,
    claimedTotal: number,
    discountAmount: number = 0
): Promise<OrderValidationResult> {
    const itemIds = items.map(i => i.id);

    const { data: dbItems, error } = await fetchItemsForValidation(supabase, itemIds);

    if (error || !dbItems) {
        return { isValid: false, error: 'Failed to validate items' };
    }

    if (dbItems.length !== itemIds.length) {
        const foundIds = new Set(dbItems.map((i: { id: string }) => i.id));
        const missingIds = itemIds.filter(id => !foundIds.has(id));
        return { isValid: false, error: `Items not found: ${missingIds.join(', ')}` };
    }

    let calculatedTotal = 0;
    const enrichedItems = [];

    for (const item of items) {
        const dbItem = dbItems.find((dbi: { id: string }) => dbi.id === item.id);
        if (!dbItem) {
            return { isValid: false, error: `Item ${item.id} not found` };
        }

        if (!dbItem.is_available) {
            return { isValid: false, error: `Item "${item.name}" is sold out` };
        }

        calculatedTotal += Number(dbItem.price) * item.quantity;

        enrichedItems.push({
            ...item,
            station: dbItem.station || 'kitchen',
            course:
                (dbItem.course as 'appetizer' | 'main' | 'dessert' | 'beverage' | 'side' | null) ??
                'main',
        });
    }

    const expectedTotal = Math.max(0, calculatedTotal - discountAmount);

    // Allow for minor floating point differences while discounts are still on the
    // pre-Santim money path. This keeps the current app stable until the full
    // integer-money migration lands.
    if (Math.abs(expectedTotal - claimedTotal) > 0.01) {
        return {
            isValid: false,
            error: 'Price mismatch. The menu might have been updated.',
            calculatedTotal: expectedTotal,
        };
    }

    return {
        isValid: true,
        calculatedTotal,
        enrichedItems,
    };
}

/**
 * Checks rate limiting for guest fingerprint
 * Allows max 5 orders per 10 minutes per device
 */
export async function checkRateLimit(
    supabase: SupabaseClient<Database>,
    guestFingerprint: string,
    maxOrders: number = 5,
    windowMinutes: number = 10
): Promise<RateLimitResult> {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    // HIGH-013: Explicit column selection (head: true, no data returned)
    const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('guest_fingerprint', guestFingerprint)
        .gt('created_at', windowStart);

    if (error) {
        // Fail open - allow order if we can't check rate limit
        log.error('Failed to check rate limit', error);
        return { allowed: true };
    }

    const orderCount = count || 0;
    const allowed = orderCount < maxOrders;

    return {
        allowed,
        remainingOrders: Math.max(0, maxOrders - orderCount),
        resetTime: new Date(Date.now() + windowMinutes * 60 * 1000),
    };
}

/**
 * Checks for duplicate order using idempotency key
 */
export async function checkDuplicateOrder(
    supabase: SupabaseClient<Database>,
    idempotencyKey: string
): Promise<Pick<Order, 'id' | 'status'> | null> {
    const { data, error } = await getOrderByIdempotencyKey(supabase, idempotencyKey);

    if (error) {
        log.error('Failed to check duplicate order', error);
        return null;
    }

    return data;
}

/**
 * Creates a new order with all validations
 */
export async function createOrder(
    supabase: SupabaseClient<Database>,
    orderData: {
        restaurant_id: string;
        table_number: string;
        items: Array<{ id: string; name: string; quantity: number; price: number; notes?: string }>;
        total_price: number;
        notes?: string;
        idempotency_key: string;
        guest_fingerprint: string;
        order_type?: string;
        delivery_address?: string;
        customer_name?: string;
        customer_phone?: string;
        discount_id?: string;
        discount_amount?: number;
    }
): Promise<{ success: true; order: Order } | { success: false; error: string }> {
    // 1. Check for duplicate
    const existingOrder = await checkDuplicateOrder(supabase, orderData.idempotency_key);
    if (existingOrder) {
        // Fetch full order data for the duplicate
        // HIGH-013: Explicit column selection
        const { data: fullOrder } = await supabase
            .from('orders')
            .select(
                'id, restaurant_id, order_number, table_number, customer_name, customer_phone, status, order_type, discount_amount, total_price, notes, idempotency_key, guest_fingerprint, created_at, updated_at'
            )
            .eq('id', existingOrder.id)
            .single();
        if (fullOrder) {
            return { success: true, order: fullOrder as Order };
        }
    }

    // 2. Validate items
    const validation = await validateOrderItems(
        supabase,
        orderData.items,
        orderData.total_price,
        orderData.discount_amount ?? 0
    );

    if (!validation.isValid) {
        return { success: false, error: validation.error || 'Validation failed' };
    }

    // 3. Generate order number
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

    // 4. Insert order
    const orderId = crypto.randomUUID();
    const orderInsert = {
        id: orderId,
        restaurant_id: orderData.restaurant_id,
        table_number: orderData.table_number,
        items: validation.enrichedItems as unknown as OrderInsert['items'],
        total_price: orderData.total_price,
        idempotency_key: orderData.idempotency_key,
        guest_fingerprint: orderData.guest_fingerprint,
        status: 'pending',
        order_number: orderNumber,
        // Optional online-ordering fields (DB columns may or may not exist yet)
        ...(orderData.order_type ? { order_type: orderData.order_type } : {}),
        ...(orderData.delivery_address ? { delivery_address: orderData.delivery_address } : {}),
        ...(orderData.customer_name ? { customer_name: orderData.customer_name } : {}),
        ...(orderData.customer_phone ? { customer_phone: orderData.customer_phone } : {}),
        ...(orderData.discount_id ? { discount_id: orderData.discount_id } : {}),
        ...(typeof orderData.discount_amount === 'number'
            ? { discount_amount: orderData.discount_amount }
            : {}),
    } as OrderInsert & {
        discount_id?: string;
        discount_amount?: number;
    };

    const { data: order, error } = await insertOrder(supabase, orderInsert);

    if (error || !order) {
        log.error('Failed to create order', error);
        return { success: false, error: error?.message || 'Failed to create order' };
    }

    return { success: true, order };
}

/**
 * Generates a guest fingerprint from IP and user agent
 * HIGH-003: Enforces minimum 32-character fingerprint using SHA-256 hash
 * to prevent session hijacking with short fingerprints
 */
export function generateGuestFingerprint(ip: string, userAgent: string | null): string {
    const raw = `${ip}-${userAgent || 'unknown'}`;
    // Use SHA-256 hash to ensure consistent 64-character hex fingerprint
    // This prevents short fingerprint attacks like "short-fp"
    return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Generates an idempotency key for order deduplication
 */
export function generateIdempotencyKey(): string {
    return crypto.randomUUID();
}
