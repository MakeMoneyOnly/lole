/**
 * Sync Replay Checkpoints
 *
 * M1: Manages sync_replay_checkpoints table lifecycle.
 * Creates checkpoints on sync start, updates cursor on progress,
 * marks completed on success, failed on error.
 */

import { getPowerSync } from './powersync-config';
import { logger } from '@/lib/logger';

export type CheckpointStatus = 'idle' | 'in_progress' | 'completed' | 'failed';

export interface SyncReplayCheckpoint {
    scope: string;
    cursor_value: string | null;
    journal_entry_id: string | null;
    status: CheckpointStatus;
    error_text: string | null;
    updated_at: string;
}

export async function startCheckpoint(scope: string): Promise<void> {
    const db = getPowerSync();
    if (!db) return;

    const now = new Date().toISOString();
    try {
        await db.execute(
            `INSERT INTO sync_replay_checkpoints (scope, cursor_value, journal_entry_id, status, error_text, updated_at)
             VALUES (?, NULL, NULL, 'in_progress', NULL, ?)
             ON CONFLICT(scope) DO UPDATE SET
                status = 'in_progress',
                error_text = NULL,
                updated_at = ?`,
            [scope, now, now]
        );
    } catch (err) {
        logger.warn('[Checkpoint] Failed to start checkpoint', {
            scope,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

export async function updateCheckpoint(
    scope: string,
    cursorValue: string,
    journalEntryId: string | null
): Promise<void> {
    const db = getPowerSync();
    if (!db) return;

    const now = new Date().toISOString();
    try {
        await db.execute(
            `UPDATE sync_replay_checkpoints
             SET cursor_value = ?, journal_entry_id = ?, updated_at = ?
             WHERE scope = ? AND status = 'in_progress'`,
            [cursorValue, journalEntryId ?? null, now, scope]
        );
    } catch (err) {
        logger.warn('[Checkpoint] Failed to update checkpoint', {
            scope,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

export async function completeCheckpoint(scope: string): Promise<void> {
    const db = getPowerSync();
    if (!db) return;

    const now = new Date().toISOString();
    try {
        await db.execute(
            `UPDATE sync_replay_checkpoints
             SET status = 'completed', updated_at = ?
             WHERE scope = ?`,
            [now, scope]
        );
    } catch (err) {
        logger.warn('[Checkpoint] Failed to complete checkpoint', {
            scope,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

export async function failCheckpoint(scope: string, errorText: string): Promise<void> {
    const db = getPowerSync();
    if (!db) return;

    const now = new Date().toISOString();
    try {
        await db.execute(
            `UPDATE sync_replay_checkpoints
             SET status = 'failed', error_text = ?, updated_at = ?
             WHERE scope = ?`,
            [errorText, now, scope]
        );
    } catch (err) {
        logger.warn('[Checkpoint] Failed to mark checkpoint failed', {
            scope,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

export async function getCheckpoint(scope: string): Promise<SyncReplayCheckpoint | null> {
    const db = getPowerSync();
    if (!db) return null;

    try {
        return await db.getFirstAsync<SyncReplayCheckpoint>(
            `SELECT * FROM sync_replay_checkpoints WHERE scope = ?`,
            [scope]
        );
    } catch {
        return null;
    }
}

export async function getLatestCursor(scope: string): Promise<{
    cursorValue: string | null;
    journalEntryId: string | null;
} | null> {
    const checkpoint = await getCheckpoint(scope);
    if (!checkpoint || checkpoint.status !== 'completed') return null;

    return {
        cursorValue: checkpoint.cursor_value,
        journalEntryId: checkpoint.journal_entry_id,
    };
}

export async function cleanupOldCheckpoints(olderThanDays: number = 30): Promise<number> {
    const db = getPowerSync();
    if (!db) return 0;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    try {
        const result = await db.execute(
            `DELETE FROM sync_replay_checkpoints
             WHERE status = 'completed' AND updated_at < ?`,
            [cutoff.toISOString()]
        );
        return result.rowsAffected;
    } catch (err) {
        logger.warn('[Checkpoint] Failed to clean up old checkpoints', {
            error: err instanceof Error ? err.message : String(err),
        });
        return 0;
    }
}
