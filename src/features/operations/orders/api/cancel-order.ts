import { apiSuccess, apiError } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import {
    CancelOrderCommandSchema,
    type CancelOrderCommand,
    type OrderResponse,
} from '../contracts';
import { ordersService } from '@/domains/orders/service';
import { auditAction } from '../../shared/audit-helpers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export async function cancelOrderHandler(
    request: Request,
    context: { params: Promise<{ orderId: string }> }
): Promise<Response> {
    try {
        const auth = await requireMerchantAuth(request);

        if (!auth.ok) {
            return auth.response;
        }

        const { supabase, restaurantId, user } = auth;
        const { orderId } = await context.params;

        let body: { reason?: string } = {};
        try {
            body = await request.json();
        } catch {
            // Empty body is ok
        }

        const command: CancelOrderCommand = {
            orderId,
            restaurantId: restaurantId,
            reason: body.reason,
            staffId: user.id,
        };

        const validated = CancelOrderCommandSchema.parse(command);

        const order = await getOrderById(supabase, orderId, restaurantId);
        if (!order) {
            return apiError('Order not found', 404, 'ORDER_NOT_FOUND');
        }

        const cancelledOrder = await ordersService.cancelOrder({
            id: validated.orderId,
            reason: validated.reason,
            staffId: validated.staffId,
        });

        await auditAction(supabase, {
            action: 'order_cancelled',
            entityType: 'order',
            entityId: validated.orderId,
            userId: user.id,
            restaurantId,
            oldValues: { status: order.status ?? '' },
            newValues: { status: 'cancelled' },
            metadata: { reason: validated.reason },
        });

        return apiSuccess<OrderResponse>(formatOrderResponse(cancelledOrder));
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'cancelOrder',
        });
    }
}

async function getOrderById(
    supabase: SupabaseClient<Database>,
    orderId: string,
    restaurantId: string
): Promise<{
    id: string;
    status: string | null;
    total_price: number | null;
    created_at: string | null;
    restaurant_id: string;
} | null> {
    const { data, error } = await supabase
        .from('orders')
        .select('id, restaurant_id, status, total_price, created_at')
        .eq('id', orderId)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return data;
}

function formatOrderResponse(order: {
    id: string;
    status: string | null;
    total_price: number | null;
    created_at: string | null;
    restaurant_id: string;
}): OrderResponse {
    return {
        id: order.id,
        restaurant_id: order.restaurant_id,
        table_number: null,
        order_number: '',
        status: (order.status ?? 'pending') as
            | 'pending'
            | 'confirmed'
            | 'preparing'
            | 'ready'
            | 'served'
            | 'cancelled',
        order_type: 'dine_in',
        total_price: (order.total_price ?? 0) / 100,
        discount_amount: null,
        notes: null,
        guest_fingerprint: null,
        items: [],
        fire_mode: 'full',
        created_at: order.created_at ?? '',
        updated_at: order.created_at ?? '',
    };
}
