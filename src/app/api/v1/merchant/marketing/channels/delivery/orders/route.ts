import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseQuery } from '@/lib/api/validation';

const DeliveryOrdersQuerySchema = z.object({
    provider: z
        .enum([
            'beu',
            'deliver_addis',
            'zmall',
            'telebirr_food',
            'esoora',
            'direct_web',
            'custom_local',
        ])
        .optional(),
    status: z
        .enum([
            'new',
            'acknowledged',
            'preparing',
            'ready',
            'out_for_delivery',
            'completed',
            'cancelled',
            'failed',
        ])
        .optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export async function GET(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    const url = new URL(request.url);
    const parsed = parseQuery(
        {
            provider: url.searchParams.get('provider') ?? undefined,
            status: url.searchParams.get('status') ?? undefined,
            limit: url.searchParams.get('limit') ?? undefined,
        },
        DeliveryOrdersQuerySchema
    );
    if (!parsed.success) {
        return parsed.response;
    }

    let query = context.supabase
        .from('external_orders')
        .select(
            'id, provider, provider_order_id, source_channel, normalized_status, total_amount, currency, payload_json, acked_at, created_at, updated_at'
        )
        .eq('restaurant_id', context.restaurantId)
        .order('created_at', { ascending: false })
        .limit(parsed.data.limit);

    if (parsed.data.provider) {
        query = query.eq('provider', parsed.data.provider);
    }
    if (parsed.data.status) {
        query = query.eq('normalized_status', parsed.data.status);
    }

    const { data, error } = await query;
    if (error) {
        return apiError(
            'Failed to fetch delivery orders',
            500,
            'DELIVERY_ORDERS_FETCH_FAILED',
            error.message
        );
    }

    return apiSuccess({
        orders: data ?? [],
        total: data?.length ?? 0,
    });
}
