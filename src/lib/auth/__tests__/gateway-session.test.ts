import { describe, expect, it } from 'vitest';
import { issueGatewaySessionToken, verifyGatewaySessionToken } from '@/lib/auth/gateway-session';

describe('gateway session token', () => {
    it('issues and verifies token', () => {
        const session = issueGatewaySessionToken({
            deviceId: 'dev-1',
            restaurantId: 'rest-1',
            locationId: 'loc-1',
            gatewayId: 'gw-1',
            deviceType: 'terminal',
            deviceProfile: 'cashier',
            identityVersion: 2,
            authorizations: ['terminal.read', 'terminal.payment.capture'],
        });

        expect(verifyGatewaySessionToken(session.token)?.deviceId).toBe('dev-1');
        expect(verifyGatewaySessionToken(session.token)?.identityVersion).toBe(2);
        expect(session.username).toBe('dev-1');
    });

    it('rejects tampered token', () => {
        const session = issueGatewaySessionToken({
            deviceId: 'dev-1',
            restaurantId: 'rest-1',
            locationId: 'loc-1',
            gatewayId: 'gw-1',
        });

        expect(verifyGatewaySessionToken(`${session.token}broken`)).toBeNull();
    });

    it('rejects issuance when secret missing outside test mode', () => {
        const env = process.env as Record<string, string | undefined>;
        const previousSecret = env.GATEWAY_SESSION_SECRET;
        const previousNodeEnv = env.NODE_ENV;

        delete env.GATEWAY_SESSION_SECRET;
        env.NODE_ENV = 'production';

        expect(() =>
            issueGatewaySessionToken({
                deviceId: 'dev-1',
                restaurantId: 'rest-1',
                locationId: 'loc-1',
                gatewayId: 'gw-1',
            })
        ).toThrow(/GATEWAY_SESSION_SECRET/);

        env.GATEWAY_SESSION_SECRET = previousSecret;
        env.NODE_ENV = previousNodeEnv;
    });
});
