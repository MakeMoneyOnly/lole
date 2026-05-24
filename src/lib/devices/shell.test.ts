import { describe, expect, it } from 'vitest';
import { getDeviceShellSummary, resolveDeviceShellPath } from '@/lib/devices/shell';

describe('device shell helpers', () => {
    it('prefers an explicit boot path from the paired session', () => {
        expect(
            resolveDeviceShellPath({
                device_type: 'terminal',
                device_profile: 'cashier',
                boot_path: '/terminal?station=front',
            })
        ).toBe('/terminal?station=front');
    });

    it('falls back to canonical profile boot paths', () => {
        expect(
            resolveDeviceShellPath({
                device_type: 'kds',
                device_profile: 'kds',
            })
        ).toBe('/kds');
    });

    it('builds a summary for the shared device shell screen', () => {
        expect(
            getDeviceShellSummary({
                device_type: 'terminal',
                device_profile: 'cashier',
                name: 'Front Counter',
                metadata: {
                    managed_mode: 'dedicated',
                },
            })
        ).toMatchObject({
            profileLabel: 'Cashier',
            typeLabel: 'Cashier Terminal',
            deviceName: 'Front Counter',
            launchPath: '/terminal',
            managedModeLabel: 'Dedicated device shell',
        });
    });
});
