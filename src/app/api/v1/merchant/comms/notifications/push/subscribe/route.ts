/**
 * Push Notification Subscription API
 *
 * Handles Web Push subscription registration and management.
 * Supports:
 * - POST /subscribe - Register a new push subscription
 * - DELETE /subscribe - Unsubscribe from push notifications
 * GET /subscribe - Get VAPID public key for client
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
    registerDeviceToken,
    unsubscribeDevice,
    getVapidPublicKey,
    type WebPushSubscription,
} from '@/lib/notifications/push';
import { updateGuestPushPreference } from '@/lib/notifications/fallback';
import { parseJsonBody, parseQuery } from '@/lib/api/validation';
import { apiError, apiSuccess } from '@/lib/api/response';

// =========================================================
// Schemas
// =========================================================

/** Web Push subscription registration request */
const SubscribeRequestSchema = z.object({
    /** Web Push subscription object from the browser */
    subscription: z.object({
        endpoint: z.string().url(),
        keys: z.object({
            p256dh: z.string(),
            auth: z.string(),
        }),
    }),
    /** Device type: 'android' | 'ios' | 'web' */
    deviceType: z.enum(['android', 'ios', 'web']).default('web'),
    /** Device name (optional) */
    deviceName: z.string().optional(),
    /** Guest ID (optional, for authenticated guests) */
    guestId: z.string().uuid().optional(),
    /** Restaurant ID (required for tenant isolation) */
    restaurantId: z.string().uuid(),
    /** Whether to enable push notifications */
    pushEnabled: z.boolean().default(true),
});

/** Unsubscribe request */
const UnsubscribeRequestSchema = z.object({
    /** Device token or subscription endpoint to remove */
    token: z.string(),
});

/** GET request (get VAPID public key) */
const VapidKeyQuerySchema = z.object({
    restaurantId: z.string().uuid().optional(),
});

// =========================================================
// POST /subscribe - Register push subscription
// =========================================================

export async function POST(request: NextRequest) {
    try {
        // Parse request body
        const parseResult = await parseJsonBody(request, SubscribeRequestSchema);
        if (!parseResult.success) {
            return parseResult.response;
        }

        const { subscription, deviceType, deviceName, guestId, restaurantId, pushEnabled } =
            parseResult.data;

        // Serialize subscription to string for storage
        const token = JSON.stringify(subscription as WebPushSubscription);

        // Use provided guestId and restaurantId
        // In a full implementation, we'd also try to resolve from auth session
        const effectiveGuestId = guestId;
        const effectiveRestaurantId = restaurantId;

        // Register the device token
        await registerDeviceToken({
            guestId: effectiveGuestId,
            restaurantId: effectiveRestaurantId,
            token,
            deviceType,
            provider: 'webpush',
            deviceName,
            metadata: {
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                subscribedAt: new Date().toISOString(),
            },
        });

        // Update guest push preferences if guest ID provided
        if (effectiveGuestId) {
            await updateGuestPushPreference({
                guestId: effectiveGuestId,
                restaurantId: effectiveRestaurantId,
                pushEnabled,
                preferredChannel: pushEnabled ? 'push' : 'sms',
            });
        }

        console.warn('[push:subscribe] Subscription registered', {
            guestId: effectiveGuestId,
            restaurantId: effectiveRestaurantId,
            deviceType,
        });

        return apiSuccess({
            message: 'Push subscription registered successfully',
            subscription: {
                endpoint: subscription.endpoint,
                deviceType,
                pushEnabled,
            },
        });
    } catch (error) {
        console.error('[push:subscribe] Error:', error);
        return apiError(
            error instanceof Error ? error.message : 'Failed to register subscription',
            500,
            'SUBSCRIPTION_ERROR'
        );
    }
}

// =========================================================
// DELETE /subscribe - Unsubscribe from push notifications
// =========================================================

export async function DELETE(request: NextRequest) {
    try {
        // Parse request body
        const parseResult = await parseJsonBody(request, UnsubscribeRequestSchema);
        if (!parseResult.success) {
            return parseResult.response;
        }

        const { token } = parseResult.data;

        // Unsubscribe the device
        await unsubscribeDevice(token);

        console.warn('[push:subscribe] Unsubscribed', {
            token: token.slice(0, 50) + '...',
        });

        return apiSuccess({
            message: 'Push subscription removed successfully',
        });
    } catch (error) {
        console.error('[push:unsubscribe] Error:', error);
        return apiError(
            error instanceof Error ? error.message : 'Failed to remove subscription',
            500,
            'UNSUBSCRIPTION_ERROR'
        );
    }
}

// =========================================================
// GET /subscribe - Get VAPID public key
// =========================================================

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const restaurantId = url.searchParams.get('restaurantId') || undefined;

        // Parse and validate query params
        const parsed = parseQuery({ restaurantId }, VapidKeyQuerySchema);
        if (!parsed.success) {
            return parsed.response;
        }

        // Get VAPID public key
        const vapidPublicKey = getVapidPublicKey();

        if (!vapidPublicKey) {
            // Return a placeholder key for development
            return apiSuccess({
                publicKey: '',
                message: 'VAPID keys not configured - using development mode',
                isConfigured: false,
            });
        }

        return apiSuccess({
            publicKey: vapidPublicKey,
            isConfigured: true,
        });
    } catch (error) {
        console.error('[push:vapid] Error:', error);
        return apiError(
            error instanceof Error ? error.message : 'Failed to get VAPID key',
            500,
            'VAPID_KEY_ERROR'
        );
    }
}
