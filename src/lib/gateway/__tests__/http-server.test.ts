import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Set required env var before importing the module
process.env.DEVICE_TOKEN_SIGNATURE_SECRET = 'test-secret-key-that-is-long-enough-32ch';
process.env.GATEWAY_SESSION_SECRET = 'test-gateway-secret-with-32-chars!!';

import { createGatewayHttpServer } from '@/lib/gateway/http-server';

vi.mock('@/lib/api/authz', () => ({
    getDeviceContext: vi.fn(),
}));

import { getDeviceContext } from '@/lib/api/authz';

const getDeviceContextMock = vi.mocked(getDeviceContext);

describe('gateway http server', () => {
    let server: Awaited<ReturnType<typeof createGatewayHttpServer>> | null = null;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(async () => {
        if (server) {
            await server.close();
            server = null;
        }
    });

    it('serves health snapshot from local gateway process', async () => {
        server = await createGatewayHttpServer({
            port: 0,
            gatewayHost: '127.0.0.1',
            getHealth: () => ({
                gatewayId: 'gw-1',
                restaurantId: 'rest-1',
                locationId: 'loc-1',
                operatingMode: 'offline-local',
                lanTransport: 'mqtt',
                fiscalContinuityMode: 'local-signing',
                queueDurabilityMode: 'persistent-local-queue',
                timestamp: '2026-04-22T10:00:00.000Z',
            }),
            bootstrapDevice: vi.fn(),
        });

        const response = await fetch(`${server.baseUrl}/health`);
        const body = (await response.json()) as { health: { gatewayId: string } };

        expect(response.status).toBe(200);
        expect(body.health.gatewayId).toBe('gw-1');
    });

    it('issues gateway session from bootstrap endpoint for authenticated device', async () => {
        getDeviceContextMock.mockResolvedValue({
            ok: true,
            device: {
                id: 'device-1',
                restaurant_id: 'rest-1',
                location_id: 'loc-1',
                device_type: 'terminal',
                device_profile: 'cashier',
                name: 'Terminal 1',
                assigned_zones: [],
                status: 'active',
                metadata: null,
                last_active_at: null,
                pairing_state: 'paired',
                pairing_code_expires_at: null,
                pairing_completed_at: '2026-04-22T10:00:00.000Z',
                management_provider: 'none',
                management_device_id: null,
                app_version: '1.0.0',
                target_app_version: null,
                ota_status: null,
            },
            restaurantId: 'rest-1',
            admin: {} as never,
        });

        server = await createGatewayHttpServer({
            port: 0,
            gatewayHost: '127.0.0.1',
            getHealth: () => ({
                gatewayId: 'gw-1',
                restaurantId: 'rest-1',
                locationId: 'loc-1',
                operatingMode: 'offline-local',
                lanTransport: 'mqtt',
                fiscalContinuityMode: 'local-signing',
                queueDurabilityMode: 'persistent-local-queue',
                timestamp: '2026-04-22T10:00:00.000Z',
            }),
            bootstrapDevice: vi.fn(),
        });

        const response = await fetch(`${server.baseUrl}/bootstrap`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-device-token': 'device-token-1',
            },
            body: JSON.stringify({}),
        });

        const body = (await response.json()) as {
            session: { claims?: { deviceId?: string } };
        };

        expect(response.status).toBe(200);
        expect(body.session.claims?.deviceId).toBe('device-1');
    });
});