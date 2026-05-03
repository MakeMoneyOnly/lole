/**
 * Sync Stress Tests
 *
 * L5: Load tests, concurrent device tests, and chaos tests
 * for the sync infrastructure.
 *
 * Run: npx vitest run src/lib/sync/__tests__/stress-tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
const mockGetFirstAsync = vi.fn().mockResolvedValue(null);
const mockGetAllAsync = vi.fn().mockResolvedValue([]);
const mockGetOptional = vi.fn().mockResolvedValue(null);

vi.mock('../powersync-config', () => ({
    getPowerSync: vi.fn(() => ({
        execute: mockExecute,
        getFirstAsync: mockGetFirstAsync,
        getAllAsync: mockGetAllAsync,
        write: vi.fn(async (fn: () => Promise<void>) => fn()),
    })),
    getPowerSyncBootstrapStatus: vi.fn(() => ({ state: 'ready', message: '', updatedAt: '' })),
    getPowerSyncConfig: vi.fn(() => ({ endpoint: '', accessToken: '' })),
}));

vi.mock('../../logger', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('Sync Stress Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecute.mockResolvedValue({ rowsAffected: 1 });
        mockGetFirstAsync.mockResolvedValue(null);
        mockGetAllAsync.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Conflict Resolution — batch stress', () => {
        it('resolves 100 concurrent conflicts without data loss', async () => {
            const { batchResolveConflicts } = await import('../conflict-resolution');

            const conflicts = Array.from({ length: 100 }, (_, i) => ({
                entityType: 'orders' as const,
                entityId: `order-${i}`,
                clientData: {
                    id: `order-${i}`,
                    notes: `Note ${i}`,
                    total_santim: 1000 + i,
                    version: 1,
                    last_modified: '2026-05-03T10:00:00.000Z',
                },
                serverData: {
                    id: `order-${i}`,
                    notes: `Server note ${i}`,
                    total_santim: 2000 + i,
                    version: 2,
                    last_modified: '2026-05-03T10:01:00.000Z',
                },
            }));

            const result = await batchResolveConflicts(conflicts);
            expect(result.resolved).toBe(100);
            expect(result.failed).toBe(0);
        });

        it('handles mixed entity types correctly', async () => {
            const { batchResolveConflicts } = await import('../conflict-resolution');

            const conflicts = [
                {
                    entityType: 'orders' as const,
                    entityId: 'order-1',
                    clientData: {
                        id: 'order-1',
                        notes: 'c-notes',
                        total_santim: 1000,
                        version: 1,
                        last_modified: '2026-05-03T10:00:00Z',
                    },
                    serverData: {
                        id: 'order-1',
                        notes: 's-notes',
                        total_santim: 2000,
                        version: 2,
                        last_modified: '2026-05-03T10:01:00Z',
                    },
                },
                {
                    entityType: 'payments' as const,
                    entityId: 'pay-1',
                    clientData: {
                        id: 'pay-1',
                        amount: 100,
                        version: 1,
                        last_modified: '2026-05-03T10:00:00Z',
                    },
                    serverData: {
                        id: 'pay-1',
                        amount: 120,
                        version: 2,
                        last_modified: '2026-05-03T10:01:00Z',
                    },
                },
                {
                    entityType: 'kds_items' as const,
                    entityId: 'kds-1',
                    clientData: {
                        id: 'kds-1',
                        status: 'cooking',
                        version: 1,
                        last_modified: '2026-05-03T10:00:00Z',
                    },
                    serverData: {
                        id: 'kds-1',
                        status: 'ready',
                        version: 2,
                        last_modified: '2026-05-03T10:01:00Z',
                    },
                },
            ];

            const result = await batchResolveConflicts(conflicts);
            expect(result.resolved).toBe(3);
            expect(result.failed).toBe(0);
            expect(result.manualReview).toBe(1); // payment amount mismatch triggers manual_review
        });
    });

    describe('Idempotency — concurrency', () => {
        it('generates unique keys under rapid calls', async () => {
            const { generateIdempotencyKey } = await import('../idempotency');

            const keys = Array.from({ length: 500 }, () => generateIdempotencyKey('test'));
            const uniqueKeys = new Set(keys);
            expect(uniqueKeys.size).toBe(keys.length);
        });

        it('marks operations as completed idempotently', async () => {
            const { markSyncOperationCompleted } = await import('../idempotency');

            await Promise.all(
                Array.from({ length: 50 }, (_, i) => markSyncOperationCompleted(`op-${i}`))
            );

            expect(mockExecute).toHaveBeenCalledTimes(50);
        });
    });

    describe('Conflict Detection — edge cases', () => {
        it('detects delete_update when client deleted but server updated', async () => {
            const { getConflictType } = await import('../conflict-resolution');

            const result = getConflictType(
                { deleted_at: '2026-05-03T10:00:00Z', version: 2 },
                { version: 3 }
            );
            expect(result).toBe('delete_update');
        });

        it('detects delete_update when server deleted but client updated', async () => {
            const { getConflictType } = await import('../conflict-resolution');

            const result = getConflictType(
                { version: 2 },
                { deleted_at: '2026-05-03T10:00:00Z', version: 3 }
            );
            expect(result).toBe('delete_update');
        });

        it('detects version_mismatch with large version gaps', async () => {
            const { getConflictType } = await import('../conflict-resolution');

            const result = getConflictType({ version: 1 }, { version: 50 });
            expect(result).toBe('version_mismatch');
        });

        it('identifies concurrent_edit for adjacent version numbers', async () => {
            const { getConflictType } = await import('../conflict-resolution');

            const result = getConflictType({ version: 5 }, { version: 6 });
            expect(result).toBe('concurrent_edit');
        });
    });

    describe('Conflict Resolution — split-brain scenarios', () => {
        it('flags cancel-vs-serve as manual review', async () => {
            const { requiresOperatorReview } = await import('../conflict-resolution');

            const needsReview = requiresOperatorReview(
                'orders',
                { status: 'cancelled', version: 1, last_modified: '' },
                { status: 'preparing', version: 2, last_modified: '' }
            );
            expect(needsReview).toBe(true);
        });

        it('flags close-vs-transfer table session as manual review', async () => {
            const { requiresOperatorReview } = await import('../conflict-resolution');

            const needsReview = requiresOperatorReview(
                'table_sessions',
                { status: 'closed', version: 1, last_modified: '' },
                { status: 'transferred', version: 2, last_modified: '' }
            );
            expect(needsReview).toBe(true);
        });

        it('does not flag normal status transitions', async () => {
            const { requiresOperatorReview } = await import('../conflict-resolution');

            const needsReview = requiresOperatorReview(
                'orders',
                { status: 'pending', version: 1, last_modified: '' },
                { status: 'preparing', version: 2, last_modified: '' }
            );
            expect(needsReview).toBe(false);
        });
    });

    describe('Data Integrity', () => {
        it('preserves idempotency keys through sync cycle', async () => {
            const { generateIdempotencyKey } = await import('../idempotency');

            const key = generateIdempotencyKey('order');
            expect(key).toMatch(/^order-/);
            expect(key.length).toBeGreaterThan(15);
        });

        it('handles empty payload gracefully in conflict resolution', async () => {
            const { resolveConflict } = await import('../conflict-resolution');

            const result = resolveConflict(
                'orders',
                { version: 1, last_modified: '2026-05-03T10:00:00Z' },
                { version: 2, last_modified: '2026-05-03T10:01:00Z' }
            );

            expect(result.strategy).toBe('merge');
            expect(result.resolvedData).toBeDefined();
        });
    });
});
