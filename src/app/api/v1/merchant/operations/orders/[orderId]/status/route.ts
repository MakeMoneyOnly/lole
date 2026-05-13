import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiError, apiSuccess } from '@/lib/api/response';
import { trackApiMetric } from '@/lib/api/metrics';
import { enforcePilotAccess } from '@/lib/api/pilotGate';
import { sendOrderStatusSms } from '@/lib/notifications/sms';
import { createloleEvent } from '@/lib/events/contracts';
import { publishEvent } from '@/lib/events/runtime';
import { redisRateLimiters } from '@/lib/security';
import { monitoredQuery } from '@/lib/services/queryMonitor';

const UpdateOrderStatusSchema = z.object({
    status: z.enum([
        'pending',
        'acknowledged',
        'preparing',
        'ready',
        'served',
        'completed',
        'cancelled',
    ]),
    type: z.enum(['kitchen', 'bar', 'general']).optional(),
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pending: ['acknowledged', 'preparing', 'ready', 'cancelled'], // KDS can fast-track any order
    acknowledged: ['preparing', 'ready', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['served', 'completed', 'cancelled'],
    served: ['completed'],
    completed: [],
    cancelled: [],
};

function canTransition(current: string | null, next: string) {
    if (!current) return false;
    return (ALLOWED_TRANSITIONS[current] || []).includes(next);
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ orderId: string }> }
) {
    // Apply rate limiting for order status updates (mutation endpoint)
    const rateLimitResponse = await redisRateLimiters.mutation(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    const startedAt = Date.now();
    let responseStatus = 500;
    let restaurantIdForMetrics: string | null = null;

    try {
        const { orderId } = await context.params;
        const body = await request.json();
        const parsed = UpdateOrderStatusSchema.safeParse(body);

        if (!parsed.success) {
            responseStatus = 400;
            return apiError(
                'Invalid request payload',
                400,
                'INVALID_PAYLOAD',
                parsed.error.flatten()
            );
        }

        const supabase = await createClient();

        // Parallelize: auth check + order fetch at the same time
        const [
            {
                data: { user },
                error: userError,
            },
            { data: order, error: orderError },
        ] = await monitoredQuery(
            'orders:update-status:fetch-order',
            () =>
                Promise.all([
                    supabase.auth.getUser(),
                    supabase
                        .from('orders')
                        .select('id, restaurant_id, status')
                        .eq('id', orderId)
                        .maybeSingle(),
                ]),
            { orderId }
        );

        if (userError || !user) {
            responseStatus = 401;
            return apiError('Unauthorized', 401, 'UNAUTHORIZED');
        }

        if (orderError) {
            responseStatus = 500;
            return apiError('Failed to load order', 500, 'ORDER_FETCH_FAILED', orderError.message);
        }
        if (!order) {
            responseStatus = 404;
            return apiError('Order not found', 404, 'ORDER_NOT_FOUND');
        }

        restaurantIdForMetrics = order.restaurant_id;

        const pilotGateResponse = enforcePilotAccess(order.restaurant_id, request.method);
        if (pilotGateResponse) {
            responseStatus = pilotGateResponse.status;
            return pilotGateResponse;
        }

        // Staff auth check — must be sequential (needs restaurant_id from order)
        const { data: staff, error: staffError } = await supabase
            .from('restaurant_staff')
            .select('id')
            .eq('restaurant_id', order.restaurant_id)
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();

        if (staffError) {
            responseStatus = 500;
            return apiError(
                'Failed to verify staff access',
                500,
                'STAFF_ACCESS_CHECK_FAILED',
                staffError.message
            );
        }
        if (!staff) {
            responseStatus = 403;
            return apiError('Forbidden', 403, 'FORBIDDEN');
        }

        if (!canTransition(order.status, parsed.data.status)) {
            responseStatus = 409;
            return apiError(
                `Invalid status transition from "${order.status}" to "${parsed.data.status}"`,
                409,
                'INVALID_TRANSITION'
            );
        }

        const now = new Date().toISOString();
        const updatePayload: Record<string, string> = {
            status: parsed.data.status,
            updated_at: now,
        };
        if (parsed.data.status === 'acknowledged') updatePayload.acknowledged_at = now;
        if (parsed.data.status === 'ready' || parsed.data.status === 'completed')
            updatePayload.completed_at = now;
        if (['acknowledged', 'preparing', 'ready'].includes(parsed.data.status)) {
            updatePayload.kitchen_status = parsed.data.status;
        }

        const { data: updatedOrder, error: updateError } = await monitoredQuery(
            'orders:update-status',
            async () => {
                const result = await supabase
                    .from('orders')
                    .update(updatePayload)
                    .eq('id', order.id)
                    .select(
                        'id, restaurant_id, status, kitchen_status, order_number, customer_phone, acknowledged_at, completed_at, created_at, updated_at'
                    )
                    .single();
                return result;
            },
            { orderId: order.id, newStatus: parsed.data.status }
        );

        if (updateError || !updatedOrder) {
            responseStatus = 500;
            return apiError(
                'Failed to update order status',
                500,
                'ORDER_UPDATE_FAILED',
                updateError?.message
            );
        }

        // ✅ Respond immediately — fire-and-forget audit + event + metrics writes
        responseStatus = 200;
        const response = apiSuccess(updatedOrder);

        const smsPromise = (async () => {
            if (!updatedOrder?.customer_phone) return;
            const { data: restaurantSettings } = await supabase
                .from('restaurants')
                .select('settings')
                .eq('id', order.restaurant_id)
                .maybeSingle();
            const notificationsSettings = (
                restaurantSettings?.settings as Record<string, unknown> | null
            )?.notifications as Record<string, unknown> | undefined;
            const smsEnabled = Boolean(notificationsSettings?.sms_enabled);
            if (!smsEnabled) return;

            await sendOrderStatusSms({
                toPhone: updatedOrder.customer_phone,
                orderNumber: updatedOrder.order_number ?? updatedOrder.id,
                status: parsed.data.status,
            });
        })();

        // These do NOT block the response
        const durationMs = Date.now() - startedAt;
        Promise.all([
            supabase.from('audit_logs').insert({
                restaurant_id: order.restaurant_id,
                user_id: user.id,
                action: 'order_status_updated',
                entity_type: 'order',
                entity_id: order.id,
                old_value: { status: order.status },
                new_value: { status: parsed.data.status },
                metadata: { source: 'merchant_dashboard' },
            }),
            supabase.from('order_events').insert({
                restaurant_id: order.restaurant_id,
                order_id: order.id,
                event_type: 'status_changed',
                from_status: order.status,
                to_status: parsed.data.status,
                actor_user_id: user.id,
                metadata: { source: 'merchant_dashboard' },
            }),
            ...(parsed.data.status === 'completed' || parsed.data.status === 'served'
                ? [
                      publishEvent(
                          createloleEvent('order.completed', {
                              restaurant_id: order.restaurant_id,
                              order_id: order.id,
                              previous_status: order.status,
                              status: parsed.data.status,
                              source: 'merchant_dashboard',
                          })
                      ),
                  ]
                : []),
            trackApiMetric(supabase, {
                restaurantId: restaurantIdForMetrics,
                endpoint: '/api/orders/:id/status',
                method: 'PATCH',
                statusCode: responseStatus,
                durationMs,
            }),
            smsPromise,
        ]).catch(err => {
            console.warn('[PATCH /api/orders/:id/status] background write failed:', err);
        });

        return response;
    } catch (error) {
        responseStatus = 500;
        return apiError(
            'Internal server error',
            500,
            'INTERNAL_ERROR',
            error instanceof Error ? error.message : 'Unknown error'
        );
    }
}
