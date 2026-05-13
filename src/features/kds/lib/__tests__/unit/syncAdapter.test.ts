import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPowerSync = vi.fn();

vi.mock('@/lib/sync/powersync-config', () => ({
    getPowerSync: mockGetPowerSync,
}));

describe('kds sync adapter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fails closed when local runtime missing instead of reading localStorage fallback', async () => {
        mockGetPowerSync.mockReturnValue(null);
        vi.stubGlobal('window', {
            localStorage: {
                getItem: vi.fn(() =>
                    JSON.stringify({
                        pendingActions: [{ id: 'legacy-1' }],
                    })
                ),
            },
        });

        const { getOfflineKdsQueueCount, getPendingKdsActions } = await import('../../syncAdapter');

        await expect(getOfflineKdsQueueCount()).resolves.toBe(0);
        await expect(getPendingKdsActions()).resolves.toEqual([]);
    });

    it('reads pending KDS actions from PowerSync-backed sync queue', async () => {
        mockGetPowerSync.mockReturnValue({
            getFirstAsync: vi.fn().mockResolvedValue({ count: 2 }),
            getAllAsync: vi.fn().mockResolvedValue([
                {
                    id: 1,
                    record_id: 'kds-1',
                    payload: JSON.stringify({
                        order_id: 'order-1',
                        order_item_id: 'item-1',
                        action: 'ready',
                        reason: 'done',
                    }),
                    attempts: 0,
                    created_at: '2026-04-23T00:00:00.000Z',
                    idempotency_key: 'idem-1',
                },
            ]),
            execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }),
        });

        const { getOfflineKdsQueueCount, getPendingKdsActions } = await import('../../syncAdapter');

        await expect(getOfflineKdsQueueCount()).resolves.toBe(2);
        await expect(getPendingKdsActions()).resolves.toEqual([
            {
                id: '1',
                orderId: 'order-1',
                itemId: 'item-1',
                kdsItemId: 'kds-1',
                action: 'ready',
                reason: 'done',
                enqueuedAt: '2026-04-23T00:00:00.000Z',
                attempts: 0,
                idempotencyKey: 'idem-1',
            },
        ]);
    });
});
