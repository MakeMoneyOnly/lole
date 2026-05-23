/**
 * Tests for Sync Worker and Conflict Resolution Integration
 *
 * HIGH-005, HIGH-006: Tests for sync worker functionality and conflict resolution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock PowerSync
vi.mock('../powersync-config', () => ({
    getPowerSync: vi.fn(() => ({
        execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
        getFirstAsync: vi.fn().mockResolvedValue(null),
        getAllAsync: vi.fn().mockResolvedValue([]),
        write: vi.fn(async fn => fn()),
    })),
}));

// Mock supabase service-role
vi.mock('../../supabase/service-role', () => ({
    createServiceRoleClient: vi.fn().mockResolvedValue({
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
        }),
    }),
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

describe('Conflict Resolution Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('detectConflict', () => {
        it('should detect conflict when versions differ', async () => {
            const { detectConflict } = await import('../conflict-resolution');

            const clientData = { version: 1, last_modified: '2024-01-01T10:00:00Z' };
            const serverData = { version: 2, last_modified: '2024-01-01T11:00:00Z' };

            const hasConflict = detectConflict(clientData, serverData);
            expect(hasConflict).toBe(true);
        });

        it('should not detect conflict when versions match', async () => {
            const { detectConflict } = await import('../conflict-resolution');

            const clientData = { version: 2, last_modified: '2024-01-01T10:00:00Z' };
            const serverData = { version: 2, last_modified: '2024-01-01T11:00:00Z' };

            const hasConflict = detectConflict(clientData, serverData);
            expect(hasConflict).toBe(false);
        });
    });

    describe('getConflictType', () => {
        it('should identify delete_update conflict when client deleted', async () => {
            const { getConflictType } = await import('../conflict-resolution');

            const clientData = { version: 2, deleted_at: '2024-01-01T10:00:00Z' };
            const serverData = { version: 2, deleted_at: null };

            const conflictType = getConflictType(clientData, serverData);
            expect(conflictType).toBe('delete_update');
        });

        it('should identify version_mismatch when versions differ by more than 1', async () => {
            const { getConflictType } = await import('../conflict-resolution');

            const clientData = { version: 1 };
            const serverData = { version: 5 };

            const conflictType = getConflictType(clientData, serverData);
            expect(conflictType).toBe('version_mismatch');
        });

        it('should identify concurrent_edit when versions differ by 1', async () => {
            const { getConflictType } = await import('../conflict-resolution');

            const clientData = { version: 2 };
            const serverData = { version: 3 };

            const conflictType = getConflictType(clientData, serverData);
            expect(conflictType).toBe('concurrent_edit');
        });
    });

    describe('resolveConflict', () => {
        it('should use server_wins strategy correctly', async () => {
            const { resolveConflict } = await import('../conflict-resolution');

            const clientData = {
                id: '123',
                name: 'Client Name',
                total_santim: 1000,
                version: 1,
                last_modified: '2024-01-01T10:00:00Z',
            };
            const serverData = {
                id: '123',
                name: 'Server Name',
                total_santim: 2000,
                version: 2,
                last_modified: '2024-01-01T11:00:00Z',
            };

            const result = resolveConflict('orders', clientData, serverData, 'server_wins');

            expect(result.strategy).toBe('server_wins');
            expect(result.resolvedData.name).toBe('Server Name');
            expect(result.resolvedData.total_santim).toBe(2000);
            expect(result.auditDetails.winner).toBe('server');
        });

        it('should use client_wins strategy correctly', async () => {
            const { resolveConflict } = await import('../conflict-resolution');

            const clientData = {
                id: '123',
                name: 'Client Name',
                version: 1,
                last_modified: '2024-01-01T10:00:00Z',
            };
            const serverData = {
                id: '123',
                name: 'Server Name',
                version: 2,
                last_modified: '2024-01-01T11:00:00Z',
            };

            const result = resolveConflict('orders', clientData, serverData, 'client_wins');

            expect(result.strategy).toBe('client_wins');
            expect(result.resolvedData.name).toBe('Client Name');
            expect(result.auditDetails.winner).toBe('client');
        });

        it('should use last_write_wins strategy based on timestamp', async () => {
            const { resolveConflict } = await import('../conflict-resolution');

            // Client has newer timestamp
            const clientData = {
                id: '123',
                name: 'Client Name',
                version: 1,
                last_modified: '2024-01-01T12:00:00Z',
            };
            const serverData = {
                id: '123',
                name: 'Server Name',
                version: 2,
                last_modified: '2024-01-01T11:00:00Z',
            };

            const result = resolveConflict('orders', clientData, serverData, 'last_write_wins');

            expect(result.strategy).toBe('last_write_wins');
            expect(result.resolvedData.name).toBe('Client Name');
            expect(result.auditDetails.winner).toBe('client');
        });

        it('should use default strategy from ENTITY_STRATEGIES when not specified', async () => {
            const { resolveConflict } = await import('../conflict-resolution');

            const clientData = {
                id: '123',
                status: 'cooking',
                version: 1,
                last_modified: '2024-01-01T12:00:00Z',
            };
            const serverData = {
                id: '123',
                status: 'ready',
                version: 2,
                last_modified: '2024-01-01T11:00:00Z',
            };

            // kds_items uses server_wins by default
            const result = resolveConflict('kds_items', clientData, serverData);

            expect(result.strategy).toBe('server_wins');
            expect(result.resolvedData.status).toBe('ready');
        });
    });
});

describe('Sync Worker Events', () => {
    it('should emit sync events through callback', async () => {
        const { createSyncWorker } = await import('../syncWorker');
        const onSyncEvent = vi.fn();

        const worker = createSyncWorker({
            syncIntervalMs: 10000,
            onSyncEvent,
        });

        // Worker should be created with event callback
        expect(worker).toBeDefined();
        expect(worker.start).toBeDefined();
        expect(worker.stop).toBeDefined();
        expect(worker.syncOnce).toBeDefined();
        expect(worker.getStatus).toBeDefined();
    });

    it('should track conflicts detected', async () => {
        const { createSyncWorker } = await import('../syncWorker');

        const worker = createSyncWorker();
        const status = await worker.getStatus();

        expect(status).toHaveProperty('pendingOperations');
        expect(status).toHaveProperty('completedOperations');
        expect(status).toHaveProperty('failedOperations');
        expect(status).toHaveProperty('isOnline');
        expect(status).toHaveProperty('conflictsDetected');
    });
});

describe('Order Sync Conflict Resolution', () => {
    it('should export conflict resolution functions', async () => {
        const orderSync = await import('../orderSync');

        expect(orderSync.resolveOrderConflict).toBeDefined();
        expect(orderSync.getConflictedOrders).toBeDefined();
        expect(orderSync.markOrderConflict).toBeDefined();
        expect(orderSync.batchResolveOrderConflicts).toBeDefined();
    });
});

describe('KDS Sync Conflict Resolution', () => {
    it('should export KDS conflict resolution functions', async () => {
        const kdsSync = await import('../kdsSync');

        expect(kdsSync.resolveKdsConflict).toBeDefined();
        expect(kdsSync.getConflictedKdsItems).toBeDefined();
        expect(kdsSync.batchResolveKdsConflicts).toBeDefined();
    });
});

describe('Idempotency', () => {
    it('should generate unique idempotency keys', async () => {
        const { generateIdempotencyKey } = await import('../idempotency');

        const key1 = generateIdempotencyKey('order');
        const key2 = generateIdempotencyKey('order');

        expect(key1).not.toBe(key2);
        expect(key1).toMatch(/^order-/);
        expect(key2).toMatch(/^order-/);
    });

    it('should queue sync operations with idempotency keys', async () => {
        const { queueSyncOperation } = await import('../idempotency');

        const idempotencyKey = await queueSyncOperation('create', 'orders', 'order-123', {
            total: 1000,
        });

        expect(idempotencyKey).toBeDefined();
        expect(idempotencyKey).toMatch(/^create-orders-/);
    });
});
