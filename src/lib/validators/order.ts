import { z } from 'zod';

/**
 * Order Item Schema
 * Validates individual items in an order
 *
 * CRIT-02: All monetary values are now INTEGER in SANTIM (100 santim = 1 ETB)
 */
export const OrderItemSchema = z.object({
    id: z.string().uuid('Invalid item ID'),
    name: z.string().trim().min(1, 'Item name is required').max(200, 'Item name too long'),
    quantity: z
        .number()
        .int('Quantity must be a whole number')
        .min(1, 'Minimum quantity is 1')
        .max(100, 'Maximum quantity is 100'),
    // price accepts birr (decimal) values
    price: z.number().nonnegative('Price must be a non-negative value (in birr)'),
    notes: z.string().max(500, 'Notes too long').optional(),
    station: z.enum(['kitchen', 'bar', 'dessert', 'coffee']).optional(),
    course: z.enum(['appetizer', 'main', 'dessert', 'beverage', 'side']).optional(),
});

/**
 * Create Order Schema
 * Validates the full order creation request
 *
 * CRIT-02: All monetary values are now INTEGER in SANTIM (100 santim = 1 ETB)
 */
export const CreateOrderSchema = z.object({
    restaurant_id: z.string().uuid('Invalid restaurant ID'),
    table_number: z.string().min(1, 'Table number is required').max(20, 'Table number too long'),
    items: z
        .array(OrderItemSchema)
        .min(1, 'At least one item is required')
        .max(50, 'Maximum 50 items per order'),
    // total_price accepts birr (decimal) values
    total_price: z.number().positive('Total price must be a positive value (in birr)'),
    notes: z.string().max(1000, 'Notes too long').optional(),
    idempotency_key: z.string().uuid('Invalid idempotency key'),
});

/**
 * Update Order Status Schema
 * Validates order status updates
 */
export const UpdateOrderStatusSchema = z.object({
    order_id: z.string().uuid('Invalid order ID'),
    status: z.enum(['pending', 'preparing', 'ready', 'served', 'closed', 'cancelled']),
    restaurant_id: z.string().uuid('Invalid restaurant ID'),
});

/**
 * Type exports for TypeScript
 */
export type OrderItemInput = z.infer<typeof OrderItemSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
