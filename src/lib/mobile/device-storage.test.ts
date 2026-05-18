import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIsCapacitorNativeRuntime = vi.fn(() => false);

vi.mock('@/lib/mobile/capacitor', () => ({
    isCapacitorNativeRuntime: mockIsCapacitorNativeRuntime,
}));

describe('device-storage printer recovery', () => {
    beforeEach(() => {
        vi.resetModules();
        window.localStorage.clear();
        window.sessionStorage.clear();
        mockIsCapacitorNativeRuntime.mockReturnValue(false);
    });

    it('rehydrates printer selection from paired device session metadata when printer cache missing', async () => {
        const { storeDeviceSession, getStoredPrinterSelection } = await import('./device-storage');

        await storeDeviceSession({
            device_token: 'device-1',
            device_type: 'pos',
            restaurant_id: 'rest-1',
            location_id: 'loc-1',
            metadata: {
                printer: {
                    connection_type: 'network',
                    device_id: 'printer-1',
                    device_name: 'Kitchen LAN Printer',
                    mac_address: 'AA:BB:CC:DD',
                },
            },
        });

        const printer = await getStoredPrinterSelection();

        expect(printer).toEqual({
            connection_type: 'network',
            device_id: 'printer-1',
            device_name: 'Kitchen LAN Printer',
            mac_address: 'AA:BB:CC:DD',
        });
        expect(
            JSON.parse(window.localStorage.getItem('lole_printer_selection_v1') ?? '{}')
        ).toMatchObject({
            connection_type: 'network',
            device_id: 'printer-1',
        });
    });
});
