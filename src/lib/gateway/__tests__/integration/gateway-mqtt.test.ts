import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    StoreGatewayService,
    getStoreGatewayService,
    type DeviceConnectionRecord,
} from '../../service';
import * as mqttClient from '../../../lan/mqtt-client';
import * as config from '../../config';
import { GatewayError } from '../../errors';

vi.mock('../../../lan/mqtt-client', () => ({
    createLanMqttClient: vi.fn().mockReturnValue({}),
    subscribeTopic: vi.fn().mockResolvedValue(undefined),
    registerLanMessageHandler: vi.fn(),
    publishJson: vi.fn().mockResolvedValue(undefined),
    closeLanMqttClient: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config', () => ({
    getStoreGatewayConfig: vi.fn(),
    buildGatewayHealthSnapshot: vi.fn().mockReturnValue({
        gatewayId: 'gw-int',
        restaurantId: 'rest-int',
        locationId: 'loc-int',
        operatingMode: 'offline-local',
        lanTransport: 'mqtt',
        fiscalContinuityMode: 'local-signing',
        queueDurabilityMode: 'persistent-local-queue',
        timestamp: new Date().toISOString(),
    }),
}));

const mockConfig = {
    restaurantId: 'rest-int',
    locationId: 'loc-int',
    gatewayId: 'gw-int',
    mqttBrokerUrl: 'mqtt://localhost:1883',
    defaultOperatingMode: 'offline-local' as const,
    runtime: 'node-service' as const,
    hostTarget: 'mini-pc' as const,
    lanTransport: 'mqtt' as const,
    fiscalContinuityMode: 'local-signing' as const,
    queueDurabilityMode: 'persistent-local-queue' as const,
    healthPort: 0,
};

describe('StoreGatewayService Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(config.getStoreGatewayConfig).mockReturnValue(mockConfig);
    });

    describe('retry with exponential backoff', () => {
        it('retries publish on first failure', async () => {
            // Start publishes mode + discovery (2 calls, succeed)
            // Third call (publishCommand) fails once then succeeds
            let callCount = 0;
            vi.mocked(mqttClient.publishJson).mockImplementation(async () => {
                callCount++;
                if (callCount === 3) {
                    throw new Error('Broker unavailable');
                }
            });

            const service = new StoreGatewayService(mockConfig, {
                maxRetries: 1,
                retryBaseMs: 10,
            });
            await service.start();

            await service.publishCommand({
                type: 'order.create',
                aggregate: 'order',
                aggregateId: 'order-1',
                payload: {},
                restaurantId: 'rest-int',
                locationId: 'loc-int',
            });

            expect(mqttClient.publishJson).toHaveBeenCalledTimes(4); // 2 start + 1 fail + 1 retry
            await service.stop();
        });

        it('throws GatewayError after all retries exhausted', async () => {
            let callCount = 0;
            vi.mocked(mqttClient.publishJson).mockImplementation(async () => {
                callCount++;
                if (callCount <= 2) return; // Start publishes succeed
                throw new Error('Persistent broker failure');
            });

            const service = new StoreGatewayService(mockConfig, {
                maxRetries: 1,
                retryBaseMs: 10,
            });
            await service.start();

            await expect(
                service.publishCommand({
                    type: 'order.create',
                    aggregate: 'order',
                    aggregateId: 'order-1',
                    payload: {},
                    restaurantId: 'rest-int',
                    locationId: 'loc-int',
                })
            ).rejects.toThrow(GatewayError);

            // 2 start + 2 publish (original + 1 retry)
            expect(mqttClient.publishJson).toHaveBeenCalledTimes(4);
            await service.stop();
        });

        it('does not retry when publish succeeds first time', async () => {
            vi.mocked(mqttClient.publishJson).mockResolvedValue(undefined);

            const service = new StoreGatewayService(mockConfig, {
                maxRetries: 3,
                retryBaseMs: 10,
            });
            await service.start();

            await service.publishCommand({
                type: 'table.update',
                aggregate: 'table',
                aggregateId: 'table-1',
                payload: {},
                restaurantId: 'rest-int',
                locationId: 'loc-int',
            });

            // 2 (start: mode + discovery) + 1 (command) = 3
            expect(mqttClient.publishJson).toHaveBeenCalledTimes(3);
            await service.stop();
        });
    });

    describe('device lifecycle tracking', () => {
        it('tracks connected and disconnected devices', async () => {
            const service = new StoreGatewayService(mockConfig);
            await service.start();

            expect(service.getConnectedDeviceCount()).toBe(0);
            expect(service.getConnectedDeviceIds()).toEqual([]);

            service.onDeviceConnected('pos-1');
            expect(service.getConnectedDeviceCount()).toBe(1);
            expect(service.getConnectedDeviceIds()).toContain('pos-1');

            service.onDeviceConnected('kds-1');
            service.onDeviceConnected('terminal-1');
            expect(service.getConnectedDeviceCount()).toBe(3);

            service.onDeviceDisconnected('pos-1');
            expect(service.getConnectedDeviceCount()).toBe(2);
            expect(service.getConnectedDeviceIds()).not.toContain('pos-1');

            await service.stop();
            expect(service.getConnectedDeviceCount()).toBe(0);
        });

        it('handles disconnect of non-existent device gracefully', async () => {
            const service = new StoreGatewayService(mockConfig);
            await service.start();

            service.onDeviceDisconnected('ghost-device');
            expect(service.getConnectedDeviceCount()).toBe(0);

            await service.stop();
        });
    });

    describe('full lifecycle', () => {
        it('start -> subscribe -> handle -> publish -> stop', async () => {
            const service = new StoreGatewayService(mockConfig);
            await service.start();

            expect(mqttClient.createLanMqttClient).toHaveBeenCalledOnce();
            expect(mqttClient.subscribeTopic).toHaveBeenCalledTimes(5);
            expect(mqttClient.registerLanMessageHandler).toHaveBeenCalledOnce();

            const handler = vi.fn();
            service.registerHandler('order.create', handler);

            const messageCallback = vi.mocked(mqttClient.registerLanMessageHandler).mock
                .calls[0]?.[1];
            expect(messageCallback).toBeDefined();

            messageCallback!(
                'some-topic',
                Buffer.from(
                    JSON.stringify({
                        type: 'order.create',
                        aggregate: 'order',
                        aggregateId: 'order-99',
                        payload: { table: 9 },
                        restaurantId: 'rest-int',
                        locationId: 'loc-int',
                    })
                )
            );

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'order.create', aggregateId: 'order-99' })
            );

            await service.stop();
            expect(mqttClient.closeLanMqttClient).toHaveBeenCalledOnce();
        });
    });
});
