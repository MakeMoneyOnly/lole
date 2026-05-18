/**
 * MED-006: Split Realtime Channels by Function
 *
 * Provides separate realtime channels for different data types:
 * - Orders channel: For dine-in order updates
 * - External orders channel: For delivery/pickup orders
 * - Tables channel: For table status updates
 * - KDS items channel: For kitchen display item updates
 *
 * Benefits:
 * - Reduced unnecessary traffic by subscribing only to needed channels
 * - Better error isolation - one channel failure doesn't affect others
 * - Independent reconnection logic per channel
 * - More granular connection status tracking
 */

'use client';

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Reconnection configuration
 */
const RECONNECT_CONFIG = {
    maxRetries: 5,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    jitterFactor: 0.3,
};

/**
 * Message deduplication configuration
 */
const DEDUP_CONFIG = {
    dedupWindowMs: 5000,
    maxTrackedMessages: 1000,
};

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateReconnectDelay(retryCount: number): number {
    const delay = Math.min(
        RECONNECT_CONFIG.baseDelayMs * Math.pow(2, retryCount),
        RECONNECT_CONFIG.maxDelayMs
    );
    const jitter = delay * RECONNECT_CONFIG.jitterFactor * Math.random();
    return delay + jitter;
}

/**
 * Generate a unique message ID from realtime payload
 */
function generateMessageId(
    table: string,
    eventType: 'INSERT' | 'UPDATE' | 'DELETE',
    recordId: string
): string {
    return `${table}:${eventType}:${recordId}`;
}

/**
 * Message deduplication tracker
 */
class MessageDeduplicator {
    private processedMessages: Map<string, number> = new Map();
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        this.cleanupInterval = setInterval(() => this.cleanup(), DEDUP_CONFIG.dedupWindowMs);
    }

    isDuplicate(messageId: string): boolean {
        const now = Date.now();
        const lastProcessed = this.processedMessages.get(messageId);

        if (lastProcessed !== undefined && now - lastProcessed < DEDUP_CONFIG.dedupWindowMs) {
            return true;
        }

        this.processedMessages.set(messageId, now);

        if (this.processedMessages.size > DEDUP_CONFIG.maxTrackedMessages) {
            this.cleanup();
        }

        return false;
    }

    private cleanup(): void {
        const now = Date.now();
        const cutoff = now - DEDUP_CONFIG.dedupWindowMs;

        for (const [id, timestamp] of this.processedMessages.entries()) {
            if (timestamp < cutoff) {
                this.processedMessages.delete(id);
            }
        }
    }

    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.processedMessages.clear();
    }
}

/**
 * Channel types for split subscriptions
 */
export type ChannelType = 'orders' | 'external_orders' | 'tables' | 'kds_items';

/**
 * Connection status per channel
 */
export type ChannelConnectionStatus = {
    [K in ChannelType]: 'disconnected' | 'connecting' | 'connected' | 'error';
};

/**
 * Realtime payload interface
 */
interface RealtimePayload {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Record<string, unknown>;
    old: Record<string, unknown>;
    schema: string;
    table: string;
    commit_timestamp: string;
}

/**
 * Options for split realtime channels
 */
interface UseSplitRealtimeChannelsOptions {
    restaurantId: string;
    channels: ChannelType[];
    onOrderChange?: (payload: RealtimePayload) => void;
    onExternalOrderChange?: (payload: RealtimePayload) => void;
    onTableChange?: (payload: RealtimePayload) => void;
    onKDSItemChange?: (payload: RealtimePayload) => void;
    enabled?: boolean;
}

/**
 * Hook for split realtime channels by function
 *
 * MED-006: Provides separate channels for different data types
 */
export function useSplitRealtimeChannels({
    restaurantId,
    channels,
    onOrderChange,
    onExternalOrderChange,
    onTableChange,
    onKDSItemChange,
    enabled = true,
}: UseSplitRealtimeChannelsOptions) {
    const supabase = useMemo(() => createClient(), []);
    const mountedRef = useRef(false);

    // Track channels separately
    const channelsRef = useRef<Map<ChannelType, RealtimeChannel>>(new Map());
    const retryCountRef = useRef<Map<ChannelType, number>>(new Map());
    const reconnectTimeoutsRef = useRef<Map<ChannelType, ReturnType<typeof setTimeout>>>(new Map());

    // Deduplicator for all channels
    const deduplicatorRef = useRef<MessageDeduplicator | null>(null);

    // Connection status per channel
    const [connectionStatus, setConnectionStatus] = useState<ChannelConnectionStatus>(() => ({
        orders: 'disconnected',
        external_orders: 'disconnected',
        tables: 'disconnected',
        kds_items: 'disconnected',
    }));

    // Initialize deduplicator
    useEffect(() => {
        deduplicatorRef.current = new MessageDeduplicator();
        return () => {
            deduplicatorRef.current?.destroy();
            deduplicatorRef.current = null;
        };
    }, []);

    /**
     * Check for duplicate messages
     */
    const checkDuplicate = useCallback((payload: RealtimePayload): boolean => {
        const recordId = (payload.new?.id || payload.old?.id) as string;
        if (recordId && deduplicatorRef.current) {
            const messageId = generateMessageId(payload.table, payload.eventType, recordId);
            return deduplicatorRef.current.isDuplicate(messageId);
        }
        return false;
    }, []);

    /**
     * Update connection status for a channel
     */
    const updateStatus = useCallback(
        (
            channelType: ChannelType,
            status: 'disconnected' | 'connecting' | 'connected' | 'error'
        ) => {
            setConnectionStatus(prev => ({
                ...prev,
                [channelType]: status,
            }));
        },
        []
    );

    // Ref to hold attemptReconnect callback to avoid immutability issues
    const attemptReconnectRef = useRef<(channelType: ChannelType) => void>(() => {});

    /**
     * Setup a single channel
     */
    const setupChannel = useCallback(
        (channelType: ChannelType) => {
            if (!mountedRef.current || !restaurantId) return;

            updateStatus(channelType, 'connecting');

            const channelName = `${channelType}-${restaurantId}`;

            let channel: RealtimeChannel;

            switch (channelType) {
                case 'orders':
                    channel = supabase.channel(channelName).on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'orders',
                            filter: `restaurant_id=eq.${restaurantId}`,
                        },
                        payload => {
                            if (!mountedRef.current) return;
                            const typedPayload = payload as unknown as RealtimePayload;
                            if (checkDuplicate(typedPayload)) {
                                console.warn(`[Realtime] Skipping duplicate orders message`);
                                return;
                            }
                            onOrderChange?.(typedPayload);
                        }
                    );
                    break;

                case 'external_orders':
                    channel = supabase.channel(channelName).on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'external_orders',
                            filter: `restaurant_id=eq.${restaurantId}`,
                        },
                        payload => {
                            if (!mountedRef.current) return;
                            const typedPayload = payload as unknown as RealtimePayload;
                            if (checkDuplicate(typedPayload)) {
                                console.warn(
                                    `[Realtime] Skipping duplicate external_orders message`
                                );
                                return;
                            }
                            onExternalOrderChange?.(typedPayload);
                        }
                    );
                    break;

                case 'tables':
                    channel = supabase.channel(channelName).on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'tables',
                            filter: `restaurant_id=eq.${restaurantId}`,
                        },
                        payload => {
                            if (!mountedRef.current) return;
                            const typedPayload = payload as unknown as RealtimePayload;
                            if (checkDuplicate(typedPayload)) {
                                console.warn(`[Realtime] Skipping duplicate tables message`);
                                return;
                            }
                            onTableChange?.(typedPayload);
                        }
                    );
                    break;

                case 'kds_items':
                    channel = supabase.channel(channelName).on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'kds_order_items',
                            filter: `restaurant_id=eq.${restaurantId}`,
                        },
                        payload => {
                            if (!mountedRef.current) return;
                            const typedPayload = payload as unknown as RealtimePayload;
                            if (checkDuplicate(typedPayload)) {
                                console.warn(`[Realtime] Skipping duplicate kds_items message`);
                                return;
                            }
                            onKDSItemChange?.(typedPayload);
                        }
                    );
                    break;

                default:
                    console.error(`[Realtime] Unknown channel type: ${channelType}`);
                    return;
            }

            // Subscribe with status handling
            channel.subscribe(status => {
                console.warn(`[Realtime] ${channelType} subscription status: ${status}`);
                if (!mountedRef.current) return;

                if (status === 'SUBSCRIBED') {
                    updateStatus(channelType, 'connected');
                    retryCountRef.current.set(channelType, 0);
                } else if (
                    status === 'CHANNEL_ERROR' ||
                    status === 'CLOSED' ||
                    status === 'TIMED_OUT'
                ) {
                    updateStatus(channelType, 'error');
                    attemptReconnectRef.current(channelType);
                }
            });

            channelsRef.current.set(channelType, channel);
        },
        [
            restaurantId,
            supabase,
            updateStatus,
            checkDuplicate,
            onOrderChange,
            onExternalOrderChange,
            onTableChange,
            onKDSItemChange,
        ]
    );

    /**
     * Attempt to reconnect a specific channel
     */
    const attemptReconnect = useCallback(
        (channelType: ChannelType) => {
            if (!mountedRef.current) return;

            const currentRetry = retryCountRef.current.get(channelType) ?? 0;

            if (currentRetry >= RECONNECT_CONFIG.maxRetries) {
                console.error(`[Realtime] ${channelType}: Max reconnection attempts reached`);
                updateStatus(channelType, 'error');
                return;
            }

            const delay = calculateReconnectDelay(currentRetry);
            console.warn(
                `[Realtime] ${channelType}: Scheduling reconnect attempt ${currentRetry + 1} in ${Math.round(delay)}ms`
            );

            const timeout = setTimeout(() => {
                if (!mountedRef.current) return;

                retryCountRef.current.set(channelType, currentRetry + 1);

                // Unsubscribe existing channel
                const existingChannel = channelsRef.current.get(channelType);
                if (existingChannel) {
                    existingChannel.unsubscribe();
                    channelsRef.current.delete(channelType);
                }

                // Reconnect
                setupChannel(channelType);
            }, delay);

            reconnectTimeoutsRef.current.set(channelType, timeout);
        },
        [setupChannel, updateStatus]
    );

    useEffect(() => {
        // Set up the ref after both callbacks are defined
        attemptReconnectRef.current = attemptReconnect;
    }, [attemptReconnect]);

    /**
     * Setup all requested channels
     */
    useEffect(() => {
        if (!enabled || !restaurantId) return;

        mountedRef.current = true;

        // Setup each requested channel
        for (const channelType of channels) {
            retryCountRef.current.set(channelType, 0);
            setupChannel(channelType);
        }

        return () => {
            mountedRef.current = false;

            // Clear all reconnect timeouts
            for (const [, timeout] of reconnectTimeoutsRef.current) {
                clearTimeout(timeout);
            }
            reconnectTimeoutsRef.current.clear();

            // Unsubscribe all channels
            for (const [, channel] of channelsRef.current) {
                channel.unsubscribe();
            }
            channelsRef.current.clear();

            // Reset status
            setConnectionStatus({
                orders: 'disconnected',
                external_orders: 'disconnected',
                tables: 'disconnected',
                kds_items: 'disconnected',
            });
        };
    }, [enabled, restaurantId, channels, setupChannel]);

    /**
     * Check if all requested channels are connected
     */
    const isAllConnected = useMemo(() => {
        return channels.every(ch => connectionStatus[ch] === 'connected');
    }, [channels, connectionStatus]);

    /**
     * Check if any channel has an error
     */
    const hasError = useMemo(() => {
        return channels.some(ch => connectionStatus[ch] === 'error');
    }, [channels, connectionStatus]);

    return {
        connectionStatus,
        isAllConnected,
        hasError,
    };
}

/**
 * Simplified hook for orders-only realtime
 */
export function useOrdersRealtime(options: {
    restaurantId: string;
    onOrderChange?: (payload: RealtimePayload) => void;
    enabled?: boolean;
}) {
    return useSplitRealtimeChannels({
        restaurantId: options.restaurantId,
        channels: ['orders'],
        onOrderChange: options.onOrderChange,
        enabled: options.enabled,
    });
}

/**
 * Simplified hook for KDS realtime (orders + external_orders + kds_items)
 */
export function useKDSChannels(options: {
    restaurantId: string;
    onOrderChange?: (payload: RealtimePayload) => void;
    onExternalOrderChange?: (payload: RealtimePayload) => void;
    onKDSItemChange?: (payload: RealtimePayload) => void;
    enabled?: boolean;
}) {
    return useSplitRealtimeChannels({
        restaurantId: options.restaurantId,
        channels: ['orders', 'external_orders', 'kds_items'],
        onOrderChange: options.onOrderChange,
        onExternalOrderChange: options.onExternalOrderChange,
        onKDSItemChange: options.onKDSItemChange,
        enabled: options.enabled,
    });
}

export default useSplitRealtimeChannels;
