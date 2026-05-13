import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { sendOrderStatusSms } from '@/lib/notifications/sms';

const GuestOrderStatusSchema = z.object({
    eventType: z.string(),
    details: z.object({
        orderGuid: z.string().uuid(),
        guestOrderStatus: z.enum(['IN_PREPARATION', 'READY_FOR_PICKUP', 'CLOSED', 'VOIDED']),
        lastUpdated: z.string().datetime().optional(),
    }),
});

function verifySharedSecret(headerValue: string | null, expectedSecret: string): boolean {
    if (!headerValue) return false;

    const expected = Buffer.from(expectedSecret, 'utf8');
    const received = Buffer.from(headerValue, 'utf8');
    if (expected.length !== received.length) return false;

    try {
        return timingSafeEqual(expected, received);
    } catch {
        return expectedSecret === headerValue;
    }
}

function mapGuestOrderStatusToInternalStatus(guestOrderStatus: string) {
    if (guestOrderStatus === 'IN_PREPARATION') return 'preparing';
    if (guestOrderStatus === 'READY_FOR_PICKUP') return 'ready';
    if (guestOrderStatus === 'CLOSED') return 'served';
    return 'cancelled';
}

export async function POST(request: Request) {
    const configuredSecret = process.env.GUEST_ORDER_STATUS_WEBHOOK_SECRET;
    if (configuredSecret) {
        const headerSecret =
            request.headers.get('x-webhook-secret') ??
            request.headers.get('x-guest-webhook-secret');
        if (!verifySharedSecret(headerSecret, configuredSecret)) {
            return apiError('Invalid webhook secret', 401, 'INVALID_WEBHOOK_SECRET');
        }
    }

    const body = await request.json().catch(() => null);
    const parsed = GuestOrderStatusSchema.safeParse(body);
    if (!parsed.success) {
        return apiError('Invalid webhook payload', 400, 'INVALID_PAYLOAD', parsed.error.flatten());
    }

    if (parsed.data.eventType !== 'guestOrderStatusUpdated') {
        return apiError('Unsupported eventType', 400, 'UNSUPPORTED_EVENT_TYPE');
    }

    const admin = createServiceRoleClient();
    const orderId = parsed.data.details.orderGuid;
    const guestOrderStatus = parsed.data.details.guestOrderStatus;
    const mappedStatus = mapGuestOrderStatusToInternalStatus(guestOrderStatus);

    const { data: existingOrder, error: orderFetchError } = await admin
        .from('orders')
        .select('id, restaurant_id, status, customer_phone, order_number')
        .eq('id', orderId)
        .maybeSingle();

    if (orderFetchError) {
        return apiError(
            'Failed to resolve order',
            500,
            'ORDER_LOOKUP_FAILED',
            orderFetchError.message
        );
    }
    if (!existingOrder) {
        return apiError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    if (existingOrder.status === mappedStatus) {
        return apiSuccess({
            accepted: true,
            updated: false,
            order_id: existingOrder.id,
            status: existingOrder.status,
        });
    }

    const { error: updateError } = await admin
        .from('orders')
        .update({
            status: mappedStatus,
            updated_at: new Date().toISOString(),
        })
        .eq('id', existingOrder.id);

    if (updateError) {
        return apiError('Failed to update order', 500, 'ORDER_UPDATE_FAILED', updateError.message);
    }

    const { data: restaurantSettings } = await admin
        .from('restaurants')
        .select('settings')
        .eq('id', existingOrder.restaurant_id)
        .maybeSingle();
    const notificationsSettings = (restaurantSettings?.settings as Record<string, unknown> | null)
        ?.notifications as Record<string, unknown> | undefined;
    const smsEnabled = Boolean(notificationsSettings?.sms_enabled);

    const smsPromise =
        smsEnabled && existingOrder.customer_phone
            ? sendOrderStatusSms({
                  toPhone: existingOrder.customer_phone,
                  orderNumber: existingOrder.order_number ?? existingOrder.id,
                  status: mappedStatus,
              })
            : Promise.resolve({ success: false, provider: 'log' as const, skipped: true });

    await Promise.all([
        admin.from('order_events').insert({
            restaurant_id: existingOrder.restaurant_id,
            order_id: existingOrder.id,
            event_type: 'status_changed',
            from_status: existingOrder.status,
            to_status: mappedStatus,
            actor_user_id: null,
            metadata: {
                source: 'guest_order_status_webhook',
                guest_order_status: guestOrderStatus,
                webhook_last_updated: parsed.data.details.lastUpdated ?? null,
            },
        }),
        admin.from('audit_logs').insert({
            restaurant_id: existingOrder.restaurant_id,
            action: 'guest_order_status_webhook_received',
            entity_type: 'order',
            entity_id: existingOrder.id,
            metadata: {
                guest_order_status: guestOrderStatus,
                mapped_status: mappedStatus,
            },
            old_value: { status: existingOrder.status },
            new_value: { status: mappedStatus },
        }),
        smsPromise,
    ]);

    return apiSuccess({
        accepted: true,
        updated: true,
        order_id: existingOrder.id,
        previous_status: existingOrder.status,
        status: mappedStatus,
    });
}
