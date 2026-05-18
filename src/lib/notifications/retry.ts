/**
 * SMS Retry Logic with Exponential Backoff
 *
 * Provides reliable SMS delivery with retry capability using exponential backoff
 * and jitter to prevent thundering herd problems.
 *
 * Configuration:
 * - Default max retries: 3
 * - Base delay: 60 seconds (1 minute)
 * - Exponential backoff multiplier: 2x
 * - Max delay: 3600 seconds (1 hour)
 * - Jitter: ±10%
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { sendSms, type SmsSendResult } from './sms';
import { logger } from '@/lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

const log = logger.child('[retry]');

// =========================================================
// Retry Configuration
// =========================================================

export const RETRY_CONFIG = {
    /** Default maximum number of retry attempts */
    DEFAULT_MAX_RETRIES: 3,
    /** Base delay in milliseconds (60 seconds = 1 minute) */
    BASE_DELAY_MS: 60 * 1000,
    /** Exponential backoff multiplier */
    BACKOFF_MULTIPLIER: 2,
    /** Maximum delay in milliseconds (3600 seconds = 1 hour) */
    MAX_DELAY_MS: 60 * 60 * 1000,
    /** Jitter factor (±10%) */
    JITTER_FACTOR: 0.1,
} as const;

// =========================================================
// Type Definitions
// =========================================================

/**
 * Parameters for sending SMS with retry
 */
export interface SendSmsParams {
    /** Recipient phone number */
    to: string;
    /** Message content */
    message: string;
    /** Restaurant ID for tenant isolation */
    restaurantId: string;
    /** Optional notification ID for tracking */
    notificationId?: string;
    /** Idempotency key to prevent duplicate sends */
    idempotencyKey: string;
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Optional metadata for the notification */
    metadata?: Record<string, unknown>;
    /** Optional Supabase client (defaults to service role client) */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase?: SupabaseClient<any>;
}

/**
 * Result of SMS send operation with retry information
 */
export interface SmsResult {
    /** Whether the SMS was sent successfully */
    success: boolean;
    /** SMS provider used */
    provider: 'africas_talking' | 'log';
    /** Provider message ID if available */
    messageId?: string;
    /** Error message if failed */
    error?: string;
    /** Number of attempts made */
    attempts: number;
    /** Raw provider response */
    providerResponse?: unknown;
}

// =========================================================
// Retry Helper Functions
// =========================================================

/**
 * Calculate the next retry time using exponential backoff with jitter
 *
 * @param retryCount - Current retry attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @returns Date when the next retry should occur
 */
export function calculateNextRetry(retryCount: number, baseDelayMs: number): Date {
    // Calculate exponential delay: baseDelay * (multiplier ^ retryCount)
    const exponentialDelay = baseDelayMs * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, retryCount);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, RETRY_CONFIG.MAX_DELAY_MS);

    // Add jitter: ±10% to prevent thundering herd
    const jitterFactor = RETRY_CONFIG.JITTER_FACTOR;
    const jitterRange = cappedDelay * jitterFactor;
    const jitter = (Math.random() * 2 - 1) * jitterRange; // -1 to 1 times jitter range

    const nextRetryTime = new Date(Date.now() + cappedDelay + jitter);

    return nextRetryTime;
}

/**
 * Determine if a retry should be attempted based on retry count and max retries
 *
 * @param retryCount - Current retry attempt number
 * @param maxRetries - Maximum number of retries allowed
 * @returns true if another retry should be attempted
 */
export function shouldRetry(retryCount: number, maxRetries: number): boolean {
    return retryCount < maxRetries;
}

/**
 * Calculate the delay for a given retry count
 *
 * @param retryCount - Current retry attempt number
 * @param baseDelayMs - Base delay in milliseconds
 * @returns Delay in milliseconds (without jitter)
 */
export function getDelayForRetry(retryCount: number, baseDelayMs: number): number {
    const exponentialDelay = baseDelayMs * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, retryCount);
    return Math.min(exponentialDelay, RETRY_CONFIG.MAX_DELAY_MS);
}

// =========================================================
// Notification Queue Operations
// =========================================================

/**
 * Notification queue insert type
 */
interface NotificationQueueInsert {
    id?: string;
    restaurant_id: string;
    guest_phone: string;
    guest_id?: string;
    notification_type?: string;
    channel?: string;
    status?: string;
    priority?: number;
    message_en?: string;
    message_am?: string;
    retry_count?: number;
    max_retries?: number;
    next_retry_at?: string;
    sent_at?: string;
    error_message?: string;
    provider_response?: Record<string, unknown>;
    idempotency_key: string;
    metadata?: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
}

/**
 * Notification queue update type
 */
interface NotificationQueueUpdate {
    status?: string;
    priority?: number;
    retry_count?: number;
    max_retries?: number;
    next_retry_at?: string;
    sent_at?: string;
    error_message?: string;
    provider_response?: Record<string, unknown>;
    updated_at?: string;
}

/**
 * Create or update a notification queue entry
 */
async function upsertNotificationQueue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any>,
    params: {
        restaurantId: string;
        guestPhone: string;
        message: string;
        idempotencyKey: string;
        notificationId?: string;
        metadata?: Record<string, unknown>;
    },
    retryCount: number,
    errorMessage?: string,
    status: 'pending' | 'processing' | 'sent' | 'failed' = 'pending'
): Promise<{ id: string } | null> {
    const { restaurantId, guestPhone, message, idempotencyKey, notificationId, metadata } = params;

    const notificationData: NotificationQueueInsert = {
        restaurant_id: restaurantId,
        guest_phone: guestPhone,
        message_en: message,
        channel: 'sms',
        notification_type: 'order_status',
        status,
        idempotency_key: idempotencyKey,
        retry_count: retryCount,
        max_retries: RETRY_CONFIG.DEFAULT_MAX_RETRIES,
        metadata: metadata ?? {},
    };

    if (errorMessage) {
        notificationData.error_message = errorMessage;
    }

    if (notificationId) {
        notificationData.id = notificationId;
    }

    // Check if notification exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
        .from('notification_queue')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

    if (existing) {
        // Update existing record
        const updateData: NotificationQueueUpdate = {
            status,
            retry_count: retryCount,
            error_message: errorMessage,
            provider_response: metadata ?? {},
        };

        if (status === 'pending' && shouldRetry(retryCount, RETRY_CONFIG.DEFAULT_MAX_RETRIES)) {
            updateData.next_retry_at = calculateNextRetry(
                retryCount,
                RETRY_CONFIG.BASE_DELAY_MS
            ).toISOString();
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .from('notification_queue')
            .update(updateData)
            .eq('id', existing.id)
            .select('id')
            .single();

        if (error) {
            log.error('Failed to update notification queue', error);
            return null;
        }

        return data;
    }

    // Insert new record
    if (status === 'pending' && shouldRetry(retryCount, RETRY_CONFIG.DEFAULT_MAX_RETRIES)) {
        notificationData.next_retry_at = calculateNextRetry(
            retryCount,
            RETRY_CONFIG.BASE_DELAY_MS
        ).toISOString();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from('notification_queue')
        .insert(notificationData)
        .select('id')
        .single();

    if (error) {
        log.error('Failed to insert notification queue', error);
        return null;
    }

    return data;
}

/**
 * Mark a notification as sent successfully
 */
async function markNotificationSent(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any>,
    idempotencyKey: string,
    providerResponse?: unknown
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
        .from('notification_queue')
        .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_response: providerResponse ?? {},
        })
        .eq('idempotency_key', idempotencyKey);

    if (error) {
        log.error('Failed to mark notification as sent', error);
    }
}

/**
 * Mark a notification as permanently failed
 */
async function markNotificationFailed(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any>,
    idempotencyKey: string,
    errorMessage: string
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
        .from('notification_queue')
        .update({
            status: 'failed',
            error_message: errorMessage,
        })
        .eq('idempotency_key', idempotencyKey);

    if (error) {
        log.error('Failed to mark notification as failed', error);
    }
}

// =========================================================
// Main SMS Retry Function
// =========================================================

/**
 * Send an SMS with automatic retry on failure using exponential backoff
 *
 * @param params - SMS send parameters including retry configuration
 * @returns Promise<SmsResult> - Result of the SMS operation
 */
export async function sendSmsWithRetry(params: SendSmsParams): Promise<SmsResult> {
    const {
        to,
        message,
        restaurantId,
        idempotencyKey,
        maxRetries = RETRY_CONFIG.DEFAULT_MAX_RETRIES,
        metadata,
        supabase: providedSupabase,
    } = params;

    // Use provided Supabase client or create service role client
    const supabase = providedSupabase ?? createServiceRoleClient();

    let attempts = 0;
    let lastError: string | undefined;

    // Attempt to send with retries
    while (attempts <= maxRetries) {
        attempts++;

        // Mark as processing in queue
        await upsertNotificationQueue(
            supabase,
            {
                restaurantId,
                guestPhone: to,
                message,
                idempotencyKey,
                metadata,
            },
            attempts - 1,
            undefined,
            'processing'
        );

        try {
            // Attempt to send SMS
            const smsResult: SmsSendResult = await sendSms(to, message);

            if (smsResult.success) {
                // Success - mark notification as sent
                await markNotificationSent(supabase, idempotencyKey, {
                    provider: smsResult.provider,
                    attempts,
                });

                return {
                    success: true,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    provider: (smsResult.provider as any) || 'log',
                    attempts,
                    providerResponse: smsResult,
                };
            }

// SMS failed - record error
         lastError = smsResult.error ?? 'Unknown SMS error';

         log.error(`SMS attempt ${attempts} failed: ${lastError}`);

            // Check if we should retry
            if (shouldRetry(attempts, maxRetries)) {
                // Update queue with next retry time and status pending
                await upsertNotificationQueue(
                    supabase,
                    {
                        restaurantId,
                        guestPhone: to,
                        message,
                        idempotencyKey,
                        metadata: { ...metadata, last_error: lastError },
                    },
                    attempts,
                    lastError,
                    'pending'
                );

                // Wait for the next attempt (simple sleep for inline retry,
                // normally handled by background worker for true scalability)
                const delay = getDelayForRetry(attempts - 1, RETRY_CONFIG.BASE_DELAY_MS);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                // Max retries exhausted
                await markNotificationFailed(supabase, idempotencyKey, lastError);
            }
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
            log.error(`Unexpected error during SMS attempt ${attempts}`, error, { lastError });

            if (shouldRetry(attempts, maxRetries)) {
                await upsertNotificationQueue(
                    supabase,
                    {
                        restaurantId,
                        guestPhone: to,
                        message,
                        idempotencyKey,
                        metadata: { ...metadata, last_error: lastError },
                    },
                    attempts,
                    lastError,
                    'pending'
                );

                const delay = getDelayForRetry(attempts - 1, RETRY_CONFIG.BASE_DELAY_MS);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                await markNotificationFailed(supabase, idempotencyKey, lastError);
            }
        }
    }

    // Should not reach here, but handle edge case
    return {
        success: false,
        provider: 'log',
        error: lastError ?? 'Max retries exceeded',
        attempts,
    };
}

// =========================================================
// Queue Processing Functions
// =========================================================

/**
 * Process pending notifications from the queue
 * This would typically be called by a cron job or worker
 *
 * @param limit - Maximum number of notifications to process
 * @returns Number of notifications processed
 */
export async function processPendingNotifications(limit: number = 100): Promise<number> {
    const supabase = createServiceRoleClient();
    const now = new Date().toISOString();

    // Get pending notifications that are due for retry
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
        return 0;
    }

    let processed = 0;

    for (const notification of pending ?? []) {
        const result = await sendSmsWithRetry({
            to: notification.guest_phone,
            message: notification.message_en ?? '',
            restaurantId: notification.restaurant_id,
            idempotencyKey: notification.idempotency_key,
            notificationId: notification.id,
            metadata: notification.metadata as Record<string, unknown>,
            supabase,
        });

        if (result.success) {
            processed++;
        }
    }

    return processed;
}
