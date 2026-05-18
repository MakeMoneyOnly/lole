'use client';

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
    createLanMqttClient,
    closeLanMqttClient,
    registerLanMessageHandler,
    subscribeTopic,
} from '@/lib/lan/mqtt-client';
import { getStoredDeviceSession } from '@/lib/mobile/device-storage';
import {
    getGatewayTopicsForScopes,
    isGatewayLanEventMessage,
    LocalGatewaySequenceTracker,
} from '@/lib/gateway/local-events';

/**
 * HIGH-015: Reconnection configuration
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
 * MED-003: Message deduplication configuration
 */
const DEDUP_CONFIG = {
    /** Time window in milliseconds for deduplication (5 seconds) */
    dedupWindowMs: 5000,
    /** Maximum number of message IDs to track */
    maxTrackedMessages: 1000,
};

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateReconnectDelay(retryCount: number): number {
    const delay = Math.min(
        RECONNECT_CONFIG.baseDelayMs * Math.pow(2, retryCount),
        RECONNECT_CONFIG.maxDelayMs
    );
    // Add jitter
    const jitter = delay * RECONNECT_CONFIG.jitterFactor * Math.random();
    return delay + jitter;
}

/**
 * MED-003: Generate a unique message ID from realtime payload
 * Uses table, event type, and record ID to create a deterministic identifier
 */
export function generateMessageId(
    table: string,
    eventType: 'INSERT' | 'UPDATE' | 'DELETE',
    recordId: string
): string {
    return `${table}:${eventType}:${recordId}`;
}

/**
 * MED-003: Message deduplication tracker
 * Tracks processed message IDs within a time window to prevent duplicate processing
 */
export class MessageDeduplicator {
    private processedMessages: Map<string, number> = new Map();
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Periodically clean up old entries
        this.cleanupInterval = setInterval(() => this.cleanup(), DEDUP_CONFIG.dedupWindowMs);
    }

    /**
     * Check if a message has already been processed
     * Returns true if the message is a duplicate (should be skipped)
     */
    isDuplicate(messageId: string): boolean {
        const now = Date.now();
        const lastProcessed = this.processedMessages.get(messageId);

        if (lastProcessed !== undefined) {
            // Check if within deduplication window
            if (now - lastProcessed < DEDUP_CONFIG.dedupWindowMs) {
                return true; // Duplicate detected
            }
        }

        // Mark as processed
        this.processedMessages.set(messageId, now);

        // Enforce max tracked messages limit
        if (this.processedMessages.size > DEDUP_CONFIG.maxTrackedMessages) {
            this.cleanup();
        }

        return false;
    }

    /**
     * Clean up old entries outside the deduplication window
     */
    private cleanup(): void {
        const now = Date.now();
        const cutoff = now - DEDUP_CONFIG.dedupWindowMs;

        for (const [id, timestamp] of this.processedMessages.entries()) {
            if (timestamp < cutoff) {
                this.processedMessages.delete(id);
            }
        }
    }

    /**
     * Clear all tracked messages
     */
    clear(): void {
        this.processedMessages.clear();
    }

    /**
     * Destroy the deduplicator and clean up resources
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.processedMessages.clear();
    }
}

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed';
type ExternalOrderStatus =
    | 'pending'
    | 'confirmed'
    | 'preparing'
    | 'ready'
    | 'delivered'
    | 'cancelled';

interface KDSOrder {
    id: string;
    order_type: 'dine-in' | 'delivery' | 'pickup';
    source: string;
    status: OrderStatus | ExternalOrderStatus;
    created_at: string;
    restaurant_id?: string;
}

interface RealtimePayload {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Record<string, unknown>;
    old: Record<string, unknown>;
    schema: string;
    table: string;
    commit_timestamp: string;
}

interface UseKDSRealtimeOptions {
    restaurantId: string;
    onNewOrder?: (order: KDSOrder) => void;
    onOrderUpdate?: (order: KDSOrder) => void;
    onOrderDelete?: (orderId: string) => void;
    onLocalSignal?: (event: { type: string; aggregate: string; aggregateId: string }) => void;
    enabled?: boolean;
}

/**
 * Hook for real-time KDS order updates via Supabase Realtime
 *
 * Subscribes to both `orders` and `external_orders` tables for
 * comprehensive omnichannel order tracking.
 */
export function useKDSRealtime({
    restaurantId,
    onNewOrder,
    onOrderUpdate,
    onOrderDelete,
    onLocalSignal,
    enabled = true,
}: UseKDSRealtimeOptions) {
    const channelRef = useRef<RealtimeChannel | null>(null);
    const supabase = useMemo(() => createClient(), []);
    const mountedRef = useRef(false);
    const [isConnected, setIsConnected] = useState(false);
    const lanTrackerRef = useRef<LocalGatewaySequenceTracker | null>(null);

    // HIGH-015: Reconnection state
    const retryCountRef = useRef(0);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [reconnectionStatus, setReconnectionStatus] = useState<
        'idle' | 'reconnecting' | 'failed'
    >('idle');

    // MED-003: Message deduplicator instance
    const deduplicatorRef = useRef<MessageDeduplicator | null>(null);

    // Initialize deduplicator on mount
    useEffect(() => {
        deduplicatorRef.current = new MessageDeduplicator();
        lanTrackerRef.current = new LocalGatewaySequenceTracker();
        return () => {
            deduplicatorRef.current?.destroy();
            deduplicatorRef.current = null;
            lanTrackerRef.current = null;
        };
    }, []);

    const handleLocalGatewayMessage = useCallback(
        (topic: string, rawPayload: string) => {
            const parsed = JSON.parse(rawPayload) as Record<string, unknown>;
            const event = isGatewayLanEventMessage(parsed)
                ? parsed
                : {
                      messageId: String(parsed.id ?? parsed.idempotencyKey ?? ''),
                      sequence: typeof parsed.sequence === 'number' ? parsed.sequence : undefined,
                      aggregate: String(parsed.aggregate ?? ''),
                      aggregateId: String(parsed.aggregateId ?? ''),
                      type: String(parsed.type ?? ''),
                      payload:
                          parsed.payload && typeof parsed.payload === 'object'
                              ? (parsed.payload as Record<string, unknown>)
                              : {},
                  };

            if (
                !lanTrackerRef.current?.shouldProcess({
                    messageId: event.messageId,
                    aggregate: event.aggregate,
                    aggregateId: event.aggregateId,
                    sequence: event.sequence,
                })
            ) {
                return;
            }

            onLocalSignal?.({
                type: event.type,
                aggregate: event.aggregate,
                aggregateId: event.aggregateId,
            });

            if (topic.includes('/orders/commands')) {
                if (event.type === 'order.create') {
                    onNewOrder?.({
                        id: String(event.payload.order_id ?? event.aggregateId),
                        order_type:
                            String(event.payload.order_type ?? 'dine_in') === 'pickup'
                                ? 'pickup'
                                : String(event.payload.order_type ?? 'dine_in') === 'delivery'
                                  ? 'delivery'
                                  : 'dine-in',
                        source: 'gateway-local',
                        status: String(event.payload.status ?? 'pending') as OrderStatus,
                        created_at: new Date().toISOString(),
                    });
                } else if (event.type === 'order.update' || event.type === 'order.fire_course') {
                    onOrderUpdate?.({
                        id: String(event.payload.order_id ?? event.aggregateId),
                        order_type: 'dine-in',
                        source: 'gateway-local',
                        status: String(event.payload.status ?? 'pending') as OrderStatus,
                        created_at: new Date().toISOString(),
                    });
                } else if (event.type === 'order.delete') {
                    onOrderDelete?.(String(event.payload.order_id ?? event.aggregateId));
                }
            }
        },
        [onLocalSignal, onNewOrder, onOrderDelete, onOrderUpdate]
    );

    const handleOrdersChange = useCallback(
        (payload: RealtimePayload) => {
            if (!mountedRef.current) return;

            // MED-003: Check for duplicate messages
            const recordId = (payload.new?.id || payload.old?.id) as string;
            if (recordId && deduplicatorRef.current) {
                const messageId = generateMessageId(payload.table, payload.eventType, recordId);
                if (deduplicatorRef.current.isDuplicate(messageId)) {
                    console.warn(`[KDS Realtime] Skipping duplicate message: ${messageId}`);
                    return;
                }
            }

            // For DELETE events, payload.new is empty; use payload.old for restaurant_id check
            const relevantRecord = payload.eventType === 'DELETE' ? payload.old : payload.new;

            // Filter by restaurant_id
            if (relevantRecord.restaurant_id !== restaurantId) {
                return;
            }

            switch (payload.eventType) {
                case 'INSERT': {
                    const order = payload.new;
                    onNewOrder?.({
                        id: order.id as string,
                        order_type: 'dine-in',
                        source: 'dine-in',
                        status: order.status as OrderStatus,
                        created_at: order.created_at as string,
                    });
                    break;
                }
                case 'UPDATE': {
                    const order = payload.new;
                    onOrderUpdate?.({
                        id: order.id as string,
                        order_type: 'dine-in',
                        source: 'dine-in',
                        status: order.status as OrderStatus,
                        created_at: order.created_at as string,
                    });
                    break;
                }
                case 'DELETE':
                    onOrderDelete?.(payload.old.id as string);
                    break;
            }
        },
        [restaurantId, onNewOrder, onOrderUpdate, onOrderDelete]
    );

    const handleExternalOrdersChange = useCallback(
        (payload: RealtimePayload) => {
            if (!mountedRef.current) return;

            // MED-003: Check for duplicate messages
            const recordId = (payload.new?.id || payload.old?.id) as string;
            if (recordId && deduplicatorRef.current) {
                const messageId = generateMessageId(payload.table, payload.eventType, recordId);
                if (deduplicatorRef.current.isDuplicate(messageId)) {
                    console.warn(`[KDS Realtime] Skipping duplicate message: ${messageId}`);
                    return;
                }
            }

            // For DELETE events, payload.new is empty; use payload.old for restaurant_id check
            const relevantRecord = payload.eventType === 'DELETE' ? payload.old : payload.new;

            // Filter by restaurant_id
            if (relevantRecord.restaurant_id !== restaurantId) {
                return;
            }

            // DELETE events have no payload.new data
            if (payload.eventType === 'DELETE') {
                onOrderDelete?.(payload.old.id as string);
                return;
            }

            const order = payload.new;
            const provider = order.provider as string;
            const payloadJson = order.payload_json as Record<string, unknown> | null;
            const fulfillmentType = payloadJson?.fulfillment_type as string;

            switch (payload.eventType) {
                case 'INSERT':
                    onNewOrder?.({
                        id: order.id as string,
                        order_type: fulfillmentType === 'pickup' ? 'pickup' : 'delivery',
                        source: provider,
                        status: order.normalized_status as ExternalOrderStatus,
                        created_at: order.created_at as string,
                    });
                    break;
                case 'UPDATE':
                    onOrderUpdate?.({
                        id: order.id as string,
                        order_type: fulfillmentType === 'pickup' ? 'pickup' : 'delivery',
                        source: provider,
                        status: order.normalized_status as ExternalOrderStatus,
                        created_at: order.created_at as string,
                    });
                    break;
            }
        },
        [restaurantId, onNewOrder, onOrderUpdate, onOrderDelete]
    );

    // HIGH-015: Refs to hold callback functions to avoid immutability errors
    const attemptReconnectRef = useRef<() => void>(() => {});

    /**
     * HIGH-015: Setup channel with reconnection handling
     */
    const setupChannel = useCallback(() => {
        if (!mountedRef.current || !restaurantId) return;

        const channel = supabase
            .channel(`kds-orders-${restaurantId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `restaurant_id=eq.${restaurantId}`,
                },
                payload => {
                    handleOrdersChange(payload as unknown as RealtimePayload);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'external_orders',
                    filter: `restaurant_id=eq.${restaurantId}`,
                },
                payload => {
                    handleExternalOrdersChange(payload as unknown as RealtimePayload);
                }
            )
            .subscribe(status => {
                console.warn(`[KDS Realtime] Subscription status: ${status}`);
                if (!mountedRef.current) return;

                if (status === 'SUBSCRIBED') {
                    setIsConnected(true);
                    setReconnectionStatus('idle');
                    retryCountRef.current = 0; // Reset retry count on successful connection
                    return;
                }

                if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
                    setIsConnected(false);
                    // HIGH-015: Attempt reconnection with exponential backoff
                    attemptReconnectRef.current();
                }
            });

        channelRef.current = channel;
    }, [restaurantId, supabase, handleOrdersChange, handleExternalOrdersChange]);

    /**
     * HIGH-015: Attempt to reconnect with exponential backoff
     */
    const attemptReconnect = useCallback(() => {
        if (!mountedRef.current) return;

        const currentRetry = retryCountRef.current;

        if (currentRetry >= RECONNECT_CONFIG.maxRetries) {
            console.error(
                `[KDS Realtime] Max reconnection attempts (${RECONNECT_CONFIG.maxRetries}) reached`
            );
            setReconnectionStatus('failed');
            return;
        }

        const delay = calculateReconnectDelay(currentRetry);
        console.warn(
            `[KDS Realtime] Scheduling reconnect attempt ${currentRetry + 1}/${RECONNECT_CONFIG.maxRetries} in ${Math.round(delay)}ms`
        );

        setReconnectionStatus('reconnecting');

        reconnectTimeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return;

            retryCountRef.current++;

            // Unsubscribe existing channel if any
            if (channelRef.current) {
                channelRef.current.unsubscribe();
                channelRef.current = null;
            }

            // Trigger reconnection by setting up a new subscription
            setupChannel();
        }, delay);
    }, [setupChannel]);

    useEffect(() => {
        // Set up the ref after both callbacks are defined
        attemptReconnectRef.current = attemptReconnect;
    }, [attemptReconnect]);

    useEffect(() => {
        if (!enabled || !restaurantId) return;

        mountedRef.current = true;
        retryCountRef.current = 0;
        setReconnectionStatus('idle');
        let mqttClient: ReturnType<typeof createLanMqttClient> | null = null;
        let cancelled = false;

        const bootstrapLocalGateway = async (): Promise<void> => {
            const session = await getStoredDeviceSession();
            if (
                cancelled ||
                !session?.gateway ||
                session.gateway_bootstrap_status !== 'ready' ||
                !session.gateway.brokerUrl
            ) {
                setupChannel();
                return;
            }

            mqttClient = createLanMqttClient({
                brokerUrl: session.gateway.brokerUrl,
                clientId: `${session.device_token}-kds-local`,
                clean: false,
            });

            const topics = getGatewayTopicsForScopes({
                restaurantId: session.restaurant_id ?? restaurantId,
                locationId: session.location_id ?? 'default-location',
                scopes: ['orders', 'kds'],
            });

            for (const topic of topics) {
                await subscribeTopic(mqttClient, topic, 1);
            }

            registerLanMessageHandler(mqttClient, (topic, rawPayload) => {
                if (!mountedRef.current) return;
                void handleLocalGatewayMessage(topic, String(rawPayload));
            });

            setIsConnected(true);
            setReconnectionStatus('idle');
        };

        void bootstrapLocalGateway();

        // HIGH-015: Cleanup function
        return () => {
            cancelled = true;
            mountedRef.current = false;

            // Clear any pending reconnect timeout
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }

            if (channelRef.current) {
                channelRef.current.unsubscribe();
                channelRef.current = null;
            }
            if (mqttClient) {
                void closeLanMqttClient(mqttClient).catch(() => undefined);
            }
            setIsConnected(false);
            setReconnectionStatus('idle');
        };
    }, [enabled, restaurantId, setupChannel, handleLocalGatewayMessage]);

    return {
        isConnected,
        reconnectionStatus,
    };
}

/**
 * Hook for real-time driver status updates
 */
interface DriverStatusUpdate {
    orderId: string;
    status: 'pending' | 'assigned' | 'arrived';
    driverName?: string;
    driverPhone?: string;
    etaMinutes?: number;
}

interface UseDriverStatusRealtimeOptions {
    restaurantId: string;
    onDriverStatusUpdate?: (update: DriverStatusUpdate) => void;
    enabled?: boolean;
}

export function useDriverStatusRealtime({
    restaurantId,
    onDriverStatusUpdate,
    enabled = true,
}: UseDriverStatusRealtimeOptions) {
    const supabase = createClient();
    const mountedRef = useRef(false);

    useEffect(() => {
        if (!enabled || !restaurantId) return;

        mountedRef.current = true;

        const channel = supabase
            .channel(`driver-status-${restaurantId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'external_orders',
                    filter: `restaurant_id=eq.${restaurantId}`,
                },
                payload => {
                    if (!mountedRef.current) return;

                    const order = payload.new as Record<string, unknown>;
                    const payloadJson = order.payload_json as Record<string, unknown> | null;
                    const driverInfo = payloadJson?.driver_info as Record<string, unknown> | null;

                    if (driverInfo) {
                        onDriverStatusUpdate?.({
                            orderId: order.id as string,
                            status: driverInfo.status as 'pending' | 'assigned' | 'arrived',
                            driverName: driverInfo.name as string | undefined,
                            driverPhone: driverInfo.phone as string | undefined,
                            etaMinutes: driverInfo.eta_minutes as number | undefined,
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            mountedRef.current = false;
            channel.unsubscribe();
        };
    }, [enabled, restaurantId, supabase, onDriverStatusUpdate]);
}
