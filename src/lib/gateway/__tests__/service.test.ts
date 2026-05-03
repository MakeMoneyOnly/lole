import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StoreGatewayService, getStoreGatewayService } from '../service';
import * as mqttClient from '../../lan/mqtt-client';
import * as config from '../config';

vi.mock('../../lan/mqtt-client', () => ({
    createLanMqttClient: vi.fn().mockReturnValue({}),
    subscribeTopic: vi.fn().mockResolvedValue(undefined),
    registerLanMessageHandler: vi.fn(),
    publishJson: vi.fn().mockResolvedValue(undefined),
    closeLanMqttClient: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config', () => ({
    getStoreGatewayConfig: vi.fn(),
    buildGatewayHealthSnapshot: vi.fn().mockReturnValue({ status: 'online' }),
}));

describe('StoreGatewayService', () => {
    const mockConfig = {
        restaurantId: 'resto-1',
        locationId: 'loc-1',
        gatewayId: 'gateway-1',
        mqttBrokerUrl: 'mqtt://localhost:1883',
        defaultOperatingMode: 'cloud-first' as const,
        syncProtocolVersion: '1.0',
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(config.getStoreGatewayConfig).mockReturnValue(mockConfig);
    });

    it('initializes with config and starts mqtt client', async () => {
        const service = new StoreGatewayService(mockConfig);
        await service.start();

        expect(mqttClient.createLanMqttClient).toHaveBeenCalledWith({
            brokerUrl: mockConfig.mqttBrokerUrl,
            clientId: mockConfig.gatewayId,
            clean: false,
        });
        expect(mqttClient.subscribeTopic).toHaveBeenCalledTimes(5);
        expect(mqttClient.registerLanMessageHandler).toHaveBeenCalled();
        expect(mqttClient.publishJson).toHaveBeenCalled(); // publishMode and publishDiscovery
    });

    it('stops client correctly', async () => {
        const service = new StoreGatewayService(mockConfig);
        await service.start();
        await service.stop();

        expect(mqttClient.closeLanMqttClient).toHaveBeenCalled();
    });

    it('publishes commands with correct scope', async () => {
        const service = new StoreGatewayService(mockConfig);
        await service.start();

        const message = {
            type: 'order.create',
            aggregate: 'order',
            aggregateId: 'order-1',
            payload: {},
            restaurantId: 'resto-1',
            locationId: 'loc-1',
        };

        await service.publishCommand(message);

        expect(mqttClient.publishJson).toHaveBeenCalledWith(
            expect.anything(),
            expect.stringContaining('lole/v1/restaurants/resto-1/locations/loc-1/orders/commands'),
            expect.objectContaining({ type: 'order.create' }),
            { qos: 1 }
        );
    });

    it('registers and triggers handlers', async () => {
        const service = new StoreGatewayService(mockConfig);
        await service.start();

        const handler = vi.fn();
        service.registerHandler('test.command', handler);

        // Extract the registered message handler callback
        const messageCallback = vi.mocked(mqttClient.registerLanMessageHandler).mock.calls[0][1];

        // Trigger it with a matched command
        const rawMessage = Buffer.from(JSON.stringify({ type: 'test.command', payload: {} }));
        messageCallback('some-topic', rawMessage);

        expect(handler).toHaveBeenCalled();
    });

    it('getStoreGatewayService returns singleton', () => {
        const service1 = getStoreGatewayService();
        const service2 = getStoreGatewayService();
        expect(service1).toBe(service2);
        expect(service1).toBeInstanceOf(StoreGatewayService);
    });

    it('throws if no config available', () => {
        vi.mocked(config.getStoreGatewayConfig).mockReturnValue(null as any);
        expect(() => new StoreGatewayService()).toThrow('Store gateway config missing');
        expect(() => new StoreGatewayService()).toThrowError('Store gateway config missing');
    });
});
