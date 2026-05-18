import { openSync, closeSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from '@/lib/logger';
import { GatewayError, GatewayErrorCode } from '@/lib/gateway/errors';

export interface QueueEntry {
    id: string;
    type: string;
    aggregate: string;
    aggregateId: string;
    payload: Record<string, unknown>;
    restaurantId: string;
    locationId: string;
    enqueuedAt: string;
    retryCount: number;
    maxRetries: number;
}

interface QueueStore {
    entries: QueueEntry[];
    lastSequence: number;
}

export class PersistentLocalQueue {
    private readonly filePath: string;
    private store: QueueStore;
    private readonly maxRetries: number;

    constructor(dataDir: string, maxRetries = 5) {
        mkdirSync(dataDir, { recursive: true });
        this.filePath = join(dataDir, 'command-queue.json');
        this.maxRetries = maxRetries;
        this.store = this.load();
    }

    private load(): QueueStore {
        try {
            if (existsSync(this.filePath)) {
                const raw = readFileSync(this.filePath, 'utf8');
                const parsed = JSON.parse(raw) as QueueStore;
                return {
                    entries: Array.isArray(parsed.entries)
                        ? parsed.entries.filter(e => e && typeof e.id === 'string')
                        : [],
                    lastSequence: typeof parsed.lastSequence === 'number' ? parsed.lastSequence : 0,
                };
            }
        } catch (err) {
            logger.warn('[PersistentQueue] Failed to load queue, starting fresh', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
        return { entries: [], lastSequence: 0 };
    }

    private persist(): void {
        try {
            writeFileSync(this.filePath, JSON.stringify(this.store), 'utf8');
        } catch (err) {
            throw new GatewayError(
                GatewayErrorCode.JOURNAL_WRITE_FAILED,
                'Failed to persist command queue',
                { filePath: this.filePath, error: String(err) }
            );
        }
    }

    enqueue(
        entry: Omit<QueueEntry, 'id' | 'enqueuedAt' | 'retryCount' | 'maxRetries'>
    ): QueueEntry {
        const id = crypto.randomUUID();
        const queueEntry: QueueEntry = {
            ...entry,
            id,
            enqueuedAt: new Date().toISOString(),
            retryCount: 0,
            maxRetries: this.maxRetries,
        };

        this.store.entries.push(queueEntry);
        this.store.lastSequence++;
        this.persist();

        logger.debug('[PersistentQueue] Enqueued command', {
            id,
            type: entry.type,
            queueSize: this.store.entries.length,
        });

        return queueEntry;
    }

    dequeue(): QueueEntry | null {
        if (this.store.entries.length === 0) {
            return null;
        }

        const entry = this.store.entries.shift()!;
        this.persist();
        return entry;
    }

    peek(): QueueEntry | null {
        if (this.store.entries.length === 0) {
            return null;
        }
        return this.store.entries[0];
    }

    ack(id: string): void {
        this.store.entries = this.store.entries.filter(e => e.id !== id);
        this.persist();
    }

    nack(id: string): QueueEntry | null {
        const entry = this.store.entries.find(e => e.id === id);
        if (!entry) return null;

        entry.retryCount++;

        if (entry.retryCount >= this.maxRetries) {
            this.store.entries = this.store.entries.filter(e => e.id !== id);
            this.persist();
            logger.warn('[PersistentQueue] Command exceeded max retries, discarded', {
                id,
                type: entry.type,
                retryCount: entry.retryCount,
            });
            return null;
        }

        this.persist();
        return entry;
    }

    getAll(): QueueEntry[] {
        return [...this.store.entries];
    }

    size(): number {
        return this.store.entries.length;
    }

    clear(): void {
        this.store = { entries: [], lastSequence: 0 };
        this.persist();
    }
}
