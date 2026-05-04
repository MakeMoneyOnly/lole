import { randomUUID } from 'crypto';
import { z } from 'zod';

// =========================================================
// Zod Event Schemas (BKND-039)
// =========================================================

const uuidPattern = z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

const PaymentLifecycleEventPayloadSchema = z.object({
    restaurant_id: uuidPattern,
    order_id: uuidPattern.nullable(),
    payment_id: uuidPattern.nullable(),
    payment_session_id: uuidPattern.nullable().optional(),
    provider: z.literal('chapa'),
    provider_transaction_id: z.string().min(1),
    idempotency_key: z.string().min(1),
    status: z.enum(['completed', 'failed']),
    amount: z.number().nullable(),
    currency: z.string().nullable(),
    metadata: z.object({}).passthrough(),
    raw_payload: z.object({}).passthrough(),
});

const NotificationQueuedPayloadSchema = z.object({
    notification_id: uuidPattern,
    restaurant_id: uuidPattern,
    guest_phone: z.string().min(1),
    notification_type: z.string().min(1),
    channel: z.enum(['sms', 'push', 'email']),
    priority: z.number().int(),
    message_en: z.string().optional(),
    message_am: z.string().optional(),
    idempotency_key: z.string().min(1),
});

const GenericPayloadSchema = z
    .object({
        restaurant_id: z.string().optional(),
        order_id: z.string().optional(),
    })
    .passthrough();

/**
 * BKND-039: Validates an event payload against its expected schema.
 * Returns true if valid, false otherwise.
 */
export function validateEventSchema(event: loleEvent): boolean {
    try {
        switch (event.name) {
            case 'payment.completed':
            case 'payment.failed':
                PaymentLifecycleEventPayloadSchema.parse(event.payload);
                return true;
            case 'notification.queued':
                NotificationQueuedPayloadSchema.parse(event.payload);
                return true;
            case 'notification.sent':
            case 'notification.failed':
            case 'notification.retry_scheduled':
                // Reuse queued schema fields (subset valid)
                GenericPayloadSchema.parse(event.payload);
                return true;
            default:
                // Generic validation for undocumented event types
                GenericPayloadSchema.parse(event.payload);
                return true;
        }
    } catch {
        return false;
    }
}

// =========================================================
// Notification Event Types
// =========================================================

export type NotificationEventName =
    | 'notification.queued'
    | 'notification.sent'
    | 'notification.failed'
    | 'notification.retry_scheduled';

export type NotificationEventStatus = 'queued' | 'sent' | 'failed' | 'retry_scheduled';

export interface NotificationQueuedPayload {
    notification_id: string;
    restaurant_id: string;
    guest_phone: string;
    notification_type: string;
    channel: 'sms' | 'push' | 'email';
    priority: number;
    message_en?: string;
    message_am?: string;
    idempotency_key: string;
}

export interface NotificationSentPayload {
    notification_id: string;
    restaurant_id: string;
    guest_phone: string;
    notification_type: string;
    channel: 'sms' | 'push' | 'email';
    sent_at: string;
    provider?: string;
    provider_message_id?: string;
}

export interface NotificationFailedPayload {
    notification_id: string;
    restaurant_id: string;
    guest_phone: string;
    notification_type: string;
    channel: 'sms' | 'push' | 'email';
    error_message: string;
    retry_count: number;
    max_retries: number;
}

export interface NotificationRetryScheduledPayload {
    notification_id: string;
    restaurant_id: string;
    guest_phone: string;
    notification_type: string;
    channel: 'sms' | 'push' | 'email';
    retry_count: number;
    next_retry_at: string;
}

export type NotificationLifecycleEvent = loleEvent<
    NotificationEventName,
    | NotificationQueuedPayload
    | NotificationSentPayload
    | NotificationFailedPayload
    | NotificationRetryScheduledPayload
>;

export type loleEventName =
    | 'order.created'
    | 'order.status_changed'
    | 'order.completed'
    | 'order.cancelled'
    | 'payment.completed'
    | 'payment.failed'
    | 'menu.updated'
    | 'table.waitlist.notify'
    | 'reservation.reminder'
    | 'notification.queued'
    | 'notification.sent'
    | 'notification.failed'
    | 'notification.retry_scheduled';

export type PaymentEventStatus = 'completed' | 'failed';

export interface PaymentLifecycleEventPayload {
    restaurant_id: string;
    order_id: string | null;
    payment_id: string | null;
    payment_session_id?: string | null;
    provider: 'chapa';
    provider_transaction_id: string;
    idempotency_key: string;
    status: PaymentEventStatus;
    amount: number | null;
    currency: string | null;
    metadata: Record<string, unknown>;
    raw_payload: Record<string, unknown>;
}

export interface loleEvent<TName extends loleEventName = loleEventName, TPayload = unknown> {
    id: string;
    version: 1;
    name: TName;
    occurred_at: string;
    trace_id: string;
    payload: TPayload;
}

export type PaymentLifecycleEvent = loleEvent<
    'payment.completed' | 'payment.failed',
    PaymentLifecycleEventPayload
>;

export function createloleEvent<TName extends loleEventName, TPayload>(
    name: TName,
    payload: TPayload
): loleEvent<TName, TPayload> {
    return {
        id: randomUUID(),
        version: 1,
        name,
        occurred_at: new Date().toISOString(),
        trace_id: randomUUID(),
        payload,
    };
}

export function createPaymentLifecycleEvent(
    status: PaymentEventStatus,
    payload: PaymentLifecycleEventPayload
): PaymentLifecycleEvent {
    return createloleEvent(
        status === 'completed' ? 'payment.completed' : 'payment.failed',
        payload
    );
}

// =========================================================
// Notification Event Factory Functions
// =========================================================

export function createNotificationQueuedEvent(
    payload: NotificationQueuedPayload
): loleEvent<'notification.queued', NotificationQueuedPayload> {
    return createloleEvent('notification.queued', payload);
}

export function createNotificationSentEvent(
    payload: NotificationSentPayload
): loleEvent<'notification.sent', NotificationSentPayload> {
    return createloleEvent('notification.sent', payload);
}

export function createNotificationFailedEvent(
    payload: NotificationFailedPayload
): loleEvent<'notification.failed', NotificationFailedPayload> {
    return createloleEvent('notification.failed', payload);
}

export function createNotificationRetryScheduledEvent(
    payload: NotificationRetryScheduledPayload
): loleEvent<'notification.retry_scheduled', NotificationRetryScheduledPayload> {
    return createloleEvent('notification.retry_scheduled', payload);
}
