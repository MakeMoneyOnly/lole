/**
 * API Input Validation Schemas
 *
 * MED-021: Comprehensive Zod validation schemas for all API endpoints.
 * Provides centralized validation for orders, payments, menu, KDS, and guest operations.
 *
 * @module lib/validators/api
 */

import { z } from 'zod';

// =============================================================================
// Common Schemas
// =============================================================================

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid ID format');

/**
 * Restaurant ID schema
 */
export const restaurantIdSchema = uuidSchema.describe('Restaurant ID');

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Date range schema
 */
export const dateRangeSchema = z.object({
    startDate: z.string().datetime().or(z.date()),
    endDate: z.string().datetime().or(z.date()),
});

/**
 * Money amount schema (in cents to avoid floating point issues)
 */
export const moneySchema = z.number().int().min(0).describe('Amount in cents');

/**
 * Ethiopian phone number schema
 */
export const ethiopianPhoneSchema = z
    .string()
    .regex(/^(\+251|0)?[79]\d{8}$/, 'Invalid Ethiopian phone number')
    .transform(val => {
        // Normalize to +251 format
        if (val.startsWith('0')) {
            return '+251' + val.slice(1);
        }
        if (!val.startsWith('+')) {
            return '+251' + val;
        }
        return val;
    });

/**
 * Email schema with normalization
 */
export const emailSchema = z.string().email().toLowerCase().trim();

// =============================================================================
// Order Validation Schemas
// =============================================================================

/**
 * Order item schema
 */
export const orderItemSchema = z.object({
    menu_item_id: uuidSchema,
    quantity: z.number().int().min(1).max(100),
    notes: z.string().max(500).optional(),
    modifiers: z
        .array(
            z.object({
                modifier_id: uuidSchema,
                option_id: uuidSchema,
                quantity: z.number().int().min(1).default(1),
            })
        )
        .optional(),
    price_override: moneySchema.optional(), // For custom pricing
});

/**
 * Create order schema
 */
export const createOrderSchema = z.object({
    restaurant_id: restaurantIdSchema,
    table_id: uuidSchema.optional(),
    table_number: z.number().int().min(1).max(999).optional(),
    order_type: z.enum(['dine_in', 'takeaway', 'delivery']),
    items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
    notes: z.string().max(1000).optional(),
    guest_name: z.string().min(1).max(100).optional(),
    guest_phone: ethiopianPhoneSchema.optional(),
    guest_email: emailSchema.optional(),
    delivery_address: z.string().max(500).optional(),
    delivery_latitude: z.number().min(-90).max(90).optional(),
    delivery_longitude: z.number().min(-180).max(180).optional(),
    idempotency_key: z.string().max(100).optional(),
});

/**
 * Update order status schema
 */
export const updateOrderStatusSchema = z.object({
    status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']),
    reason: z.string().max(500).optional(), // For cancellation reason
});

/**
 * Bulk order status update schema
 */
export const bulkOrderStatusSchema = z.object({
    order_ids: z.array(uuidSchema).min(1).max(50),
    status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']),
});

/**
 * Split order schema
 */
export const splitOrderSchema = z.object({
    items: z.array(
        z.object({
            order_item_id: uuidSchema,
            quantity: z.number().int().min(1),
        })
    ),
    target_order_id: uuidSchema.optional(), // If splitting into existing order
});

// =============================================================================
// Payment Validation Schemas
// =============================================================================

/**
 * Payment provider enum
 */
export const paymentProviderSchema = z.enum(['chapa', 'telebirr', 'cash']);

/**
 * Initiate payment schema
 */
export const initiatePaymentSchema = z.object({
    order_id: uuidSchema,
    amount: moneySchema,
    currency: z.enum(['ETB', 'USD']).default('ETB'),
    provider: paymentProviderSchema,
    return_url: z.string().url().optional(),
    webhook_url: z.string().url().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    idempotency_key: z.string().max(100).optional(),
});

/**
 * Verify payment schema
 */
export const verifyPaymentSchema = z.object({
    transaction_reference: z.string().min(1).max(200),
    provider: paymentProviderSchema,
});

/**
 * Refund payment schema
 */
export const refundPaymentSchema = z.object({
    payment_id: uuidSchema,
    amount: moneySchema.optional(), // Partial refund if specified
    reason: z.string().min(1).max(500),
});

// =============================================================================
// Menu Validation Schemas
// =============================================================================

/**
 * Menu item creation schema
 */
export const createMenuItemSchema = z.object({
    restaurant_id: restaurantIdSchema,
    category_id: uuidSchema,
    name: z.string().min(1).max(200),
    name_am: z.string().max(200).optional(), // Amharic name
    description: z.string().max(1000).optional(),
    description_am: z.string().max(1000).optional(),
    price: moneySchema,
    cost_price: moneySchema.optional(),
    image_url: z.string().url().optional(),
    is_available: z.boolean().default(true),
    preparation_time_minutes: z.number().int().min(1).max(180).optional(),
    dietary_tags: z.array(z.string()).optional(),
    allergens: z.array(z.string()).optional(),
    calories: z.number().int().min(0).optional(),
    sort_order: z.number().int().min(0).default(0),
});

/**
 * Menu item update schema
 */
export const updateMenuItemSchema = createMenuItemSchema.partial().extend({
    id: uuidSchema,
});

/**
 * Category creation schema
 */
export const createCategorySchema = z.object({
    restaurant_id: restaurantIdSchema,
    name: z.string().min(1).max(100),
    name_am: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    sort_order: z.number().int().min(0).default(0),
});

// =============================================================================
// KDS Validation Schemas
// =============================================================================

/**
 * KDS action schema
 */
export const kdsActionSchema = z.object({
    action: z.enum(['start', 'complete', 'cancel', 'recall']),
    station_id: uuidSchema.optional(),
    notes: z.string().max(500).optional(),
});

/**
 * KDS station creation schema
 */
export const createKdsStationSchema = z.object({
    restaurant_id: restaurantIdSchema,
    name: z.string().min(1).max(100),
    printer_id: z.string().max(100).optional(),
    categories: z.array(uuidSchema).optional(), // Categories to route to this station
    is_active: z.boolean().default(true),
});

// =============================================================================
// Guest Validation Schemas
// =============================================================================

/**
 * Guest session creation schema
 */
export const createGuestSessionSchema = z.object({
    restaurant_slug: z.string().min(1).max(200),
    table_number: z.number().int().min(1).max(999).optional(),
    device_fingerprint: z.string().max(100).optional(),
});

/**
 * Guest order creation schema (for guest-facing ordering)
 */
export const guestOrderSchema = z.object({
    restaurant_id: restaurantIdSchema,
    table_id: uuidSchema.optional(),
    table_number: z.number().int().min(1).max(999).optional(),
    items: z.array(orderItemSchema).min(1),
    guest_name: z.string().min(1).max(100).optional(),
    guest_phone: ethiopianPhoneSchema.optional(),
    special_requests: z.string().max(1000).optional(),
    idempotency_key: z.string().max(100).optional(),
});

/**
 * Guest feedback schema
 */
export const guestFeedbackSchema = z.object({
    order_id: uuidSchema,
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional(),
    categories: z.array(z.enum(['food', 'service', 'ambiance', 'value', 'speed'])).optional(),
});

// =============================================================================
// Staff Validation Schemas
// =============================================================================

/**
 * Staff creation schema
 */
export const createStaffSchema = z.object({
    restaurant_id: restaurantIdSchema,
    email: emailSchema,
    name: z.string().min(1).max(200),
    role: z.enum(['owner', 'manager', 'staff', 'cashier', 'kitchen']),
    pin: z
        .string()
        .length(4)
        .regex(/^\d{4}$/, 'PIN must be 4 digits')
        .optional(),
    phone: ethiopianPhoneSchema.optional(),
});

/**
 * Staff PIN verification schema
 */
export const verifyPinSchema = z.object({
    pin: z
        .string()
        .length(4)
        .regex(/^\d{4}$/, 'PIN must be 4 digits'),
    restaurant_id: restaurantIdSchema,
});

// =============================================================================
// Table Session Validation Schemas
// =============================================================================

/**
 * Create table session schema
 */
export const createTableSessionSchema = z.object({
    restaurant_id: restaurantIdSchema,
    table_id: uuidSchema,
    covers: z.number().int().min(1).max(50).default(1),
    server_id: uuidSchema.optional(),
});

/**
 * Update table session schema
 */
export const updateTableSessionSchema = z.object({
    covers: z.number().int().min(1).max(50).optional(),
    status: z.enum(['seated', 'ordering', 'eating', 'billing', 'closed']).optional(),
    server_id: uuidSchema.optional(),
});

// =============================================================================
// Notification Validation Schemas
// =============================================================================

/**
 * Push notification subscription schema
 */
export const pushSubscriptionSchema = z.object({
    endpoint: z.string().url(),
    keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
    }),
    device_id: z.string().max(100).optional(),
});

/**
 * SMS notification schema
 */
export const smsNotificationSchema = z.object({
    to: ethiopianPhoneSchema,
    message: z.string().min(1).max(160),
    template: z.string().max(50).optional(),
    template_data: z.record(z.string(), z.unknown()).optional(),
});

// =============================================================================
// Delivery Validation Schemas
// =============================================================================

/**
 * Delivery zone schema
 */
export const deliveryZoneSchema = z.object({
    restaurant_id: restaurantIdSchema,
    name: z.string().min(1).max(100),
    min_order_amount: moneySchema.optional(),
    delivery_fee: moneySchema,
    estimated_delivery_minutes: z.number().int().min(1).max(180),
    polygon: z
        .array(
            z.object({
                lat: z.number().min(-90).max(90),
                lng: z.number().min(-180).max(180),
            })
        )
        .min(3), // At least 3 points for a polygon
    is_active: z.boolean().default(true),
});

/**
 * External order schema (for delivery partners)
 */
export const externalOrderSchema = z.object({
    external_id: z.string().min(1).max(100),
    partner: z.enum(['beu', 'zmall', 'deliver_addis', 'esoora']),
    customer: z.object({
        name: z.string().min(1).max(200),
        phone: ethiopianPhoneSchema,
        email: emailSchema.optional(),
    }),
    delivery_location: z.object({
        address: z.string().min(1).max(500),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        notes: z.string().max(500).optional(),
    }),
    items: z.array(
        z.object({
            name: z.string().min(1).max(200),
            quantity: z.number().int().min(1),
            price: moneySchema,
            notes: z.string().max(500).optional(),
        })
    ),
    total_amount: moneySchema,
    delivery_fee: moneySchema.optional(),
    notes: z.string().max(1000).optional(),
    placed_at: z.string().datetime().optional(),
});

// =============================================================================
// Discount Validation Schemas
// =============================================================================

/**
 * Discount creation schema
 */
export const createDiscountSchema = z.object({
    restaurant_id: restaurantIdSchema,
    code: z.string().min(1).max(50).toUpperCase(),
    description: z.string().max(500).optional(),
    type: z.enum(['percentage', 'fixed', 'buy_x_get_y']),
    value: z.number().min(0),
    min_order_amount: moneySchema.optional(),
    max_discount_amount: moneySchema.optional(),
    valid_from: z.string().datetime().or(z.date()),
    valid_until: z.string().datetime().or(z.date()),
    usage_limit: z.number().int().min(1).optional(),
    is_active: z.boolean().default(true),
});

/**
 * Apply discount schema
 */
export const applyDiscountSchema = z.object({
    code: z.string().min(1).max(50),
    order_id: uuidSchema,
});

// =============================================================================
// Validation Helper Functions
// =============================================================================

/**
 * Validate and parse request body with detailed error messages
 */
export function validateBody<T>(
    schema: z.ZodSchema<T>,
    body: unknown
):
    | { success: true; data: T }
    | { success: false; errors: Array<{ field: string; message: string }> } {
    const result = schema.safeParse(body);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
    }));

    return { success: false, errors };
}

/**
 * Validate query parameters
 */
export function validateQuery<T>(
    schema: z.ZodSchema<T>,
    query: Record<string, string | string[] | undefined>
):
    | { success: true; data: T }
    | { success: false; errors: Array<{ field: string; message: string }> } {
    const result = schema.safeParse(query);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
    }));

    return { success: false, errors };
}

/**
 * Validate path parameters
 */
export function validateParams<T>(
    schema: z.ZodSchema<T>,
    params: Record<string, string | string[] | undefined>
):
    | { success: true; data: T }
    | { success: false; errors: Array<{ field: string; message: string }> } {
    const result = schema.safeParse(params);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
    }));

    return { success: false, errors };
}
