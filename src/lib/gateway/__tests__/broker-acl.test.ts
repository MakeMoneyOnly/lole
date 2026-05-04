import { describe, expect, it } from 'vitest';
import {
    authorizePublish,
    authorizeSubscribe,
    parseTopicTenant,
    isSystemTopic,
} from '@/lib/gateway/broker-acl';
import type { GatewaySessionClaims } from '@/lib/auth/gateway-session';

function makeClaims(overrides: Partial<GatewaySessionClaims> = {}): GatewaySessionClaims {
    return {
        sub: 'device-1',
        iss: 'gw-1',
        aud: 'lole-store',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        alg: 'HS256',
        kid: 'test',
        deviceId: 'device-1',
        restaurantId: 'rest-1',
        locationId: 'loc-1',
        gatewayId: 'gw-1',
        deviceType: 'pos',
        deviceProfile: 'waiter',
        identityVersion: 1,
        authorizations: ['orders.write', 'tables.write', 'gateway.bootstrap'],
        topicPrefix: 'lole/v1/restaurants/rest-1/locations/loc-1',
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        offlineAccessExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        staffOutagePolicy: {
            mode: 'blocked',
            ttlMinutes: 0,
            requiresRecentPin: false,
            allowedRoles: [],
        },
        ...overrides,
    };
}

describe('broker-acl', () => {
    describe('parseTopicTenant', () => {
        it('extracts restaurant and location from valid topic', () => {
            const tenant = parseTopicTenant(
                'lole/v1/restaurants/rest-1/locations/loc-1/orders/commands'
            );
            expect(tenant).toEqual({
                restaurantId: 'rest-1',
                locationId: 'loc-1',
            });
        });

        it('returns null for malformed topics', () => {
            expect(parseTopicTenant('random/topic')).toBeNull();
            expect(parseTopicTenant('lole/v1/restaurants')).toBeNull();
            expect(parseTopicTenant('')).toBeNull();
        });
    });

    describe('isSystemTopic', () => {
        it('detects system topics', () => {
            expect(isSystemTopic('lole/v1/restaurants/rest-1/locations/loc-1/system/mode')).toBe(
                true
            );
            expect(isSystemTopic('lole/v1/restaurants/rest-1/locations/loc-1/system/status')).toBe(
                true
            );
        });

        it('rejects non-system topics', () => {
            expect(
                isSystemTopic('lole/v1/restaurants/rest-1/locations/loc-1/orders/commands')
            ).toBe(false);
        });
    });

    describe('authorizePublish', () => {
        it('allows publish to own restaurant topic', () => {
            const claims = makeClaims();
            const result = authorizePublish(
                'lole/v1/restaurants/rest-1/locations/loc-1/orders/commands',
                claims
            );
            expect(result.allowed).toBe(true);
        });

        it('denies publish to different restaurant', () => {
            const claims = makeClaims();
            const result = authorizePublish(
                'lole/v1/restaurants/rest-2/locations/loc-1/orders/commands',
                claims
            );
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('rest-1');
            expect(result.reason).toContain('rest-2');
        });

        it('denies anonymous publish to system topics', () => {
            const result = authorizePublish(
                'lole/v1/restaurants/rest-1/locations/loc-1/system/mode',
                null
            );
            expect(result.allowed).toBe(false);
        });

        it('denies publish without gateway privilege to system topics', () => {
            const claims = makeClaims({
                authorizations: ['orders.write'],
            });
            const result = authorizePublish(
                'lole/v1/restaurants/rest-1/locations/loc-1/system/mode',
                claims
            );
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('gateway-privileged');
        });

        it('allows publish with gateway.bootstrap to system topics', () => {
            const claims = makeClaims({
                authorizations: ['gateway.bootstrap'],
            });
            const result = authorizePublish(
                'lole/v1/restaurants/rest-1/locations/loc-1/system/mode',
                claims
            );
            expect(result.allowed).toBe(true);
        });

        it('denies publish to malformed topic', () => {
            const claims = makeClaims();
            const result = authorizePublish('invalid', claims);
            expect(result.allowed).toBe(false);
        });
    });

    describe('authorizeSubscribe', () => {
        it('allows subscribe to own restaurant topic', () => {
            const claims = makeClaims();
            const result = authorizeSubscribe(
                'lole/v1/restaurants/rest-1/locations/loc-1/orders/commands',
                claims
            );
            expect(result.allowed).toBe(true);
        });

        it('denies subscribe to different restaurant', () => {
            const claims = makeClaims();
            const result = authorizeSubscribe(
                'lole/v1/restaurants/rest-2/locations/loc-1/orders/commands',
                claims
            );
            expect(result.allowed).toBe(false);
        });

        it('allows anonymous subscribe to system topics', () => {
            const result = authorizeSubscribe(
                'lole/v1/restaurants/rest-1/locations/loc-1/system/mode',
                null
            );
            expect(result.allowed).toBe(true);
        });

        it('allows anonymous subscribe to scoped topics', () => {
            const result = authorizeSubscribe(
                'lole/v1/restaurants/rest-1/locations/loc-1/orders/commands',
                null
            );
            expect(result.allowed).toBe(true);
        });
    });
});
