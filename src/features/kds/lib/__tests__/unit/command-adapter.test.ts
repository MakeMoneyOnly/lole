import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecuteKdsAction = vi.fn();
const mockGetPowerSync = vi.fn();
vi.mock('@/lib/sync', () => ({
    executeKdsAction: mockExecuteKdsAction,
    getPowerSync: mockGetPowerSync,
}));

describe('kds command adapter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetPowerSync.mockReturnValue(null);
        mockExecuteKdsAction.mockResolvedValue(false);
        vi.stubGlobal('fetch', vi.fn());
    });

    it('prefers local command execution when PowerSync exists', async () => {
        mockGetPowerSync.mockReturnValue({ execute: vi.fn() });
        mockExecuteKdsAction.mockResolvedValue(true);

        const { submitKdsItemAction } = await import('../../command-adapter');
        const result = await submitKdsItemAction({
            orderId: 'order-1',
            itemId: 'item-1',
            kdsItemId: 'kds-1',
            action: 'start',
            isOnline: true,
        });

        expect(result).toEqual({
            ok: true,
            mode: 'local',
        });
        expect(mockExecuteKdsAction).toHaveBeenCalledWith('kds-1', 'start');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('fails closed when local runtime missing', async () => {
        const { submitKdsItemAction } = await import('../../command-adapter');
        const result = await submitKdsItemAction({
            orderId: 'order-1',
            itemId: 'item-1',
            kdsItemId: 'kds-1',
            action: 'ready',
            isOnline: false,
        });

        expect(result).toEqual({
            ok: false,
            error: 'Local KDS command runtime unavailable. Pair to store gateway and retry.',
        });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('fails closed when local runtime missing and online', async () => {
        const { submitKdsItemAction } = await import('../../command-adapter');
        const result = await submitKdsItemAction({
            orderId: 'order-1',
            itemId: 'item-1',
            kdsItemId: 'kds-1',
            action: 'hold',
            isOnline: true,
        });

        expect(result).toEqual({
            ok: false,
            error: 'Local KDS command runtime unavailable. Pair to store gateway and retry.',
        });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('fails when local execution cannot complete', async () => {
        mockGetPowerSync.mockReturnValue({ execute: vi.fn() });
        mockExecuteKdsAction.mockResolvedValue(false);

        const { submitKdsItemAction } = await import('../../command-adapter');
        const result = await submitKdsItemAction({
            orderId: 'order-1',
            itemId: 'item-1',
            kdsItemId: 'kds-1',
            action: 'start',
            isOnline: true,
        });

        expect(result).toEqual({
            ok: false,
            error: 'Failed to apply KDS action locally.',
        });
        expect(fetch).not.toHaveBeenCalled();
    });
});
