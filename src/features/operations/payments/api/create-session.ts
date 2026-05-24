import { apiSuccess, apiError } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { CreatePaymentSessionSchema, type PaymentSessionResponse } from '../contracts';

export async function createSessionHandler(request: Request): Promise<Response> {
    try {
        const auth = await requireMerchantAuth(request);

        if (!auth.ok) {
            return auth.response;
        }

        const { supabase, restaurantId } = auth;

        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return apiError('Invalid JSON body', 400, 'INVALID_JSON');
        }

        const rawCommand = {
            restaurantId: restaurantId,
            ...body,
        };

        const validated = CreatePaymentSessionSchema.parse(rawCommand);
        const { orderId, amount, currency, provider } = validated;

        // Verify order belongs to restaurant
        const { data: order, error: orderError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('orders')
                .select('id, status, total_amount')
                .eq('id', orderId)
                .eq('restaurant_id', restaurantId)
                .single();

        if (orderError || !order) {
            return apiError('Order not found', 404, 'ORDER_NOT_FOUND');
        }

        // Create payment session
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min expiry

        const { data: session, error: sessionError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('payment_sessions')
                .insert({
                    restaurant_id: restaurantId,
                    order_id: orderId,
                    provider,
                    amount,
                    currency,
                    status: 'pending',
                    provider_ref: null,
                    checkout_url: null,
                    expires_at: expiresAt,
                })
                .select(
                    'id, restaurant_id, order_id, provider, amount, currency, status, provider_ref, checkout_url, expires_at, created_at, updated_at'
                )
                .single();

        if (sessionError) {
            return apiError(
                'Failed to create payment session',
                500,
                'PAYMENT_SESSION_CREATE_FAILED',
                sessionError.message
            );
        }

        // TODO: Integrate with actual payment provider (Chapa, Telebirr)
        // For now, return the session with a placeholder checkout URL
        const checkoutUrl = `${process.env.NEXT_PUBLIC_APP_URL}/checkout/${session!.id}`;

        const { data: updatedSession, error: updateError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('payment_sessions')
                .update({ checkout_url: checkoutUrl })
                .eq('id', session!.id)
                .select(
                    'id, restaurant_id, order_id, provider, amount, currency, status, provider_ref, checkout_url, expires_at, created_at, updated_at'
                )
                .single();

        if (updateError) {
            return apiError(
                'Failed to update payment session',
                500,
                'PAYMENT_SESSION_UPDATE_FAILED',
                updateError.message
            );
        }

        return apiSuccess({ session: updatedSession as PaymentSessionResponse }, 201);
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'createSession',
        });
    }
}
