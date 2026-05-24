import { apiSuccess, apiError } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { GetOrdersQuerySchema, type OrderResponse } from '../contracts';
import { auditAction } from '../../shared/audit-helpers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type OrderRow = {
    id: string;
    status: string;
    total_price: number;
    created_at: string;
};

export async function listOrdersHandler(request: Request): Promise<Response> {
    try {
        const auth = await requireMerchantAuth(request);

        if (!auth.ok) {
            return auth.response;
        }

        const { supabase, restaurantId, user } = auth;

        const url = new URL(request.url);
        const rawQuery = {
            restaurantId: restaurantId,
            status: url.searchParams.get('status') ?? undefined,
            search: url.searchParams.get('search') ?? undefined,
            limit: url.searchParams.get('limit')
                ? Number(url.searchParams.get('limit'))
                : undefined,
            offset: url.searchParams.get('offset')
                ? Number(url.searchParams.get('offset'))
                : undefined,
        };

        const validated = GetOrdersQuerySchema.parse(rawQuery);

        const orders = await listOrdersQuery(supabase, validated);

        await auditAction(supabase, {
            action: 'orders_listed',
            entityType: 'order',
            userId: user.id,
            restaurantId,
            metadata: { count: orders.length },
        });

        return apiSuccess<{ orders: OrderResponse[]; total: number }>({
            orders: orders.map(formatOrderResponse),
            total: orders.length,
        });
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'listOrders',
        });
    }
}

async function listOrdersQuery(
    supabase: SupabaseClient<Database>,
    query: {
        restaurantId: string;
        status?: string;
        search?: string;
        limit?: number;
        offset?: number;
    }
): Promise<OrderRow[]> {
    let q = supabase
        .from('orders')
        .select(
            'id, restaurant_id, table_number, status, total_price, customer_name, customer_phone, notes, idempotency_key, created_at, updated_at'
        )
        .eq('restaurant_id', query.restaurantId)
        .order('created_at', { ascending: false });

    if (query.status && query.status !== 'all') {
        q = q.eq('status', query.status);
    }

    if (query.search) {
        const s = query.search.trim();
        if (s.length > 0) {
            q = q.or(
                `table_number.ilike.%${s}%,order_number.ilike.%${s}%,customer_name.ilike.%${s}%`
            );
        }
    }

    q = q.range(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? 50) - 1);

    const { data, error } = await q;

    if (error) {
        throw error;
    }

    return (data ?? []).map((item: Record<string, unknown>) => ({
        id: item.id as string,
        status: item.status as string,
        total_price: Number(item.total_price ?? 0),
        created_at: item.created_at as string,
    }));
}

function formatOrderResponse(order: OrderRow): OrderResponse {
    return {
        id: order.id,
        restaurant_id: '',
        table_number: null,
        order_number: '',
        status: order.status as
            | 'pending'
            | 'confirmed'
            | 'preparing'
            | 'ready'
            | 'served'
            | 'cancelled',
        order_type: 'dine_in',
        total_price: order.total_price / 100,
        discount_amount: null,
        notes: null,
        guest_fingerprint: null,
        items: [],
        fire_mode: 'full',
        created_at: order.created_at,
        updated_at: order.created_at,
    };
}
