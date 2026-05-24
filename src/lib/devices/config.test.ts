import { describe, expect, it } from 'vitest';
import {
    getBootPathForDeviceProfile,
    getDeviceProfileLabel,
    getDeviceTypeLabel,
    getPaymentOptionsForSurface,
    normalizeDeviceMetadata,
    resolveDeviceProfile,
} from '@/lib/devices/config';

describe('device config helpers', () => {
    it('normalizes terminal metadata with dedicated-device defaults', () => {
        expect(normalizeDeviceMetadata('terminal')).toEqual({
            station_name: undefined,
            settlement_mode: 'cashier',
            allowed_payment_methods: ['cash', 'chapa'],
            receipt_mode: 'auto',
            managed_mode: 'dedicated',
            kiosk_required: true,
            fiscal: {
                mode: 'mor_pending',
            },
            printer: {
                connection_type: 'none',
                auto_connect: true,
            },
            management: {
                provider: 'none',
                kiosk_mode: true,
            },
        });
    });

    it('preserves runtime and printer metadata for non-terminal devices', () => {
        expect(
            normalizeDeviceMetadata('pos', {
                runtime: {
                    route: '/waiter',
                    native_platform: 'android',
                },
                printer: {
                    connection_type: 'bluetooth',
                    device_id: 'printer-1',
                },
            })
        ).toEqual({
            managed_mode: 'pwa',
            runtime: {
                route: '/waiter',
                native_platform: 'android',
            },
            printer: {
                connection_type: 'bluetooth',
                auto_connect: true,
                device_id: 'printer-1',
            },
        });
    });

    it('returns terminal payment options with chapa and cash enabled', () => {
        const options = getPaymentOptionsForSurface('terminal');
        expect(options.map(option => option.method)).toContain('cash');
        expect(options.map(option => option.method)).toContain('chapa');
        expect(options.every(option => option.enabled)).toBe(true);
    });

    it('labels the terminal device type clearly', () => {
        expect(getDeviceTypeLabel('terminal')).toBe('Cashier Terminal');
    });

    it('maps device types to enterprise profiles and boot paths', () => {
        expect(resolveDeviceProfile('terminal')).toBe('cashier');
        expect(getDeviceProfileLabel('kds')).toBe('Kitchen Display');
        expect(getBootPathForDeviceProfile('cashier')).toBe('/terminal');
    });
});
