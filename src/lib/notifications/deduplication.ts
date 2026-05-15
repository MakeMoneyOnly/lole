/**
 * Notification Deduplication Service
 *
 * Prevents notification spam through deduplication using Redis as primary storage
 * with database fallback. Uses time-windowed deduplication keys to allow legitimate
 * re-notification after the deduplication window expires.
 *
 * Configuration:
 * - Different deduplication windows per notification type:
 *   - order_status: 1 hour (guest may receive multiple updates)
 *   - waitlist: 30 minutes (prevent spam while waiting)
 *   - promotion: 24 hours (daily promotions max)
 *   - reservation: 2 hours
 *
 * Uses SHA-256 hash of composite keys for storage.
 */

import { Redis } from '@upstash/redis';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createHash } from 'crypto';
import { logger } from '@/lib/logger';

const log = logger.child('[deduplication]');

// =========================================================
// Deduplication Configuration
// =========================================================

/** Deduplication windows in seconds per notification type */
export const DEDUP_CONFIG = {
    /** Default deduplication window: 24 hours */
    DEFAULT_WINDOW_SECONDS: 24 * 60 * 60,
    /** Per-type deduplication windows in seconds */
    WINDOWS: {
        /** Order status updates: 1 hour */
        order_status: 60 * 60,
        /** Waitlist notifications: 30 minutes */
        waitlist: 30 * 60,
        /** Promotional messages: 24 hours */
        promotion: 24 * 60 * 60,
        /** Reservation notifications: 2 hours */
        reservation: 2 * 60 * 60,
    },
    /** Key prefix for Redis deduplication keys */
    KEY_PREFIX: 'notif:dedup',
    /** Content-based dedup enabled by default */
    ENABLE_CONTENT_DEDUP: false,
} as const;

/** Notification types supported */
export type NotificationType = 'order_status' | 'waitlist' | 'promotion' | 'reservation';

// =========================================================
// Type Definitions
// =========================================================

/**
 * Parameters for deduplication check
 */
export interface DedupeCheckParams {
    /** Guest phone number */
    guestPhone: string;
    /** Type of notification */
    notificationType: NotificationType;
    /** Relevant ID (order_id, waitlist_id, etc.) */
    relevantId?: string;
    /** Message content for content-based deduplication */
    message?: string;
}

/**
 * Parameters for recording a notification
 */
export interface RecordNotificationParams extends DedupeCheckParams {
    /** Optional custom deduplication window (in seconds) */
    customWindowSeconds?: number;
}

/**
 * Result of deduplication check
 */
export interface DedupeCheckResult {
    /** Whether the notification is a duplicate */
    isDuplicate: boolean;
    /** The deduplication key used */
    dedupeKey: string;
    /** Time remaining until the key expires (seconds) */
    expiresIn?: number;
}

// =========================================================
// Redis Client (Singleton)
// =========================================================

let redisClient: Redis | null = null;

/**
 * Get or create the Redis client for deduplication
 */
function getRedisClient(): Redis | null {
    if (redisClient) {
        return redisClient;
    }

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        log.warn('Redis credentials not configured, using database fallback');
        return null;
    }

    try {
        redisClient = new Redis({
            url,
            token,
        });
        return redisClient;
    } catch (error) {
        log.error('Failed to initialize Redis client', error);
        return null;
    }
}

/**
 * Close the Redis client (for testing)
 */
export async function closeDedupeRedis(): Promise<void> {
    if (redisClient) {
        redisClient = null;
    }
}

// =========================================================
// DedupeKey Generation
// =========================================================

/**
 * Generate a deterministic deduplication key
 *
 * Format: {prefix}:{notification_type}:{relevant_id}:{hashed_phone}
 * Or for content-based: {prefix}:{notification_type}:{relevant_id}:{content_hash}
 *
 * @param params - Deduplication parameters
 * @returns The deduplication key
 */
export function getDedupeKey(params: DedupeCheckParams): string {
    const { guestPhone, notificationType, relevantId, message } = params;

    // Normalize phone number (remove spaces, country code variations)
    const normalizedPhone = normalizePhone(guestPhone);

    // Build the key components
    const typePart = notificationType;
    const idPart = relevantId || 'general';

    let keyPart: string;
    if (message && DEDUP_CONFIG.ENABLE_CONTENT_DEDUP) {
        // Use content hash for message-based deduplication
        const contentHash = createHash('sha256').update(message).digest('hex').slice(0, 16);
        keyPart = `${typePart}:${idPart}:${contentHash}`;
    } else {
        // Use phone hash for recipient-based deduplication
        const phoneHash = createHash('sha256').update(normalizedPhone).digest('hex').slice(0, 16);
        keyPart = `${typePart}:${idPart}:${phoneHash}`;
    }

    return `${DEDUP_CONFIG.KEY_PREFIX}:${keyPart}`;
}

/**
 * Normalize phone number for consistent deduplication
 */
export function normalizePhone(phone: string): string {
    // Remove all non-digit characters except +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Handle Ethiopian phone numbers
    // +251 or 251 -> 0 (convert to local format)
    if (normalized.startsWith('251')) {
        normalized = '0' + normalized.slice(3);
    } else if (normalized.startsWith('+251')) {
        normalized = '0' + normalized.slice(4);
    }

    return normalized;
}

/**
 * Get deduplication window in seconds for a notification type
 */
export function getDeduplicationWindow(
    notificationType: NotificationType,
    customWindowSeconds?: number
): number {
    if (customWindowSeconds) {
        return customWindowSeconds;
    }
    return DEDUP_CONFIG.WINDOWS[notificationType] ?? DEDUP_CONFIG.DEFAULT_WINDOW_SECONDS;
}

// =========================================================
// Redis-Based Deduplication
// =========================================================

/**
 * Check if a notification is a duplicate using Redis
 *
 * @param params - Deduplication parameters
 * @returns Promise<DedupeCheckResult>
 */
async function checkDuplicateRedis(params: DedupeCheckParams): Promise<DedupeCheckResult> {
    const redis = getRedisClient();
    if (!redis) {
        // Fallback to database
        return checkDuplicateDatabase(params);
    }

    const key = getDedupeKey(params);

    try {
        // Use SETNX (set if not exists) to atomically check and set
        // We use SET with NX option and get the TTL
        const result = await redis.set(key, '1', {
            nx: true, // Only set if not exists
            ex: getDeduplicationWindow(params.notificationType),
        });

        if (result) {
            // Key didn't exist, so this is NOT a duplicate
            return {
                isDuplicate: false,
                dedupeKey: key,
                expiresIn: getDeduplicationWindow(params.notificationType),
            };
        }

        // Key exists, so this IS a duplicate
        // Get remaining TTL
        const ttl = await redis.ttl(key);
        return {
            isDuplicate: true,
            dedupeKey: key,
            expiresIn: ttl > 0 ? ttl : undefined,
        };
    } catch (error) {
        log.error('Redis error during duplicate check', error);
        // Fallback to database on error
        return checkDuplicateDatabase(params);
    }
}

/**
 * Record a notification in Redis to prevent duplicates
 *
 * @param params - Parameters for recording notification
 */
async function recordNotificationRedis(params: RecordNotificationParams): Promise<void> {
    const redis = getRedisClient();
    if (!redis) {
        // Fallback to database
        await recordNotificationDatabase(params);
        return;
    }

    const key = getDedupeKey(params);
    const windowSeconds = getDeduplicationWindow(
        params.notificationType,
        params.customWindowSeconds
    );

    try {
        await redis.set(key, '1', {
            ex: windowSeconds,
        });
    } catch (error) {
        log.error('Redis error during record', error);
        // Fallback to database on error
        await recordNotificationDatabase(params);
    }
}

// =========================================================
// Database Fallback (when Redis unavailable)
// =========================================================

/**
 * Check for duplicates in the notification_queue table
 */

async function checkDuplicateDatabase(params: DedupeCheckParams): Promise<DedupeCheckResult> {
    const supabase = createServiceRoleClient();
    const key = getDedupeKey(params);
    const windowSeconds = getDeduplicationWindow(params.notificationType);

    // Use idempotency_key as the dedupe key in database
    // Check for any recent notification with the same key
    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

    // Pre-declare result to avoid ESLint false positive with catch block
    const result: DedupeCheckResult = {
        isDuplicate: false,
        dedupeKey: key,
    };

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .from('notification_queue')
            .select('id, created_at')
            .eq('idempotency_key', key)
            .gte('created_at', windowStart)
            .limit(1)
            .maybeSingle();

        if (error) {
            log.error('Database error during duplicate check', error);
            // On database error, allow the notification (fail open)
            return result;
        }

        if (data) {
            // Calculate remaining time
            const createdAt = new Date(data.created_at).getTime();
            const expiresIn = Math.max(
                0,
                Math.floor((createdAt + windowSeconds * 1000 - Date.now()) / 1000)
            );
            return {
                isDuplicate: true,
                dedupeKey: key,
                expiresIn,
            };
        }

        return result;
    } catch {
        // Fail open - allow notification
        return {
            isDuplicate: false,
            dedupeKey: key,
        };
    }
}

/**
 * Record notification in database (fallback)
 */
async function recordNotificationDatabase(params: RecordNotificationParams): Promise<void> {
    const supabase = createServiceRoleClient();
    const key = getDedupeKey(params);
    const windowSeconds = getDeduplicationWindow(
        params.notificationType,
        params.customWindowSeconds
    );

    try {
        // Insert a placeholder record with the deduplication key
        // We use idempotency_key for this purpose
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from('notification_queue').upsert(
            {
                idempotency_key: key,
                guest_phone: params.guestPhone,
                notification_type: params.notificationType,
                status: 'pending',
                message_en: params.message || 'Deduplication marker',
                created_at: new Date().toISOString(),
                // Don't actually send - just mark for deduplication
                metadata: {
                    is_dedup_marker: true,
                    expires_at: new Date(Date.now() + windowSeconds * 1000).toISOString(),
                },
            },
            {
                onConflict: 'idempotency_key',
                ignoreDuplicates: true,
            }
        );

        if (error) {
            log.error('Database error during record', error);
        }
    } catch (error) {
        log.error('Unexpected database error during record', error);
    }
}

// =========================================================
// Main Exported Functions
// =========================================================

/**
 * Check if a notification is a duplicate
 *
 * This is the main entry point for checking deduplication.
 * Uses Redis as primary storage, falls back to database.
 *
 * @param params - Deduplication check parameters
 * @returns Promise<boolean> - true if duplicate, false if unique
 */
export async function isDuplicate(params: DedupeCheckParams): Promise<boolean> {
    const result = await checkDuplicateRedis(params);
    return result.isDuplicate;
}

/**
 * Record a sent notification to prevent future duplicates
 *
 * Call this after successfully sending a notification.
 *
 * @param params - Parameters for recording notification
 */
export async function recordNotification(params: RecordNotificationParams): Promise<void> {
    await recordNotificationRedis(params);
}

/**
 * Check if notification is duplicate AND record it in one atomic operation
 *
 * This is useful when you want to check and record in one call.
 *
 * @param params - Deduplication parameters
 * @returns Promise<DedupeCheckResult>
 */
export async function checkAndRecord(params: RecordNotificationParams): Promise<DedupeCheckResult> {
    // First check if duplicate
    const result = await checkDuplicateRedis(params);

    // If not duplicate, record it
    if (!result.isDuplicate) {
        await recordNotificationRedis(params);
    }

    return result;
}

/**
 * Clear old deduplication entries
 *
 * For Redis: This is handled automatically by TTL.
 * For database: Manually cleans up old entries.
 *
 * @param olderThanHours - Delete entries older than this many hours (default: 24)
 * @returns Number of entries cleared
 */
export async function clearOldEntries(olderThanHours: number = 24): Promise<number> {
    const redis = getRedisClient();

    if (redis) {
        // Redis handles expiration automatically via TTL
        // This function can be used to force cleanup if needed
        try {
            // Find and delete keys matching the pattern that have expired
            // Note: This is expensive for large datasets, prefer TTL
            const pattern = `${DEDUP_CONFIG.KEY_PREFIX}:*`;
            let cursor = '0';
            let deletedCount = 0;

            do {
                const [newCursor, keys] = await redis.scan(cursor, {
                    match: pattern,
                    count: 100,
                });
                cursor = newCursor;

                if (keys && keys.length > 0) {
                    const pipeline = redis.pipeline();
                    for (const key of keys) {
                        const ttl = await redis.ttl(key);
                        if (ttl <= 0) {
                            pipeline.del(key);
                            deletedCount++;
                        }
                    }
                    await pipeline.exec();
                }
            } while (cursor !== '0');

            return deletedCount;
        } catch (error) {
            log.error('Error during Redis cleanup', error);
        }
    }

    // Database fallback
    const supabase = createServiceRoleClient();
    const olderThan = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();

    try {
        // Delete old dedup markers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .from('notification_queue')
            .delete()
            .eq('metadata->>is_dedup_marker', 'true')
            .lt('created_at', olderThan);

if (error) {
        log.error('Database cleanup error', error);
        return 0;
    }

    return Array.isArray(data) ? data.length : 0;
} catch (error) {
    log.error('Unexpected cleanup error', error);
    return 0;
}
}

/**
 * Get statistics about deduplication (for monitoring)
 */
export async function getDeduplicationStats(): Promise<{
    redisAvailable: boolean;
    keysCount?: number;
}> {
    const redis = getRedisClient();

    if (!redis) {
        return { redisAvailable: false };
    }

    try {
        const pattern = `${DEDUP_CONFIG.KEY_PREFIX}:*`;
        let cursor = '0';
        let keysCount = 0;

        do {
            const [newCursor, keys] = await redis.scan(cursor, {
                match: pattern,
                count: 100,
            });
            cursor = newCursor;
            keysCount += keys?.length || 0;
        } while (cursor !== '0');

        return {
            redisAvailable: true,
            keysCount,
        };
    } catch (error) {
        log.error('Error getting stats', error);
        return { redisAvailable: false };
    }
}

// =========================================================
// Content-Based Deduplication (Optional Enhancement)
// =========================================================

/**
 * Hash message content for similarity-based deduplication
 *
 * @param message - Message content to hash
 * @returns SHA-256 hash of the message
 */
export function hashMessageContent(message: string): string {
    return createHash('sha256').update(message.trim().toLowerCase()).digest('hex');
}

/**
 * Check if two messages are similar (for content-based dedup)
 *
 * Uses simple exact match. For more sophisticated similarity,
 * consider using Levenshtein distance or Jaccard similarity.
 *
 * @param message1 - First message
 * @param message2 - Second message
 * @param threshold - Similarity threshold (0-1), default 0.9
 * @returns boolean
 */
export function isMessageSimilar(
    message1: string,
    message2: string,
    threshold: number = 0.9
): boolean {
    // Handle empty strings
    if (!message1 || !message2) {
        return false;
    }

    // Exact match
    if (message1.trim().toLowerCase() === message2.trim().toLowerCase()) {
        return true;
    }

    // Simple length-based similarity
    const len1 = message1.length;
    const len2 = message2.length;

    if (len1 === 0 || len2 === 0) {
        return false;
    }

    const longerLength = Math.max(len1, len2);
    const similarity = 1 - Math.abs(len1 - len2) / longerLength;

    return similarity >= threshold;
}
