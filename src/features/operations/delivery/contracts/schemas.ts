import { z } from 'zod';

const DeliveryProviderEnum = z.enum([
    'beu',
    'zmall',
    'deliver_addis',
    'telebirr_food',
    'esoora',
    'custom_local',
]);

export const AggregatorOrderSchema = z.object({
    orderId: z.string().uuid(),
    provider: DeliveryProviderEnum,
    externalOrderId: z.string().optional(),
    customerName: z.string().optional(),
    customerPhone: z.string().optional(),
    deliveryAddress: z.string().optional(),
    deliveryNotes: z.string().optional(),
    items: z
        .array(
            z.object({
                name: z.string(),
                quantity: z.number().int().positive(),
                price: z.number().nonnegative(),
                notes: z.string().optional(),
            })
        )
        .optional(),
    subtotal: z.number().nonnegative().optional(),
    deliveryFee: z.number().nonnegative().optional(),
    platformFee: z.number().nonnegative().optional(),
    total: z.number().nonnegative(),
    currency: z.string().default('ETB'),
    placedAt: z.string().datetime().optional(),
});

export type AggregatorOrderCommand = z.infer<typeof AggregatorOrderSchema>;

export const AggregatorOrderResponseSchema = z.object({
    id: z.string().uuid(),
    restaurant_id: z.string().uuid(),
    provider: DeliveryProviderEnum,
    provider_order_id: z.string().nullable(),
    normalized_status: z.string(),
    total_amount: z.number().nonnegative(),
    currency: z.string(),
    customer_name: z.string().nullable(),
    customer_phone: z.string().nullable(),
    source_channel: z.string(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
});

export type AggregatorOrderResponse = z.infer<typeof AggregatorOrderResponseSchema>;

export const CalculateFeeQuerySchema = z.object({
    restaurantId: z.string().uuid(),
    deliveryArea: z.string().min(1),
    deliveryCity: z.string().default('Addis Ababa'),
    restaurantArea: z.string().optional(),
});

export type CalculateFeeQuery = z.infer<typeof CalculateFeeQuerySchema>;

export const FeeCalculationSchema = z.object({
    distanceKm: z.number().nonnegative(),
    baseFee: z.number().nonnegative(),
    distanceFee: z.number().nonnegative(),
    deliveryFee: z.number().nonnegative(),
    platformFee: z.number().nonnegative(),
    totalFee: z.number().nonnegative(),
    estimatedTime: z.number().int(),
    currency: z.string(),
    restaurantId: z.string().uuid().optional(),
    deliveryArea: z.string().optional(),
    deliveryCity: z.string().optional(),
});

export type FeeCalculationResult = z.infer<typeof FeeCalculationSchema>;

export { DeliveryProviderEnum };
