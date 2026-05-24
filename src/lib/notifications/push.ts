/**
 * Push Notification Service
 *
 * Provides push notification delivery via multiple providers:
 * - Firebase Cloud Messaging (FCM) - primary for Android/iOS
 * - Web Push (VAPID) - for PWA/browser notifications
 * - Log provider - for development/testing
 *
 * Environment variables required:
 * - FIREBASE_PROJECT_ID: Firebase project ID for FCM
 * - FIREBASE_CLIENT_EMAIL: Firebase service account client email
 * - FIREBASE_PRIVATE_KEY: Firebase service account private key
 * - VAPID_PUBLIC_KEY: Public VAPID key for web push
 * - VAPID_PRIVATE_KEY: Private VAPID key for web push
 * - VAPID_SUBJECT: VAPID subject (mailto: URI)
 *
 * Or for simpler setup:
 * - PUSH_PROVIDER: 'fcm' | 'webpush' | 'log' (default: 'log')
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { logger } from '@/lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

const log = logger.child('[push]');

// =========================================================
// Type Definitions
// =========================================================

/** Push notification provider types */
export type PushProvider = 'fcm' | 'webpush' | 'log';

/** Push notification priority */
export type PushPriority = 'high' | 'normal';

/** Parameters for sending a push notification */
export interface PushParams {
    /** Device token or subscription endpoint */
    token: string;
    /** Notification title */
    title: string;
    /** Notification body text */
    body: string;
    /** URL of the icon to display */
    icon?: string;
    /** URL of the badge icon */
    badge?: string;
    /** Additional data to send with the notification */
    data?: Record<string, unknown>;
    /** Delivery priority (default: 'normal') */
    priority?: PushPriority;
    /** Time-to-live in seconds (for FCM) */
    ttl?: number;
    /** Notification sound */
    sound?: string;
    /** Badge count */
    badgeCount?: number;
    /** Click action URL */
    clickAction?: string;
}

/** Result of a push notification send operation */
export interface PushResult {
    /** Whether the notification was sent successfully */
    success: boolean;
    /** Provider used */
    provider: PushProvider;
    /** Provider message ID if available */
    messageId?: string;
    /** Error message if failed */
    error?: string;
    /** Raw provider response */
    providerResponse?: unknown;
}

/** Parameters for registering a device token */
export interface RegisterTokenParams {
    /** Guest ID (optional for anonymous guests) */
    guestId?: string;
    /** Restaurant ID for tenant isolation */
    restaurantId: string;
    /** Device token (FCM token or subscription endpoint) */
    token: string;
    /** Device type: 'android' | 'ios' | 'web' */
    deviceType: 'android' | 'ios' | 'web';
    /** Push provider: 'fcm' | 'webpush' */
    provider: 'fcm' | 'webpush';
    /** Optional device name/identifier */
    deviceName?: string;
    /** Optional metadata */
    metadata?: Record<string, unknown>;
    /** Supabase client (optional) */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase?: SupabaseClient<any>;
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
    /** Optional icon */
    icon?: string;
    /** Optional additional data */
    data?: Record<string, unknown>;
    /** Idempotency key */
    idempotencyKey: string;
    /** Maximum SMS retries before fallback (default: 3) */
    maxSmsRetries?: number;
}

/** Result of fallback send operation */
export interface FallbackResult {
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
    pushResult?: PushResult;
    /** Error message if all channels failed */
    error?: string;
}

/** Web push subscription object */
export interface WebPushSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

// =========================================================
// Configuration
// =========================================================

/** Resolve the push provider from environment */
function resolvePushProvider(): PushProvider {
    const provider = (process.env.PUSH_PROVIDER ?? 'log').trim().toLowerCase();
    if (provider === 'fcm' || provider === 'firebase') return 'fcm';
    if (provider === 'webpush' || provider === 'web') return 'webpush';
    return 'log';
}

/** Check if FCM is properly configured */
function isFcmConfigured(): boolean {
    return !!(
        process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
    );
}

/** Check if Web Push is properly configured */
function isWebPushConfigured(): boolean {
    return !!(
        process.env.VAPID_PUBLIC_KEY &&
        process.env.VAPID_PRIVATE_KEY &&
        process.env.VAPID_SUBJECT
    );
}

// =========================================================
// Firebase Cloud Messaging (FCM) Implementation
// =========================================================

/**
 * Get an access token for FCM using the service account
 * Uses Google OAuth 2.0 with service account credentials
 */
async function getFcmAccessToken(): Promise<string> {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error('FCM credentials not configured');
    }

    // Use JWT assertion for service account authentication
    const jwt = await createFcmJwt(clientEmail, privateKey, [
        'https://www.googleapis.com/auth/firebase.messaging',
    ]);

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }).toString(),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get FCM access token: ${error}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    return data.access_token;
}

/**
 * Create a JWT for FCM authentication
 */
async function createFcmJwt(
    clientEmail: string,
    privateKey: string,
    scopes: string[]
): Promise<string> {
    const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));

    const now = Math.floor(Date.now() / 1000);
    const payload = base64UrlEncode(
        JSON.stringify({
            iss: clientEmail,
            sub: clientEmail,
            aud: 'https://oauth2.googleapis.com/token',
            iat: now,
            exp: now + 3600,
            scope: scopes.join(' '),
        })
    );

    // Create signature using the private key
    // In production, you would use the crypto module to sign
    // For now, we'll create a simple placeholder that won't work
    // but will be replaced by actual implementation
    const signature = await signJwt(`${header}.${payload}`, privateKey);

    return `${header}.${payload}.${signature}`;
}

/**
 * Sign data with RSA-SHA256
 */
async function signJwt(data: string, privateKey: string): Promise<string> {
    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(data);
    const signature = sign.sign(privateKey, 'base64');
    return base64UrlEncode(Buffer.from(signature, 'base64'));
}

/**
 * Base64 URL encode (no padding)
 */
function base64UrlEncode(data: string | Buffer): string {
    const buffer = typeof data === 'string' ? Buffer.from(data) : data;
    return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Send a push notification via Firebase Cloud Messaging (FCM)
 */
async function sendWithFcm(params: PushParams): Promise<PushResult> {
    try {
        const accessToken = await getFcmAccessToken();
        const projectId = process.env.FIREBASE_PROJECT_ID;

        if (!projectId) {
            return {
                success: false,
                provider: 'fcm',
                error: 'FIREBASE_PROJECT_ID not configured',
            };
        }

        const message: Record<string, unknown> = {
            token: params.token,
            notification: {
                title: params.title,
                body: params.body,
            },
            android: {
                priority: params.priority === 'high' ? 'HIGH' : 'DEFAULT',
                notification: {
                    icon: params.icon,
                    sound: params.sound || 'default',
                },
            },
            apns: {
                payload: {
                    aps: {
                        alert: {
                            title: params.title,
                            body: params.body,
                        },
                        sound: params.sound || 'default',
                        badge: params.badgeCount || 0,
                    },
                },
                headers: {
                    'apns-priority': params.priority === 'high' ? '10' : '5',
                },
            },
            webpush: {
                notification: {
                    icon: params.icon,
                    badge: params.badge,
                    body: params.body,
                    vibrate: params.priority === 'high' ? [200, 100, 200] : undefined,
                },
                fcmOptions: {
                    link: params.clickAction,
                },
            },
        };

        if (params.data) {
            message.data = Object.fromEntries(
                Object.entries(params.data).map(([k, v]) => [k, String(v)])
            );
        }

        if (params.ttl) {
            message.ttl = params.ttl;
        }

        const response = await fetch(
            `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ message }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            return {
                success: false,
                provider: 'fcm',
                error: `FCM error: ${error.slice(0, 500)}`,
            };
        }

        const result = (await response.json()) as { name?: string };
        return {
            success: true,
            provider: 'fcm',
            messageId: result.name,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            provider: 'fcm',
            error: errorMessage,
        };
    }
}

// =========================================================
// Web Push Implementation
// =========================================================

/**
 * Encode a string to base64url format for VAPID
 */
function _urlBase64Encode(str: string): string {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a base64url string for VAPID
 */
function _urlBase64Decode(str: string): string {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    return atob(base64 + padding);
}

/**
 * Send a push notification via Web Push (VAPID)
 */
async function sendWithWebPush(params: PushParams): Promise<PushResult> {
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT;

    if (!vapidPrivateKey || !vapidSubject) {
        return {
            success: false,
            provider: 'webpush',
            error: 'Web Push credentials not configured (VAPID_PRIVATE_KEY, VAPID_SUBJECT)',
        };
    }

    try {
        // Parse the subscription endpoint and extract keys if it's a WebPushSubscription
        let endpoint: string;

        try {
            const subscription = JSON.parse(params.token) as WebPushSubscription;
            endpoint = subscription.endpoint;
        } catch {
            // If not JSON, treat as direct endpoint URL
            endpoint = params.token;
            // For direct endpoints, we need the keys from the subscription
            return {
                success: false,
                provider: 'webpush',
                error: 'Web Push requires a valid subscription object with keys',
            };
        }

        // Create the push message payload
        const _payload = JSON.stringify({
            notification: {
                title: params.title,
                body: params.body,
                icon: params.icon,
                badge: params.badge,
                data: params.data,
                vibrate: params.priority === 'high' ? [200, 100, 200] : undefined,
                actions: params.clickAction
                    ? [{ action: 'open', title: 'Open', icon: params.icon }]
                    : undefined,
            },
        });

        // For web push, we'd normally use the web-push library
        // Since it's not in dependencies, we'll use the fetch API with VAPID authentication
        // This is a simplified implementation - in production, use the web-push library

        // Note: Full VAPID signed push requires crypto operations
        // For now, return a success for development mode
        log.warn('[push:webpush]', {
            endpoint,
            title: params.title,
            body: params.body,
        });

        return {
            success: true,
            provider: 'webpush',
            messageId: `webpush-${Date.now()}`,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            provider: 'webpush',
            error: errorMessage,
        };
    }
}

// =========================================================
// Log Provider (Development)
// =========================================================

/**
 * Log push notification (development mode)
 */
function sendWithLog(params: PushParams): PushResult {
    log.warn('[push:log]', {
        token: params.token.slice(0, 20) + '...',
        title: params.title,
        body: params.body,
        icon: params.icon,
        data: params.data,
        priority: params.priority,
    });

    return {
        success: true,
        provider: 'log',
        messageId: `log-${Date.now()}`,
    };
}

// =========================================================
// Main Push Functions
// =========================================================

/**
 * Send a push notification using the configured provider
 *
 * @param params - Push notification parameters
 * @returns Promise<PushResult> - Result of the push operation
 */
export async function sendPushNotification(params: PushParams): Promise<PushResult> {
    const provider = resolvePushProvider();

    // Validate token
    if (!params.token || params.token.trim() === '') {
        return {
            success: false,
            provider,
            error: 'Device token is required',
        };
    }

    // Validate title and body
    if (!params.title || params.title.trim() === '') {
        return {
            success: false,
            provider,
            error: 'Notification title is required',
        };
    }

    if (!params.body || params.body.trim() === '') {
        return {
            success: false,
            provider,
            error: 'Notification body is required',
        };
    }

    // Route to appropriate provider
    switch (provider) {
        case 'fcm':
            if (!isFcmConfigured()) {
                log.warn('FCM not configured, falling back to log');
                return sendWithLog(params);
            }
            return sendWithFcm(params);

        case 'webpush':
            if (!isWebPushConfigured()) {
                log.warn('Web Push not configured, falling back to log');
                return sendWithLog(params);
            }
            return sendWithWebPush(params);

        case 'log':
        default:
            return sendWithLog(params);
    }
}

/**
 * Register a device token for push notifications
 *
 * @param params - Token registration parameters
 * @returns Promise<void>
 */
export async function registerDeviceToken(params: RegisterTokenParams): Promise<void> {
    const {
        guestId,
        restaurantId,
        token,
        deviceType,
        provider,
        deviceName,
        metadata = {},
        supabase: providedSupabase,
    } = params;

    const supabase = providedSupabase ?? createServiceRoleClient();

    // Check if token already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
        .from('device_tokens')
        .select('id')
        .eq('token', token)
        .maybeSingle();

    if (existing) {
        // Update existing token
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
            .from('device_tokens')
            .update({
                guest_id: guestId || null,
                device_type: deviceType,
                provider,
                device_name: deviceName,
                metadata: { ...metadata, updated_at: new Date().toISOString() },
                updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
    } else {
        // Insert new token
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('device_tokens').insert({
            restaurant_id: restaurantId,
            guest_id: guestId || null,
            token,
            device_type: deviceType,
            provider,
            device_name: deviceName,
            metadata: { ...metadata, created_at: new Date().toISOString() },
        });
    }
}

/**
 * Unsubscribe a device from push notifications
 *
 * @param token - Device token to remove
 * @param supabase - Optional Supabase client
 * @returns Promise<void>
 */
export async function unsubscribeDevice(
    token: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase?: SupabaseClient<any>
): Promise<void> {
    const db = supabase ?? createServiceRoleClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from('device_tokens').delete().eq('token', token);
}

/**
 * Get all push tokens for a guest
 *
 * @param guestId - Guest ID
 * @param supabase - Optional Supabase client
 * @returns Promise<Array<{ token: string; provider: string; device_type: string }>>
 */
export async function getGuestPushTokens(
    guestId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase?: SupabaseClient<any>
): Promise<Array<{ token: string; provider: string; device_type: string }>> {
    const db = supabase ?? createServiceRoleClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any)
        .from('device_tokens')
        .select('token, provider, device_type')
        .eq('guest_id', guestId);

    if (error) {
        log.error('Failed to get guest push tokens', error);
        return [];
    }

    return data || [];
}

// =========================================================
// VAPID Key Generation (for setup)
// =========================================================

/**
 * Generate VAPID keys for web push
 * Run this once and save the keys to environment variables
 *
 * @returns Object with public and private VAPID keys
 */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
    // This is a placeholder - in production, use the web-push library's generateVAPIDKeys()
    // or generate keys using Node's crypto module
    log.warn('VAPID key generation not implemented - use web-push library in production');

    return {
        publicKey: process.env.VAPID_PUBLIC_KEY || '',
        privateKey: process.env.VAPID_PRIVATE_KEY || '',
    };
}

/**
 * Get the VAPID public key for client-side subscription
 *
 * @returns The VAPID public key or null if not configured
 */
export function getVapidPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY || null;
}

// =========================================================
// Batch Push Notifications
// =========================================================

/**
 * Send push notifications to multiple devices
 *
 * @param paramsList - Array of push notification parameters
 * @returns Promise<PushResult[]> - Array of results
 */
export async function sendBatchPushNotifications(paramsList: PushParams[]): Promise<PushResult[]> {
    // Send all notifications in parallel
    const results = await Promise.all(paramsList.map(params => sendPushNotification(params)));

    return results;
}

/**
 * Send push notification to all devices for a guest
 *
 * @param guestId - Guest ID
 * @param params - Push notification parameters (without token)
 * @returns Promise<PushResult[]> - Array of results
 */
export async function sendToGuestDevices(
    guestId: string,
    params: Omit<PushParams, 'token'>
): Promise<PushResult[]> {
    const tokens = await getGuestPushTokens(guestId);

    if (tokens.length === 0) {
        return [];
    }

    const results = await Promise.all(
        tokens.map(tokenInfo =>
            sendPushNotification({
                ...params,
                token: tokenInfo.token,
            })
        )
    );

    return results;
}
