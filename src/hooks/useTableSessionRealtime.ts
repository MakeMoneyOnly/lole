'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
import { logger } from '@/lib/logger';
import { TOPIC_FILTER_TABLES_COMMANDS, DEFAULT_LOCATION_ID } from '@/lib/constants';

/**
 * SEC-04: Reconnection configuration for KDS realtime
 */
const RECONNECT_CONFIG = {
    /** Maximum number of reconnection attempts */
    maxRetries: 5,
    /** Base delay in milliseconds for exponential backoff */
    baseDelayMs: 1000,
    /** Maximum delay in milliseconds */
    maxDelayMs: 30000,
    /** Jitter factor to prevent thundering herd (0-1) */
    jitterFactor: 0.3,
};

/**
 * Calculate exponential backoff delay with jitter
 * Used for KDS realtime reconnection attempts
 */
export function calculateReconnectDelay(retryCount: number): number {
    const delay = Math.min(
        RECONNECT_CONFIG.baseDelayMs * Math.pow(2, retryCount),
        RECONNECT_CONFIG.maxDelayMs
    );
    const jitter = delay * RECONNECT_CONFIG.jitterFactor * Math.random();
    return delay + jitter;
}

export interface TableSessionRealtimeEvent {
    type: string;
    tableId: string;
    guestCount?: number | null;
    notes?: string | null;
    assignedStaffId?: string | null;
}

export interface UseTableSessionRealtimeResult {
    isConnected: boolean;
    reconnectionStatus: 'idle' | 'reconnecting' | 'failed';
}

export function useTableSessionRealtime(input: {
    restaurantId: string;
    enabled?: boolean;
    onEvent?: (event: TableSessionRealtimeEvent) => void;
}): UseTableSessionRealtimeResult {
    const trackerRef = useRef(new LocalGatewaySequenceTracker());
    const activeRef = useRef(true);
    const retryCountRef = useRef(0);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentClientRef = useRef<ReturnType<typeof createLanMqttClient> | null>(null);

    const [isConnected, setIsConnected] = useState(false);
    const [reconnectionStatus, setReconnectionStatus] = useState<
        'idle' | 'reconnecting' | 'failed'
    >('idle');

    // Use refs to hold callbacks to avoid immutability issues
    const startRef = useRef<() => Promise<void>>(async () => {});
    const attemptReconnectRef = useRef<() => void>(() => {});

    /**
     * SEC-04: Attempt to reconnect with exponential backoff
     */
    const attemptReconnect = useCallback((): void => {
        if (!activeRef.current) return;

        const currentRetry = retryCountRef.current;

        if (currentRetry >= RECONNECT_CONFIG.maxRetries) {
            logger.error(
                `[TableSessionRealtime] Max reconnection attempts (${RECONNECT_CONFIG.maxRetries}) reached`
            );
            setReconnectionStatus('failed');
            setIsConnected(false);
            return;
        }

        const delay = calculateReconnectDelay(currentRetry);
        logger.warn(
            `[TableSessionRealtime] Scheduling reconnect attempt ${currentRetry + 1}/${RECONNECT_CONFIG.maxRetries} in ${Math.round(delay)}ms`
        );

        setReconnectionStatus('reconnecting');
        retryCountRef.current++;

        reconnectTimeoutRef.current = setTimeout(async () => {
            if (!activeRef.current) return;

            const session = await getStoredDeviceSession();
            if (session?.gateway?.brokerUrl) {
                startRef.current().catch(error => {
                    logger.error('[TableSessionRealtime] Reconnection failed', error);
                });
            }
        }, delay);
    }, []);

    /**
     * Start the MQTT connection for table sessions
     */
    const start = useCallback(async (): Promise<void> => {
        const session = await getStoredDeviceSession();
        if (
            !activeRef.current ||
            !session?.gateway ||
            session.gateway_bootstrap_status !== 'ready'
        ) {
            setIsConnected(false);
            return;
        }

        try {
            const client = createLanMqttClient({
                brokerUrl: session.gateway.brokerUrl,
                clientId: `${session.device_token}-table-sub`,
                clean: false,
                reconnectPeriodMs: 0,
            });

            currentClientRef.current = client;
            setIsConnected(true);
            setReconnectionStatus('idle');
            retryCountRef.current = 0;

            const topics = getGatewayTopicsForScopes({
                restaurantId: session.restaurant_id ?? input.restaurantId,
                locationId: session.location_id ?? DEFAULT_LOCATION_ID,
                scopes: ['tables'],
            });

            for (const topic of topics) {
                await subscribeTopic(client, topic, 1);
            }

            client.on('error', (error: Error) => {
                logger.error('[TableSessionRealtime] MQTT client error', error);
                if (activeRef.current && !reconnectTimeoutRef.current) {
                    attemptReconnectRef.current();
                }
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (client as any).on('offline', () => {
                logger.warn('[TableSessionRealtime] MQTT client offline');
                if (activeRef.current) {
                    setIsConnected(false);
                    if (!reconnectTimeoutRef.current) {
                        attemptReconnectRef.current();
                    }
                }
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (client as any).on('close', () => {
                logger.warn('[TableSessionRealtime] MQTT client closed');
                if (activeRef.current) {
                    setIsConnected(false);
                    if (!reconnectTimeoutRef.current) {
                        attemptReconnectRef.current();
                    }
                }
            });

            registerLanMessageHandler(client, (topic, rawPayload) => {
                if (!topic.includes(TOPIC_FILTER_TABLES_COMMANDS)) {
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
        } catch (error) {
            logger.error('[TableSessionRealtime] Failed to start', error);
            setIsConnected(false);
            if (activeRef.current && !reconnectTimeoutRef.current) {
                attemptReconnectRef.current();
            }
        }
    }, [input]);

    // Set up refs after callbacks are defined
    useEffect(() => {
        startRef.current = start;
        attemptReconnectRef.current = attemptReconnect;
    }, [start, attemptReconnect]);

    useEffect(() => {
        if (!input.enabled || !input.restaurantId) {
            return;
        }

        activeRef.current = true;
        retryCountRef.current = 0;
        setReconnectionStatus('idle');
        void startRef.current();

        // SEC-04: Cleanup function
        return () => {
            activeRef.current = false;
            setReconnectionStatus('idle');

            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }

            if (currentClientRef.current) {
                void closeLanMqttClient(currentClientRef.current).catch(() => undefined);
                currentClientRef.current = null;
            }
            setIsConnected(false);
        };
    }, [input.enabled, input.restaurantId]);

    return {
        isConnected,
        reconnectionStatus,
    };
}
