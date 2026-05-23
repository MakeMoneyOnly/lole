import { z } from 'zod';

export const OrderItemInputSchema = z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().positive().default(1),
    modifiers: z.record(z.string(), z.unknown()).optional(),
    notes: z.string().optional(),
});

export const CreateOrderRequestSchema = z.object({
    restaurantId: z.string().uuid(),
    tableId: z.string().uuid().optional(),
    type: z.enum(['dine_in', 'takeaway', 'delivery']).default('dine_in'),
    items: z.array(OrderItemInputSchema).min(1),
    notes: z.string().optional(),
    idempotencyKey: z.string().uuid(),
    staffId: z.string().uuid(),
    guestId: z.string().uuid().optional(),
});

export const UpdateOrderStatusRequestSchema = z.object({
    id: z.string().uuid(),
    status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled']),
    staffId: z.string().uuid(),
});

export const CancelOrderRequestSchema = z.object({
    id: z.string().uuid(),
    reason: z.string().optional(),
    staffId: z.string().uuid(),
});

export const GetOrdersQuerySchema = z.object({
    restaurantId: z.string().uuid(),
    status: z
        .enum(['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'])
        .optional(),
    tableId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).default(0),
});

export type CreateOrderInput = z.infer<typeof CreateOrderRequestSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusRequestSchema>;
export type CancelOrderInput = z.infer<typeof CancelOrderRequestSchema>;
export type GetOrdersQuery = z.infer<typeof GetOrdersQuerySchema>;
export type OrderItemInput = z.infer<typeof OrderItemInputSchema>;
