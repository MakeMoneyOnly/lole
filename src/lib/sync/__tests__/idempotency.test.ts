/**
 * Tests for Idempotency Key Manager
 *
 * CRIT-05: Offline sync consolidation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock PowerSync
const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
const mockGetFirstAsync = vi.fn().mockResolvedValue(null);
const mockGetAllAsync = vi.fn().mockResolvedValue([]);
const mockAppendLocalJournalEntryInDatabase = vi.fn().mockResolvedValue(null);

vi.mock('../powersync-config', () => ({
    getPowerSync: vi.fn(() => ({
        execute: mockExecute,
        getFirstAsync: mockGetFirstAsync,
        getAllAsync: mockGetAllAsync,
    })),
}));

vi.mock('@/lib/journal/local-journal', () => ({
    appendLocalJournalEntryInDatabase: mockAppendLocalJournalEntryInDatabase,
}));

describe('Idempotency Key Manager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecute.mockResolvedValue({ rowsAffected: 1 });
        mockGetFirstAsync.mockResolvedValue(null);
        mockGetAllAsync.mockResolvedValue([]);
        mockAppendLocalJournalEntryInDatabase.mockResolvedValue(null);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('generateIdempotencyKey', () => {
        it('should generate a unique key with prefix', async () => {
            const { generateIdempotencyKey } = await import('../idempotency');
            const key = generateIdempotencyKey('order');

            expect(key).toMatch(/^order-/);
            expect(key.length).toBeGreaterThan(10);
        });

        it('should generate unique keys on each call', async () => {
            const { generateIdempotencyKey } = await import('../idempotency');
            const key1 = generateIdempotencyKey();
            const key2 = generateIdempotencyKey();

            expect(key1).not.toBe(key2);
        });

        it('should use default prefix when not provided', async () => {
            const { generateIdempotencyKey } = await import('../idempotency');
            const key = generateIdempotencyKey();

            expect(key).toMatch(/^offline-/);
        });
    });

    describe('isIdempotencyKeyUsed', () => {
        it('should return true when key exists and is completed', async () => {
            mockGetFirstAsync.mockResolvedValueOnce({ id: 1 });

            const { isIdempotencyKeyUsed } = await import('../idempotency');
            const result = await isIdempotencyKeyUsed('test-key-123');

            expect(result).toBe(true);
            expect(mockGetFirstAsync).toHaveBeenCalledWith(
                expect.stringContaining("status = 'completed'"),
                ['test-key-123']
            );
        });

        it('should return false when key does not exist', async () => {
            mockGetFirstAsync.mockResolvedValueOnce(null);

            const { isIdempotencyKeyUsed } = await import('../idempotency');
            const result = await isIdempotencyKeyUsed('nonexistent-key');

            expect(result).toBe(false);
        });

        it('should return false when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { isIdempotencyKeyUsed } = await import('../idempotency');
            const result = await isIdempotencyKeyUsed('test-key');

            expect(result).toBe(false);
        });
    });

    describe('markIdempotencyKeyCompleted', () => {
        it('should update sync_queue status to completed', async () => {
            const { markIdempotencyKeyCompleted } = await import('../idempotency');
            await markIdempotencyKeyCompleted('test-key-123');

            expect(mockExecute).toHaveBeenCalledWith(
                expect.stringContaining("status = 'completed'"),
                expect.arrayContaining([expect.any(String), 'test-key-123'])
            );
        });

        it('should do nothing when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { markIdempotencyKeyCompleted } = await import('../idempotency');
            await markIdempotencyKeyCompleted('test-key');

            expect(mockExecute).not.toHaveBeenCalled();
        });
    });

    describe('queueSyncOperation', () => {
        it('should queue a sync operation with all fields', async () => {
            const { queueSyncOperation } = await import('../idempotency');
            const result = await queueSyncOperation('create', 'orders', 'order-123', {
                total: 1000,
                status: 'pending',
            });

            expect(result).toMatch(/^create-orders-/);
            expect(mockExecute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO sync_queue'),
                expect.arrayContaining([
                    'create',
                    'orders',
                    'order-123',
                    expect.any(String),
                    expect.any(String),
                    expect.any(String),
                ])
            );
        });

        it('should return empty string when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { queueSyncOperation } = await import('../idempotency');
            const result = await queueSyncOperation('update', 'orders', 'order-123', {});

            expect(result).toBe('');
        });

        it('should append sync journal when context supplied', async () => {
            const { queueSyncOperation } = await import('../idempotency');
            await queueSyncOperation(
                'create',
                'orders',
                'order-123',
                { total: 1000 },
                {
                    restaurantId: 'rest-1',
                    locationId: 'loc-1',
                    deviceId: 'dev-1',
                    actorId: 'device-1',
                }
            );

            expect(mockAppendLocalJournalEntryInDatabase).toHaveBeenCalledOnce();
            expect(mockAppendLocalJournalEntryInDatabase).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    entryKind: 'sync',
                    aggregateType: 'orders',
                    aggregateId: 'order-123',
                    operationType: 'sync.create',
                })
            );
            expect(mockAppendLocalJournalEntryInDatabase.mock.invocationCallOrder[0]).toBeLessThan(
                mockExecute.mock.invocationCallOrder[0]
            );
        });
    });

    describe('getPendingSyncOperations', () => {
        it('should return pending operations', async () => {
            const mockOperations = [
                {
                    id: 1,
                    operation: 'create',
                    table_name: 'orders',
                    record_id: 'order-1',
                    payload: '{"total":1000}',
                    idempotency_key: 'key-1',
                    attempts: 0,
                    last_error: null,
                    created_at: '2024-01-01T10:00:00Z',
                },
            ];
            mockGetAllAsync.mockResolvedValueOnce(mockOperations);

            const { getPendingSyncOperations } = await import('../idempotency');
            const result = await getPendingSyncOperations();

            expect(result).toEqual(mockOperations);
            expect(mockGetAllAsync).toHaveBeenCalledWith(
                expect.stringContaining("status = 'pending'"),
                [50]
            );
        });

        it('should respect limit parameter', async () => {
            mockGetAllAsync.mockResolvedValueOnce([]);

            const { getPendingSyncOperations } = await import('../idempotency');
            await getPendingSyncOperations(100);

            expect(mockGetAllAsync).toHaveBeenCalledWith(expect.any(String), [100]);
        });

        it('should return empty array when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { getPendingSyncOperations } = await import('../idempotency');
            const result = await getPendingSyncOperations();

            expect(result).toEqual([]);
        });
    });

    describe('markSyncOperationFailed', () => {
        it('should increment attempts and set error', async () => {
            const { markSyncOperationFailed } = await import('../idempotency');
            await markSyncOperationFailed('1', 'Network error');

            expect(mockExecute).toHaveBeenCalledWith(
                expect.stringContaining('attempts = attempts + 1'),
                ['Network error', '1']
            );
        });

        it('should do nothing when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { markSyncOperationFailed } = await import('../idempotency');
            await markSyncOperationFailed('1', 'error');

            expect(mockExecute).not.toHaveBeenCalled();
        });
    });

    describe('markSyncOperationCompleted', () => {
        it('should update status to completed', async () => {
            const { markSyncOperationCompleted } = await import('../idempotency');
            await markSyncOperationCompleted('1');

            expect(mockExecute).toHaveBeenCalledWith(
                expect.stringContaining("status = 'completed'"),
                expect.arrayContaining([expect.any(String), '1'])
            );
        });

        it('should do nothing when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { markSyncOperationCompleted } = await import('../idempotency');
            await markSyncOperationCompleted('1');

            expect(mockExecute).not.toHaveBeenCalled();
        });
    });

    describe('getSyncQueueStatus', () => {
        it('should return counts for all statuses', async () => {
            mockGetFirstAsync
                .mockResolvedValueOnce({ count: 5 })
                .mockResolvedValueOnce({ count: 2 })
                .mockResolvedValueOnce({ count: 10 })
                .mockResolvedValueOnce({ count: 1 });

            const { getSyncQueueStatus } = await import('../idempotency');
            const result = await getSyncQueueStatus();

            expect(result).toEqual({
                pending: 5,
                processing: 2,
                completed: 10,
                failed: 1,
            });
        });

        it('should return zeros when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { getSyncQueueStatus } = await import('../idempotency');
            const result = await getSyncQueueStatus();

            expect(result).toEqual({
                pending: 0,
                processing: 0,
                completed: 0,
                failed: 0,
            });
        });

        it('should handle null counts gracefully', async () => {
            mockGetFirstAsync.mockResolvedValue(null);

            const { getSyncQueueStatus } = await import('../idempotency');
            const result = await getSyncQueueStatus();

            expect(result).toEqual({
                pending: 0,
                processing: 0,
                completed: 0,
                failed: 0,
            });
        });
    });

    describe('clearCompletedSyncOperations', () => {
        it('should delete completed operations older than specified days', async () => {
            mockExecute.mockResolvedValueOnce({ rowsAffected: 5 });

            const { clearCompletedSyncOperations } = await import('../idempotency');
            const result = await clearCompletedSyncOperations(7);

            expect(result).toBe(5);
            expect(mockExecute).toHaveBeenCalledWith(
                expect.stringContaining("status = 'completed'"),
                expect.arrayContaining([expect.any(String)])
            );
        });

        it('should use default of 7 days', async () => {
            mockExecute.mockResolvedValueOnce({ rowsAffected: 0 });

            const { clearCompletedSyncOperations } = await import('../idempotency');
            await clearCompletedSyncOperations();

            expect(mockExecute).toHaveBeenCalled();
        });

        it('should return 0 when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { clearCompletedSyncOperations } = await import('../idempotency');
            const result = await clearCompletedSyncOperations();

            expect(result).toBe(0);
        });
    });
});
