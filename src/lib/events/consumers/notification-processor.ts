/**
 * Notification Processor Consumer
 *
 * CRIT-11: Event consumer that processes notification-related events.
 * Listens to events that trigger notifications and enqueues them for delivery.
 *
 * Events handled:
 * - order.status_changed: Send order status update to guest
 * - table.waitlist.notify: Send waitlist notification to guest
 * - reservation.reminder: Send reservation reminder
 */

import type { loleEvent } from '@/lib/events/contracts';
import { enqueueNotification } from '@/lib/notifications/queue';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { writeAuditLog } from '@/lib/api/audit';
import { logger } from '@/lib/logger';

const log = logger.child('[events/notification-processor]');

// =========================================================
// Event Payload Types
// =========================================================

/**
 * Order status changed event payload
 */
interface OrderStatusChangedPayload {
    restaurant_id: string;
    order_id: string;
    order_number: string;
    guest_phone?: string | null;
    guest_id?: string | null;
    status: 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
    eta_minutes?: number;
}

/**
 * Table waitlist notification event payload
 */
interface WaitlistNotifyPayload {
    restaurant_id: string;
    waitlist_id: string;
    guest_name: string;
    guest_phone: string;
    table_number?: string;
    estimated_wait_minutes: number;
}

/**
 * Reservation reminder event payload
 */
interface ReservationReminderPayload {
    restaurant_id: string;
    reservation_id: string;
    guest_name: string;
    guest_phone: string;
    reservation_time: string;
    party_size: number;
}

// =========================================================
// Message Templates
// =========================================================

/**
 * Order status messages (English)
 */
const ORDER_STATUS_MESSAGES_EN: Record<string, string> = {
    preparing: 'Your order #{orderNumber} is now being prepared. ETA: {eta} minutes.',
    ready: 'Your order #{orderNumber} is ready for pickup!',
    served: 'Your order #{orderNumber} has been served. Enjoy your meal!',
    completed: 'Thank you for dining with us! Order #{orderNumber} is complete.',
    cancelled: 'Your order #{orderNumber} has been cancelled.',
};

/**
 * Order status messages (Amharic)
 */
const ORDER_STATUS_MESSAGES_AM: Record<string, string> = {
    preparing: 'ትዕዛዝዎ #{orderNumber} አሁን በማዘጋጀት ላይ ነው። የሚጠብቁት ጊዜ: {eta} ደቂቃ።',
    ready: 'ትዕዛዝዎ #{orderNumber} ለመውሰድ ዝግጁ ነው!',
    served: 'ትዕዛዝዎ #{orderNumber} ቀርቧል። በሚጠባበቅ ይደሰቱ!',
    completed: 'ከኛ ጋር ስለበላሙ እናመሰግናለን! ትዕዛዝ #{orderNumber} ተጠናቋል።',
    cancelled: 'ትዕዛዝዎ #{orderNumber} ተሰርዟል።',
};

/**
 * Waitlist notification messages
 */
const WAITLIST_MESSAGE_EN =
    'Great news! Your table is ready. Please proceed to the host. Expected wait was {wait} minutes.';
const WAITLIST_MESSAGE_AM = '� хорошие новости! ጠርጤ እንደገቡ ወደ ስብሰባው ይምጡ። የተጠበቀው ጊዜ {wait} ደቂቃ ነበር።';

/**
 * Reservation reminder messages
 */
const RESERVATION_MESSAGE_EN =
    'Reminder: Your reservation at lole is scheduled for {time}. Party size: {size}. See you soon!';
const RESERVATION_MESSAGE_AM = 'ማስታወሻ: በገበታ የተያዘው ስብሰባዎ ለ{time} ታቅዷል። ቁጥር: {size}። በቅርብ እናያለን!';

// =========================================================
// Message Building Functions
// =========================================================

/**
 * Build order status message
 */
function buildOrderStatusMessage(
    status: string,
    orderNumber: string,
    etaMinutes?: number
): { en: string; am: string } {
    const templateEn = ORDER_STATUS_MESSAGES_EN[status] || `Order #{orderNumber} status: ${status}`;
    const templateAm = ORDER_STATUS_MESSAGES_AM[status] || ORDER_STATUS_MESSAGES_AM.preparing;

    const eta = etaMinutes !== undefined ? etaMinutes : 15;
    const formattedEta = eta <= 0 ? 'less than 5' : String(eta);

    return {
        en: templateEn.replace('{orderNumber}', orderNumber).replace('{eta}', formattedEta),
        am: templateAm.replace('{orderNumber}', orderNumber).replace('{eta}', String(eta)),
    };
}

// =========================================================
// Event Handlers
// =========================================================

/**
 * Handle order status changed event
 */
async function handleOrderStatusChanged(
    event: loleEvent<'order.status_changed', OrderStatusChangedPayload>
): Promise<{ success: boolean; notificationId?: string; error?: string }> {
    const { payload } = event;

    if (!payload.guest_phone) {
        log.warn('No guest phone for order, skipping notification');
        return { success: true }; // Not an error - just no notification needed
    }

    const messages = buildOrderStatusMessage(
        payload.status,
        payload.order_number,
        payload.eta_minutes
    );

    try {
        const notificationId = await enqueueNotification({
            restaurantId: payload.restaurant_id,
            guestPhone: payload.guest_phone,
            guestId: payload.guest_id || undefined,
            notificationType: 'order_status',
            channel: 'sms',
            messageAm: messages.am,
            messageEn: messages.en,
            priority: payload.status === 'ready' ? 10 : 5,
            relevantId: payload.order_id,
            metadata: {
                event_id: event.id,
                order_id: payload.order_id,
                order_number: payload.order_number,
            },
        });

        return { success: true, notificationId };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Don't treat duplicates as errors
        if (errorMessage.includes('DUPLICATE_NOTIFICATION')) {
            return { success: true };
        }

        log.error('Failed to enqueue order notification:', error);
        return { success: false, error: errorMessage };
    }
}

/**
 * Handle waitlist notification event
 */
async function handleWaitlistNotify(
    event: loleEvent<'table.waitlist.notify', WaitlistNotifyPayload>
): Promise<{ success: boolean; notificationId?: string; error?: string }> {
    const { payload } = event;

    const messageEn = WAITLIST_MESSAGE_EN.replace('{wait}', String(payload.estimated_wait_minutes));
    const messageAm = WAITLIST_MESSAGE_AM.replace('{wait}', String(payload.estimated_wait_minutes));

    try {
        const notificationId = await enqueueNotification({
            restaurantId: payload.restaurant_id,
            guestPhone: payload.guest_phone,
            notificationType: 'waitlist',
            channel: 'sms',
            messageAm: messageAm,
            messageEn: messageEn,
            priority: 20, // High priority - guest is waiting
            relevantId: payload.waitlist_id,
            metadata: {
                event_id: event.id,
                guest_name: payload.guest_name,
                table_number: payload.table_number,
            },
        });

        return { success: true, notificationId };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes('DUPLICATE_NOTIFICATION')) {
            return { success: true };
        }

        log.error('Failed to enqueue waitlist notification:', error);
        return { success: false, error: errorMessage };
    }
}

/**
 * Handle reservation reminder event
 */
async function handleReservationReminder(
    event: loleEvent<'reservation.reminder', ReservationReminderPayload>
): Promise<{ success: boolean; notificationId?: string; error?: string }> {
    const { payload } = event;

    // Format time for message
    const reservationDate = new Date(payload.reservation_time);
    const timeStr = reservationDate.toLocaleTimeString('en-ET', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    const messageEn = RESERVATION_MESSAGE_EN.replace('{time}', timeStr).replace(
        '{size}',
        String(payload.party_size)
    );
    const messageAm = RESERVATION_MESSAGE_AM.replace('{time}', timeStr).replace(
        '{size}',
        String(payload.party_size)
    );

    try {
        const notificationId = await enqueueNotification({
            restaurantId: payload.restaurant_id,
            guestPhone: payload.guest_phone,
            notificationType: 'reservation',
            channel: 'sms',
            messageAm: messageAm,
            messageEn: messageEn,
            priority: 15, // Higher than order notifications
            relevantId: payload.reservation_id,
            metadata: {
                event_id: event.id,
                guest_name: payload.guest_name,
                party_size: payload.party_size,
            },
        });

        return { success: true, notificationId };
} catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes('DUPLICATE_NOTIFICATION')) {
            return { success: true };
        }

        log.error('Failed to enqueue reservation notification:', error);
        return { success: false, error: errorMessage };
    }
}

/**
 * Process a notification-related event
 *
 * @param event - The event to process
 * @returns Processing result
 */
export async function processNotificationEvent(event: loleEvent): Promise<{
    handled: boolean;
    success: boolean;
    notificationId?: string;
    error?: string;
}> {
    switch (event.name) {
        case 'order.status_changed': {
            const result = await handleOrderStatusChanged(
                event as loleEvent<'order.status_changed', OrderStatusChangedPayload>
            );
            return { handled: true, ...result };
        }

        case 'table.waitlist.notify': {
            const result = await handleWaitlistNotify(
                event as loleEvent<'table.waitlist.notify', WaitlistNotifyPayload>
            );
            return { handled: true, ...result };
        }

        case 'reservation.reminder': {
            const result = await handleReservationReminder(
                event as loleEvent<'reservation.reminder', ReservationReminderPayload>
            );
            return { handled: true, ...result };
        }

        default:
            return { handled: false, success: true };
    }
}

/**
 * Write audit log for notification processing
 */
async function _logNotificationProcessing(
    restaurantId: string,
    eventId: string,
    eventName: string,
    notificationId?: string,
    success?: boolean,
    error?: string
): Promise<void> {
    try {
        const supabase = createServiceRoleClient();
        await writeAuditLog(supabase, {
            restaurant_id: restaurantId,
            action: 'notification_event_processed',
            entity_type: 'notification_queue',
            entity_id: notificationId,
            metadata: {
                event_id: eventId,
                event_name: eventName,
                success,
                error,
            },
        });
    } catch (auditError) {
        log.error('Failed to write audit log:', auditError);
        // Don't fail the notification processing if audit fails
    }
}

// =========================================================
// Consumer Export
// =========================================================

export const notificationProcessorConsumer = {
    processNotificationEvent,
    handleOrderStatusChanged,
    handleWaitlistNotify,
    handleReservationReminder,
};

export default notificationProcessorConsumer;
