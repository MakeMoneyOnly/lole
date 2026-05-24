import { apiSuccess, apiError } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import {
    UpdateOrderStatusCommandSchema,
    type UpdateOrderStatusCommand,
    type OrderResponse,
} from '../contracts';
import { ordersService } from '@/domains/orders/service';
import { auditStatusTransition } from '../../shared/audit-helpers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export async function updateOrderStatusHandler(
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

        const body = await request.json();
        const command: UpdateOrderStatusCommand = {
            orderId,
            restaurantId: restaurantId,
            status: body.status,
            staffId: user.id,
        };

        const validated = UpdateOrderStatusCommandSchema.parse(command);

        const order = await getOrderWithStatus(supabase, orderId, restaurantId);
        if (!order) {
            return apiError('Order not found', 404, 'ORDER_NOT_FOUND');
        }

        const updatedOrder = await ordersService.updateOrderStatus({
            id: validated.orderId,
            status: validated.status,
            staffId: validated.staffId,
        });

        await auditStatusTransition(supabase, restaurantId, {
            orderId: validated.orderId,
            userId: user.id,
            fromStatus: order.status ?? '',
            toStatus: validated.status,
        });

        return apiSuccess<OrderResponse>(formatOrderResponse(updatedOrder));
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'updateOrderStatus',
        });
    }
}

async function getOrderWithStatus(
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
