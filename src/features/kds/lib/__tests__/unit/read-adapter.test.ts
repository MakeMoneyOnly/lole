import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPowerSync = vi.fn();

vi.mock('@/lib/sync', () => ({
    getPowerSync: mockGetPowerSync,
}));

describe('kds read adapter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetPowerSync.mockReturnValue(null);
        vi.stubGlobal('fetch', vi.fn());
    });

    it('reads queue from local runtime when available', async () => {
        const mockDb = {
            getAllAsync: vi
                .fn()
                .mockResolvedValueOnce([
                    {
                        id: 'order-1',
                        order_number: 'ORD-1',
                        table_number: 'T1',
                        created_at: '2026-04-22T10:00:00.000Z',
                        acknowledged_at: null,
                        status: 'preparing',
                        fire_mode: 'auto',
                        current_course: 'main',
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        id: 'item-1',
                        order_id: 'order-1',
                        name: 'Kitfo',
                        quantity: 1,
                        notes: 'No chili',
                        station: 'kitchen',
                        course: 'main',
                        order_item_id: 'order-item-1',
                        modifiers_json: '["No chili"]',
                        kds_item_id: 'kds-1',
                        kds_status: 'in_progress',
                    },
                ]),
            getFirstAsync: vi.fn().mockResolvedValueOnce({
                settings_json: JSON.stringify({
                    kds: {
                        ready_auto_archive_minutes: 20,
                    },
                }),
            }),
        };
        mockGetPowerSync.mockReturnValue(mockDb);

        const { readKdsQueue } = await import('../../read-adapter');
        const result = await readKdsQueue({
            station: 'kitchen',
            limit: 20,
            slaMinutes: 30,
        });

        expect(result.ok).toBe(true);
        expect(result.mode).toBe('local');
        expect(result.data?.orders).toHaveLength(1);
        expect(result.data?.orders[0]?.items[0]?.kds_item_id).toBe('kds-1');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('reads settings from local runtime when available', async () => {
        const mockDb = {
            getFirstAsync: vi.fn().mockResolvedValue({
                settings_json: JSON.stringify({
                    kds: {
                        ready_auto_archive_minutes: 25,
                        alert_policy: {
                            new_ticket_sound: false,
                        },
                    },
                }),
            }),
        };
        mockGetPowerSync.mockReturnValue(mockDb);

        const { readKdsSettings } = await import('../../read-adapter');
        const result = await readKdsSettings();

        expect(result).toEqual({
            ok: true,
            mode: 'local',
            data: expect.objectContaining({
                ready_auto_archive_minutes: 25,
                alert_policy: expect.objectContaining({
                    new_ticket_sound: false,
                }),
            }),
        });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('keeps grill station tickets visible in local runtime reads', async () => {
        const mockDb = {
            getAllAsync: vi
                .fn()
                .mockResolvedValueOnce([
                    {
                        id: 'order-2',
                        order_number: 'ORD-2',
                        table_number: 'T2',
                        created_at: '2026-04-22T10:00:00.000Z',
                        acknowledged_at: null,
                        status: 'preparing',
                        fire_mode: 'auto',
                        current_course: 'main',
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        id: 'item-2',
                        order_id: 'order-2',
                        name: 'Mixed Grill',
                        quantity: 1,
                        notes: null,
                        station: 'grill',
                        course: 'main',
                        order_item_id: 'order-item-2',
                        modifiers_json: '[]',
                        kds_item_id: 'kds-2',
                        kds_status: 'queued',
                    },
                ]),
            getFirstAsync: vi.fn().mockResolvedValueOnce({
                settings_json: JSON.stringify({
                    kds: {
                        ready_auto_archive_minutes: 20,
                    },
                }),
            }),
        };
        mockGetPowerSync.mockReturnValue(mockDb);

        const { readKdsQueue } = await import('../../read-adapter');
        const result = await readKdsQueue({
            station: 'grill' as never,
            limit: 20,
            slaMinutes: 30,
        });

        expect(result.ok).toBe(true);
        expect(result.data?.orders).toHaveLength(1);
        expect(result.data?.orders[0]?.station).toBe('grill');
        expect(result.data?.orders[0]?.items[0]?.station).toBe('grill');
    });
});
