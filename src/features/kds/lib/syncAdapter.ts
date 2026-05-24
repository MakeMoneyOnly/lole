/**
 * KDS Sync Adapter
 *
 * Compatibility adapter over supported PowerSync-backed local stack.
 * Legacy localStorage replay path intentionally removed.
 */

import { getPowerSync } from '@/lib/sync/powersync-config';

export async function getOfflineKdsQueueCount(): Promise<number> {
    const db = getPowerSync();
    if (!db) {
        return 0;
    }

    const result = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM sync_queue WHERE table_name = 'kds_items' AND status = 'pending'`
    );

    return result?.count ?? 0;
}

export async function getPendingKdsActions(): Promise<
    Array<{
        id: string;
        orderId: string;
        itemId: string;
        kdsItemId: string;
        action: string;
        reason?: string;
        enqueuedAt: string;
        attempts: number;
        idempotencyKey: string;
    }>
> {
    const db = getPowerSync();
    if (!db) {
        return [];
    }

    const results = await db.getAllAsync<{
        id: number;
        record_id: string;
        payload: string;
        attempts: number;
        created_at: string;
        idempotency_key: string;
    }>(
        `SELECT id, record_id, payload, attempts, created_at, idempotency_key
         FROM sync_queue
         WHERE table_name = 'kds_items' AND status = 'pending'`
    );

    return results.map(row => {
        const payload = JSON.parse(row.payload || '{}') as Record<string, unknown>;
        return {
            id: String(row.id),
            orderId: typeof payload.order_id === 'string' ? payload.order_id : '',
            itemId: typeof payload.order_item_id === 'string' ? payload.order_item_id : '',
            kdsItemId: row.record_id,
            action: typeof payload.action === 'string' ? payload.action : 'start',
            reason: typeof payload.reason === 'string' ? payload.reason : undefined,
            enqueuedAt: row.created_at,
            attempts: row.attempts,
            idempotencyKey: row.idempotency_key,
        };
    });
}

export async function addKdsActionToQueue(): Promise<void> {
    throw new Error('Legacy KDS queue writes removed. Use executeKdsAction() local runtime path.');
}

export async function clearSyncedKdsActions(): Promise<void> {
    const db = getPowerSync();
    if (!db) {
        return;
    }

    await db.execute(
        `DELETE FROM sync_queue WHERE table_name = 'kds_items' AND status = 'completed'`
    );
}
