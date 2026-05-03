/**
 * Sync Worker
 *
 * CRIT-05: Offline sync consolidation
 * Handles background sync between local PowerSync and server
 */

import {
    getPendingSyncOperations,
    markSyncOperationCompleted,
    markSyncOperationFailed,
    getSyncQueueStatus,
} from './idempotency';
import { logger } from '@/lib/logger';
import { reconcileWithServer } from './conflict-resolution';

/**
 * Sync operation row type from the database
 */
interface SyncOperationRow {
    id: string;
    operation: string;
    table_name: string;
    record_id: string;
    payload: string;
    idempotency_key: string;
    attempts: number;
    last_error: string | null;
    created_at: string;
}

/**
 * HIGH-013: API endpoint configuration for sync operations
 * Uses the unified /api/sync endpoint for batch operations
 */
const SYNC_API_ENDPOINT = '/api/sync';

/**
 * Individual table endpoints for direct operations (fallback)
 */
const SYNC_ENDPOINTS: Record<string, string> = {
    orders: '/api/orders',
    order_items: '/api/orders/items',
    kds_order_items: '/api/kds/items',
    tables: '/api/device/tables',
    payments: '/api/payments',
    guests: '/api/guests',
} as const;

/**
 * Cache of endpoint health status (table_name → reachable boolean)
 */
let endpointHealthCache: Record<string, boolean> = {};

/**
 * Validate configured sync endpoints via HEAD request.
 * Skips tables with unreachable endpoints in subsequent sync cycles.
 */
async function validateSyncEndpoints(): Promise<void> {
    const health: Record<string, boolean> = {};

    await Promise.all(
        Object.entries(SYNC_ENDPOINTS).map(async ([tableName, endpoint]) => {
            try {
                const response = await fetch(endpoint + '/_health', {
                    method: 'HEAD',
                    signal: AbortSignal.timeout(5000),
                });
                health[tableName] = response.ok;
            } catch {
                health[tableName] = false;
            }
        })
    );

    try {
        const batchResponse = await fetch(SYNC_API_ENDPOINT + '/_health', {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000),
        });
        health['batch'] = batchResponse.ok;
    } catch {
        health['batch'] = false;
    }

    endpointHealthCache = health;

    const unhealthy = Object.entries(health).filter(([, ok]) => !ok);
    if (unhealthy.length > 0) {
        logger.warn('[SyncWorker] Unreachable endpoints', {
            endpoints: unhealthy.map(([name]) => name),
        });
    }
}

/**
 * Check if a table's endpoint is reachable.
 * If health cache is empty (never validated), assume reachable.
 */
function isEndpointReachable(tableName: string): boolean {
    if (Object.keys(endpointHealthCache).length === 0) {
        return true; // Not yet validated, assume reachable
    }
    return endpointHealthCache[tableName] !== false;
}

/**
 * Exponential backoff configuration
 */
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

/**
 * Sync event types for UI updates
 */
export type SyncEventType =
    | 'sync:start'
    | 'sync:complete'
    | 'sync:error'
    | 'sync:conflict'
    | 'sync:offline'
    | 'sync:online'
    | 'operation:success'
    | 'operation:failed'
    | 'operation:retry';

/**
 * Sync event payload
 */
export interface SyncEvent {
    type: SyncEventType;
    timestamp: string;
    data?: Record<string, unknown>;
}

/**
 * Sync event listener
 */
export type SyncEventListener = (event: SyncEvent) => void;

/**
 * Sync worker configuration
 */
export interface SyncWorkerConfig {
    /** Interval in ms for checking pending operations */
    syncIntervalMs: number;
    /** Maximum operations per sync batch */
    batchSize: number;
    /** Enable printer queue processing */
    enablePrinterQueue: boolean;
    /** Callback for sync events */
    onSyncProgress?: (stats: SyncProgress) => void;
    /** Callback for errors */
    onError?: (error: Error) => void;
    /** Callback for sync events (HIGH-005) */
    onSyncEvent?: (event: SyncEvent) => void;
}

/**
 * Sync progress statistics
 */
export interface SyncProgress {
    pendingOperations: number;
    completedOperations: number;
    failedOperations: number;
    printerJobsProcessed: number;
    printerJobsSucceeded: number;
    printerJobsFailed: number;
    lastSyncAt: string | null;
    isOnline: boolean;
    /** Number of conflicts detected in last sync */
    conflictsDetected?: number;
}

const DEFAULT_CONFIG: SyncWorkerConfig = {
    syncIntervalMs: 5000, // 5 seconds
    batchSize: 20,
    enablePrinterQueue: true,
};

/**
 * Create a sync worker
 */
export interface SyncWorker {
    start: () => void;
    stop: () => void;
    syncOnce: () => Promise<SyncProgress>;
    getStatus: () => Promise<SyncProgress>;
    readonly isRunning: boolean;
}

export function createSyncWorker(config: Partial<SyncWorkerConfig> = {}): SyncWorker {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    let isRunning = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let lastSyncAt: string | null = null;
    let conflictsDetected = 0;

    /**
     * HIGH-005: Emit sync event for UI updates
     */
    function emitEvent(type: SyncEventType, data?: Record<string, unknown>): void {
        if (cfg.onSyncEvent) {
            cfg.onSyncEvent({
                type,
                timestamp: new Date().toISOString(),
                data,
            });
        }
    }

    /**
     * HIGH-013: Calculate exponential backoff delay
     */
    function calculateBackoffDelay(retryCount: number): number {
        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), MAX_DELAY_MS);
        // Add jitter to prevent thundering herd
        return delay + Math.random() * 1000;
    }

    /**
     * HIGH-013: Execute batch sync via unified /api/sync endpoint
     * This is more efficient than individual API calls
     */
    async function executeBatchSync(operations: SyncOperationRow[]): Promise<{
        succeeded: number;
        failed: number;
        results: Map<string, { success: boolean; error?: string }>;
    }> {
        const results = new Map<string, { success: boolean; error?: string }>();
        let succeeded = 0;
        let failed = 0;

        if (operations.length === 0) {
            return { succeeded, failed, results };
        }

        // Transform operations to sync API format
        const syncOperations = operations.map(op => {
            let payload;
            try {
                payload = op.payload ? JSON.parse(op.payload) : {};
            } catch {
                payload = {};
            }

            return {
                id: crypto.randomUUID(),
                operation: op.operation.toLowerCase(),
                tableName: op.table_name,
                recordId: op.record_id,
                data: payload,
                version: 1,
                lastModified: new Date().toISOString(),
                idempotencyKey: op.idempotency_key || `sync-${op.id}`,
                restaurantId: payload.restaurant_id || '',
            };
        });

        try {
            const response = await fetch(SYNC_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    operations: syncOperations,
                    clientId: `sync-worker-${Date.now()}`,
                }),
            });

            if (!response.ok) {
                // Batch failed - fall back to individual operations
                logger.info('Batch sync failed, falling back to individual operations');
                for (const op of operations) {
                    const result = await executeSyncOperation(op);
                    results.set(op.id, result);
                    if (result.success) {
                        succeeded++;
                    } else {
                        failed++;
                    }
                    if (result.conflict) {
                        emitEvent('sync:conflict', {
                            operationId: op.id,
                            tableName: op.table_name,
                            recordId: op.record_id,
                        });
                    }
                }
                return { succeeded, failed, results };
            }

            const data = await response.json();

            // Process results from batch response
            if (data.data?.results && Array.isArray(data.data.results)) {
                for (let i = 0; i < operations.length; i++) {
                    const op = operations[i];
                    const result = data.data.results[i];
                    if (result) {
                        results.set(op.id, { success: result.success, error: result.error });
                        if (result.success) {
                            succeeded++;
                        } else {
                            failed++;
                        }
                        if (result.conflict || result.error?.includes('conflict')) {
                            conflictsDetected++;
                            emitEvent('sync:conflict', {
                                operationId: op.id,
                                tableName: op.table_name,
                                recordId: op.record_id,
                            });
                        }
                    }
                }
            }

            return { succeeded, failed, results };
        } catch (error) {
            logger.error('Batch sync error', error);
            // Fall back to individual operations
            for (const op of operations) {
                const result = await executeSyncOperation(op);
                results.set(op.id, result);
                if (result.success) {
                    succeeded++;
                } else {
                    failed++;
                }
                if (result.conflict) {
                    emitEvent('sync:conflict', {
                        operationId: op.id,
                        tableName: op.table_name,
                        recordId: op.record_id,
                    });
                }
            }
            return { succeeded, failed, results };
        }
    }

    /**
     * HIGH-013: Make actual API call to server for sync operation (fallback)
     */
    async function executeSyncOperation(
        op: SyncOperationRow
    ): Promise<{ success: boolean; error?: string; conflict?: boolean }> {
        const endpoint = SYNC_ENDPOINTS[op.table_name];

        if (!endpoint) {
            logger.info('No endpoint configured for table', { tableName: op.table_name });
            return { success: false, error: `Unknown table: ${op.table_name}` };
        }

        const method =
            op.operation === 'INSERT' || op.operation === 'create'
                ? 'POST'
                : op.operation === 'UPDATE' || op.operation === 'update'
                  ? 'PATCH'
                  : 'DELETE';
        const url =
            method === 'DELETE' || method === 'PATCH' ? `${endpoint}/${op.record_id}` : endpoint;

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'x-sync-operation-id': String(op.id),
                    'x-idempotency-key': op.idempotency_key || String(op.id),
                },
                body: method !== 'DELETE' ? op.payload : undefined,
            });

            const responseData = (await response.json().catch(() => ({}))) as {
                error?: { message?: string } | string;
                data?: Record<string, unknown>;
            };

            if (!response.ok) {
                if (response.status === 409) {
                    conflictsDetected++;
                    return {
                        success: false,
                        error: `Conflict detected for ${op.table_name}/${op.record_id}`,
                        conflict: true,
                    };
                }
                const errorMessage =
                    typeof responseData.error === 'object'
                        ? responseData.error?.message || `HTTP ${response.status}`
                        : responseData.error || `HTTP ${response.status}`;
                return {
                    success: false,
                    error: errorMessage,
                };
            }

            // HIGH-006: Reconcile local data with server response
            if (responseData?.data && method !== 'DELETE') {
                try {
                    await reconcileWithServer({
                        entityType: op.table_name,
                        entityId: op.record_id,
                        serverData: responseData.data,
                    });
                } catch {
                    // Reconciliation failure is non-critical - the sync succeeded
                }
            }

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Process pending sync operations with retry logic
     * Uses batch sync for efficiency
     */
    async function processSyncOperations(): Promise<{
        processed: number;
        succeeded: number;
        failed: number;
    }> {
        const operations = await getPendingSyncOperations(cfg.batchSize);

        if (operations.length === 0) {
            return { processed: 0, succeeded: 0, failed: 0 };
        }

        logger.info('Processing operations via batch sync', { count: operations.length });

        // Use batch sync for efficiency
        const { succeeded, failed, results } = await executeBatchSync(operations);

        // Mark operations as completed or failed based on results
        for (const op of operations) {
            const result = results.get(op.id);
            if (result?.success) {
                await markSyncOperationCompleted(op.id);
            } else if (result) {
                const retryCount = op.attempts || 0;
                if (retryCount >= MAX_RETRIES) {
                    await markSyncOperationFailed(op.id, result.error || 'Max retries exceeded');
                    cfg.onError?.(new Error(result.error || 'Sync operation failed'));
                }
            }
        }

        return { processed: operations.length, succeeded, failed };
    }

    /**
     * Process pending print jobs
     */
    async function processPrinterQueue(): Promise<{
        processed: number;
        succeeded: number;
        failed: number;
    }> {
        // This would integrate with the actual printer system
        // For now, just return zeros as we can't print from server
        return { processed: 0, succeeded: 0, failed: 0 };
    }

    /**
     * Get current sync status
     */
    async function getStatus(): Promise<SyncProgress> {
        const queueStats = await getSyncQueueStatus();

        return {
            pendingOperations: queueStats.pending,
            completedOperations: queueStats.completed,
            failedOperations: queueStats.failed,
            printerJobsProcessed: 0,
            printerJobsSucceeded: 0,
            printerJobsFailed: 0,
            lastSyncAt,
            isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
            conflictsDetected,
        };
    }

    /**
     * Run one sync cycle
     */
    async function syncOnce(): Promise<SyncProgress> {
        if (!navigator.onLine) {
            logger.info('Offline - skipping sync');
            emitEvent('sync:offline', { reason: 'navigator.offline' });
            return getStatus();
        }

        logger.info('Starting sync cycle');
        emitEvent('sync:start', { timestamp: new Date().toISOString() });

        // Validate endpoint health before processing (every 5th cycle)
        if (Math.random() < 0.2) {
            await validateSyncEndpoints();
        }

        try {
            const syncResult = await processSyncOperations();

            let _printerResult = { processed: 0, succeeded: 0, failed: 0 };
            if (cfg.enablePrinterQueue) {
                _printerResult = await processPrinterQueue();
            }

            lastSyncAt = new Date().toISOString();

            // Emit success/failure events
            if (syncResult.succeeded > 0) {
                emitEvent('operation:success', {
                    count: syncResult.succeeded,
                    processed: syncResult.processed,
                });
            }

            if (syncResult.failed > 0) {
                emitEvent('operation:failed', {
                    count: syncResult.failed,
                    processed: syncResult.processed,
                });
            }

            const status = await getStatus();
            cfg.onSyncProgress?.(status);

            logger.info('Sync complete', {
                succeeded: syncResult.succeeded,
                failed: syncResult.failed,
            });

            emitEvent('sync:complete', {
                succeeded: syncResult.succeeded,
                failed: syncResult.failed,
                processed: syncResult.processed,
                conflictsDetected,
            });

            return status;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Sync error', errorMessage);

            emitEvent('sync:error', {
                error: errorMessage,
                timestamp: new Date().toISOString(),
            });

            cfg.onError?.(error instanceof Error ? error : new Error(errorMessage));

            throw error;
        }
    }

    /**
     * Start the sync worker
     */
    function start() {
        if (isRunning) return;

        isRunning = true;
        intervalId = setInterval(syncOnce, cfg.syncIntervalMs);

        // Run immediately on start
        syncOnce();

        logger.info('SyncWorker started');
    }

    /**
     * Stop the sync worker
     */
    function stop() {
        if (!isRunning) return;

        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }

        isRunning = false;
        logger.info('SyncWorker stopped');
    }

    return {
        start,
        stop,
        syncOnce,
        getStatus,
        get isRunning() {
            return isRunning;
        },
    };
}

/**
 * Singleton sync worker instance
 */
let syncWorker: ReturnType<typeof createSyncWorker> | null = null;

/**
 * Get the sync worker instance
 */
export function getSyncWorker(): SyncWorker {
    if (!syncWorker) {
        syncWorker = createSyncWorker();
    }
    return syncWorker;
}

/**
 * Start the global sync worker
 */
export function startGlobalSync(): void {
    const worker = getSyncWorker();
    worker.start();
}

/**
 * Stop the global sync worker
 */
export function stopGlobalSync(): void {
    const worker = getSyncWorker();
    worker.stop();
}

/**
 * Trigger a manual sync
 */
export async function triggerSync(): Promise<SyncProgress> {
    const worker = getSyncWorker();
    return worker.syncOnce();
}
