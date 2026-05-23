/**
 * Tests for KDS Sync Manager
 *
 * CRIT-05: Offline sync consolidation for KDS
 * HIGH-006: Conflict resolution for KDS sync
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock PowerSync
const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
const mockGetFirstAsync = vi.fn().mockResolvedValue(null);
const mockGetAllAsync = vi.fn().mockResolvedValue([]);
const mockQueueSyncOperationInDatabase = vi.fn().mockResolvedValue(undefined);
const mockAppendLocalJournalEntryInDatabase = vi.fn().mockResolvedValue(undefined);

vi.mock('../powersync-config', () => ({
    getPowerSync: vi.fn(() => ({
        execute: mockExecute,
        getFirstAsync: mockGetFirstAsync,
        getAllAsync: mockGetAllAsync,
        write: vi.fn(async (fn: () => Promise<unknown>) => fn()),
    })),
}));

// Mock idempotency module
vi.mock('../idempotency', () => ({
    queueSyncOperationInDatabase: mockQueueSyncOperationInDatabase,
    generateIdempotencyKey: vi.fn((prefix: string) => `${prefix}-test-idempotency-key`),
}));

vi.mock('@/lib/journal/local-journal', () => ({
    appendLocalJournalEntryInDatabase: mockAppendLocalJournalEntryInDatabase,
}));

// Mock conflict-resolution module
vi.mock('../conflict-resolution', () => ({
    resolveConflict: vi.fn((tableName, clientData, serverData, strategy) => ({
        resolvedData: { ...serverData, ...clientData, version: serverData.version },
        strategy,
        auditDetails: { winner: 'server', reason: 'server_wins' },
    })),
    logConflictResolution: vi.fn().mockResolvedValue(undefined),
    getConflictType: vi.fn(() => 'version_mismatch'),
}));

// Mock logger
vi.mock('../../logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn(() => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        })),
    },
}));

describe('KDS Sync Manager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mock implementations
        mockExecute.mockResolvedValue({ rowsAffected: 1 });
        mockGetFirstAsync.mockResolvedValue(null);
        mockGetAllAsync.mockResolvedValue([]);
        mockQueueSyncOperationInDatabase.mockResolvedValue(undefined);
        mockAppendLocalJournalEntryInDatabase.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('createKdsItem', () => {
        it('should create a KDS item with required fields', async () => {
            const randomUUIDSpy = vi
                .spyOn(crypto, 'randomUUID')
                .mockReturnValue(
                    'test-kds-id-123' as `${string}-${string}-${string}-${string}-${string}`
                );

            mockGetFirstAsync.mockResolvedValueOnce({
                id: 'test-kds-id-123',
                order_id: 'order-1',
                order_item_id: 'item-1',
                station: 'grill',
                status: 'queued',
                priority: 0,
                created_at: '2024-01-01T10:00:00Z',
            });

            const { createKdsItem } = await import('../kdsSync');
            const result = await createKdsItem('order-1', 'item-1', 'grill');

            expect(result).not.toBeNull();
            expect(mockExecute).toHaveBeenCalled();
            expect(mockAppendLocalJournalEntryInDatabase).toHaveBeenCalledOnce();
            expect(mockQueueSyncOperationInDatabase).toHaveBeenCalledOnce();
            expect(mockAppendLocalJournalEntryInDatabase.mock.invocationCallOrder[0]).toBeLessThan(
                mockExecute.mock.invocationCallOrder[0]
            );

            randomUUIDSpy.mockRestore();
        });

        it('should create a KDS item with display data', async () => {
            const randomUUIDSpy = vi
                .spyOn(crypto, 'randomUUID')
                .mockReturnValue(
                    'test-kds-id-456' as `${string}-${string}-${string}-${string}-${string}`
                );

            mockGetFirstAsync.mockResolvedValueOnce({
                id: 'test-kds-id-456',
                order_id: 'order-1',
                order_item_id: 'item-1',
                station: 'grill',
                status: 'queued',
                priority: 5,
                menu_item_name: 'Test Burger',
                quantity: 2,
                created_at: '2024-01-01T10:00:00Z',
            });

            const { createKdsItem } = await import('../kdsSync');
            const result = await createKdsItem('order-1', 'item-1', 'grill', 5, {
                menu_item_name: 'Test Burger',
                quantity: 2,
            });

            expect(result).not.toBeNull();
            expect(mockExecute).toHaveBeenCalledTimes(2); // INSERT + UPDATE
            expect(mockAppendLocalJournalEntryInDatabase).toHaveBeenCalledOnce();
            expect(mockQueueSyncOperationInDatabase).toHaveBeenCalledOnce();

            randomUUIDSpy.mockRestore();
        });

        it('should return null when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { createKdsItem } = await import('../kdsSync');
            const result = await createKdsItem('order-1', 'item-1', 'grill');

            expect(result).toBeNull();
        });

        it('should handle database errors gracefully', async () => {
            mockExecute.mockRejectedValueOnce(new Error('Database error'));

            const { createKdsItem } = await import('../kdsSync');
            const result = await createKdsItem('order-1', 'item-1', 'grill');

            expect(result).toBeNull();
        });
    });

    describe('getKdsItem', () => {
        it('should return a KDS item by ID', async () => {
            const mockItem = {
                id: 'kds-1',
                order_id: 'order-1',
                order_item_id: 'item-1',
                station: 'grill',
                status: 'in_progress',
                priority: 0,
                menu_item_name: 'Burger',
                quantity: 1,
            };
            mockGetFirstAsync.mockResolvedValueOnce(mockItem);

            const { getKdsItem } = await import('../kdsSync');
            const result = await getKdsItem('kds-1');

            expect(result).toEqual(mockItem);
            expect(mockGetFirstAsync).toHaveBeenCalledWith(
                expect.stringContaining('FROM kds_items k'),
                ['kds-1']
            );
        });

        it('should return null when item not found', async () => {
            mockGetFirstAsync.mockResolvedValueOnce(null);

            const { getKdsItem } = await import('../kdsSync');
            const result = await getKdsItem('nonexistent');

            expect(result).toBeNull();
        });

        it('should return null when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { getKdsItem } = await import('../kdsSync');
            const result = await getKdsItem('kds-1');

            expect(result).toBeNull();
        });
    });

    describe('getKdsItemsByStation', () => {
        it('should return KDS items for a station excluding bumped', async () => {
            const mockItems = [
                { id: 'kds-1', station: 'grill', status: 'in_progress' },
                { id: 'kds-2', station: 'grill', status: 'queued' },
            ];
            mockGetAllAsync.mockResolvedValueOnce(mockItems);

            const { getKdsItemsByStation } = await import('../kdsSync');
            const result = await getKdsItemsByStation('grill');

            expect(result).toEqual(mockItems);
            expect(mockGetAllAsync).toHaveBeenCalledWith(
                expect.stringContaining("WHERE k.station = ? AND k.status != 'bumped'"),
                ['grill']
            );
        });

        it('should return empty array when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { getKdsItemsByStation } = await import('../kdsSync');
            const result = await getKdsItemsByStation('grill');

            expect(result).toEqual([]);
        });
    });

    describe('getKdsItemsByOrder', () => {
        it('should return all KDS items for an order', async () => {
            const mockItems = [
                { id: 'kds-1', order_id: 'order-1', status: 'in_progress' },
                { id: 'kds-2', order_id: 'order-1', status: 'ready' },
            ];
            mockGetAllAsync.mockResolvedValueOnce(mockItems);

            const { getKdsItemsByOrder } = await import('../kdsSync');
            const result = await getKdsItemsByOrder('order-1');

            expect(result).toEqual(mockItems);
            expect(mockGetAllAsync).toHaveBeenCalledWith(
                expect.stringContaining('WHERE k.order_id = ?'),
                ['order-1']
            );
        });

        it('should return empty array when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { getKdsItemsByOrder } = await import('../kdsSync');
            const result = await getKdsItemsByOrder('order-1');

            expect(result).toEqual([]);
        });
    });

    describe('executeKdsAction', () => {
        it('should execute start action and update status to in_progress', async () => {
            mockGetFirstAsync.mockResolvedValueOnce({
                id: 'kds-1',
                order_item_id: 'item-1',
                status: 'queued',
            });

            const { executeKdsAction } = await import('../kdsSync');
            const result = await executeKdsAction('kds-1', 'start');

            expect(result).toBe(true);
            expect(mockExecute).toHaveBeenCalled();
            expect(mockAppendLocalJournalEntryInDatabase).toHaveBeenCalledOnce();
            expect(mockQueueSyncOperationInDatabase).toHaveBeenCalledOnce();
        });

        it('should execute ready action and update status', async () => {
            mockGetFirstAsync.mockResolvedValueOnce({
                id: 'kds-1',
                order_item_id: 'item-1',
                status: 'in_progress',
            });

            const { executeKdsAction } = await import('../kdsSync');
            const result = await executeKdsAction('kds-1', 'ready');

            expect(result).toBe(true);
        });

        it('should execute bump action and update status to completed', async () => {
            mockGetFirstAsync.mockResolvedValueOnce({
                id: 'kds-1',
                order_item_id: 'item-1',
                status: 'ready',
            });

            const { executeKdsAction } = await import('../kdsSync');
            const result = await executeKdsAction('kds-1', 'bump');

            expect(result).toBe(true);
        });

        it('should execute hold action and move item to on_hold', async () => {
            mockGetFirstAsync.mockResolvedValueOnce({
                id: 'kds-1',
                order_item_id: 'item-1',
                status: 'in_progress',
            });

            const { executeKdsAction } = await import('../kdsSync');
            const result = await executeKdsAction('kds-1', 'hold');

            expect(result).toBe(true);
        });

        it('should execute recall action', async () => {
            mockGetFirstAsync.mockResolvedValueOnce({
                id: 'kds-1',
                order_item_id: 'item-1',
                status: 'ready',
            });

            const { executeKdsAction } = await import('../kdsSync');
            const result = await executeKdsAction('kds-1', 'recall');

            expect(result).toBe(true);
        });

        it('should return false for invalid action', async () => {
            const { executeKdsAction } = await import('../kdsSync');
            const result = await executeKdsAction('kds-1', 'invalid' as never);

            expect(result).toBe(false);
        });

        it('should return false when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { executeKdsAction } = await import('../kdsSync');
            const result = await executeKdsAction('kds-1', 'start');

            expect(result).toBe(false);
        });

        it('should handle database errors gracefully', async () => {
            mockExecute.mockRejectedValueOnce(new Error('Database error'));

            const { executeKdsAction } = await import('../kdsSync');
            const result = await executeKdsAction('kds-1', 'start');

            expect(result).toBe(false);
        });
    });

    describe('getKdsStats', () => {
        it('should return KDS queue statistics', async () => {
            mockGetAllAsync.mockResolvedValueOnce([
                { status: 'queued', count: 5 },
                { status: 'in_progress', count: 3 },
                { status: 'ready', count: 2 },
            ]);

            const { getKdsStats } = await import('../kdsSync');
            const result = await getKdsStats();

            expect(result).toEqual({
                queued: 5,
                cooking: 3,
                ready: 2,
                total: 10,
            });
        });

        it('should filter by station when provided', async () => {
            mockGetAllAsync.mockResolvedValueOnce([
                { status: 'queued', count: 2 },
                { status: 'in_progress', count: 1 },
            ]);

            const { getKdsStats } = await import('../kdsSync');
            const result = await getKdsStats('grill');

            expect(mockGetAllAsync).toHaveBeenCalledWith(
                expect.stringContaining('AND station = ?'),
                ['grill']
            );
            expect(result.total).toBe(3);
        });

        it('should return zeros when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { getKdsStats } = await import('../kdsSync');
            const result = await getKdsStats();

            expect(result).toEqual({
                queued: 0,
                cooking: 0,
                ready: 0,
                total: 0,
            });
        });
    });

    describe('clearBumpedKdsItems', () => {
        it('should delete bumped items older than specified hours', async () => {
            mockExecute.mockResolvedValueOnce({ rowsAffected: 5 });

            const { clearBumpedKdsItems } = await import('../kdsSync');
            const result = await clearBumpedKdsItems(24);

            expect(result).toBe(5);
            expect(mockExecute).toHaveBeenCalledWith(
                expect.stringContaining("WHERE status = 'bumped' AND bumped_at <"),
                expect.arrayContaining([expect.any(String)])
            );
        });

        it('should return 0 when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { clearBumpedKdsItems } = await import('../kdsSync');
            const result = await clearBumpedKdsItems();

            expect(result).toBe(0);
        });
    });

    describe('resolveKdsConflict', () => {
        it('should resolve conflict using server_wins strategy by default', async () => {
            mockGetFirstAsync.mockResolvedValueOnce({
                id: 'kds-1',
                status: 'cooking',
                version: 2,
            });

            const { resolveKdsConflict } = await import('../kdsSync');
            const result = await resolveKdsConflict(
                'kds-1',
                {
                    id: 'kds-1',
                    order_id: 'order-1',
                    order_item_id: 'item-1',
                    station: 'grill',
                    status: 'queued',
                    priority: 0,
                    created_at: '2024-01-01T10:00:00Z',
                    version: 1,
                    last_modified: '2024-01-01T10:00:00Z',
                },
                {
                    id: 'kds-1',
                    status: 'cooking',
                    version: 2,
                    last_modified: '2024-01-01T11:00:00Z',
                }
            );

            expect(result.resolved).toBe(true);
            expect(result.strategy).toBe('server_wins');
        });

        it('should return error when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { resolveKdsConflict } = await import('../kdsSync');
            const result = await resolveKdsConflict(
                'kds-1',
                {
                    id: 'kds-1',
                    order_id: 'order-1',
                    order_item_id: 'item-1',
                    station: 'grill',
                    status: 'queued',
                    priority: 0,
                    created_at: '2024-01-01T10:00:00Z',
                    version: 1,
                    last_modified: '2024-01-01T10:00:00Z',
                },
                {
                    id: 'kds-1',
                    status: 'cooking',
                    version: 2,
                    last_modified: '2024-01-01T11:00:00Z',
                }
            );

            expect(result.resolved).toBe(false);
            expect(result.error).toBe('PowerSync not initialized');
        });

        it('should handle resolution errors gracefully', async () => {
            mockExecute.mockRejectedValueOnce(new Error('Update failed'));

            const { resolveKdsConflict } = await import('../kdsSync');
            const result = await resolveKdsConflict(
                'kds-1',
                {
                    id: 'kds-1',
                    order_id: 'order-1',
                    order_item_id: 'item-1',
                    station: 'grill',
                    status: 'queued',
                    priority: 0,
                    created_at: '2024-01-01T10:00:00Z',
                    version: 1,
                    last_modified: '2024-01-01T10:00:00Z',
                },
                {
                    id: 'kds-1',
                    status: 'cooking',
                    version: 2,
                    last_modified: '2024-01-01T11:00:00Z',
                }
            );

            expect(result.resolved).toBe(false);
            expect(result.error).toBe('Update failed');
        });
    });

    describe('getConflictedKdsItems', () => {
        it('should return KDS items with conflicts', async () => {
            const mockItems = [{ id: 'kds-1', order_id: 'order-1', status: 'cooking' }];
            mockGetAllAsync.mockResolvedValueOnce(mockItems);

            const { getConflictedKdsItems } = await import('../kdsSync');
            const result = await getConflictedKdsItems();

            expect(result).toEqual(mockItems);
        });

        it('should filter by orderId when provided', async () => {
            mockGetAllAsync.mockResolvedValueOnce([]);

            const { getConflictedKdsItems } = await import('../kdsSync');
            await getConflictedKdsItems('order-1');

            expect(mockGetAllAsync).toHaveBeenCalledWith(
                expect.stringContaining('AND k.order_id = ?'),
                ['order-1']
            );
        });

        it('should return empty array when PowerSync is not available', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { getConflictedKdsItems } = await import('../kdsSync');
            const result = await getConflictedKdsItems();

            expect(result).toEqual([]);
        });
    });

    describe('batchResolveKdsConflicts', () => {
        it('should resolve multiple conflicts and return summary', async () => {
            mockGetFirstAsync.mockResolvedValue({
                id: 'kds-1',
                status: 'cooking',
                version: 2,
            });

            const { batchResolveKdsConflicts } = await import('../kdsSync');
            const result = await batchResolveKdsConflicts([
                {
                    kdsId: 'kds-1',
                    clientData: {
                        id: 'kds-1',
                        order_id: 'order-1',
                        order_item_id: 'item-1',
                        station: 'grill',
                        status: 'queued',
                        priority: 0,
                        created_at: '2024-01-01T10:00:00Z',
                        version: 1,
                        last_modified: '2024-01-01T10:00:00Z',
                    },
                    serverData: {
                        id: 'kds-1',
                        status: 'cooking',
                        version: 2,
                        last_modified: '2024-01-01T11:00:00Z',
                    },
                },
            ]);

            expect(result.resolved).toBe(1);
            expect(result.failed).toBe(0);
            expect(result.errors).toHaveLength(0);
        });

        it('should track failed resolutions', async () => {
            const { getPowerSync } = await import('../powersync-config');
            vi.mocked(getPowerSync).mockReturnValueOnce(
                null as unknown as ReturnType<typeof getPowerSync>
            );

            const { batchResolveKdsConflicts } = await import('../kdsSync');
            const result = await batchResolveKdsConflicts([
                {
                    kdsId: 'kds-1',
                    clientData: {
                        id: 'kds-1',
                        order_id: 'order-1',
                        order_item_id: 'item-1',
                        station: 'grill',
                        status: 'queued',
                        priority: 0,
                        created_at: '2024-01-01T10:00:00Z',
                        version: 1,
                        last_modified: '2024-01-01T10:00:00Z',
                    },
                    serverData: {
                        id: 'kds-1',
                        status: 'cooking',
                        version: 2,
                        last_modified: '2024-01-01T11:00:00Z',
                    },
                },
            ]);

            expect(result.resolved).toBe(0);
            expect(result.failed).toBe(1);
            expect(result.errors).toHaveLength(1);
        });
    });
});
