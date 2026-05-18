import { Client as QStashClient } from '@upstash/qstash';
import { Redis } from '@upstash/redis';
import type { loleEvent } from '@/lib/events/contracts';
import { validateEventSchema } from '@/lib/events/contracts';
import { getAppUrl } from '@/lib/config/env';
import { logger } from '@/lib/logger';

const PUBLISH_MAX_RETRIES = 3;
const PUBLISH_RETRY_DELAY_MS = [1000, 2000, 4000];

export interface PublishEventResult {
    eventId: string;
    streamName: string;
    streamEntryId?: string;
    jobMessageId?: string;
    retried: boolean;
    retryCount: number;
    dlqPersisted: boolean;
}

interface FailedEventRecord {
    event_id: string;
    event_name: string;
    stream_name: string;
    payload: Record<string, unknown>;
    trace_id: string;
    occurred_at: string;
    error_message: string;
    retry_count: number;
    max_retries: number;
    status: 'pending';
}

function getRedisClient(): Redis | null {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        return null;
    }

    return new Redis({ url, token });
}

function getQStashClient(): QStashClient | null {
    const token = process.env.QSTASH_TOKEN;
    if (!token) {
        return null;
    }

    return new QStashClient({ token });
}

function toStreamName(eventName: string): string {
    return `lole:events:${eventName.replaceAll('.', ':')}`;
}

/**
 * Persist failed event to dead-letter queue (failed_events table).
 * Uses service role client for database write access.
 * Returns true if persisted successfully, false otherwise.
 */
async function persistToDLQ(
    event: loleEvent,
    streamName: string,
    errorMessage: string,
    retryCount: number
): Promise<boolean> {
    try {
        const { createServiceRoleClient } = await import('@/lib/supabase/service-role');
        const supabase = createServiceRoleClient();

        const record: FailedEventRecord = {
            event_id: event.id,
            event_name: event.name,
            stream_name: streamName,
            payload: event.payload as Record<string, unknown>,
            trace_id: event.trace_id,
            occurred_at: event.occurred_at,
            error_message: errorMessage,
            retry_count: retryCount,
            max_retries: PUBLISH_MAX_RETRIES,
            status: 'pending',
        };

        const { error } = await supabase.from('failed_events').insert(record);

        if (error) {
            logger.error('[events] Failed to persist event to DLQ', {
                eventId: event.id,
                eventName: event.name,
                dlqError: error.message,
            });
            return false;
        }

        logger.warn('[events] Event persisted to dead-letter queue', {
            eventId: event.id,
            eventName: event.name,
            retryCount,
        });

        return true;
    } catch (dlqError) {
        logger.error('[events] DLQ persistence threw exception', {
            eventId: event.id,
            eventName: event.name,
            error: dlqError instanceof Error ? dlqError.message : String(dlqError),
        });
        return false;
    }
}

/**
 * Publish an event to Redis Streams with exponential backoff retry.
 *
 * BKND-039: Schema validation — validates payload against Zod schema before publishing.
 * BKND-038: Retry logic — 3 attempts with 1s/2s/4s delays.
 * BKND-037: On final failure, event is persisted to failed_events table (DLQ).
 *
 * @param event - The event to publish
 * @returns PublishEventResult with retry and DLQ status
 */
export async function publishEvent(event: loleEvent): Promise<PublishEventResult> {
    const streamName = toStreamName(event.name);

    // BKND-039: Validate event payload schema before publishing
    if (!validateEventSchema(event)) {
        logger.error('[events] Event schema validation failed, publishing to DLQ', {
            eventId: event.id,
            eventName: event.name,
        });

        const dlqOk = await persistToDLQ(event, streamName, 'Schema validation failed', 0);

        return {
            eventId: event.id,
            streamName,
            streamEntryId: undefined,
            retried: false,
            retryCount: 0,
            dlqPersisted: dlqOk,
        };
    }

    const redis = getRedisClient();

    if (!redis) {
        if (process.env.NODE_ENV !== 'test') {
            logger.warn(
                `[events] Upstash Redis not configured, publishing event to DLQ: ${event.name}`
            );
        }

        const dlqOk = await persistToDLQ(event, streamName, 'Redis client unavailable', 0);

        return {
            eventId: event.id,
            streamName,
            streamEntryId: undefined,
            retried: false,
            retryCount: 0,
            dlqPersisted: dlqOk,
        };
    }

    let lastError: Error | null = null;
    let streamEntryId: string | undefined;
    let retryCount = 0;
    let retried = false;

    // Attempt publish with exponential backoff
    for (let attempt = 0; attempt < PUBLISH_MAX_RETRIES; attempt++) {
        try {
            streamEntryId = await redis.xadd(streamName, '*', {
                eventId: event.id,
                eventName: event.name,
                occurredAt: event.occurred_at,
                version: event.version,
                traceId: event.trace_id,
                payload: JSON.stringify(event.payload),
            });

            // Success — exit retry loop
            retryCount = attempt;
            if (attempt > 0) {
                retried = true;
                logger.info('[events] Event published after retry', {
                    eventId: event.id,
                    eventName: event.name,
                    attempt: attempt + 1,
                });
            }
            break;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            retryCount = attempt + 1;

            const isLastAttempt = attempt === PUBLISH_MAX_RETRIES - 1;

            logger.warn('[events] Event publish attempt failed', {
                eventId: event.id,
                eventName: event.name,
                attempt: attempt + 1,
                maxRetries: PUBLISH_MAX_RETRIES,
                error: lastError.message,
                isLastAttempt,
            });

            if (!isLastAttempt) {
                // Wait before retry with exponential backoff
                await new Promise(resolve => setTimeout(resolve, PUBLISH_RETRY_DELAY_MS[attempt]));
            }
        }
    }

    // If all retries exhausted, persist to dead-letter queue
    let dlqPersisted = false;
    if (!streamEntryId) {
        dlqPersisted = await persistToDLQ(
            event,
            streamName,
            lastError?.message ?? 'All publish attempts failed',
            retryCount
        );
    }

    return {
        eventId: event.id,
        streamName,
        streamEntryId,
        retried,
        retryCount,
        dlqPersisted,
    };
}

export async function enqueueInternalJob<TBody extends Record<string, unknown>>(params: {
    path: string;
    body: TBody;
    deduplicationKey: string;
}): Promise<string | undefined> {
    const client = getQStashClient();
    const appUrl = getAppUrl();
    const destinationUrl = new URL(params.path, appUrl).toString();

    if (!client) {
        if (process.env.NODE_ENV !== 'test') {
            logger.warn(`[jobs] QStash not configured, skipping enqueue for ${params.path}`);
        }
        return undefined;
    }

    const result = await client.publishJSON({
        url: destinationUrl,
        body: params.body,
        retries: 5,
        headers: {
            'x-lole-job-key': process.env.QSTASH_TOKEN ?? '',
        },
        contentBasedDeduplication: false,
        deduplicationId: params.deduplicationKey,
    });

    return result.messageId;
}
