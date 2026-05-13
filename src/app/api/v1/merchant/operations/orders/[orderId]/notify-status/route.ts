import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { sendOrderStatusSms } from '@/lib/notifications/sms';
import { writeAuditLog } from '@/lib/api/audit';
import { isIdempotencyKeyValid, resolveIdempotencyKey } from '@/lib/api/idempotency';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const OrderIdSchema = z.string().uuid();

const NotifyStatusSchema = z.object({
    status: z.enum(['preparing', 'ready', 'served', 'completed', 'cancelled']),
    notify_methods: z
        .array(z.enum(['sms', 'push']))
        .optional()
        .default(['sms']),
    custom_message: z.string().max(500).optional(),
    eta_minutes: z.number().int().min(1).max(180).optional(),
});

/**
 * POST /api/orders/[orderId]/notify-status
 *
 * Sends order status notifications to the customer via SMS and/or push.
 * This is the P0 SMS Order Notifications feature.
 */
export async function POST(
    request: Request,
    routeContext: { params: Promise<{ orderId: string }> }
) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const { orderId } = await routeContext.params;
    const orderIdParsed = OrderIdSchema.safeParse(orderId);
    if (!orderIdParsed.success) {
        return apiError('Invalid order id', 400, 'INVALID_ORDER_ID', orderIdParsed.error.flatten());
    }

    const explicitIdempotencyKey = request.headers.get('x-idempotency-key');
    if (explicitIdempotencyKey && !isIdempotencyKeyValid(explicitIdempotencyKey)) {
        return apiError('Invalid idempotency key', 400, 'INVALID_IDEMPOTENCY_KEY');
    }
    const idempotencyKey = resolveIdempotencyKey(explicitIdempotencyKey);

    const parsed = await parseJsonBody(request, NotifyStatusSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const db = context.supabase as SupabaseClient<Database>;

    // Fetch the order with customer details
    const { data: order, error: orderError } = (await db
        .from('orders')
        .select(
            `
            id,
            order_number,
            status,
            customer_phone,
            customer_name,
            restaurant_id,
            table_sessions (
                id,
                guests (
                    id,
                    phone,
                    user_id
                )
            )
        `
        )
        .eq('id', orderIdParsed.data)
        .eq('restaurant_id', context.restaurantId)
        .maybeSingle()) as {
        data: {
            id: string;
            order_number: string;
            status: string | null;
            customer_phone: string | null;
            customer_name: string | null;
            restaurant_id: string;
            table_sessions: {
                id: string;
                guests: {
                    id: string;
                    phone: string | null;
                    user_id: string | null;
                } | null;
            } | null;
        } | null;
        error: { message: string } | null;
    };

    if (orderError) {
        return apiError('Failed to fetch order', 500, 'ORDER_FETCH_FAILED', orderError.message);
    }

    if (!order) {
        return apiError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    // Determine the phone number to notify
    let phoneToNotify = order.customer_phone;

    // If no direct customer phone, check table session guests
    if (!phoneToNotify && order.table_sessions?.guests?.phone) {
        phoneToNotify = order.table_sessions.guests.phone;
    }

    if (!phoneToNotify) {
        return apiError(
            'No customer phone number available for notification',
            400,
            'NO_CUSTOMER_PHONE'
        );
    }

    const notifyMethods = parsed.data.notify_methods ?? ['sms'];
    const results: { method: string; success: boolean; error?: string }[] = [];

    // Send SMS notification
    if (notifyMethods.includes('sms')) {
        const smsResult = await sendOrderStatusSms({
            toPhone: phoneToNotify,
            orderNumber: order.order_number,
            status: parsed.data.status,
            etaMinutes: parsed.data.eta_minutes,
        });

        results.push({
            method: 'sms',
            success: smsResult.success,
            error: smsResult.error,
        });

        // Log to notification_logs if available
        try {
            await db.from('notification_logs').insert({
                restaurant_id: context.restaurantId,
                order_id: order.id,
                type: 'order_status_sms',
                recipient: phoneToNotify,
                status: smsResult.success ? 'sent' : 'failed',
                provider: smsResult.provider,
                error_message: smsResult.error ?? null,
                metadata: {
                    order_status: parsed.data.status,
                    idempotency_key: idempotencyKey,
                },
            });
        } catch {
            // Non-critical: don't fail if logging fails
        }
    }

    // Send Push notification (if push token exists)
    if (notifyMethods.includes('push')) {
        try {
            // Check for push tokens for this customer
            const { data: pushTokens } = await db
                .from('push_tokens')
                .select('token')
                .eq('phone', phoneToNotify)
                .eq('is_active', true);

            if (pushTokens && pushTokens.length > 0) {
                // Import push notification service
                const { sendBatchPushNotifications } = await import('@/lib/notifications/push');

                // Send to all registered devices
                const pushResults = await sendBatchPushNotifications(
                    pushTokens.map((t: { token: string }) => ({
                        token: t.token,
                        title: `Order #${order.order_number} Update`,
                        body: `Your order status is now: ${parsed.data.status}`,
                        data: {
                            order_id: order.id,
                            order_number: order.order_number,
                            status: parsed.data.status,
                            type: 'order_status_update',
                        },
                    }))
                );

                const anySuccess = pushResults.some(r => r.success);
                const errors = pushResults
                    .filter(r => !r.success)
                    .map(r => r.error)
                    .filter(Boolean);

                results.push({
                    method: 'push',
                    success: anySuccess,
                    error: errors.length > 0 ? errors.join('; ') : undefined,
                });
            } else {
                results.push({
                    method: 'push',
                    success: false,
                    error: 'No push tokens registered for this customer',
                });
            }
        } catch (pushError) {
            results.push({
                method: 'push',
                success: false,
                error: pushError instanceof Error ? pushError.message : 'Push notification failed',
            });
        }
    }

    // Update order status if provided
    if (parsed.data.status && order.status !== parsed.data.status) {
        await db
            .from('orders')
            .update({
                status: parsed.data.status,
                updated_at: new Date().toISOString(),
            })
            .eq('id', order.id);
    }

    // Write audit log
    await writeAuditLog(context.supabase as SupabaseClient<Database>, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'order_status_notification_sent',
        entity_type: 'order',
        entity_id: order.id,
        new_value: {
            status: parsed.data.status,
            notify_methods: notifyMethods,
            results,
        },
        metadata: {
            customer_phone: phoneToNotify.slice(-4).padStart(phoneToNotify.length, '*'), // Masked
            idempotency_key: idempotencyKey,
        },
    });

    const allSuccess = results.every(r => r.success);

    return apiSuccess(
        {
            order_id: order.id,
            order_number: order.order_number,
            notifications: results,
            all_success: allSuccess,
            idempotency_key: idempotencyKey,
        },
        allSuccess ? 200 : 207 // 207 Multi-Status if partial failure
    );
}

// Helper function to parse JSON body with Zod validation
async function parseJsonBody<T extends z.ZodTypeAny>(
    request: Request,
    schema: T
): Promise<{ success: true; data: z.infer<T> } | { success: false; response: Response }> {
    try {
        const body = await request.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            return {
                success: false,
                response: apiError(
                    'Invalid request body',
                    400,
                    'VALIDATION_ERROR',
                    parsed.error.flatten()
                ),
            };
        }
        return { success: true, data: parsed.data };
    } catch {
        return {
            success: false,
            response: apiError('Invalid JSON body', 400, 'INVALID_JSON'),
        };
    }
}
