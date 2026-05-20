import { describe, expect, it, vi } from 'vitest';
import { createGatewayBootstrapPayload } from '@/lib/gateway/bootstrap';

vi.mock('@/lib/gateway/service', () => ({
    getStoreGatewayService: vi.fn(() => ({
        getHealth: vi.fn(() => ({
            gatewayId: 'gw-1',
            restaurantId: 'rest-1',
            locationId: 'loc-1',
            operatingMode: 'offline-local',
            lanTransport: 'mqtt',
            fiscalContinuityMode: 'local-signing',
            queueDurabilityMode: 'persistent-local-queue',
            timestamp: '2026-04-22T10:00:00.000Z',
        })),
    })),
}));

describe('gateway bootstrap payload', () => {
    it('returns discovery, health, and scoped session material', () => {
        process.env.GATEWAY_SESSION_SECRET = 'test-gateway-secret-with-32-chars!';

        const payload = createGatewayBootstrapPayload({
            deviceId: 'device-1',
            restaurantId: 'rest-1',
            locationId: 'loc-1',
            gatewayId: 'gw-1',
            gatewayHost: '127.0.0.1',
            mqttBrokerUrl: 'ws://127.0.0.1:1884/mqtt',
            healthPort: 8787,
        });

        expect(payload.session.deviceId).toBe('device-1');
        expect(payload.discovery.gatewayId).toBe('gw-1');
        expect(payload.health.operatingMode).toBe('offline-local');
        expect(payload.endpoints.bootstrap).toBe('http://127.0.0.1:8787/bootstrap');
    });
});
