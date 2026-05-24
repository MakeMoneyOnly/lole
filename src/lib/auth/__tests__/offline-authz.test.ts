import { describe, expect, it } from 'vitest';
import {
    buildOfflineDeviceAuthorization,
    buildOfflineStaffOutagePolicy,
    evaluateOfflineStaffAccess,
    hasGatewayCapability,
    rotateGatewayIdentityMetadata,
    resolveGatewayIdentityVersion,
    revokeGatewayIdentityMetadata,
} from '@/lib/auth/offline-authz';

describe('offline gateway authz', () => {
    it('grants cashier terminal capabilities to terminal devices', () => {
        const policy = buildOfflineDeviceAuthorization({
            deviceType: 'terminal',
            deviceProfile: 'cashier',
        });

        expect(hasGatewayCapability(policy.capabilities, 'terminal.read')).toBe(true);
        expect(hasGatewayCapability(policy.capabilities, 'terminal.split.manage')).toBe(true);
        expect(hasGatewayCapability(policy.capabilities, 'terminal.payment.capture')).toBe(true);
        expect(hasGatewayCapability(policy.capabilities, 'terminal.table.close')).toBe(true);
        expect(policy.ttlMinutes).toBeGreaterThan(0);
    });

    it('restricts kds device away from terminal capabilities', () => {
        const policy = buildOfflineDeviceAuthorization({
            deviceType: 'kds',
            deviceProfile: 'kds',
        });

        expect(hasGatewayCapability(policy.capabilities, 'kds.queue.read')).toBe(true);
        expect(hasGatewayCapability(policy.capabilities, 'kds.settings.read')).toBe(true);
        expect(hasGatewayCapability(policy.capabilities, 'terminal.payment.capture')).toBe(false);
    });

    it('reads gateway identity version from metadata and defaults to one', () => {
        expect(resolveGatewayIdentityVersion(null)).toBe(1);
        expect(
            resolveGatewayIdentityVersion({
                gateway_identity: {
                    version: 4,
                },
            })
        ).toBe(4);
    });

    it('builds staff outage policy with bounded offline grace', () => {
        const policy = buildOfflineStaffOutagePolicy({
            deviceType: 'terminal',
            deviceProfile: 'cashier',
        });

        expect(policy.mode).toBe('supervised');
        expect(policy.requiresRecentPin).toBe(true);
        expect(policy.ttlMinutes).toBeGreaterThan(0);
        expect(policy.allowedRoles).toContain('manager');
    });

    it('denies offline staff access after outage policy expiry', () => {
        const policy = buildOfflineStaffOutagePolicy({
            deviceType: 'terminal',
            deviceProfile: 'cashier',
        });

        const result = evaluateOfflineStaffAccess({
            policy: {
                ...policy,
                issuedAt: '2026-04-20T00:00:00.000Z',
            },
            isOnline: false,
            lastPinVerifiedAt: '2026-04-20T00:00:00.000Z',
            now: '2026-04-22T00:00:00.000Z',
            role: 'cashier',
        });

        expect(result.allowed).toBe(false);
        expect(result.reason).toMatch(/expired/i);
    });

    it('rotates and revokes gateway identity metadata explicitly', () => {
        const rotated = rotateGatewayIdentityMetadata(
            {
                gateway_identity: {
                    version: 3,
                    issued_at: '2026-04-20T00:00:00.000Z',
                    rotated_at: '2026-04-20T00:00:00.000Z',
                    revoked_at: null,
                },
            },
            '2026-04-22T10:00:00.000Z'
        );
        const revoked = revokeGatewayIdentityMetadata(rotated, '2026-04-22T11:00:00.000Z');

        expect(resolveGatewayIdentityVersion(rotated)).toBe(4);
        expect(
            ((rotated.gateway_identity as Record<string, unknown>).revoked_at as string | null) ??
                null
        ).toBeNull();
        expect(
            ((revoked.gateway_identity as Record<string, unknown>).revoked_at as string | null) ??
                null
        ).toBe('2026-04-22T11:00:00.000Z');
    });
});
