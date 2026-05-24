import { describe, expect, it } from 'vitest';
import { normalizeAppVersion, resolveOtaStatus } from '@/lib/devices/ota';

describe('device OTA helpers', () => {
    it('normalizes blank versions to null', () => {
        expect(normalizeAppVersion('   ')).toBeNull();
    });

    it('marks the device current when the reported version matches the target', () => {
        expect(
            resolveOtaStatus({
                currentVersion: '1.4.2',
                targetVersion: '1.4.2',
                existingStatus: 'queued',
            })
        ).toBe('current');
    });

    it('keeps an update in installing state while the target version is still pending', () => {
        expect(
            resolveOtaStatus({
                currentVersion: '1.4.1',
                targetVersion: '1.4.2',
                existingStatus: 'queued',
            })
        ).toBe('installing');
    });
});
