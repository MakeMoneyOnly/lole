'use client';

import { useEffect, useRef } from 'react';
import {
    createLanMqttClient,
    closeLanMqttClient,
    registerLanMessageHandler,
    subscribeTopic,
} from '@/lib/lan/mqtt-client';
import { getStoredDeviceSession } from '@/lib/mobile/device-storage';
import {
    isGatewayLanEventMessage,
    LocalGatewaySequenceTracker,
    getGatewayTopicsForScopes,
} from '@/lib/gateway/local-events';

export interface TableSessionRealtimeEvent {
    type: string;
    tableId: string;
    guestCount?: number | null;
    notes?: string | null;
    assignedStaffId?: string | null;
}

export function useTableSessionRealtime(input: {
    restaurantId: string;
    enabled?: boolean;
    onEvent?: (event: TableSessionRealtimeEvent) => void;
}) {
    const trackerRef = useRef(new LocalGatewaySequenceTracker());

    useEffect(() => {
        if (!input.enabled || !input.restaurantId) {
            return;
        }

        let active = true;
        let client: ReturnType<typeof createLanMqttClient> | null = null;

        const start = async (): Promise<void> => {
            const session = await getStoredDeviceSession();
            if (!active || !session?.gateway || session.gateway_bootstrap_status !== 'ready') {
                return;
            }

            client = createLanMqttClient({
                brokerUrl: session.gateway.brokerUrl,
                clientId: `${session.device_token}-table-sub`,
                clean: false,
            });

            const topics = getGatewayTopicsForScopes({
                restaurantId: session.restaurant_id ?? input.restaurantId,
                locationId: session.location_id ?? 'default-location',
                scopes: ['tables'],
            });

            for (const topic of topics) {
                await subscribeTopic(client, topic, 1);
            }

            registerLanMessageHandler(client, (topic, rawPayload) => {
                if (!topic.includes('/tables/commands')) {
                    return;
                }

                const parsed = JSON.parse(String(rawPayload)) as Record<string, unknown>;
                const event = isGatewayLanEventMessage(parsed)
                    ? parsed
                    : {
                          messageId: String(parsed.id ?? parsed.idempotencyKey ?? ''),
                          sequence:
                              typeof parsed.sequence === 'number' ? parsed.sequence : undefined,
                          aggregate: String(parsed.aggregate ?? ''),
                          aggregateId: String(parsed.aggregateId ?? ''),
                          type: String(parsed.type ?? ''),
                          payload:
                              parsed.payload && typeof parsed.payload === 'object'
                                  ? (parsed.payload as Record<string, unknown>)
                                  : {},
                      };

                if (
                    !trackerRef.current.shouldProcess({
                        messageId: event.messageId,
                        aggregate: event.aggregate,
                        aggregateId: event.aggregateId,
                        sequence: event.sequence,
                    })
                ) {
                    return;
                }

                input.onEvent?.({
                    type: event.type,
                    tableId: String(event.payload.table_id ?? event.aggregateId),
                    guestCount:
                        typeof event.payload.guest_count === 'number'
                            ? event.payload.guest_count
                            : null,
                    assignedStaffId:
                        typeof event.payload.assigned_staff_id === 'string'
                            ? event.payload.assigned_staff_id
                            : null,
                    notes: typeof event.payload.notes === 'string' ? event.payload.notes : null,
                });
            });
        };

        void start();

        return () => {
            active = false;
            if (client) {
                void closeLanMqttClient(client).catch(() => undefined);
            }
        };
    }, [input.enabled, input.onEvent, input.restaurantId]);
}
