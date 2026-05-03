import { describe, expect, it } from 'vitest';
import {
    buildGatewayDiscoveryRecord,
    parseGatewayDiscoveryRecord,
    serializeGatewayDiscoveryRecord,
} from '@/lib/lan/discovery';

describe('gateway discovery', () => {
    it('builds discovery record', () => {
        const record = buildGatewayDiscoveryRecord({
            restaurantId: 'rest-1',
            locationId: 'loc-1',
            gatewayId: 'gw-1',
            runtime: 'node-service',
            hostTarget: 'mini-pc',
            lanTransport: 'mqtt',
            mqttBrokerUrl: 'ws://127.0.0.1:1884/mqtt',
            fiscalContinuityMode: 'local-signing',
            queueDurabilityMode: 'persistent-local-queue',
            healthPort: 8787,
            defaultOperatingMode: 'offline-local',
        });

        expect(record.transport).toBe('mqtt');
        expect(record.capabilities).toContain('orders');
    });

    it('serializes and parses discovery record', () => {
        const serialized = serializeGatewayDiscoveryRecord({
            gatewayId: 'gw-1',
            restaurantId: 'rest-1',
            locationId: 'loc-1',
            brokerUrl: 'ws://127.0.0.1:1884/mqtt',
            healthPort: 8787,
            transport: 'mqtt',
            capabilities: ['orders', 'kds', 'tables', 'printers', 'fiscal'],
            advertisedAt: '2026-04-21T00:00:00.000Z',
        });

        const result = parseGatewayDiscoveryRecord(serialized);
        expect(result.ok).toBe(true);
        expect(result.value?.gatewayId).toBe('gw-1');
    });
});
