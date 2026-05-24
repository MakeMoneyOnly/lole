import { describe, expect, it } from 'vitest';
import {
    buildPairingExpiry,
    generatePairingCode,
    getDeviceBootPathFromRecord,
    normalizePairingCode,
    resolveProvisionedDeviceShape,
} from '@/lib/devices/pairing';

describe('device pairing helpers', () => {
    it('generates six-character alphanumeric pairing codes', () => {
        const code = generatePairingCode();
        expect(code).toMatch(/^[A-Z2-9]{6}$/);
    });

    it('normalizes pairing code input for enterprise welcome screen', () => {
        expect(normalizePairingCode(' ab-12 c3 ')).toBe('AB12C3');
    });

    it('resolves device type and profile consistently', () => {
        expect(
            resolveProvisionedDeviceShape({ name: 'Cashier', device_profile: 'cashier' })
        ).toEqual({
            deviceType: 'terminal',
            deviceProfile: 'cashier',
        });
    });

    it('builds boot paths from stored records', () => {
        expect(
            getDeviceBootPathFromRecord({
                device_profile: 'kiosk',
                restaurant_slug: 'cafe-lucia',
            })
        ).toBe('/cafe-lucia?entry=menu');
    });

    it('returns a future pairing expiry time', () => {
        expect(new Date(buildPairingExpiry()).getTime()).toBeGreaterThan(Date.now());
    });
});
