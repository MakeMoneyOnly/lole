#!/usr/bin/env tsx
/**
 * Event Replay Tool — BKND-040
 *
 * Reads failed events from failed_events table and republishes them
 * to Redis Streams. Includes idempotency key support to prevent
 * double-processing.
 *
 * Usage:
 *   npx tsx scripts/tools/replay-events.ts [--limit 100] [--dry-run] [--status pending]
 *
 * Options:
 *   --limit N     Max events to replay (default: 100)
 *   --dry-run     Show what would be replayed without executing
 *   --status      Filter by status (default: pending)
 *   --event       Filter by event name
 *   --days N      Only events older than N days
 */

import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

interface FailedEvent {
    id: string;
    event_id: string;
    event_name: string;
    stream_name: string;
    payload: Record<string, unknown>;
    trace_id: string;
    error_message: string;
    retry_count: number;
    status: string;
    created_at: string;
}

function loadEnv() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!supabaseUrl || !supabaseKey) {
        console.error(
            '❌ Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.'
        );
        process.exit(1);
    }

    if (!redisUrl || !redisToken) {
        console.error(
            '❌ Missing Redis credentials. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
        );
        process.exit(1);
    }

    return { supabaseUrl, supabaseKey, redisUrl, redisToken };
}

function parseArgs() {
    const args = process.argv.slice(2);
    const options: Record<string, string> = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i].slice(2);
            options[key] = args[i + 1] || 'true';
            if (args[i + 1] && !args[i + 1].startsWith('--')) i++;
        }
    }
    return {
        limit: parseInt(options.limit || '100'),
        dryRun: 'dry-run' in options || options['dry-run'] === 'true',
        status: options.status || 'pending',
        eventName: options.event || null,
        days: parseInt(options.days || '0'),
    };
}

async function fetchFailedEvents(
    supabase: any,
    options: ReturnType<typeof parseArgs>
): Promise<FailedEvent[]> {
    let query = supabase
        .from('failed_events')
        .select('*')
        .eq('status', options.status)
        .order('created_at', { ascending: true })
        .limit(options.limit);

    if (options.eventName) {
        query = query.eq('event_name', options.eventName);
    }
    if (options.days > 0) {
        const cutoff = new Date(Date.now() - options.days * 86400000);
        query = query.lt('created_at', cutoff.toISOString());
    }

    const { data, error } = await query;

    if (error) {
        console.error('❌ Failed to fetch events:', error.message);
        process.exit(1);
    }

    return (data as FailedEvent[]) || [];
}

async function republishEvent(
    redis: Redis,
    event: FailedEvent
): Promise<{ success: boolean; streamEntryId?: string; error?: string }> {
    try {
        const streamEntryId = await redis.xadd(event.stream_name, '*', {
            eventId: event.event_id,
            eventName: event.event_name,
            occurredAt: event.created_at,
            payload: JSON.stringify(event.payload),
            traceId: event.trace_id,
            replayed: 'true',
            originalFailedEventId: event.id,
        });
        return { success: true, streamEntryId };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function markReplayed(supabase: any, eventId: string): Promise<void> {
    await supabase
        .from('failed_events')
        .update({
            status: 'replayed',
            updated_at: new Date().toISOString(),
        })
        .eq('id', eventId);
}

async function markDead(supabase: any, eventId: string): Promise<void> {
    await supabase
        .from('failed_events')
        .update({
            status: 'dead',
            updated_at: new Date().toISOString(),
        })
        .eq('id', eventId);
}

async function main() {
    const { supabaseUrl, supabaseKey, redisUrl, redisToken } = loadEnv();
    const options = parseArgs();

    const supabase = createClient(supabaseUrl, supabaseKey);
    const redis = new Redis({ url: redisUrl, token: redisToken });

    console.log(`\n🔄 Event Replay Tool`);
    console.log(`   Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`   Status: ${options.status}`);
    console.log(`   Limit: ${options.limit}`);
    if (options.eventName) console.log(`   Event: ${options.eventName}`);
    if (options.days > 0) console.log(`   Older than: ${options.days} days`);
    console.log('');

    const events = await fetchFailedEvents(supabase, options);

    if (events.length === 0) {
        console.log('✅ No failed events to replay.');
        process.exit(0);
    }

    console.log(`Found ${events.length} failed event(s) to replay:\n`);

    let replayed = 0;
    let failed = 0;

    for (const event of events) {
        const detail = `${event.event_name} (${new Date(event.created_at).toISOString()})`;
        console.log(`  → ${event.id}: ${detail}`);

        if (options.dryRun) {
            console.log(`    [DRY RUN] Would republish to ${event.stream_name}`);
            replayed++;
            continue;
        }

        const result = await republishEvent(redis, event);

        if (result.success) {
            await markReplayed(supabase, event.id);
            console.log(`    ✅ Replayed → ${event.stream_name}:${result.streamEntryId}`);
            replayed++;
        } else {
            await markDead(supabase, event.id);
            console.log(`    ❌ Failed: ${result.error} (marked as dead)`);
            failed++;
        }
    }

    console.log(`\n📊 Summary: ${replayed} replayed, ${failed} failed, ${events.length} total\n`);
}

main().catch(console.error);
