import { z } from 'zod';

const PaymentProviderEnum = z.enum(['chapa', 'telebirr', 'cbe']);

export const CreatePaymentSessionSchema = z.object({
    restaurantId: z.string().uuid(),
    orderId: z.string().uuid(),
    amount: z.number().int().positive(),
    currency: z.string().default('ETB'),
    provider: PaymentProviderEnum.default('chapa'),
    customerPhone: z.string().optional(),
    customerName: z.string().optional(),
    callbackUrl: z.string().url().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreatePaymentSessionCommand = z.infer<typeof CreatePaymentSessionSchema>;

export const PaymentSessionResponseSchema = z.object({
    id: z.string().uuid(),
    restaurant_id: z.string().uuid(),
    order_id: z.string().uuid(),
    provider: PaymentProviderEnum,
    amount: z.number().int(),
    currency: z.string(),
    status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
    provider_ref: z.string().nullable(),
    checkout_url: z.string().nullable(),
    expires_at: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
});

export type PaymentSessionResponse = z.infer<typeof PaymentSessionResponseSchema>;

export const PaymentStatusEnum = z.enum([
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled',
]);

export { PaymentProviderEnum };
