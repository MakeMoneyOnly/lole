export interface BackgroundSyncQueueItem {
    id: string;
    operation: 'insert' | 'update' | 'delete';
    tableName: string;
    recordId: string;
    payload: Record<string, unknown>;
    createdAt: string;
    attempts: number;
}

export interface BackgroundSyncStatus {
    pendingCount: number;
    lastSyncAt: string | null;
    lastSyncResult: 'success' | 'failure' | null;
}

let syncStatus: BackgroundSyncStatus = {
    pendingCount: 0,
    lastSyncAt: null,
    lastSyncResult: null,
};

export function getBackgroundSyncStatus(): BackgroundSyncStatus {
    return { ...syncStatus };
}

export async function queueForBackgroundSync(
    items: Omit<BackgroundSyncQueueItem, 'id' | 'createdAt' | 'attempts'>[]
): Promise<void> {
    const now = new Date().toISOString();

    const queueItems: BackgroundSyncQueueItem[] = items.map((item, index) => ({
        ...item,
        id: `sync_${Date.now()}_${index}`,
        createdAt: now,
        attempts: 0,
    }));

    if (typeof window !== 'undefined') {
        try {
            const existing = window.localStorage.getItem('lole_sync_queue');
            const queue: BackgroundSyncQueueItem[] = existing ? JSON.parse(existing) : [];
            queue.push(...queueItems);
            window.localStorage.setItem('lole_sync_queue', JSON.stringify(queue));
            syncStatus.pendingCount = queue.length;
        } catch {
            console.error('[BackgroundSync] Failed to persist sync queue.');
        }
    }
}

export async function processSyncQueue(): Promise<{
    synced: number;
    failed: number;
}> {
    if (typeof window === 'undefined') {
        return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    try {
        const raw = window.localStorage.getItem('lole_sync_queue');
        if (!raw) {
            syncStatus.pendingCount = 0;
            return { synced, failed };
        }

        const queue: BackgroundSyncQueueItem[] = JSON.parse(raw);
        const remaining: BackgroundSyncQueueItem[] = [];

        for (const item of queue) {
            try {
                const response = await fetch('/api/sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        operation: item.operation,
                        tableName: item.tableName,
                        recordId: item.recordId,
                        payload: item.payload,
                    }),
                });

                if (response.ok) {
                    synced++;
                } else if (response.status >= 500) {
                    failed++;
                    remaining.push({ ...item, attempts: item.attempts + 1 });
                } else {
                    // Client error — drop, won't succeed on retry
                    synced++;
                }
            } catch {
                failed++;
                remaining.push({ ...item, attempts: item.attempts + 1 });
            }
        }

        window.localStorage.setItem('lole_sync_queue', JSON.stringify(remaining));
        syncStatus = {
            pendingCount: remaining.length,
            lastSyncAt: new Date().toISOString(),
            lastSyncResult: failed > 0 ? 'failure' : 'success',
        };
    } catch {
        console.error('[BackgroundSync] Failed to process sync queue.');
    }

    return { synced, failed };
}
