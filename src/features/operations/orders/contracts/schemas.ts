import { z } from 'zod';

const OrderStatusEnum = z.enum([
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'served',
    'cancelled',
]);
const OrderTypeEnum = z.enum(['dine_in', 'takeaway', 'delivery']);
const FireModeEnum = z.enum(['full', 'delayed']);

export const GetOrdersQuerySchema = z.object({
    restaurantId: z.string().uuid(),
    status: OrderStatusEnum.optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).default(50),
    offset: z.coerce.number().int().nonnegative().default(0),
});

export type GetOrdersQuery = z.infer<typeof GetOrdersQuerySchema>;

export const GetOrderByIdQuerySchema = z.object({
    orderId: z.string().uuid(),
    restaurantId: z.string().uuid(),
});

export type GetOrderByIdQuery = z.infer<typeof GetOrderByIdQuerySchema>;

export const UpdateOrderStatusCommandSchema = z.object({
    orderId: z.string().uuid(),
    restaurantId: z.string().uuid(),
    status: OrderStatusEnum,
    staffId: z.string().uuid(),
});

export type UpdateOrderStatusCommand = z.infer<typeof UpdateOrderStatusCommandSchema>;

export const CancelOrderCommandSchema = z.object({
    orderId: z.string().uuid(),
    restaurantId: z.string().uuid(),
    reason: z.string().max(500).optional(),
    staffId: z.string().uuid(),
});

export type CancelOrderCommand = z.infer<typeof CancelOrderCommandSchema>;

export const OrderResponseSchema = z.object({
    id: z.string().uuid(),
    restaurant_id: z.string().uuid(),
    table_number: z.string().nullable(),
    order_number: z.string(),
    status: OrderStatusEnum,
    order_type: OrderTypeEnum,
    total_price: z.number(),
    discount_amount: z.number().nullable(),
    notes: z.string().nullable(),
    guest_fingerprint: z.string().nullable(),
    items: z.array(z.unknown()).default([]),
    fire_mode: FireModeEnum.default('full'),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
});

export type OrderResponse = z.infer<typeof OrderResponseSchema>;

export { OrderStatusEnum, OrderTypeEnum, FireModeEnum };
