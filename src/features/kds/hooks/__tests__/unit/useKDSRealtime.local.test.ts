import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockSupabaseChannel,
    mockSupabase,
    mockMqttClient,
    mockCreateLanMqttClient,
    mockSubscribeTopic,
    mockCloseLanMqttClient,
    mockRegisterLanMessageHandler,
    mockGetStoredDeviceSession,
} = vi.hoisted(() => {
    const supabaseChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
    };

    const supabase = {
        channel: vi.fn().mockReturnValue(supabaseChannel),
    };

    const mqttClient = {
        on: vi.fn(),
    };

    return {
        mockSupabaseChannel: supabaseChannel,
        mockSupabase: supabase,
        mockMqttClient: mqttClient,
        mockCreateLanMqttClient: vi.fn(() => mqttClient),
        mockSubscribeTopic: vi.fn().mockResolvedValue([{ qos: 1 }]),
        mockCloseLanMqttClient: vi.fn().mockResolvedValue(undefined),
        mockRegisterLanMessageHandler: vi.fn((client, handler) => {
            client.on('message', handler);
        }),
        mockGetStoredDeviceSession: vi.fn(),
    };
});

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => mockSupabase,
}));

vi.mock('@/lib/lan/mqtt-client', () => ({
    createLanMqttClient: mockCreateLanMqttClient,
    subscribeTopic: mockSubscribeTopic,
    closeLanMqttClient: mockCloseLanMqttClient,
    registerLanMessageHandler: mockRegisterLanMessageHandler,
}));

vi.mock('@/lib/mobile/device-storage', () => ({
    getStoredDeviceSession: mockGetStoredDeviceSession,
}));

import { useKDSRealtime } from '../../useKDSRealtime';

describe('useKDSRealtime local gateway mode', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetStoredDeviceSession.mockResolvedValue({
            restaurant_id: 'rest-1',
            location_id: 'loc-1',
            gateway_bootstrap_status: 'ready',
            gateway: {
                gatewayId: 'gw-1',
                brokerUrl: 'ws://127.0.0.1:1884/mqtt',
                bootstrapUrl: 'http://127.0.0.1:8787/bootstrap',
                healthUrl: 'http://127.0.0.1:8787/health',
                operatingMode: 'offline-local',
                sessionToken: 'gateway-token',
                topicPrefix: 'lole/v1/restaurants/rest-1/locations/loc-1',
                issuedAt: '2026-04-24T00:00:00.000Z',
                expiresAt: '2026-04-24T12:00:00.000Z',
            },
        });
    });

    it('prefers local MQTT subscription over Supabase realtime when gateway session exists', async () => {
        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'rest-1',
                enabled: true,
            })
        );

        await waitFor(() => {
            expect(mockCreateLanMqttClient).toHaveBeenCalledOnce();
        });

        expect(mockSupabase.channel).not.toHaveBeenCalled();
        expect(mockSubscribeTopic).toHaveBeenCalledTimes(2);
        expect(mockSubscribeTopic.mock.calls[0][1]).toContain('/orders/commands');
        expect(mockSubscribeTopic.mock.calls[1][1]).toContain('/kds/commands');
    });

    it('emits local order create and KDS signal events from LAN messages', async () => {
        const onNewOrder = vi.fn();
        const onLocalSignal = vi.fn();

        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'rest-1',
                enabled: true,
                onNewOrder,
                onLocalSignal,
            })
        );

        await waitFor(() => {
            expect(mockMqttClient.on).toHaveBeenCalledWith('message', expect.any(Function));
        });

        const handler = mockMqttClient.on.mock.calls.find(call => call[0] === 'message')?.[1] as
            | ((topic: string, payload: Uint8Array) => void)
            | undefined;

        expect(handler).toBeDefined();

        act(() => {
            handler?.(
                'lole/v1/restaurants/rest-1/locations/loc-1/orders/commands',
                Buffer.from(
                    JSON.stringify({
                        type: 'order.create',
                        aggregate: 'order',
                        aggregateId: 'order-1',
                        restaurantId: 'rest-1',
                        locationId: 'loc-1',
                        payload: {
                            order_id: 'order-1',
                            order_number: 42,
                            status: 'pending',
                            order_type: 'dine_in',
                        },
                    })
                )
            );
        });

        expect(onNewOrder).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'order-1',
                status: 'pending',
            })
        );

        act(() => {
            handler?.(
                'lole/v1/restaurants/rest-1/locations/loc-1/kds/commands',
                Buffer.from(
                    JSON.stringify({
                        type: 'kds.ready',
                        aggregate: 'kds_ticket',
                        aggregateId: 'kds-1',
                        restaurantId: 'rest-1',
                        locationId: 'loc-1',
                        payload: {
                            kds_id: 'kds-1',
                            action: 'ready',
                            status: 'ready',
                        },
                    })
                )
            );
        });

        expect(onLocalSignal).toHaveBeenCalledTimes(2);
    });
});
