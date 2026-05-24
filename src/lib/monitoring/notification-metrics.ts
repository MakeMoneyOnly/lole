/**
 * Notification Metrics Module
 *
 * Provides observability for the notification system:
 * - Track delivery metrics by channel (sms, push, email)
 * - Success/failure rates and retry statistics
 * - Delivery latency tracking
 * - Restaurant-level breakdown
 *
 * Uses Redis for real-time metrics aggregation with database fallback.
 * Integrates with Sentry for distributed tracing.
 *
 * @see docs/implementation/observability-setup.md
 */

import * as Sentry from '@sentry/nextjs';
import { Redis } from '@upstash/redis';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { logger } from '@/lib/logger';

// =========================================================
// Types and Interfaces
// =========================================================

/**
 * Supported notification channels
 */
export type NotificationChannel = 'sms' | 'push' | 'email';

/**
 * Metrics for a specific notification channel
 */
export interface ChannelMetrics {
    sent: number;
    failed: number;
    retries: number;
    avgLatencyMs: number;
}

/**
 * Aggregated notification metrics
 */
export interface NotificationMetrics {
    totalSent: number;
    totalFailed: number;
    successRate: number;
    avgLatencyMs: number;
    byChannel: {
        sms: ChannelMetrics;
        push: ChannelMetrics;
        email: ChannelMetrics;
    };
}

/**
 * Parameters for recording metrics
 */
export interface MetricParams {
    restaurantId: string;
    channel: NotificationChannel;
    latencyMs: number;
    notificationId?: string;
    errorCode?: string;
    errorMessage?: string;
}

/**
 * Date range for delivery reports
 */
export interface DateRange {
    startDate: Date;
    endDate: Date;
}

/**
 * Delivery report entry
 */
export interface DeliveryReportEntry {
    date: string;
    channel: NotificationChannel;
    sent: number;
    failed: number;
    successRate: number;
    avgLatencyMs: number;
}

/**
 * Aggregated delivery report
 */
export interface DeliveryReport {
    restaurantId: string;
    period: DateRange;
    totalSent: number;
    totalFailed: number;
    overallSuccessRate: number;
    avgLatencyMs: number;
    byChannel: {
        sms: ChannelMetrics;
        push: ChannelMetrics;
        email: ChannelMetrics;
    };
    dailyBreakdown: DeliveryReportEntry[];
}

/**
 * Notification event types for Sentry breadcrumbs
 */
export const NOTIFICATION_EVENTS = {
    SENT: 'notification.sent',
    FAILED: 'notification.failed',
    RETRY: 'notification.retry',
    QUEUED: 'notification.queued',
    DEDUPED: 'notification.deduped',
} as const;

// =========================================================
// Redis Configuration
// =========================================================

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Key prefixes for Redis
const METRICS_PREFIX = 'notif:metrics';
const CHANNEL_SUFFIX = {
    sent: 'sent',
    failed: 'failed',
    retries: 'retries',
    latency: 'latency',
} as const;

/**
 * Build Redis key for notification metrics
 */
function buildMetricKey(
    restaurantId: string,
    channel: NotificationChannel,
    metric: string
): string {
    return `${METRICS_PREFIX}:${restaurantId}:${channel}:${metric}`;
}

/**
 * Build Redis key for global metrics (no restaurant)
 */
function buildGlobalMetricKey(channel: NotificationChannel, metric: string): string {
    return `${METRICS_PREFIX}:global:${channel}:${metric}`;
}

// =========================================================
// Redis Client (Singleton)
// =========================================================

let redisClient: Redis | null = null;

/**
 * Get or create the Redis client for metrics
 */
function getRedisClient(): Redis | null {
    if (redisClient) {
        return redisClient;
    }

    if (!REDIS_URL || !REDIS_TOKEN) {
        logger.warn(
            '[notification-metrics] Redis not configured, metrics will not be aggregated in real-time'
        );
        return null;
    }

    try {
        redisClient = new Redis({
            url: REDIS_URL,
            token: REDIS_TOKEN,
        });
        return redisClient;
    } catch (error) {
        logger.error('[notification-metrics] Failed to initialize Redis client', error);
        return null;
    }
}

/**
 * Close the Redis client (for testing)
 */
export async function closeMetricsRedis(): Promise<void> {
    if (redisClient) {
        redisClient = null;
    }
}

// =========================================================
// Metrics Recording Functions
// =========================================================

/**
 * Increment a counter in Redis
 */
async function _incrementCounter(key: string, amount: number = 1): Promise<void> {
    const redis = getRedisClient();
    if (redis) {
        try {
            await redis.incrby(key, amount);
            // Set expiry to 30 days for metrics retention
            await redis.expire(key, 30 * 24 * 60 * 60);
        } catch (error) {
            logger.error('[notification-metrics] Redis increment error', error);
        }
    }
}

/**
 * Add to latency sum in Redis (for calculating average)
 */
async function _addLatency(key: string, latencyMs: number): Promise<void> {
    const redis = getRedisClient();
    if (redis) {
        try {
            await redis.incrbyfloat(key, latencyMs);
            await redis.expire(key, 30 * 24 * 60 * 60);
        } catch (error) {
            logger.error('[notification-metrics] Redis latency error', error);
        }
    }
}

/**
 * Record a successful notification send
 *
 * @example
 * await recordNotificationSent({
 *   restaurantId: 'rest-123',
 *   channel: 'sms',
 *   latencyMs: 250,
 *   notificationId: 'notif-456'
 * });
 */
export async function recordNotificationSent(params: MetricParams): Promise<void> {
    const { restaurantId, channel, latencyMs, notificationId } = params;

    // Add Sentry breadcrumb
    Sentry.addBreadcrumb({
        category: 'notification',
        type: 'info',
        message: `Notification sent via ${channel}`,
        level: 'info',
        data: {
            restaurantId,
            channel,
            latencyMs,
            notificationId,
        },
    });

    // Record Sentry span
    const span = Sentry.startInactiveSpan({
        name: `notification.sent.${channel}`,
        op: 'notification',
    });
    span.setAttribute('restaurant_id', restaurantId);
    span.setAttribute('channel', channel);
    span.setAttribute('success', 'true');
    if (notificationId) {
        span.setAttribute('notification_id', notificationId);
    }
    span.end();

    // Update Redis counters
    const redis = getRedisClient();
    if (redis) {
        try {
            const pipeline = redis.pipeline();
            pipeline.incrby(buildMetricKey(restaurantId, channel, CHANNEL_SUFFIX.sent), 1);
            pipeline.incrby(buildGlobalMetricKey(channel, CHANNEL_SUFFIX.sent), 1);
            pipeline.incrby(
                buildMetricKey(restaurantId, channel, CHANNEL_SUFFIX.latency),
                latencyMs
            );
            pipeline.incrby(buildGlobalMetricKey(channel, CHANNEL_SUFFIX.latency), latencyMs);
            pipeline.expire(
                buildMetricKey(restaurantId, channel, CHANNEL_SUFFIX.sent),
                30 * 24 * 60 * 60
            );
            pipeline.expire(buildGlobalMetricKey(channel, CHANNEL_SUFFIX.sent), 30 * 24 * 60 * 60);
            pipeline.expire(
                buildMetricKey(restaurantId, channel, CHANNEL_SUFFIX.latency),
                30 * 24 * 60 * 60
            );
            pipeline.expire(
                buildGlobalMetricKey(channel, CHANNEL_SUFFIX.latency),
                30 * 24 * 60 * 60
            );
            await pipeline.exec();
        } catch (error) {
            logger.error('[notification-metrics] Error recording sent metrics', error);
        }
    }

    // Also record to database for persistence
    try {
        const supabase = createServiceRoleClient();
        await supabase.from('notification_metrics').insert({
            restaurant_id: restaurantId,
            channel,
            status: 'sent',
            latency_ms: latencyMs,
            notification_id: notificationId,
            recorded_at: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('[notification-metrics] Database insert error', error);
    }
}

/**
 * Record a failed notification
 *
 * @example
 * await recordNotificationFailed({
 *   restaurantId: 'rest-123',
 *   channel: 'sms',
 *   latencyMs: 500,
 *   notificationId: 'notif-456',
 *   errorCode: 'PROVIDER_ERROR',
 *   errorMessage: 'SMS provider timeout'
 * });
 */
export async function recordNotificationFailed(params: MetricParams): Promise<void> {
    const { restaurantId, channel, latencyMs, notificationId, errorCode, errorMessage } = params;

    // Add Sentry breadcrumb with error details
    Sentry.addBreadcrumb({
        category: 'notification',
        type: 'error',
        message: `Notification failed via ${channel}`,
        level: 'error',
        data: {
            restaurantId,
            channel,
            notificationId,
            errorCode,
            errorMessage,
        },
    });

    // Record Sentry span as error
    const span = Sentry.startInactiveSpan({
        name: `notification.failed.${channel}`,
        op: 'notification',
    });
    span.setAttribute('restaurant_id', restaurantId);
    span.setAttribute('channel', channel);
    span.setAttribute('success', 'false');
    span.setAttribute('error_code', errorCode || 'unknown');
    if (notificationId) {
        span.setAttribute('notification_id', notificationId);
    }
    if (errorMessage) {
        span.setAttribute('error_message', errorMessage);
    }
    span.setStatus({ code: 2, message: errorMessage || 'Failed' });
    span.end();

    // Update Redis counters
    const redis = getRedisClient();
    if (redis) {
        try {
            const pipeline = redis.pipeline();
            pipeline.incrby(buildMetricKey(restaurantId, channel, CHANNEL_SUFFIX.failed), 1);
            pipeline.incrby(buildGlobalMetricKey(channel, CHANNEL_SUFFIX.failed), 1);
            pipeline.expire(
                buildMetricKey(restaurantId, channel, CHANNEL_SUFFIX.failed),
                30 * 24 * 60 * 60
            );
            pipeline.expire(
                buildGlobalMetricKey(channel, CHANNEL_SUFFIX.failed),
                30 * 24 * 60 * 60
            );
            await pipeline.exec();
        } catch (error) {
            logger.error('[notification-metrics] Error recording failed metrics', error);
        }
    }

    // Record to database
    try {
        const supabase = createServiceRoleClient();
        await supabase.from('notification_metrics').insert({
            restaurant_id: restaurantId,
            channel,
            status: 'failed',
            latency_ms: latencyMs,
            notification_id: notificationId,
            error_code: errorCode,
            error_message: errorMessage,
            recorded_at: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('[notification-metrics] Database insert error', error);
    }
}

/**
 * Record a retry attempt
 *
 * @example
 * await recordRetryAttempt({
 *   restaurantId: 'rest-123',
 *   channel: 'sms',
 *   latencyMs: 1000,
 *   notificationId: 'notif-456'
 * });
 */
export async function recordRetryAttempt(params: MetricParams): Promise<void> {
    const { restaurantId, channel, latencyMs, notificationId } = params;

    // Add Sentry breadcrumb
    Sentry.addBreadcrumb({
        category: 'notification',
        type: 'info',
        message: `Notification retry via ${channel}`,
        level: 'warning',
        data: {
            restaurantId,
            channel,
            latencyMs,
            notificationId,
        },
    });

    // Record Sentry span
    const span = Sentry.startInactiveSpan({
        name: `notification.retry.${channel}`,
        op: 'notification.retry',
    });
    span.setAttribute('restaurant_id', restaurantId);
    span.setAttribute('channel', channel);
    span.setAttribute('notification_id', notificationId || '');
    span.end();

    // Update Redis counters
    const redis = getRedisClient();
    if (redis) {
        try {
            const pipeline = redis.pipeline();
            pipeline.incrby(buildMetricKey(restaurantId, channel, CHANNEL_SUFFIX.retries), 1);
            pipeline.incrby(buildGlobalMetricKey(channel, CHANNEL_SUFFIX.retries), 1);
            pipeline.incrby(
                buildMetricKey(restaurantId, channel, CHANNEL_SUFFIX.latency),
                latencyMs
            );
            pipeline.expire(
                buildMetricKey(restaurantId, channel, CHANNEL_SUFFIX.retries),
                30 * 24 * 60 * 60
            );
            pipeline.expire(
                buildGlobalMetricKey(channel, CHANNEL_SUFFIX.retries),
                30 * 24 * 60 * 60
            );
            await pipeline.exec();
        } catch (error) {
            logger.error('[notification-metrics] Error recording retry metrics', error);
        }
    }
}

// =========================================================
// Metrics Retrieval Functions
// =========================================================

/**
 * Get a numeric value from Redis with fallback to database
 */
async function getMetricValue(
    restaurantId: string | null,
    channel: NotificationChannel,
    metric: string
): Promise<number> {
    const redis = getRedisClient();

    if (redis && restaurantId) {
        try {
            const value = await redis.get(buildMetricKey(restaurantId, channel, metric));
            return typeof value === 'number' ? value : 0;
        } catch (error) {
            logger.error('[notification-metrics] Redis get error', error);
        }
    }

    // Fallback to database
    return getMetricFromDatabase(restaurantId, channel, metric);
}

/**
 * Get metrics from database as fallback
 */
async function getMetricFromDatabase(
    restaurantId: string | null,
    channel: NotificationChannel,
    metric: string
): Promise<number> {
    try {
        const supabase = createServiceRoleClient();

        let query = supabase
            .from('notification_metrics')
            .select('id', { count: 'exact', head: true });

        if (restaurantId) {
            query = query.eq('restaurant_id', restaurantId);
        }

        // Map metric to database column
        if (metric === CHANNEL_SUFFIX.sent) {
            query = query.eq('status', 'sent');
        } else if (metric === CHANNEL_SUFFIX.failed) {
            query = query.eq('status', 'failed');
        } else if (metric === CHANNEL_SUFFIX.retries) {
            // Count retries from the metrics table
            query = query.eq('is_retry', true);
        }

        const { count, error } = await query;
        if (error) throw error;

        return count || 0;
    } catch (error) {
        logger.error('[notification-metrics] Database query error', error);
        return 0;
    }
}

/**
 * Calculate average latency from Redis sum and count
 */
async function getAverageLatency(
    restaurantId: string | null,
    channel: NotificationChannel
): Promise<number> {
    const redis = getRedisClient();

    if (redis && restaurantId) {
        try {
            const [latencySum, sentCount] = await Promise.all([
                redis.get(buildMetricKey(restaurantId, channel, CHANNEL_SUFFIX.latency)),
                redis.get(buildMetricKey(restaurantId, channel, CHANNEL_SUFFIX.sent)),
            ]);

            const sum = typeof latencySum === 'number' ? latencySum : 0;
            const count = typeof sentCount === 'number' ? sentCount : 0;

            return count > 0 ? Math.round(sum / count) : 0;
        } catch (error) {
            logger.error('[notification-metrics] Redis latency calculation error', error);
        }
    }

    // Fallback to database
    return getLatencyFromDatabase(restaurantId, channel);
}

/**
 * Get average latency from database
 */
async function getLatencyFromDatabase(
    restaurantId: string | null,
    channel: NotificationChannel
): Promise<number> {
    try {
        const supabase = createServiceRoleClient();

        let query = supabase.from('notification_metrics').select('latency_ms');

        if (restaurantId) {
            query = query.eq('restaurant_id', restaurantId);
        }
        query = query.eq('channel', channel);

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) return 0;

        const sum = data.reduce((acc, row) => acc + (row.latency_ms || 0), 0);
        return Math.round(sum / data.length);
    } catch (error) {
        logger.error('[notification-metrics] Database latency query error', error);
        return 0;
    }
}

/**
 * Get notification metrics for a restaurant or globally
 *
 * @example
 * // Get global metrics
 * const metrics = await getNotificationMetrics();
 *
 * // Get metrics for specific restaurant
 * const restaurantMetrics = await getNotificationMetrics('rest-123');
 */
export async function getNotificationMetrics(restaurantId?: string): Promise<NotificationMetrics> {
    const channels: NotificationChannel[] = ['sms', 'push', 'email'];
    const byChannel: NotificationMetrics['byChannel'] = {
        sms: { sent: 0, failed: 0, retries: 0, avgLatencyMs: 0 },
        push: { sent: 0, failed: 0, retries: 0, avgLatencyMs: 0 },
        email: { sent: 0, failed: 0, retries: 0, avgLatencyMs: 0 },
    };

    let totalSent = 0;
    let totalFailed = 0;
    let totalLatency = 0;
    let totalCount = 0;

    for (const channel of channels) {
        const sent = await getMetricValue(restaurantId || null, channel, CHANNEL_SUFFIX.sent);
        const failed = await getMetricValue(restaurantId || null, channel, CHANNEL_SUFFIX.failed);
        const retries = await getMetricValue(restaurantId || null, channel, CHANNEL_SUFFIX.retries);
        const avgLatencyMs = await getAverageLatency(restaurantId || null, channel);

        byChannel[channel] = { sent, failed, retries, avgLatencyMs };

        totalSent += sent;
        totalFailed += failed;
        totalLatency += avgLatencyMs * (sent + failed);
        totalCount += sent + failed;
    }

    const successRate =
        totalSent + totalFailed > 0
            ? Math.round((totalSent / (totalSent + totalFailed)) * 10000) / 100
            : 0;

    const avgLatencyMs = totalCount > 0 ? Math.round(totalLatency / totalCount) : 0;

    return {
        totalSent,
        totalFailed,
        successRate,
        avgLatencyMs,
        byChannel,
    };
}

/**
 * Get delivery report with date range filtering
 *
 * @example
 * const report = await getDeliveryReport('rest-123', {
 *   startDate: new Date('2026-01-01'),
 *   endDate: new Date('2026-03-17')
 * });
 */
export async function getDeliveryReport(
    restaurantId: string,
    dateRange: DateRange
): Promise<DeliveryReport> {
    const channels: NotificationChannel[] = ['sms', 'push', 'email'];

    // Try Redis first for recent data
    const redis = getRedisClient();
    const useRedis = redis !== null;

    const byChannel: DeliveryReport['byChannel'] = {
        sms: { sent: 0, failed: 0, retries: 0, avgLatencyMs: 0 },
        push: { sent: 0, failed: 0, retries: 0, avgLatencyMs: 0 },
        email: { sent: 0, failed: 0, retries: 0, avgLatencyMs: 0 },
    };

    let totalSent = 0;
    let totalFailed = 0;
    let avgLatencyMs = 0;

    if (useRedis) {
        // Get data from Redis (last 24 hours or aggregated)
        for (const channel of channels) {
            const sent = await getMetricValue(restaurantId, channel, CHANNEL_SUFFIX.sent);
            const failed = await getMetricValue(restaurantId, channel, CHANNEL_SUFFIX.failed);
            const retries = await getMetricValue(restaurantId, channel, CHANNEL_SUFFIX.retries);
            const latency = await getAverageLatency(restaurantId, channel);

            byChannel[channel] = { sent, failed, retries, avgLatencyMs: latency };
            totalSent += sent;
            totalFailed += failed;
        }
    }

    // Always get historical data from database for date range
    try {
        const supabase = createServiceRoleClient();

        const { data, error } = await supabase
            .from('notification_metrics')
            .select('channel, status, latency_ms, recorded_at')
            .eq('restaurant_id', restaurantId)
            .gte('recorded_at', dateRange.startDate.toISOString())
            .lte('recorded_at', dateRange.endDate.toISOString());

        if (error) throw error;

        if (data && data.length > 0) {
            // Aggregate from database
            const channelData: Record<
                NotificationChannel,
                { sent: number; failed: number; latencies: number[] }
            > = {
                sms: { sent: 0, failed: 0, latencies: [] },
                push: { sent: 0, failed: 0, latencies: [] },
                email: { sent: 0, failed: 0, latencies: [] },
            };

            for (const row of data) {
                const channel = row.channel as NotificationChannel;
                if (!channelData[channel]) continue;

                if (row.status === 'sent') {
                    channelData[channel].sent++;
                } else if (row.status === 'failed') {
                    channelData[channel].failed++;
                }

                if (row.latency_ms) {
                    channelData[channel].latencies.push(row.latency_ms);
                }
            }

            // Calculate averages and totals
            let dbTotalSent = 0;
            let dbTotalFailed = 0;
            let dbTotalLatency = 0;
            let dbTotalCount = 0;

            for (const channel of channels) {
                const cd = channelData[channel];
                const avgLat =
                    cd.latencies.length > 0
                        ? Math.round(cd.latencies.reduce((a, b) => a + b, 0) / cd.latencies.length)
                        : 0;

                // Merge with Redis data (prefer higher values)
                byChannel[channel] = {
                    sent: Math.max(byChannel[channel].sent, cd.sent),
                    failed: Math.max(byChannel[channel].failed, cd.failed),
                    retries: byChannel[channel].retries,
                    avgLatencyMs:
                        cd.latencies.length > 0 ? avgLat : byChannel[channel].avgLatencyMs,
                };

                dbTotalSent += cd.sent;
                dbTotalFailed += cd.failed;
                dbTotalLatency += avgLat * cd.latencies.length;
                dbTotalCount += cd.latencies.length;
            }

            totalSent = Math.max(totalSent, dbTotalSent);
            totalFailed = Math.max(totalFailed, dbTotalFailed);
            avgLatencyMs = dbTotalCount > 0 ? Math.round(dbTotalLatency / dbTotalCount) : 0;
        }
    } catch (error) {
        logger.error('[notification-metrics] Error fetching delivery report', error);
    }

    const overallSuccessRate =
        totalSent + totalFailed > 0
            ? Math.round((totalSent / (totalSent + totalFailed)) * 10000) / 100
            : 0;

    // Generate daily breakdown
    const dailyBreakdown: DeliveryReportEntry[] = [];
    const currentDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];

        for (const channel of channels) {
            dailyBreakdown.push({
                date: dateStr,
                channel,
                sent: byChannel[channel].sent,
                failed: byChannel[channel].failed,
                successRate:
                    byChannel[channel].sent + byChannel[channel].failed > 0
                        ? Math.round(
                              (byChannel[channel].sent /
                                  (byChannel[channel].sent + byChannel[channel].failed)) *
                                  10000
                          ) / 100
                        : 0,
                avgLatencyMs: byChannel[channel].avgLatencyMs,
            });
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
        restaurantId,
        period: dateRange,
        totalSent,
        totalFailed,
        overallSuccessRate,
        avgLatencyMs,
        byChannel,
        dailyBreakdown,
    };
}

// =========================================================
// Sentry Context Helpers
// =========================================================

/**
 * Add notification context to Sentry
 */
export function setNotificationContext(
    restaurantId: string,
    notificationId?: string,
    channel?: NotificationChannel
): void {
    Sentry.setTag('restaurant_id', restaurantId);
    if (notificationId) {
        Sentry.setTag('notification_id', notificationId);
    }
    if (channel) {
        Sentry.setTag('notification_channel', channel);
    }
}

/**
 * Clear notification context
 */
export function clearNotificationContext(): void {
    Sentry.setTag('notification_id', undefined);
    Sentry.setTag('notification_channel', undefined);
}

// =========================================================
// Monitoring Wrapper
// =========================================================

/**
 * Wrap notification sending with automatic metrics recording
 *
 * @example
 * const result = await withNotificationMetrics(
 *   'rest-123',
 *   'sms',
 *   async () => {
 *     return await sendSms({ to: '+251911234567', message: 'Hello' });
 *   }
 * );
 */
export async function withNotificationMetrics<T>(
    restaurantId: string,
    channel: NotificationChannel,
    operation: () => Promise<T>,
    options?: {
        notificationId?: string;
        tags?: Record<string, string>;
    }
): Promise<T> {
    const startTime = Date.now();

    return Sentry.startSpan(
        {
            name: `notification.${channel}`,
            op: 'notification.send',
        },
        async span => {
            span.setAttribute('restaurant_id', restaurantId);
            span.setAttribute('channel', channel);
            if (options?.notificationId) {
                span.setAttribute('notification_id', options.notificationId);
            }
            if (options?.tags) {
                for (const [key, value] of Object.entries(options.tags)) {
                    span.setAttribute(key, value);
                }
            }

            try {
                const result = await operation();
                const latencyMs = Date.now() - startTime;

                // Record success
                await recordNotificationSent({
                    restaurantId,
                    channel,
                    latencyMs,
                    notificationId: options?.notificationId,
                });

                span.setStatus({ code: 1 }); // OK
                return result;
            } catch (error) {
                const latencyMs = Date.now() - startTime;
                const errorMessage = error instanceof Error ? error.message : String(error);

                // Record failure
                await recordNotificationFailed({
                    restaurantId,
                    channel,
                    latencyMs,
                    notificationId: options?.notificationId,
                    errorCode: 'INTERNAL_ERROR',
                    errorMessage,
                });

                span.setStatus({ code: 2, message: errorMessage });
                throw error;
            }
        }
    );
}
