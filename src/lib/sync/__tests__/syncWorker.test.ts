/**
 * Tests for Sync Worker
 *
 * Tests cover:
 * - Worker lifecycle (start/stop)
 * - Batch sync operations
 * - Individual sync operations
 * - Retry logic with exponential backoff
 * - Event emission
 * - Error handling
 * - Online/offline detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    createSyncWorker,
    getSyncWorker,
    startGlobalSync,
    stopGlobalSync,
    triggerSync,
    type SyncWorkerConfig,
    type SyncEvent,
} from '../syncWorker';

// Mock the idempotency module
vi.mock('../idempotency', () => ({
    getPendingSyncOperations: vi.fn(),
    markSyncOperationCompleted: vi.fn(),
    markSyncOperationFailed: vi.fn(),
    getSyncQueueStatus: vi.fn(),
}));

// Mock the conflict-resolution module
vi.mock('../conflict-resolution', () => ({
    handleSyncConflict: vi.fn(),
    detectConflict: vi.fn(),
    reconcileWithServer: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => 'test-uuid-1234'),
});

import {
    getPendingSyncOperations,
    markSyncOperationCompleted,
    markSyncOperationFailed,
    getSyncQueueStatus,
} from '../idempotency';

const mockedGetPendingSyncOperations = vi.mocked(getPendingSyncOperations);
const mockedMarkSyncOperationCompleted = vi.mocked(markSyncOperationCompleted);
const mockedMarkSyncOperationFailed = vi.mocked(markSyncOperationFailed);
const mockedGetSyncQueueStatus = vi.mocked(getSyncQueueStatus);

describe('SyncWorker', () => {
    let worker: ReturnType<typeof createSyncWorker>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockReset();
        vi.useFakeTimers();

        // Reset mocks
        mockedGetPendingSyncOperations.mockResolvedValue([]);
        mockedGetSyncQueueStatus.mockResolvedValue({
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
        });
        mockedMarkSyncOperationCompleted.mockResolvedValue(undefined);
        mockedMarkSyncOperationFailed.mockResolvedValue(undefined);

        // Mock navigator.onLine
        Object.defineProperty(window, 'navigator', {
            value: { onLine: true },
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        if (worker) {
            worker.stop();
        }
    });

    describe('createSyncWorker', () => {
        it('should create a worker with default config', () => {
            worker = createSyncWorker();
            expect(worker).toBeDefined();
            expect(worker.isRunning).toBe(false);
        });

        it('should create a worker with custom config', () => {
            const onSyncProgress = vi.fn();
            const onError = vi.fn();
            const onSyncEvent = vi.fn();

            worker = createSyncWorker({
                syncIntervalMs: 10000,
                batchSize: 50,
                enablePrinterQueue: false,
                onSyncProgress,
                onError,
                onSyncEvent,
            });

            expect(worker).toBeDefined();
        });

        it('should merge custom config with defaults', () => {
            worker = createSyncWorker({
                batchSize: 100,
            });

            expect(worker).toBeDefined();
        });
    });

    describe('start and stop', () => {
        it('should start the worker and set isRunning to true', () => {
            worker = createSyncWorker();
            worker.start();

            expect(worker.isRunning).toBe(true);
        });

        it('should not start twice', () => {
            worker = createSyncWorker();
            worker.start();
            worker.start();

            expect(worker.isRunning).toBe(true);
        });

        it('should stop the worker and set isRunning to false', () => {
            worker = createSyncWorker();
            worker.start();
            worker.stop();

            expect(worker.isRunning).toBe(false);
        });

        it('should not stop if not running', () => {
            worker = createSyncWorker();
            worker.stop(); // Should not throw

            expect(worker.isRunning).toBe(false);
        });

        it('should clear interval on stop', async () => {
            worker = createSyncWorker({ syncIntervalMs: 5000 });
            worker.start();

            expect(worker.isRunning).toBe(true);

            worker.stop();

            expect(worker.isRunning).toBe(false);
        });
    });

    describe('getStatus', () => {
        it('should return current sync status', async () => {
            mockedGetSyncQueueStatus.mockResolvedValue({
                pending: 5,
                processing: 0,
                completed: 10,
                failed: 2,
            });

            worker = createSyncWorker();
            const status = await worker.getStatus();

            expect(status.pendingOperations).toBe(5);
            expect(status.completedOperations).toBe(10);
            expect(status.failedOperations).toBe(2);
            expect(status.isOnline).toBe(true);
        });

        it('should return offline status when navigator is offline', async () => {
            Object.defineProperty(window, 'navigator', {
                value: { onLine: false },
                writable: true,
                configurable: true,
            });

            worker = createSyncWorker();
            const status = await worker.getStatus();

            expect(status.isOnline).toBe(false);
        });
    });

    describe('syncOnce', () => {
        it('should skip sync when offline', async () => {
            Object.defineProperty(window, 'navigator', {
                value: { onLine: false },
                writable: true,
                configurable: true,
            });

            const onSyncEvent = vi.fn();
            worker = createSyncWorker({ onSyncEvent });

            await worker.syncOnce();

            expect(onSyncEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'sync:offline',
                })
            );
            expect(mockedGetPendingSyncOperations).not.toHaveBeenCalled();
        });

        it('should process pending operations when online', async () => {
            const mockOperations = [
                {
                    id: '1',
                    operation: 'INSERT',
                    table_name: 'orders',
                    record_id: 'order-1',
                    payload: JSON.stringify({ restaurant_id: 'rest-1', total: 100 }),
                    idempotency_key: 'key-1',
                    attempts: 0,
                    last_error: null,
                    created_at: new Date().toISOString(),
                },
            ];

            mockedGetPendingSyncOperations.mockResolvedValue(mockOperations);

            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        results: [{ success: true }],
                    },
                }),
            });

            const onSyncEvent = vi.fn();
            worker = createSyncWorker({ onSyncEvent });

            await worker.syncOnce();

            expect(onSyncEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'sync:start',
                })
            );
            expect(onSyncEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'sync:complete',
                })
            );
        });

        it('should emit operation:success event for successful operations', async () => {
            const mockOperations = [
                {
                    id: '1',
                    operation: 'INSERT',
                    table_name: 'orders',
                    record_id: 'order-1',
                    payload: JSON.stringify({ restaurant_id: 'rest-1' }),
                    idempotency_key: 'key-1',
                    attempts: 0,
                    last_error: null,
                    created_at: new Date().toISOString(),
                },
            ];

            mockedGetPendingSyncOperations.mockResolvedValue(mockOperations);

            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        results: [{ success: true }],
                    },
                }),
            });

            const onSyncEvent = vi.fn();
            worker = createSyncWorker({ onSyncEvent });

            await worker.syncOnce();

            expect(onSyncEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'operation:success',
                    data: expect.objectContaining({
                        count: 1,
                    }),
                })
            );
        });

        it('should emit operation:failed event for failed operations', async () => {
            const mockOperations = [
                {
                    id: '1',
                    operation: 'INSERT',
                    table_name: 'orders',
                    record_id: 'order-1',
                    payload: JSON.stringify({ restaurant_id: 'rest-1' }),
                    idempotency_key: 'key-1',
                    attempts: 3, // Max retries
                    last_error: null,
                    created_at: new Date().toISOString(),
                },
            ];

            mockedGetPendingSyncOperations.mockResolvedValue(mockOperations);

            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        results: [{ success: false, error: 'Server error' }],
                    },
                }),
            });

            const onSyncEvent = vi.fn();
            worker = createSyncWorker({ onSyncEvent });

            await worker.syncOnce();

            expect(onSyncEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'operation:failed',
                })
            );
        });

        it('should emit sync:error event on error', async () => {
            mockedGetPendingSyncOperations.mockRejectedValue(new Error('Database error'));

            const onSyncEvent = vi.fn();
            const onError = vi.fn();
            worker = createSyncWorker({ onSyncEvent, onError });

            await expect(worker.syncOnce()).rejects.toThrow('Database error');

            expect(onSyncEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'sync:error',
                })
            );
            expect(onError).toHaveBeenCalledWith(expect.any(Error));
        });

        it('should call onSyncProgress callback', async () => {
            mockedGetSyncQueueStatus.mockResolvedValue({
                pending: 0,
                processing: 0,
                completed: 5,
                failed: 0,
            });

            const onSyncProgress = vi.fn();
            worker = createSyncWorker({ onSyncProgress });

            await worker.syncOnce();

            expect(onSyncProgress).toHaveBeenCalledWith(
                expect.objectContaining({
                    completedOperations: 5,
                })
            );
        });
    });

    describe('batch sync', () => {
        it('should send batch sync request to /api/v1/system/sync', async () => {
            const mockOperations = [
                {
                    id: '1',
                    operation: 'INSERT',
                    table_name: 'orders',
                    record_id: 'order-1',
                    payload: JSON.stringify({ restaurant_id: 'rest-1', total: 100 }),
                    idempotency_key: 'key-1',
                    attempts: 0,
                    last_error: null,
                    created_at: new Date().toISOString(),
                },
                {
                    id: '2',
                    operation: 'UPDATE',
                    table_name: 'orders',
                    record_id: 'order-2',
                    payload: JSON.stringify({ restaurant_id: 'rest-1', total: 200 }),
                    idempotency_key: 'key-2',
                    attempts: 0,
                    last_error: null,
                    created_at: new Date().toISOString(),
                },
            ];

            mockedGetPendingSyncOperations.mockResolvedValue(mockOperations);

            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        results: [{ success: true }, { success: true }],
                    },
                }),
            });

            worker = createSyncWorker();
            await worker.syncOnce();

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/v1/system/sync',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                    }),
                })
            );
        });

        it('should fall back to individual operations on batch failure', async () => {
            const mockOperations = [
                {
                    id: '1',
                    operation: 'INSERT',
                    table_name: 'orders',
                    record_id: 'order-1',
                    payload: JSON.stringify({ restaurant_id: 'rest-1' }),
                    idempotency_key: 'key-1',
                    attempts: 0,
                    last_error: null,
                    created_at: new Date().toISOString(),
                },
            ];

            mockedGetPendingSyncOperations.mockResolvedValue(mockOperations);

            // First call (batch) fails
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            // Second call (individual) succeeds
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            });

            worker = createSyncWorker();
            await worker.syncOnce();

            // Should have made two fetch calls
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should handle invalid JSON payload gracefully', async () => {
            const mockOperations = [
                {
                    id: '1',
                    operation: 'INSERT',
                    table_name: 'orders',
                    record_id: 'order-1',
                    payload: 'invalid json',
                    idempotency_key: 'key-1',
                    attempts: 0,
                    last_error: null,
                    created_at: new Date().toISOString(),
                },
            ];

            mockedGetPendingSyncOperations.mockResolvedValue(mockOperations);

            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        results: [{ success: true }],
                    },
                }),
            });

            worker = createSyncWorker();
            await worker.syncOnce();

            // Should have called with empty object as data
            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.operations[0].data).toEqual({});
        });
    });

    describe('individual sync operations', () => {
        it('should handle unknown table gracefully', async () => {
            const mockOperations = [
                {
                    id: '1',
                    operation: 'INSERT',
                    table_name: 'unknown_table',
                    record_id: 'record-1',
                    payload: '{}',
                    idempotency_key: 'key-1',
                    attempts: 3,
                    last_error: null,
                    created_at: new Date().toISOString(),
                },
            ];

            mockedGetPendingSyncOperations.mockResolvedValue(mockOperations);

            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        results: [{ success: false, error: 'Unknown table: unknown_table' }],
                    },
                }),
            });

            worker = createSyncWorker();
            await worker.syncOnce();

            // Should mark as failed
            expect(mockedMarkSyncOperationFailed).toHaveBeenCalled();
        });
    });

    describe('retry logic', () => {
        it('should mark operation as failed after max retries', async () => {
            const mockOperations = [
                {
                    id: '1',
                    operation: 'INSERT',
                    table_name: 'orders',
                    record_id: 'order-1',
                    payload: JSON.stringify({ restaurant_id: 'rest-1' }),
                    idempotency_key: 'key-1',
                    attempts: 3, // Already at max retries
                    last_error: null,
                    created_at: new Date().toISOString(),
                },
            ];

            mockedGetPendingSyncOperations.mockResolvedValue(mockOperations);

            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        results: [{ success: false, error: 'Server error' }],
                    },
                }),
            });

            const onError = vi.fn();
            worker = createSyncWorker({ onError });
            await worker.syncOnce();

            expect(mockedMarkSyncOperationFailed).toHaveBeenCalledWith('1', 'Server error');
            expect(onError).toHaveBeenCalled();
        });

        it('should not mark as failed if under max retries', async () => {
            const mockOperations = [
                {
                    id: '1',
                    operation: 'INSERT',
                    table_name: 'orders',
                    record_id: 'order-1',
                    payload: JSON.stringify({ restaurant_id: 'rest-1' }),
                    idempotency_key: 'key-1',
                    attempts: 1, // Under max retries
                    last_error: null,
                    created_at: new Date().toISOString(),
                },
            ];

            mockedGetPendingSyncOperations.mockResolvedValue(mockOperations);

            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        results: [{ success: false, error: 'Temporary error' }],
                    },
                }),
            });

            worker = createSyncWorker();
            await worker.syncOnce();

            // Should not mark as failed yet
            expect(mockedMarkSyncOperationFailed).not.toHaveBeenCalled();
        });
    });

    describe('event emission', () => {
        it('should emit all expected events during successful sync', async () => {
            const mockOperations = [
                {
                    id: '1',
                    operation: 'INSERT',
                    table_name: 'orders',
                    record_id: 'order-1',
                    payload: JSON.stringify({ restaurant_id: 'rest-1' }),
                    idempotency_key: 'key-1',
                    attempts: 0,
                    last_error: null,
                    created_at: new Date().toISOString(),
                },
            ];

            mockedGetPendingSyncOperations.mockResolvedValue(mockOperations);

            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        results: [{ success: true }],
                    },
                }),
            });

            const events: SyncEvent[] = [];
            const onSyncEvent = (event: SyncEvent) => events.push(event);

            worker = createSyncWorker({ onSyncEvent });
            await worker.syncOnce();

            expect(events.some(e => e.type === 'sync:start')).toBe(true);
            expect(events.some(e => e.type === 'operation:success')).toBe(true);
            expect(events.some(e => e.type === 'sync:complete')).toBe(true);
        });
    });

    describe('conflict detection', () => {
        it('should detect conflict from batch sync response', async () => {
            const mockOperations = [
                {
                    id: '1',
                    operation: 'INSERT',
                    table_name: 'orders',
                    record_id: 'order-1',
                    payload: JSON.stringify({ restaurant_id: 'rest-1' }),
                    idempotency_key: 'key-1',
                    attempts: 0,
                    last_error: null,
                    created_at: new Date().toISOString(),
                },
            ];

            mockedGetPendingSyncOperations.mockResolvedValue(mockOperations);

            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        results: [{ success: false, conflict: true, error: 'Version mismatch' }],
                    },
                }),
            });

            const onSyncEvent = vi.fn();
            worker = createSyncWorker({ onSyncEvent });
            await worker.syncOnce();

            expect(onSyncEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'sync:conflict',
                })
            );
        });

        it('should detect conflict from HTTP 409 response', async () => {
            const mockOperations = [
                {
                    id: '1',
                    operation: 'UPDATE',
                    table_name: 'orders',
                    record_id: 'order-1',
                    payload: JSON.stringify({ restaurant_id: 'rest-1' }),
                    idempotency_key: 'key-1',
                    attempts: 0,
                    last_error: null,
                    created_at: new Date().toISOString(),
                },
            ];

            mockedGetPendingSyncOperations.mockResolvedValue(mockOperations);

            mockFetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                })
                .mockResolvedValueOnce({
                    ok: false,
                    status: 409,
                    json: async () => ({ error: { message: 'Conflict' } }),
                });

            const onSyncEvent = vi.fn();
            worker = createSyncWorker({ onSyncEvent });
            await worker.syncOnce();

            expect(onSyncEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'sync:conflict',
                })
            );
        });

        it('should include conflictsDetected in sync:complete event', async () => {
            const mockOperations = [
                {
                    id: '1',
                    operation: 'INSERT',
                    table_name: 'orders',
                    record_id: 'order-1',
                    payload: JSON.stringify({ restaurant_id: 'rest-1' }),
                    idempotency_key: 'key-1',
                    attempts: 0,
                    last_error: null,
                    created_at: new Date().toISOString(),
                },
            ];

            mockedGetPendingSyncOperations.mockResolvedValue(mockOperations);

            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    data: {
                        results: [{ success: false, conflict: true, error: 'Version mismatch' }],
                    },
                }),
            });

            const onSyncEvent = vi.fn();
            worker = createSyncWorker({ onSyncEvent });
            await worker.syncOnce();

            const completeEvent = onSyncEvent.mock.calls.find(
                (call: Array<SyncEvent>) => call[0].type === 'sync:complete'
            );
            expect(completeEvent).toBeDefined();
            expect(completeEvent![0].data?.conflictsDetected).toBeGreaterThan(0);
        });

        it('should call reconcileWithServer after successful individual sync', async () => {
            const mockOperations = [
                {
                    id: '1',
                    operation: 'INSERT',
                    table_name: 'orders',
                    record_id: 'order-1',
                    payload: JSON.stringify({ restaurant_id: 'rest-1' }),
                    idempotency_key: 'key-1',
                    attempts: 0,
                    last_error: null,
                    created_at: new Date().toISOString(),
                },
            ];

            mockedGetPendingSyncOperations.mockResolvedValue(mockOperations);

            // Batch fails, individual succeeds with server data
            mockFetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: { id: 'order-1', version: 2, total: 100 },
                    }),
                });

            const { reconcileWithServer } = await import('../conflict-resolution');
            const mockedReconcile = vi.mocked(reconcileWithServer);

            worker = createSyncWorker();
            await worker.syncOnce();

            expect(mockedReconcile).toHaveBeenCalledWith(
                expect.objectContaining({
                    entityType: 'orders',
                    entityId: 'order-1',
                    serverData: expect.objectContaining({
                        id: 'order-1',
                        version: 2,
                    }),
                })
            );
        });
    });
});

describe('Global sync worker functions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getSyncQueueStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
            pending: 0,
            completed: 0,
            failed: 0,
        });
    });

    it('should get singleton sync worker instance', () => {
        const worker1 = getSyncWorker();
        const worker2 = getSyncWorker();

        expect(worker1).toBe(worker2);
    });

    it('should start global sync worker', () => {
        startGlobalSync();
        const worker = getSyncWorker();

        expect(worker.isRunning).toBe(true);
        worker.stop();
    });

    it('should stop global sync worker', () => {
        startGlobalSync();
        stopGlobalSync();
        const worker = getSyncWorker();

        expect(worker.isRunning).toBe(false);
    });

    it('should trigger manual sync', async () => {
        const result = await triggerSync();

        expect(result).toHaveProperty('pendingOperations');
        expect(result).toHaveProperty('completedOperations');
        expect(result).toHaveProperty('failedOperations');
        expect(result).toHaveProperty('isOnline');
    });
});

describe('SyncWorkerConfig', () => {
    it('should use default values for missing config options', () => {
        const worker = createSyncWorker({});
        expect(worker).toBeDefined();
    });

    it('should accept partial config', () => {
        const worker = createSyncWorker({
            batchSize: 50,
        });
        expect(worker).toBeDefined();
    });

    it('should accept full config', () => {
        const config: Partial<SyncWorkerConfig> = {
            syncIntervalMs: 10000,
            batchSize: 50,
            enablePrinterQueue: false,
            onSyncProgress: vi.fn(),
            onError: vi.fn(),
            onSyncEvent: vi.fn(),
        };

        const worker = createSyncWorker(config);
        expect(worker).toBeDefined();
    });
});
