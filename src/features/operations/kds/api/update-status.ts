import { apiError, apiSuccess } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { UpdateKDSStatusSchema } from '../contracts';
import { auditStatusTransition } from '../../shared/audit-helpers';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pending: ['acknowledged', 'preparing'],
    acknowledged: ['preparing', 'ready'],
    preparing: ['ready'],
    ready: [],
    served: [],
    completed: [],
    cancelled: [],
};

function canTransition(current: string | null, next: string): boolean {
    if (!current) return false;
    return (ALLOWED_TRANSITIONS[current] || []).includes(next);
}

export async function updateKDSStatusHandler(
    request: Request,
    context: { orderId: string }
): Promise<Response> {
    try {
        const auth = await requireMerchantAuth(request);

        if (!auth.ok) {
            return auth.response;
        }

        const { supabase, restaurantId, user } = auth;
        const orderId = context.orderId;

        const payload = await request.json();
        const parsed = UpdateKDSStatusSchema.safeParse({
            ...payload,
            restaurantId,
            orderId,
        });

        if (!parsed.success) {
            return apiError('Invalid request payload', 400, 'INVALID_PAYLOAD');
        }

        const { status } = parsed.data;

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, restaurant_id, status')
            .eq('id', orderId)
            .maybeSingle();

        if (orderError) {
            return apiError('Failed to load order', 500, 'ORDER_FETCH_FAILED');
        }

        if (!order) {
            return apiError('Order not found', 404, 'ORDER_NOT_FOUND');
        }

        if (!canTransition(order.status, status)) {
            return apiError(
                `Invalid status transition from "${order.status}" to "${status}"`,
                409,
                'INVALID_STATUS_TRANSITION'
            );
        }

        const now = new Date().toISOString();
        const updatePayload: Record<string, string> = {
            status,
            kitchen_status: status,
            updated_at: now,
        };

        if (status === 'acknowledged') {
            updatePayload.acknowledged_at = now;
        }
        if (status === 'ready') {
            updatePayload.completed_at = now;
        }

        const { data: updatedOrder, error: updateError } = await supabase
            .from('orders')
            .update(updatePayload)
            .eq('id', order.id)
            .select(
                'id, restaurant_id, table_id, status, kitchen_status, total_amount, currency, customer_name, customer_phone, notes, acknowledged_at, completed_at, created_at, updated_at'
            )
            .single();

        if (updateError || !updatedOrder) {
            return apiError('Failed to update order status', 500, 'UPDATE_FAILED');
        }

        await auditStatusTransition(supabase, restaurantId, {
            orderId: order.id,
            userId: user.id,
            fromStatus: order.status ?? '',
            toStatus: status,
        });

        return apiSuccess({ order: updatedOrder });
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'updateKDSStatus',
        });
    }
}
