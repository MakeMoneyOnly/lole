import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PowerSyncDatabase } from '@/lib/sync/powersync-config';
import { StoreRuntimeHarness } from './helpers/storeRuntimeHarness';

let currentDb: PowerSyncDatabase | null = null;

vi.mock('../powersync-config', () => ({
    getPowerSync: vi.fn(() => currentDb),
}));

vi.mock('../../logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

async function loadOrderSync() {
    return await import('../orderSync');
}

async function loadIdempotency() {
    return await import('../idempotency');
}

describe('store runtime harness', () => {
    beforeEach(() => {
        vi.resetModules();
        currentDb = null;
    });

    it('ENT-019: simulates WAN cut and verifies local order create/update still work', async () => {
        const harness = new StoreRuntimeHarness();
        harness.disconnectWan();
        currentDb = harness.createClientDatabase();

        const { createOfflineOrder, updateOfflineOrderStatus, getOfflineOrder } =
            await loadOrderSync();

        const created = await createOfflineOrder({
            restaurant_id: 'rest-1',
            subtotal_santim: 1000,
            vat_santim: 150,
            total_santim: 1150,
            items: [
                {
                    menu_item_id: 'item-1',
                    menu_item_name: 'Burger',
                    quantity: 2,
                    unit_price_santim: 500,
                    total_price_santim: 1000,
                },
            ],
        });

        if (!created.success) {
            console.error('createOfflineOrder failed:', created.error);
        }
        expect(harness.isWanConnected()).toBe(false);
        expect(created.success).toBe(true);
        expect(created.order?.id).toBeDefined();

        const updated = await updateOfflineOrderStatus(created.order!.id, 'acknowledged');
        const order = await getOfflineOrder(created.order!.id);

        expect(updated).toBe(true);
        expect(order?.status).toBe('acknowledged');
        expect(harness.getLocalJournal()).toHaveLength(4);
        expect(harness.getPendingSyncQueue()).toHaveLength(2);
    });

    it('ENT-020: survives gateway restart during WAN outage without losing queued writes', async () => {
        const harness = new StoreRuntimeHarness();
        harness.disconnectWan();
        currentDb = harness.createClientDatabase();

        const { createOfflineOrder, updateOfflineOrderStatus } = await loadOrderSync();

        const created = await createOfflineOrder({
            restaurant_id: 'rest-1',
            subtotal_santim: 2400,
            vat_santim: 360,
            total_santim: 2760,
            items: [
                {
                    menu_item_id: 'item-2',
                    menu_item_name: 'Shiro',
                    quantity: 1,
                    unit_price_santim: 2400,
                    total_price_santim: 2400,
                },
            ],
        });

        harness.restartGateway();
        const updated = await updateOfflineOrderStatus(created.order!.id, 'preparing');

        expect(harness.isGatewayRunning()).toBe(true);
        expect(updated).toBe(true);
        expect(harness.getOrder(created.order!.id)?.status).toBe('preparing');
        expect(harness.getPendingSyncQueue()).toHaveLength(2);
        expect(harness.getLocalJournal()).toHaveLength(4);
    });

    it('ENT-020: survives client restart and delayed reconnect without data loss', async () => {
        const harness = new StoreRuntimeHarness();
        harness.disconnectWan();
        currentDb = harness.createClientDatabase();

        let orderSync = await loadOrderSync();

        const created = await orderSync.createOfflineOrder({
            restaurant_id: 'rest-1',
            subtotal_santim: 3200,
            vat_santim: 480,
            total_santim: 3680,
            items: [
                {
                    menu_item_id: 'item-3',
                    menu_item_name: 'Pasta',
                    quantity: 1,
                    unit_price_santim: 3200,
                    total_price_santim: 3200,
                },
            ],
        });

        await orderSync.updateOfflineOrderStatus(created.order!.id, 'ready');

        currentDb = harness.createClientDatabase();
        vi.resetModules();
        orderSync = await loadOrderSync();

        const afterRestart = await orderSync.getOfflineOrder(created.order!.id);
        expect(afterRestart?.status).toBe('ready');

        await orderSync.updateOfflineOrderStatus(created.order!.id, 'served');

        harness.reconnectWan();
        const idempotency = await loadIdempotency();
        const pendingBeforeReplay = await idempotency.getPendingSyncOperations();

        expect(pendingBeforeReplay).toHaveLength(3);

        for (const operation of pendingBeforeReplay) {
            await idempotency.markSyncOperationCompleted(operation.id);
        }

        const pendingAfterReplay = await idempotency.getPendingSyncOperations();

        expect(harness.isWanConnected()).toBe(true);
        expect(harness.getOrder(created.order!.id)?.status).toBe('served');
        expect(harness.getLocalJournal()).toHaveLength(6);
        expect(pendingAfterReplay).toHaveLength(0);
    });
});
