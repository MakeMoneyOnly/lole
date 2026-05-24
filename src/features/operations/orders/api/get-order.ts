import { apiSuccess, apiError } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { GetOrderByIdQuerySchema, type GetOrderByIdQuery, type OrderResponse } from '../contracts';
import { auditAction } from '../../shared/audit-helpers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export async function getOrderHandler(
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

        const query: GetOrderByIdQuery = {
            orderId,
            restaurantId,
        };

        GetOrderByIdQuerySchema.parse(query);

        const order = await getOrderById(supabase, orderId, restaurantId);

        if (!order) {
            return apiError('Order not found', 404, 'ORDER_NOT_FOUND');
        }

        await auditAction(supabase, {
            action: 'order_viewed',
            entityType: 'order',
            entityId: orderId,
            userId: user.id,
            restaurantId,
        });

        return apiSuccess<OrderResponse>(formatOrderResponse(order));
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'getOrder',
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
    table_number: string | null;
} | null> {
    const { data, error } = await supabase
        .from('orders')
        .select(
            'id, restaurant_id, table_number, status, total_price, customer_name, customer_phone, notes, idempotency_key, created_at, updated_at'
        )
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
    table_number: string | null;
}): OrderResponse {
    return {
        id: order.id,
        restaurant_id: order.restaurant_id,
        table_number: order.table_number,
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
