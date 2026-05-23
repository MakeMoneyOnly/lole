import { createClient } from '@/lib/supabase/server';
import { apiError, apiSuccess } from '@/lib/api/response';
import { enforcePilotAccess } from '@/lib/api/pilotGate';
import { resolveRestaurantIdForUser } from '@/lib/api/route-utils';

export async function GET(
    _request: Request,
    context: { params: Promise<{ orderId: string }> }
): Promise<Response> {
    try {
        const { orderId } = await context.params;
        const supabase = await createClient();

        // Get authenticated user
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return apiError('Unauthorized', 401, 'UNAUTHORIZED');
        }

        // Now resolve restaurant + fetch order + fetch events all in parallel
        const { restaurantId, error: restaurantError } = await resolveRestaurantIdForUser(user.id);

        if (restaurantError) {
            return apiError(
                'Failed to resolve restaurant context',
                500,
                'RESTAURANT_RESOLVE_FAILED',
                restaurantError
            );
        }
        if (!restaurantId) {
            return apiError('No restaurant found for user', 404, 'RESTAURANT_NOT_FOUND');
        }

        const pilotGateResponse = enforcePilotAccess(restaurantId);
        if (pilotGateResponse) return pilotGateResponse;

        // Parallelize: order fetch + events fetch at the same time
        const [{ data: order, error: orderError }, { data: events, error: eventsError }] =
            await Promise.all([
                supabase
                    .from('orders')
                    .select(
                        'id, restaurant_id, table_number, status, total_price, customer_name, customer_phone, notes, idempotency_key, created_at, updated_at'
                    )
                    .eq('restaurant_id', restaurantId)
                    .eq('id', orderId)
                    .maybeSingle(),
                supabase
                    .from('order_events')
                    .select(
                        'id, event_type, from_status, to_status, created_at, actor_user_id, metadata'
                    )
                    .eq('restaurant_id', restaurantId)
                    .eq('order_id', orderId)
                    .order('created_at', { ascending: false })
                    .limit(50),
            ]);

        if (orderError) {
            return apiError('Failed to fetch order', 500, 'ORDER_FETCH_FAILED', orderError.message);
        }
        if (!order) {
            return apiError('Order not found', 404, 'ORDER_NOT_FOUND');
        }
        if (eventsError) {
            return apiError(
                'Failed to fetch order events',
                500,
                'ORDER_EVENTS_FETCH_FAILED',
                eventsError.message
            );
        }

        return apiSuccess({
            order: { ...order, total_price: Number(order.total_price ?? 0) / 100 },
            events: events ?? [],
        });
    } catch (error) {
        return apiError(
            'Internal server error',
            500,
            'INTERNAL_ERROR',
            error instanceof Error ? error.message : 'Unknown error'
        );
    }
}
