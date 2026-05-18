// Event Bus Publisher
// Publishes events to Redis Streams for async processing
//
// BKND-038: Added retry with exponential backoff (3 attempts: 1s/2s/4s).
// BKND-037: On final failure, events persisted to failed_events table (DLQ).
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

const PUBLISH_MAX_RETRIES = 3;
const PUBLISH_RETRY_DELAY_MS = [1000, 2000, 4000];

// Use Upstash Redis environment variables
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// Only create Redis client if credentials are available
const redis =
    redisUrl && redisToken
        ? new Redis({
              url: redisUrl,
              token: redisToken,
          })
        : null;

export type EventType =
    | 'order.created'
    | 'order.status_changed'
    | 'order.completed'
    | 'order.cancelled'
    | 'payment.completed'
    | 'payment.failed'
    | 'menu.updated'
    | 'loyalty.points_earned'
    | 'table.opened'
    | 'table.closed'
    | 'table.waitlist.notify'
    | 'reservation.reminder'
    | 'notification.queued'
    | 'notification.sent'
    | 'notification.failed'
    | 'notification.retry_scheduled';

export interface EventPayload {
    [key: string]: unknown;
}

async function persistToDLQ(
    type: EventType,
    payload: EventPayload,
    errorMessage: string,
    retryCount: number
): Promise<void> {
    try {
        const { createServiceRoleClient } = await import('@/lib/supabase/service-role');
        const supabase = createServiceRoleClient();

        const { error } = await supabase.from('failed_events').insert({
            event_id: crypto.randomUUID(),
            event_name: type,
            stream_name: `events:${type.split('.')[0]}`,
            payload: payload as Record<string, unknown>,
            trace_id: crypto.randomUUID(),
            occurred_at: new Date().toISOString(),
            error_message: errorMessage,
            retry_count: retryCount,
            max_retries: PUBLISH_MAX_RETRIES,
            status: 'pending',
        });

        if (error) {
            logger.error('[publisher] Failed to persist event to DLQ', {
                eventType: type,
                dlqError: error.message,
            });
        } else {
            logger.warn('[publisher] Event persisted to dead-letter queue', {
                eventType: type,
                retryCount,
            });
        }
    } catch (dlqError) {
        logger.error('[publisher] DLQ persistence threw exception', {
            eventType: type,
            error: dlqError instanceof Error ? dlqError.message : String(dlqError),
        });
    }
}

export async function publishEvent(type: EventType, payload: EventPayload): Promise<void> {
    if (!redis) {
        logger.warn('[publisher] Redis not available, persisting event to DLQ');
        await persistToDLQ(type, payload, 'Redis client unavailable', 0);
        return;
    }

    const streamKey = `events:${type.split('.')[0]}`;
    const event = {
        type,
        payload: JSON.stringify(payload),
        timestamp: new Date().toISOString(),
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < PUBLISH_MAX_RETRIES; attempt++) {
        try {
            await redis.xadd(streamKey, '*', event);
            if (attempt > 0) {
                logger.info('[publisher] Event published after retry', {
                    eventType: type,
                    attempt: attempt + 1,
                });
            }
            return;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            logger.warn('[publisher] Event publish attempt failed', {
                eventType: type,
                attempt: attempt + 1,
                maxRetries: PUBLISH_MAX_RETRIES,
                error: lastError.message,
            });

            if (attempt < PUBLISH_MAX_RETRIES - 1) {
                await new Promise(resolve => setTimeout(resolve, PUBLISH_RETRY_DELAY_MS[attempt]));
            }
        }
    }

    await persistToDLQ(
        type,
        payload,
        lastError?.message ?? 'All publish attempts failed',
        PUBLISH_MAX_RETRIES
    );
}

// For backward compatibility - single stream
export async function publish(event: EventType, data: EventPayload): Promise<void> {
    if (!redis) {
        logger.warn('[publisher] Redis not available, persisting event to DLQ');
        await persistToDLQ(event, data, 'Redis client unavailable', 0);
        return;
    }

    const eventData = {
        type: event,
        data: JSON.stringify(data),
        timestamp: new Date().toISOString(),
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < PUBLISH_MAX_RETRIES; attempt++) {
        try {
            await redis.xadd('events', '*', eventData);
            if (attempt > 0) {
                logger.info('[publisher] Event published after retry', {
                    eventType: event,
                    attempt: attempt + 1,
                });
            }
            return;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            logger.warn('[publisher] Event publish attempt failed', {
                eventType: event,
                attempt: attempt + 1,
                maxRetries: PUBLISH_MAX_RETRIES,
                error: lastError.message,
            });

            if (attempt < PUBLISH_MAX_RETRIES - 1) {
                await new Promise(resolve => setTimeout(resolve, PUBLISH_RETRY_DELAY_MS[attempt]));
            }
        }
    }

    await persistToDLQ(
        event,
        data,
        lastError?.message ?? 'All publish attempts failed',
        PUBLISH_MAX_RETRIES
    );
}
