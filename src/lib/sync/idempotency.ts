/**
 * Idempotency Key Manager
 *
 * CRIT-05: Offline sync consolidation
 * Ensures operations are not duplicated during offline replay
 */

import { getPowerSync } from './powersync-config';
import type { PowerSyncDatabase } from './powersync-config';
import {
    dispatchGatewayDomainCommand,
    isDispatchableDomainCommand,
} from '@/lib/gateway/dispatcher';
import { appendLocalJournalEntryInDatabase } from '@/lib/journal/local-journal';
import { logger } from '@/lib/logger';

/**
 * Generate a unique idempotency key
 * Format: {timestamp}-{random}
 */
export function generateIdempotencyKey(prefix: string = 'offline'): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomUUID().slice(0, 8);
    return `${prefix}-${timestamp}-${random}`;
}

/**
 * Check if an idempotency key has already been processed
 */
export async function isIdempotencyKeyUsed(idempotencyKey: string): Promise<boolean> {
    const db = getPowerSync();
    if (!db) {
        // Fallback to memory-based check if PowerSync not available
        return false;
    }

    const result = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM sync_queue WHERE idempotency_key = ? AND status = 'completed'`,
        [idempotencyKey]
    );

    return !!result;
}

/**
 * Mark an idempotency key as used (completed)
 */
export async function markIdempotencyKeyCompleted(idempotencyKey: string): Promise<void> {
    const db = getPowerSync();
    if (!db) return;

    await db.execute(
        `UPDATE sync_queue SET status = 'completed', processed_at = ? WHERE idempotency_key = ?`,
        [new Date().toISOString(), idempotencyKey]
    );
}

/**
 * Operation types for sync queue
 */
export type SyncOperation = 'create' | 'update' | 'delete';

export interface SyncQueueJournalContext {
    restaurantId: string;
    locationId?: string | null;
    deviceId: string;
    actorId?: string | null;
}

async function appendSyncQueueJournal(
    db: PowerSyncDatabase,
    operation: SyncOperation,
    tableName: string,
    recordId: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
    journalContext?: SyncQueueJournalContext
): Promise<void> {
    if (!journalContext) {
        return;
    }

    await appendLocalJournalEntryInDatabase(db, {
        restaurantId: journalContext.restaurantId,
        locationId: journalContext.locationId ?? null,
        deviceId: journalContext.deviceId,
        actorId: journalContext.actorId ?? null,
        entryKind: 'sync',
        aggregateType: tableName,
        aggregateId: recordId,
        operationType: `sync.${operation}`,
        payload: {
            operation,
            table_name: tableName,
            record_id: recordId,
            sync_payload: payload,
        },
        idempotencyKey,
    });
}

export async function queueSyncOperationInDatabase(
    db: PowerSyncDatabase,
    operation: SyncOperation,
    tableName: string,
    recordId: string,
    payload: Record<string, unknown>,
    journalContext?: SyncQueueJournalContext
): Promise<string> {
    const idempotencyKey = generateIdempotencyKey(`${operation}-${tableName}`);
    const now = new Date().toISOString();

    await appendSyncQueueJournal(
        db,
        operation,
        tableName,
        recordId,
        payload,
        idempotencyKey,
        journalContext
    );

    await db.execute(
        `INSERT INTO sync_queue (operation, table_name, record_id, payload, idempotency_key, status, attempts, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`,
        [operation, tableName, recordId, JSON.stringify(payload), idempotencyKey, now]
    );

    return idempotencyKey;
}

/**
 * Queue an operation for sync
 */
export async function queueSyncOperation(
    operation: SyncOperation,
    tableName: string,
    recordId: string,
    payload: Record<string, unknown>,
    journalContext?: SyncQueueJournalContext
): Promise<string> {
    const db = getPowerSync();
    if (!db) {
        logger.warn('[SyncQueue] PowerSync not initialized');
        return '';
    }

    const idempotencyKey = await queueSyncOperationInDatabase(
        db,
        operation,
        tableName,
        recordId,
        payload,
        journalContext
    );

    const commandCandidate = payload.domain_command;
    if (isDispatchableDomainCommand(commandCandidate)) {
        try {
            await dispatchGatewayDomainCommand(commandCandidate);
        } catch (error) {
            logger.warn('[SyncQueue] Gateway dispatch failed, relying on replay queue', {
                operation,
                tableName,
                recordId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return idempotencyKey;
}

/**
 * Get pending sync operations
 */
export async function getPendingSyncOperations(limit: number = 50): Promise<
    Array<{
        id: string;
        operation: string;
        table_name: string;
        record_id: string;
        payload: string;
        idempotency_key: string;
        attempts: number;
        last_error: string | null;
        created_at: string;
    }>
> {
    const db = getPowerSync();
    if (!db) return [];

    const results = await db.getAllAsync<{
        id: string;
        operation: string;
        table_name: string;
        record_id: string;
        payload: string;
        idempotency_key: string;
        attempts: number;
        last_error: string | null;
        created_at: string;
    }>(`SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`, [
        limit,
    ]);

    return results;
}

/**
 * Mark a sync operation as failed
 */
export async function markSyncOperationFailed(id: string, error: string): Promise<void> {
    const db = getPowerSync();
    if (!db) return;

    await db.execute(
        `UPDATE sync_queue SET attempts = attempts + 1, last_error = ?, status = CASE 
            WHEN attempts + 1 >= 5 THEN 'failed' 
            ELSE 'pending' 
         END WHERE id = ?`,
        [error, id]
    );
}

/**
 * Mark a sync operation as completed
 */
export async function markSyncOperationCompleted(id: string): Promise<void> {
    const db = getPowerSync();
    if (!db) return;

    await db.execute(`UPDATE sync_queue SET status = 'completed', processed_at = ? WHERE id = ?`, [
        new Date().toISOString(),
        id,
    ]);
}

/**
 * Get sync queue status
 */
export async function getSyncQueueStatus(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
}> {
    const db = getPowerSync();
    if (!db) {
        return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }

    const [pending, processing, completed, failed] = await Promise.all([
        db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'`
        ),
        db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'processing'`
        ),
        db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'completed'`
        ),
        db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed'`
        ),
    ]);

    return {
        pending: pending?.count ?? 0,
        processing: processing?.count ?? 0,
        completed: completed?.count ?? 0,
        failed: failed?.count ?? 0,
    };
}

/**
 * Clear completed sync operations (cleanup)
 */
export async function clearCompletedSyncOperations(olderThanDays: number = 7): Promise<number> {
    const db = getPowerSync();
    if (!db) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db.execute(
        `DELETE FROM sync_queue WHERE status = 'completed' AND processed_at < ?`,
        [cutoffDate.toISOString()]
    );

    return result.rowsAffected;
}
