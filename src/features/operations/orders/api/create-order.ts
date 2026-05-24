import { apiSuccess, apiError } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { type OrderResponse } from '../contracts';
import { ordersService } from '@/domains/orders/service';
import { auditAction } from '../../shared/audit-helpers';
import type { CreateOrderInput } from '@/domains/orders/service';

export async function createOrderHandler(request: Request): Promise<Response> {
    try {
        const auth = await requireMerchantAuth(request);

        if (!auth.ok) {
            return auth.response;
        }

        const { supabase, restaurantId, user } = auth;

        const body = await request.json();

        const input: CreateOrderInput = {
            restaurantId: restaurantId,
            tableId: body.tableId,
            type: body.type ?? 'dine_in',
            items: body.items,
            notes: body.notes,
            idempotencyKey: body.idempotencyKey,
            staffId: user.id,
            guestId: body.guestId,
        };

        const order = await ordersService.createOrder(input);

        await auditAction(supabase, {
            action: 'order_created',
            entityType: 'order',
            entityId: order.id,
            userId: user.id,
            restaurantId,
            newValues: { status: order.status ?? '', total_price: order.total_price },
            metadata: { item_count: body.items?.length ?? 0 },
        });

        return apiSuccess<OrderResponse>(formatOrderResponse(order), 201);
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'createOrder',
        });
    }
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
        created_at: order.created_at ?? new Date().toISOString(),
        updated_at: order.created_at ?? new Date().toISOString(),
    };
}
