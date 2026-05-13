import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';

export async function GET() {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    const [partnersResult, ordersResult] = await Promise.all([
        context.supabase
            .from('delivery_partners')
            .select('id, provider, status, updated_at, last_sync_at')
            .eq('restaurant_id', context.restaurantId)
            .order('provider', { ascending: true }),
        context.supabase
            .from('external_orders')
            .select('id, provider, normalized_status, created_at, acknowledged_at, source_channel')
            .eq('restaurant_id', context.restaurantId)
            .order('created_at', { ascending: false })
            .limit(300),
    ]);

    if (partnersResult.error) {
        return apiError(
            'Failed to fetch channel partners',
            500,
            'CHANNEL_PARTNERS_FETCH_FAILED',
            partnersResult.error.message
        );
    }
    if (ordersResult.error) {
        return apiError(
            'Failed to fetch external order summary',
            500,
            'EXTERNAL_ORDERS_FETCH_FAILED',
            ordersResult.error.message
        );
    }

    const partners = partnersResult.data ?? [];
    const orders = ordersResult.data ?? [];
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const byProvider: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let externalOrders24h = 0;
    let unackedOrders = 0;

    for (const order of orders) {
        byProvider[order.provider] = (byProvider[order.provider] ?? 0) + 1;
        byStatus[order.normalized_status] = (byStatus[order.normalized_status] ?? 0) + 1;
        if (order.acknowledged_at === null) {
            unackedOrders += 1;
        }
        if (new Date(order.created_at).getTime() >= oneDayAgo) {
            externalOrders24h += 1;
        }
    }

    const connectedPartners = partners.filter(partner => partner.status === 'connected').length;
    const degradedPartners = partners.filter(partner => partner.status === 'error').length;

    return apiSuccess({
        totals: {
            delivery_partners: partners.length,
            connected_partners: connectedPartners,
            degraded_partners: degradedPartners,
            external_orders_24h: externalOrders24h,
            external_orders_total: orders.length,
            unacked_orders: unackedOrders,
        },
        providers: byProvider,
        statuses: byStatus,
        partners,
    });
}
