/**
 * Push Notification Fallback Service
 *
 * Provides fallback logic from SMS to push notifications when SMS fails.
 * This enables reliable guest notification even when SMS delivery is unreliable.
 *
 * Features:
 * - Try SMS first, fall back to push on failure
 * - Queue fallback notifications for background processing
 * - Store guest push preferences
 * - Support for guest opt-in/out of push notifications
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { sendSms, type SmsSendResult } from './sms';
import { sendPushNotification, getGuestPushTokens } from './push';
import { enqueueNotification, type NotificationChannel } from './queue';
import { logger } from '@/lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

const log = logger.child('[fallback]');

// =========================================================
// Types and Interfaces
// =========================================================

/** Guest push preferences stored in database */
export interface GuestPushPreference {
    guestId: string;
    restaurantId: string;
    pushEnabled: boolean;
    pushOptInAt?: string;
    pushOptOutAt?: string;
    preferredChannel: 'sms' | 'push' | 'both';
    createdAt: string;
    updatedAt: string;
}

/** Parameters for sending with fallback */
export interface SendWithFallbackParams {
    /** Guest phone number (for SMS) */
    guestPhone: string;
    /** Push token if available */
    pushToken?: string;
    /** Guest ID if available */
    guestId?: string;
    /** Restaurant ID for tenant isolation */
    restaurantId: string;
    /** Notification title */
    title: string;
    /** Notification body */
    body: string;
    /** Optional icon for push */
    icon?: string;
    /** Optional click action URL */
    clickAction?: string;
    /** Optional additional data */
    data?: Record<string, unknown>;
    /** Idempotency key to prevent duplicate sends */
    idempotencyKey: string;
    /** Maximum SMS retries before fallback (default: 3) */
    maxSmsRetries?: number;
    /** Whether to skip SMS and use push directly */
    skipSms?: boolean;
    /** Supabase client (optional) */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase?: SupabaseClient<any>;
}

/** Result of fallback send operation */
export interface FallbackOperationResult {
    /** Whether at least one channel succeeded */
    success: boolean;
    /** Which channel succeeded: 'sms' | 'push' | 'none' */
    channel: 'sms' | 'push' | 'none';
    /** SMS result if attempted */
    smsResult?: {
        success: boolean;
        attempts: number;
        error?: string;
    };
    /** Push result if attempted */
    pushResult?: {
        success: boolean;
        provider: string;
        error?: string;
    };
    /** Error message if all channels failed */
    error?: string;
}

/** Guest preference update parameters */
export interface UpdateGuestPreferenceParams {
    guestId: string;
    restaurantId: string;
    pushEnabled: boolean;
    preferredChannel?: 'sms' | 'push' | 'both';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase?: SupabaseClient<any>;
}

// =========================================================
// Main Fallback Function
// =========================================================

/**
 * Send a notification with SMS-to-push fallback
 *
 * Strategy:
 * 1. Try SMS first (primary channel)
 * 2. If SMS fails after maxRetries, try push (fallback channel)
 * 3. If push token available, try push directly
 * 4. If both fail, return error
 *
 * @param params - Fallback send parameters
 * @returns Promise<FallbackOperationResult> - Result of the operation
 */
export async function sendWithFallback(
    params: SendWithFallbackParams
): Promise<FallbackOperationResult> {
    const {
        guestPhone,
        pushToken,
        guestId,
        restaurantId,
        title,
        body,
        icon,
        clickAction,
        data = {},
        idempotencyKey,
        maxSmsRetries = 3,
        skipSms = false,
        supabase: providedSupabase,
    } = params;

    const supabase = providedSupabase ?? createServiceRoleClient();

    // If skipSms is true, try push directly
    if (skipSms && pushToken) {
        const pushResult = await sendPushNotification({
            token: pushToken,
            title,
            body,
            icon,
            clickAction,
            data: { ...data, fallback: 'direct_push' },
        });

        return {
            success: pushResult.success,
            channel: pushResult.success ? 'push' : 'none',
            pushResult: {
                success: pushResult.success,
                provider: pushResult.provider,
                error: pushResult.error,
            },
            error: pushResult.success ? undefined : pushResult.error,
        };
    }

    // Step 1: Try SMS first
    let smsAttempts = 0;
    let smsSuccess = false;
    let smsError: string | undefined;

    while (smsAttempts < maxSmsRetries && !smsSuccess) {
        smsAttempts++;
        const smsResult: SmsSendResult = await sendSms(guestPhone, body);

        if (smsResult.success) {
            smsSuccess = true;
            log.info('SMS sent successfully on attempt', { attempt: smsAttempts });
            break;
        }

        smsError = smsResult.error || 'Unknown SMS error';
        log.warn('SMS attempt failed', { attempt: smsAttempts, error: smsError });

        // Wait before retry (simple delay, normally handled by queue)
        if (smsAttempts < maxSmsRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * smsAttempts));
        }
    }

    // If SMS succeeded, we're done
    if (smsSuccess) {
        // Log successful SMS to notification queue for audit
        await logNotificationToQueue(supabase, {
            restaurantId,
            guestPhone,
            guestId,
            message: body,
            channel: 'sms',
            idempotencyKey,
            metadata: { title, smsAttempts, channel: 'sms' },
        });

        return {
            success: true,
            channel: 'sms',
            smsResult: {
                success: true,
                attempts: smsAttempts,
            },
        };
    }

    // Step 2: SMS failed, try push as fallback
    log.warn('SMS failed after attempts, trying push', { attempts: smsAttempts });

    let pushTokenToUse = pushToken;

    // If no push token provided, try to get from guest's registered tokens
    if (!pushTokenToUse && guestId) {
        const tokens = await getGuestPushTokens(guestId, supabase);
        if (tokens.length > 0) {
            pushTokenToUse = tokens[0].token;
        }
    }

    if (pushTokenToUse) {
        const pushResult = await sendPushNotification({
            token: pushTokenToUse,
            title,
            body,
            icon,
            clickAction,
            data: { ...data, fallback: 'sms_to_push' },
        });

        // Log to notification queue
        await logNotificationToQueue(supabase, {
            restaurantId,
            guestPhone,
            guestId,
            message: body,
            channel: 'push',
            idempotencyKey: `${idempotencyKey}_push`,
            metadata: {
                title,
                smsAttempts,
                smsError,
                pushSuccess: pushResult.success,
                channel: 'push',
            },
        });

        return {
            success: pushResult.success,
            channel: pushResult.success ? 'push' : 'none',
            smsResult: {
                success: false,
                attempts: smsAttempts,
                error: smsError,
            },
            pushResult: {
                success: pushResult.success,
                provider: pushResult.provider,
                error: pushResult.error,
            },
            error: pushResult.error
                ? `SMS failed: ${smsError}. Push also failed: ${pushResult.error}`
                : `SMS failed after ${smsAttempts} attempts`,
        };
    }

    // No push token available, queue for later retry
    log.warn('No push token available, queuing fallback notification');

    try {
        await enqueueNotification({
            restaurantId,
            guestPhone,
            guestId,
            notificationType: 'order_status',
            channel: 'push',
            messageAm: body,
            messageEn: body,
            priority: 1, // Lower priority for fallback
            metadata: {
                title,
                icon,
                clickAction,
                ...data,
                originalSmsAttempts: smsAttempts,
                originalSmsError: smsError,
                fallbackReason: 'sms_failed_no_push_token',
            },
        });
    } catch (queueError) {
        log.error('Failed to queue fallback notification', queueError);
    }

    return {
        success: false,
        channel: 'none',
        smsResult: {
            success: false,
            attempts: smsAttempts,
            error: smsError,
        },
        error: `SMS failed after ${smsAttempts} attempts. No push token available.`,
    };
}

// =========================================================
// Guest Push Preferences
// =========================================================

/**
 * Get guest push preferences
 *
 * @param guestId - Guest ID
 * @param supabase - Optional Supabase client
 * @returns Promise<GuestPushPreference | null>
 */
export async function getGuestPushPreference(
    guestId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase?: SupabaseClient<any>
): Promise<GuestPushPreference | null> {
    const db = supabase ?? createServiceRoleClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any)
        .from('guest_push_preferences')
        // HIGH-013: Explicit column selection
        .select(
            'guest_id, restaurant_id, push_enabled, push_opt_in_at, push_opt_out_at, preferred_channel, created_at, updated_at'
        )
        .eq('guest_id', guestId)
        .single();

    if (error || !data) {
        return null;
    }

    return {
        guestId: data.guest_id,
        restaurantId: data.restaurant_id,
        pushEnabled: data.push_enabled,
        pushOptInAt: data.push_opt_in_at,
        pushOptOutAt: data.push_opt_out_at,
        preferredChannel: data.preferred_channel || 'both',
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };
}

/**
 * Update guest push preferences
 *
 * @param params - Preference update parameters
 * @returns Promise<void>
 */
export async function updateGuestPushPreference(
    params: UpdateGuestPreferenceParams
): Promise<void> {
    const { guestId, restaurantId, pushEnabled, preferredChannel = 'both', supabase } = params;
    const db = supabase ?? createServiceRoleClient();

    const now = new Date().toISOString();

    // Check if preference exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (db as any)
        .from('guest_push_preferences')
        .select('id, push_enabled')
        .eq('guest_id', guestId)
        .single();

    if (existing) {
        // Update existing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any)
            .from('guest_push_preferences')
            .update({
                push_enabled: pushEnabled,
                preferred_channel: preferredChannel,
                push_opt_in_at: pushEnabled && !existing.push_enabled ? now : undefined,
                push_opt_out_at: !pushEnabled && existing.push_enabled ? now : undefined,
                updated_at: now,
            })
            .eq('guest_id', guestId);
    } else {
        // Insert new
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as any).from('guest_push_preferences').insert({
            guest_id: guestId,
            restaurant_id: restaurantId,
            push_enabled: pushEnabled,
            preferred_channel: preferredChannel,
            push_opt_in_at: pushEnabled ? now : null,
            created_at: now,
            updated_at: now,
        });
    }
}

/**
 * Check if guest prefers push notifications
 *
 * @param guestId - Guest ID
 * @param supabase - Optional Supabase client
 * @returns Promise<boolean>
 */
export async function guestPrefersPush(
    guestId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase?: SupabaseClient<any>
): Promise<boolean> {
    const preference = await getGuestPushPreference(guestId, supabase);

    if (!preference) {
        // Default to SMS if no preference set
        return false;
    }

    return preference.pushEnabled && preference.preferredChannel !== 'sms';
}

// =========================================================
// Queue Fallback Notification
// =========================================================

/**
 * Queue a notification to be retried via push after SMS failure
 *
 * @param params - Notification parameters
 * @returns Promise<string> - Notification queue ID
 */
export async function queuePushFallback(
    params: Omit<Parameters<typeof enqueueNotification>[0], 'channel'>
): Promise<string> {
    return enqueueNotification({
        ...params,
        channel: 'push',
        priority: params.priority ?? -1, // Lower priority for fallback
    });
}

/**
 * Process failed SMS notifications and queue them for push fallback
 *
 * @param limit - Maximum number to process
 * @returns Promise<number> - Number of notifications queued
 */
export async function processSmsFailuresForPush(limit: number = 50): Promise<number> {
    const supabase = createServiceRoleClient();
    const _now = new Date().toISOString();

    // Find failed SMS notifications that haven't been retried via push
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: failedSms, error } = await (supabase as any)
        .from('notification_queue')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, guest_id, guest_phone, notification_type, channel, status, message_en, message_am, retry_count, metadata'
        )
        .eq('channel', 'sms')
        .eq('status', 'failed')
        .eq('retry_count', 3) // Exhausted SMS retries
        .not('metadata', 'has', 'push_fallback_attempted')
        .limit(limit);

    if (error || !failedSms || failedSms.length === 0) {
        return 0;
    }

    let queued = 0;

    for (const notification of failedSms) {
        try {
            // Check if guest has push token
            if (notification.guest_id) {
                const tokens = await getGuestPushTokens(notification.guest_id, supabase);

                if (tokens.length > 0) {
                    // Send push directly
                    const pushResult = await sendPushNotification({
                        token: tokens[0].token,
                        title: notification.message_en || 'Notification',
                        body: notification.message_en || '',
                        data: {
                            notificationId: notification.id,
                            fallbackFromSms: true,
                        },
                    });

                    // Update original notification
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (supabase as any)
                        .from('notification_queue')
                        .update({
                            metadata: {
                                ...(notification.metadata || {}),
                                push_fallback_attempted: true,
                                push_fallback_success: pushResult.success,
                            },
                        })
                        .eq('id', notification.id);

                    if (pushResult.success) {
                        queued++;
                    }
                    continue;
                }
            }

            // No push token, queue for later
            const metadata = notification.metadata || {};
            await enqueueNotification({
                restaurantId: notification.restaurant_id,
                guestPhone: notification.guest_phone,
                guestId: notification.guest_id,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                notificationType: notification.notification_type as any,
                channel: 'push',
                messageAm: notification.message_am || '',
                messageEn: notification.message_en || '',
                priority: -1, // Lowest priority
                metadata: {
                    ...metadata,
                    originalNotificationId: notification.id,
                    fallbackReason: 'sms_failed',
                    push_fallback_attempted: false,
                },
            });

            // Mark original as queued for fallback
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
                .from('notification_queue')
                .update({
                    metadata: {
                        ...metadata,
                        push_fallback_queued: true,
                    },
                })
                .eq('id', notification.id);

            queued++;
} catch (err) {
        log.error('Error processing SMS failure', err);
    }
    }

    return queued;
}

// =========================================================
// Helper Functions
// =========================================================

/**
 * Log successful notification to queue for audit
 */
async function logNotificationToQueue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any>,
    params: {
        restaurantId: string;
        guestPhone: string;
        guestId?: string;
        message: string;
        channel: NotificationChannel;
        idempotencyKey: string;
        metadata?: Record<string, unknown>;
    }
): Promise<void> {
    try {
        // Insert into notification queue (we don't enqueue since it's already sent,
        // but we log for audit trail)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('notification_queue').upsert(
            {
                restaurant_id: params.restaurantId,
                guest_phone: params.guestPhone,
                guest_id: params.guestId || null,
                notification_type: 'order_status',
                channel: params.channel,
                status: 'sent',
                message_en: params.message,
                idempotency_key: params.idempotencyKey,
                metadata: params.metadata,
                sent_at: new Date().toISOString(),
            },
            {
                onConflict: 'idempotency_key',
                ignoreDuplicates: true,
            }
        );
    } catch (error) {
        // Log but don't fail the main operation
        log.error('Failed to log notification', error);
    }
}

/**
 * Get notification channel priority based on guest preference
 *
 * @param guestId - Guest ID
 * @returns Preferred channel: 'sms' | 'push' | 'both'
 */
export async function getPreferredChannel(guestId: string): Promise<'sms' | 'push' | 'both'> {
    const preference = await getGuestPushPreference(guestId);

    if (!preference) {
        return 'sms'; // Default to SMS
    }

    return preference.preferredChannel;
}

/**
 * Check if push fallback is available for a guest
 *
 * @param guestId - Guest ID
 * @returns Promise<boolean>
 */
export async function hasPushFallbackAvailable(guestId: string): Promise<boolean> {
    if (!guestId) {
        return false;
    }

    const tokens = await getGuestPushTokens(guestId);
    return tokens.length > 0;
}
