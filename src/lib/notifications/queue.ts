/**
 * Notification Queue Service
 *
 * Manages the notification queue for reliable async processing of SMS, push, and email notifications.
 * Provides enqueue, process, retry, and cancel operations.
 *
 * Features:
 * - Priority-based ordering (higher = process first)
 * - Idempotency support via unique keys
 * - Integration with deduplication service
 * - Event publishing on status changes
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { sendSms, type SmsSendResult } from './sms';
import { isDuplicate, recordNotification, type NotificationType } from './deduplication';
import { calculateNextRetry, shouldRetry, RETRY_CONFIG } from './retry';
import { publishEvent, type EventType, type EventPayload } from '@/lib/events/publisher';
import { createHash } from 'crypto';
import { logger } from '@/lib/logger';

const log = logger.child('[queue]');

// =========================================================
// Types and Interfaces
// =========================================================

/** Notification channel types */
export type NotificationChannel = 'sms' | 'push' | 'email';

/** Notification type from task requirements */
export type QueueNotificationType = 'order_status' | 'waitlist' | 'promotion' | 'reservation';

/** Parameters for enqueueing a notification */
export interface EnqueueParams {
    /** Restaurant ID for tenant isolation */
    restaurantId: string;
    /** Guest phone number */
    guestPhone: string;
    /** Optional guest ID */
    guestId?: string;
    /** Type of notification */
    notificationType: QueueNotificationType;
    /** Delivery channel */
    channel: NotificationChannel;
    /** Message in Amharic */
    messageAm: string;
    /** Message in English */
    messageEn: string;
    /** Priority (higher = process first, default: 0) */
    priority?: number;
    /** Relevant ID (order_id, waitlist_id, etc.) */
    relevantId?: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}

/** Result of queue processing */
export interface ProcessResult {
    /** Number of notifications processed */
    processed: number;
    /** Number of successful sends */
    sent: number;
    /** Number of failed sends */
    failed: number;
    /** Number of scheduled retries */
    retried: number;
    /** Errors encountered */
    errors: Array<{
        notificationId: string;
        error: string;
    }>;
}

/** Queue notification row from database */
interface NotificationQueueRow {
    id: string;
    restaurant_id: string;
    guest_id: string | null;
    guest_phone: string;
    notification_type: string;
    channel: string;
    status: string;
    priority: number;
    message_am: string | null;
    message_en: string | null;
    retry_count: number;
    max_retries: number;
    next_retry_at: string | null;
    sent_at: string | null;
    error_message: string | null;
    provider_response: Record<string, unknown> | null;
    idempotency_key: string;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

// =========================================================
// Queue Service Implementation
// =========================================================

/**
 * Generate an idempotency key for a notification
 *
 * @param restaurantId - Restaurant ID
 * @param guestPhone - Guest phone number
 * @param notificationType - Type of notification
 * @param relevantId - Optional relevant ID
 * @returns Unique idempotency key
 */
function generateIdempotencyKey(
    restaurantId: string,
    guestPhone: string,
    notificationType: string,
    relevantId?: string
): string {
    const keyData = `${restaurantId}:${guestPhone}:${notificationType}:${relevantId || 'general'}`;
    return createHash('sha256').update(keyData).digest('hex').slice(0, 32);
}

/**
 * Enqueue a notification for async processing
 *
 * @param params - Enqueue parameters
 * @returns Promise<string> - Notification ID
 * @throws Error if notification is a duplicate
 */
export async function enqueueNotification(params: EnqueueParams): Promise<string> {
    const {
        restaurantId,
        guestPhone,
        guestId,
        notificationType,
        channel,
        messageAm,
        messageEn,
        priority = 0,
        relevantId,
        metadata = {},
    } = params;

    const supabase = createServiceRoleClient();

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(
        restaurantId,
        guestPhone,
        notificationType,
        relevantId
    );

    // Check for duplicates using deduplication service
    const isDuplicateResult = await isDuplicate({
        guestPhone,
        notificationType: notificationType as NotificationType,
        relevantId,
        message: messageEn,
    });

    if (isDuplicateResult) {
        log.warn('Notification is duplicate, skipping', {
            restaurantId,
            guestPhone,
            notificationType,
            relevantId,
        });
        throw new Error('DUPLICATE_NOTIFICATION');
    }

    // Insert into notification queue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from('notification_queue')
        .insert({
            restaurant_id: restaurantId,
            guest_id: guestId || null,
            guest_phone: guestPhone,
            notification_type: notificationType,
            channel: channel,
            status: 'pending',
            priority: priority,
            message_am: messageAm,
            message_en: messageEn,
            retry_count: 0,
            max_retries: RETRY_CONFIG.DEFAULT_MAX_RETRIES,
            idempotency_key: idempotencyKey,
            metadata: {
                ...metadata,
                relevant_id: relevantId,
            },
        })
        .select('id')
        .single();

    if (error) {
        log.error('Failed to enqueue notification', error);
        throw new Error(`FAILED_TO_ENQUEUE: ${error.message}`);
    }

    const notificationId = data.id;

    // Record for deduplication
    await recordNotification({
        guestPhone,
        notificationType: notificationType as NotificationType,
        relevantId,
        message: messageEn,
    });

    // Publish notification.queued event
    await publishNotificationEvent('notification.queued', {
        notification_id: notificationId,
        restaurant_id: restaurantId,
        guest_phone: guestPhone,
        notification_type: notificationType,
        channel: channel,
        priority: priority,
        message_en: messageEn,
        message_am: messageAm,
        idempotency_key: idempotencyKey,
    });

    log.info('Notification enqueued', {
        notificationId,
        restaurantId,
        guestPhone,
        notificationType,
        channel,
    });

    return notificationId;
}

/**
 * Process pending notifications from the queue
 *
 * @param limit - Maximum number of notifications to process
 * @returns Promise<ProcessResult>
 */
export async function processQueue(limit: number = 50): Promise<ProcessResult> {
    const supabase = createServiceRoleClient();
    const now = new Date().toISOString();

    // Fetch pending notifications that are due for processing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pending, error } = await (supabase as any)
        .from('notification_queue')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, guest_id, guest_phone, notification_type, channel, status, priority, message_am, message_en, retry_count, max_retries, next_retry_at, sent_at, error_message, provider_response, idempotency_key, metadata, created_at, updated_at'
        )
        .eq('status', 'pending')
        .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
        .lte('retry_count', RETRY_CONFIG.DEFAULT_MAX_RETRIES)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(limit);

    if (error) {
        log.error('Failed to fetch pending notifications', error);
        return {
            processed: 0,
            sent: 0,
            failed: 0,
            retried: 0,
            errors: [{ notificationId: 'unknown', error: error.message }],
        };
    }

    const result: ProcessResult = {
        processed: 0,
        sent: 0,
        failed: 0,
        retried: 0,
        errors: [],
    };

    for (const notification of pending ?? []) {
        const row = notification as unknown as NotificationQueueRow;
        const processResult = await processNotification(supabase, row);

        result.processed++;

        if (processResult.success) {
            result.sent++;
        } else if (processResult.retryScheduled) {
            result.retried++;
        } else {
            result.failed++;
            result.errors.push({
                notificationId: row.id,
                error: processResult.error || 'Unknown error',
            });
        }
    }

    log.info('Queue processed', result as unknown as Record<string, unknown>);
    return result;
}

/**
 * Process a single notification
 *
 * @param supabase - Supabase client
 * @param notification - Notification row
 * @returns Processing result
 */
async function processNotification(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    notification: NotificationQueueRow
): Promise<{
    success: boolean;
    retryScheduled: boolean;
    error?: string;
}> {
    const { id, guest_phone, message_en, channel, restaurant_id, retry_count } = notification;

    try {
        // Mark as processing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
            .from('notification_queue')
            .update({
                status: 'processing',
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);

        // Send based on channel
        let sendResult: SmsSendResult;

        if (channel === 'sms') {
            sendResult = await sendSms(guest_phone, message_en || '');
        } else if (channel === 'push') {
            // Push notification - placeholder
            log.warn('Push notification not implemented yet');
            sendResult = { success: true, provider: 'log', skipped: true };
        } else if (channel === 'email') {
            // Email notification - placeholder
            log.warn('Email notification not implemented yet');
            sendResult = { success: true, provider: 'log', skipped: true };
        } else {
            throw new Error(`Unsupported channel: ${channel}`);
        }

        if (sendResult.success) {
            // Mark as sent
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
                .from('notification_queue')
                .update({
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    provider_response: {
                        provider: sendResult.provider,
                    },
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id);

            // Publish notification.sent event
            await publishNotificationEvent('notification.sent', {
                notification_id: id,
                restaurant_id: restaurant_id,
                guest_phone: guest_phone,
                notification_type: notification.notification_type,
                channel: notification.channel as 'sms' | 'push' | 'email',
                sent_at: new Date().toISOString(),
                provider: sendResult.provider,
            });

            return { success: true, retryScheduled: false };
        }

        // Send failed - schedule retry or mark as failed
        const newRetryCount = retry_count + 1;

        if (shouldRetry(newRetryCount, notification.max_retries)) {
            const nextRetryAt = calculateNextRetry(
                newRetryCount,
                RETRY_CONFIG.BASE_DELAY_MS
            ).toISOString();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
                .from('notification_queue')
                .update({
                    status: 'pending',
                    retry_count: newRetryCount,
                    next_retry_at: nextRetryAt,
                    error_message: sendResult.error,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id);

            // Publish notification.retry_scheduled event
            await publishNotificationEvent('notification.retry_scheduled', {
                notification_id: id,
                restaurant_id: restaurant_id,
                guest_phone: guest_phone,
                notification_type: notification.notification_type,
                channel: notification.channel as 'sms' | 'push' | 'email',
                retry_count: newRetryCount,
                next_retry_at: nextRetryAt,
            });

            return { success: false, retryScheduled: true };
        }

        // Max retries exceeded
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
            .from('notification_queue')
            .update({
                status: 'failed',
                error_message: sendResult.error || 'Max retries exceeded',
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);

        // Publish notification.failed event
        await publishNotificationEvent('notification.failed', {
            notification_id: id,
            restaurant_id: restaurant_id,
            guest_phone: guest_phone,
            notification_type: notification.notification_type,
            channel: notification.channel as 'sms' | 'push' | 'email',
            error_message: sendResult.error || 'Max retries exceeded',
            retry_count: newRetryCount,
            max_retries: notification.max_retries,
        });

        return { success: false, retryScheduled: false, error: sendResult.error };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('Error processing notification', error);

        // Mark as failed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
            .from('notification_queue')
            .update({
                status: 'failed',
                error_message: errorMessage,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id);

        // Publish notification.failed event
        await publishNotificationEvent('notification.failed', {
            notification_id: id,
            restaurant_id: restaurant_id,
            guest_phone: guest_phone,
            notification_type: notification.notification_type,
            channel: notification.channel as 'sms' | 'push' | 'email',
            error_message: errorMessage,
            retry_count: retry_count + 1,
            max_retries: notification.max_retries,
        });

        return { success: false, retryScheduled: false, error: errorMessage };
    }
}

/**
 * Schedule a retry for a specific notification
 *
 * @param notificationId - Notification ID
 * @param delayMs - Delay in milliseconds
 * @returns Promise<void>
 */
export async function scheduleRetry(notificationId: string, delayMs: number): Promise<void> {
    const supabase = createServiceRoleClient();
    const nextRetryAt = new Date(Date.now() + delayMs).toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
        .from('notification_queue')
        .update({
            status: 'pending',
            next_retry_at: nextRetryAt,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            retry_count: (supabase as any).rpc('increment_retry_count', {
                notification_id: notificationId,
            }),
            updated_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .eq('status', 'failed');

    if (error) {
        log.error('Failed to schedule retry', error);
        throw new Error(`FAILED_TO_SCHEDULE_RETRY: ${error.message}`);
    }

    // Fetch notification details for event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: notification } = await (supabase as any)
        .from('notification_queue')
        .select('restaurant_id, guest_phone, notification_type, channel, retry_count')
        .eq('id', notificationId)
        .single();

    if (notification) {
        await publishNotificationEvent('notification.retry_scheduled', {
            notification_id: notificationId,
            restaurant_id: notification.restaurant_id,
            guest_phone: notification.guest_phone,
            notification_type: notification.notification_type,
            channel: notification.channel as 'sms' | 'push' | 'email',
            retry_count: (notification.retry_count || 0) + 1,
            next_retry_at: nextRetryAt,
        });
    }
}

/**
 * Cancel a pending notification
 *
 * @param notificationId - Notification ID
 * @returns Promise<void>
 */
export async function cancelNotification(notificationId: string): Promise<void> {
    const supabase = createServiceRoleClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
        .from('notification_queue')
        .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .eq('status', 'pending');

    if (error) {
        log.error('Failed to cancel notification', error);
        throw new Error(`FAILED_TO_CANCEL: ${error.message}`);
    }

    log.info('Notification cancelled', { notificationId });
}

/**
 * Get queue statistics
 *
 * @param restaurantId - Optional restaurant ID filter
 * @returns Queue statistics
 */
export async function getQueueStats(restaurantId?: string): Promise<{
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    cancelled: number;
}> {
    const supabase = createServiceRoleClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
        .from('notification_queue')
        .select('status', { count: 'exact', head: true });

    if (restaurantId) {
        query = query.eq('restaurant_id', restaurantId);
    }

    const { count: _count, error } = await query;

    if (error) {
        log.error('Failed to get queue stats', error);
        return {
            pending: 0,
            processing: 0,
            sent: 0,
            failed: 0,
            cancelled: 0,
        };
    }

    // Get counts by status
    const [pending, processing, sent, failed, cancelled] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
            .from('notification_queue')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .then((r: any) => r.count || 0),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
            .from('notification_queue')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'processing')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .then((r: any) => r.count || 0),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
            .from('notification_queue')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'sent')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .then((r: any) => r.count || 0),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
            .from('notification_queue')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'failed')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .then((r: any) => r.count || 0),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
            .from('notification_queue')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'cancelled')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .then((r: any) => r.count || 0),
    ]);

    return { pending, processing, sent, failed, cancelled };
}

// =========================================================
// Helper Functions
// =========================================================

/**
 * Publish a notification event to the event bus
 *
 * @param eventName - Event name
 * @param payload - Event payload
 */
async function publishNotificationEvent(
    eventName: EventType,
    payload: EventPayload
): Promise<void> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await publishEvent(eventName as any, payload);
    } catch (error) {
        log.error('Failed to publish event', error);
        // Don't throw - event publishing failure shouldn't fail the notification
    }
}
