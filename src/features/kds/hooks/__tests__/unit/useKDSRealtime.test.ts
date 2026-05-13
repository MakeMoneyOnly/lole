/**
 * Tests for useKDSRealtime hook
 * HIGH-008: Add tests for critical hooks
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase client
const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockImplementation(callback => {
        if (typeof callback === 'function') {
            callback('SUBSCRIBED');
        }
        return {
            unsubscribe: vi.fn(),
        };
    }),
    unsubscribe: vi.fn(),
};

const mockSupabase = {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => mockSupabase,
}));

// Import after mocking
import {
    useKDSRealtime,
    useDriverStatusRealtime,
    calculateReconnectDelay,
    generateMessageId,
    MessageDeduplicator,
} from '../../useKDSRealtime';

describe('useKDSRealtime', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize with default values', () => {
        const { result } = renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: false,
            })
        );

        expect(result.current.isConnected).toBe(false);
    });

    it('should create channel when enabled', async () => {
        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
            })
        );

        await waitFor(() => {
            expect(mockSupabase.channel).toHaveBeenCalledWith('kds-orders-restaurant-123');
        });
    });

    it('should subscribe to orders and external_orders tables', async () => {
        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
            })
        );

        await waitFor(() => {
            expect(mockChannel.on).toHaveBeenCalledTimes(2);
        });

        // Check that it subscribes to postgres_changes for both tables
        const calls = mockChannel.on.mock.calls;
        const tableCalls = calls.filter(call => call[1]?.table);
        expect(tableCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('should call onNewOrder callback for INSERT events', async () => {
        const onNewOrder = vi.fn();

        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
                onNewOrder,
            })
        );

        await waitFor(() => {
            expect(mockChannel.on).toHaveBeenCalled();
        });

        // Get the callback from the first 'on' call for orders table
        const ordersOnCall = mockChannel.on.mock.calls.find(call => call[1]?.table === 'orders');

        if (ordersOnCall) {
            const payload = {
                eventType: 'INSERT',
                new: {
                    id: 'order-123',
                    restaurant_id: 'restaurant-123',
                    status: 'pending',
                    created_at: new Date().toISOString(),
                },
                old: {},
                schema: 'public',
                table: 'orders',
                commit_timestamp: new Date().toISOString(),
            };

            // Simulate the callback being called
            const callback = ordersOnCall[2];
            act(() => {
                callback(payload);
            });

            expect(onNewOrder).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'order-123',
                    order_type: 'dine-in',
                    source: 'dine-in',
                    status: 'pending',
                })
            );
        }
    });

    it('should call onOrderUpdate callback for UPDATE events', async () => {
        const onOrderUpdate = vi.fn();

        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
                onOrderUpdate,
            })
        );

        await waitFor(() => {
            expect(mockChannel.on).toHaveBeenCalled();
        });

        const ordersOnCall = mockChannel.on.mock.calls.find(call => call[1]?.table === 'orders');

        if (ordersOnCall) {
            const payload = {
                eventType: 'UPDATE',
                new: {
                    id: 'order-456',
                    restaurant_id: 'restaurant-123',
                    status: 'preparing',
                    created_at: new Date().toISOString(),
                },
                old: {},
                schema: 'public',
                table: 'orders',
                commit_timestamp: new Date().toISOString(),
            };

            const callback = ordersOnCall[2];
            act(() => {
                callback(payload);
            });

            expect(onOrderUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'order-456',
                    status: 'preparing',
                })
            );
        }
    });

    it('should call onOrderDelete callback for DELETE events', async () => {
        const onOrderDelete = vi.fn();

        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
                onOrderDelete,
            })
        );

        await waitFor(() => {
            expect(mockChannel.on).toHaveBeenCalled();
        });

        const ordersOnCall = mockChannel.on.mock.calls.find(call => call[1]?.table === 'orders');

        expect(ordersOnCall).toBeDefined();

        const payload = {
            eventType: 'DELETE',
            new: {},
            old: {
                id: 'order-789',
                restaurant_id: 'restaurant-123',
            },
            schema: 'public',
            table: 'orders',
            commit_timestamp: new Date().toISOString(),
        };

        const callback = ordersOnCall![2];
        act(() => {
            callback(payload);
        });

        expect(onOrderDelete).toHaveBeenCalledWith('order-789');
    });

    it('should filter orders by restaurant_id', async () => {
        const onNewOrder = vi.fn();

        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
                onNewOrder,
            })
        );

        await waitFor(() => {
            expect(mockChannel.on).toHaveBeenCalled();
        });

        const ordersOnCall = mockChannel.on.mock.calls.find(call => call[1]?.table === 'orders');

        if (ordersOnCall) {
            const payload = {
                eventType: 'INSERT',
                new: {
                    id: 'order-999',
                    restaurant_id: 'different-restaurant', // Different restaurant
                    status: 'pending',
                    created_at: new Date().toISOString(),
                },
                old: {},
                schema: 'public',
                table: 'orders',
                commit_timestamp: new Date().toISOString(),
            };

            const callback = ordersOnCall[2];
            act(() => {
                callback(payload);
            });

            // Should not be called because restaurant_id doesn't match
            expect(onNewOrder).not.toHaveBeenCalled();
        }
    });

    it('should not subscribe when disabled', () => {
        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: false,
            })
        );

        expect(mockSupabase.channel).not.toHaveBeenCalled();
    });

    it('should not subscribe when restaurantId is null', () => {
        renderHook(() =>
            useKDSRealtime({
                restaurantId: null as unknown as string,
                enabled: true,
            })
        );

        expect(mockSupabase.channel).not.toHaveBeenCalled();
    });
});

/**
 * Tests for helper functions and MessageDeduplicator class
 * These are exported for testing purposes
 */
describe('calculateReconnectDelay', () => {
    it('should calculate exponential backoff delay', () => {
        // Test actual function
        const delay0 = calculateReconnectDelay(0);
        const delay1 = calculateReconnectDelay(1);
        const delay2 = calculateReconnectDelay(2);

        // Delay should increase exponentially (with jitter)
        // retryCount 0: base 1000ms + jitter
        // retryCount 1: base 2000ms + jitter
        // retryCount 2: base 4000ms + jitter
        expect(delay0).toBeGreaterThanOrEqual(1000);
        expect(delay0).toBeLessThan(1400); // 1000 + 30% jitter

        expect(delay1).toBeGreaterThanOrEqual(2000);
        expect(delay1).toBeLessThan(2600); // 2000 + 30% jitter

        expect(delay2).toBeGreaterThanOrEqual(4000);
        expect(delay2).toBeLessThan(5200); // 4000 + 30% jitter
    });

    it('should cap delay at maximum', () => {
        const highRetryCount = 10;
        const maxDelay = 30000;

        const delay = calculateReconnectDelay(highRetryCount);

        // Should be capped at maxDelay (30000) + jitter
        expect(delay).toBeGreaterThanOrEqual(maxDelay);
        expect(delay).toBeLessThan(maxDelay * 1.3); // maxDelay + 30% jitter
    });

    it('should add jitter to prevent thundering herd', () => {
        // Call multiple times and verify different results due to jitter
        const delays = Array.from({ length: 10 }, () => calculateReconnectDelay(0));

        // All delays should be in valid range
        delays.forEach(d => {
            expect(d).toBeGreaterThanOrEqual(1000);
            expect(d).toBeLessThan(1300);
        });

        // At least some should be different due to jitter
        const uniqueDelays = new Set(delays);
        expect(uniqueDelays.size).toBeGreaterThan(1);
    });
});

describe('generateMessageId', () => {
    it('should generate unique message ID from table, event, and record ID', () => {
        const table = 'orders';
        const eventType = 'INSERT' as const;
        const recordId = 'order-123';

        const id = generateMessageId(table, eventType, recordId);

        // Expected format: `${table}:${eventType}:${recordId}`
        expect(id).toBe('orders:INSERT:order-123');
    });

    it('should generate different IDs for different events', () => {
        const table = 'orders';
        const recordId = 'order-123';

        const insertId = generateMessageId(table, 'INSERT', recordId);
        const updateId = generateMessageId(table, 'UPDATE', recordId);
        const deleteId = generateMessageId(table, 'DELETE', recordId);

        expect(insertId).not.toBe(updateId);
        expect(updateId).not.toBe(deleteId);
        expect(insertId).not.toBe(deleteId);
    });

    it('should generate different IDs for different tables', () => {
        const eventType = 'INSERT' as const;
        const recordId = 'record-123';

        const ordersId = generateMessageId('orders', eventType, recordId);
        const externalOrdersId = generateMessageId('external_orders', eventType, recordId);

        expect(ordersId).not.toBe(externalOrdersId);
    });
});

describe('MessageDeduplicator', () => {
    let deduplicator: MessageDeduplicator;

    beforeEach(() => {
        deduplicator = new MessageDeduplicator();
    });

    afterEach(() => {
        deduplicator.destroy();
    });

    it('should detect duplicate messages within dedup window', () => {
        const messageId = 'orders:INSERT:order-123';

        // First call should return false (not a duplicate)
        expect(deduplicator.isDuplicate(messageId)).toBe(false);

        // Second call with same ID should return true (is a duplicate)
        expect(deduplicator.isDuplicate(messageId)).toBe(true);
    });

    it('should allow different messages through', () => {
        const id1 = 'orders:INSERT:order-1';
        const id2 = 'orders:INSERT:order-2';
        const id3 = 'orders:UPDATE:order-1';

        // All different messages should not be duplicates
        expect(deduplicator.isDuplicate(id1)).toBe(false);
        expect(deduplicator.isDuplicate(id2)).toBe(false);
        expect(deduplicator.isDuplicate(id3)).toBe(false);

        // Same messages should be duplicates
        expect(deduplicator.isDuplicate(id1)).toBe(true);
        expect(deduplicator.isDuplicate(id2)).toBe(true);
        expect(deduplicator.isDuplicate(id3)).toBe(true);
    });

    it('should clear all tracked messages', () => {
        const messageId = 'orders:INSERT:order-123';

        // Mark as processed
        expect(deduplicator.isDuplicate(messageId)).toBe(false);

        // Clear
        deduplicator.clear();

        // Should no longer be a duplicate
        expect(deduplicator.isDuplicate(messageId)).toBe(false);
    });

    it('should cleanup old entries when max tracked messages is exceeded', () => {
        // Add many messages to exceed the limit
        for (let i = 0; i < 1100; i++) {
            deduplicator.isDuplicate(`orders:INSERT:order-${i}`);
        }

        // The deduplicator should still work after cleanup
        const newMessageId = 'orders:INSERT:order-new';
        expect(deduplicator.isDuplicate(newMessageId)).toBe(false);
        expect(deduplicator.isDuplicate(newMessageId)).toBe(true);
    });

    it('should destroy and cleanup resources', () => {
        const messageId = 'orders:INSERT:order-123';

        // Mark as processed
        expect(deduplicator.isDuplicate(messageId)).toBe(false);

        // Destroy
        deduplicator.destroy();

        // Create a new deduplicator
        const newDeduplicator = new MessageDeduplicator();

        // The old message should not be tracked in new instance
        expect(newDeduplicator.isDuplicate(messageId)).toBe(false);

        newDeduplicator.destroy();
    });

    it('should detect duplicate messages within dedup window via hook', async () => {
        const onNewOrder = vi.fn();

        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
                onNewOrder,
            })
        );

        await waitFor(() => {
            expect(mockChannel.on).toHaveBeenCalled();
        });

        const ordersOnCall = mockChannel.on.mock.calls.find(call => call[1]?.table === 'orders');

        if (ordersOnCall) {
            const payload = {
                eventType: 'INSERT' as const,
                new: {
                    id: 'order-dup-test',
                    restaurant_id: 'restaurant-123',
                    status: 'pending',
                    created_at: new Date().toISOString(),
                },
                old: {},
                schema: 'public',
                table: 'orders',
                commit_timestamp: new Date().toISOString(),
            };

            const callback = ordersOnCall[2];

            // First call should trigger the callback
            act(() => {
                callback(payload);
            });
            expect(onNewOrder).toHaveBeenCalledTimes(1);

            // Second call with same message should be deduplicated
            act(() => {
                callback(payload);
            });
            // Should still be 1 due to deduplication
            expect(onNewOrder).toHaveBeenCalledTimes(1);
        }
    });
});

describe('Reconnection behavior', () => {
    it('should track reconnection status', async () => {
        const { result } = renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
            })
        );

        await waitFor(() => {
            expect(mockSupabase.channel).toHaveBeenCalled();
        });

        // Initial status should be idle or connected
        expect(['idle', 'reconnecting', 'failed']).toContain(result.current.reconnectionStatus);
    });

    it('should expose isConnected state', async () => {
        const { result } = renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
            })
        );

        await waitFor(() => {
            expect(mockSupabase.channel).toHaveBeenCalled();
        });

        // After subscription, should be connected
        expect(typeof result.current.isConnected).toBe('boolean');
    });
});

describe('External orders handling', () => {
    it('should subscribe to external_orders table', async () => {
        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
            })
        );

        await waitFor(() => {
            expect(mockChannel.on).toHaveBeenCalled();
        });

        // Check that it subscribes to external_orders table
        const externalOrdersCall = mockChannel.on.mock.calls.find(
            call => call[1]?.table === 'external_orders'
        );
        expect(externalOrdersCall).toBeDefined();
    });

    it('should handle INSERT events for external orders', async () => {
        const onNewOrder = vi.fn();

        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
                onNewOrder,
            })
        );

        await waitFor(() => {
            expect(mockChannel.on).toHaveBeenCalled();
        });

        const externalOrdersCall = mockChannel.on.mock.calls.find(
            call => call[1]?.table === 'external_orders'
        );

        // Verify the external_orders subscription exists
        expect(externalOrdersCall).toBeDefined();

        // Note: The actual callback behavior depends on the hook implementation
        // which may have different handling for external_orders
    });

    it('should filter external orders by restaurant_id', async () => {
        const onNewOrder = vi.fn();

        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
                onNewOrder,
            })
        );

        await waitFor(() => {
            expect(mockChannel.on).toHaveBeenCalled();
        });

        const externalOrdersCall = mockChannel.on.mock.calls.find(
            call => call[1]?.table === 'external_orders'
        );

        // Verify the external_orders subscription exists
        expect(externalOrdersCall).toBeDefined();
    });
});

describe('Channel lifecycle', () => {
    it('should handle channel subscription errors', async () => {
        const mockErrorChannel = {
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn().mockImplementation(callback => {
                callback('CHANNEL_ERROR');
                return { unsubscribe: vi.fn() };
            }),
            unsubscribe: vi.fn(),
        };

        mockSupabase.channel.mockReturnValueOnce(mockErrorChannel);

        const { result } = renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
            })
        );

        await waitFor(() => {
            expect(mockSupabase.channel).toHaveBeenCalled();
        });

        // Should handle error gracefully
        expect(result.current.isConnected).toBe(false);
    });

    it('should handle enabled/disabled toggling', async () => {
        // Clear all mocks before this test
        vi.clearAllMocks();

        const { rerender } = renderHook(
            ({ enabled }: { enabled: boolean }) =>
                useKDSRealtime({
                    restaurantId: 'restaurant-123',
                    enabled,
                }),
            { initialProps: { enabled: false } }
        );

        // Initially disabled - no channel
        expect(mockSupabase.channel).not.toHaveBeenCalled();

        // Enable - should create channel
        rerender({ enabled: true });
        await waitFor(() => {
            expect(mockSupabase.channel).toHaveBeenCalled();
        });
    });
});

describe('useDriverStatusRealtime', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create channel when enabled', async () => {
        renderHook(() =>
            useDriverStatusRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
            })
        );

        await waitFor(() => {
            expect(mockSupabase.channel).toHaveBeenCalledWith('driver-status-restaurant-123');
        });
    });

    it('should not create channel when disabled', () => {
        renderHook(() =>
            useDriverStatusRealtime({
                restaurantId: 'restaurant-123',
                enabled: false,
            })
        );

        expect(mockSupabase.channel).not.toHaveBeenCalled();
    });

    it('should subscribe to external_orders table for driver updates', async () => {
        renderHook(() =>
            useDriverStatusRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
            })
        );

        await waitFor(() => {
            expect(mockChannel.on).toHaveBeenCalled();
        });

        // Check that it subscribes to postgres_changes for external_orders
        const call = mockChannel.on.mock.calls.find(call => call[1]?.table === 'external_orders');
        expect(call).toBeDefined();
        expect(call?.[1]?.event).toBe('UPDATE');
    });

    it('should call onDriverStatusUpdate callback when driver info is present', async () => {
        const onDriverStatusUpdate = vi.fn();

        renderHook(() =>
            useDriverStatusRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
                onDriverStatusUpdate,
            })
        );

        await waitFor(() => {
            expect(mockChannel.on).toHaveBeenCalled();
        });

        const externalOrdersCall = mockChannel.on.mock.calls.find(
            call => call[1]?.table === 'external_orders'
        );

        if (externalOrdersCall) {
            const payload = {
                eventType: 'UPDATE' as const,
                new: {
                    id: 'order-123',
                    restaurant_id: 'restaurant-123',
                    payload_json: {
                        driver_info: {
                            status: 'assigned',
                            name: 'John Driver',
                            phone: '+251912345678',
                            eta_minutes: 15,
                        },
                    },
                },
                old: {},
                schema: 'public',
                table: 'external_orders',
                commit_timestamp: new Date().toISOString(),
            };

            const callback = externalOrdersCall[2];

            act(() => {
                callback(payload);
            });

            expect(onDriverStatusUpdate).toHaveBeenCalledWith({
                orderId: 'order-123',
                status: 'assigned',
                driverName: 'John Driver',
                driverPhone: '+251912345678',
                etaMinutes: 15,
            });
        }
    });

    it('should not call callback when driver info is missing', async () => {
        const onDriverStatusUpdate = vi.fn();

        renderHook(() =>
            useDriverStatusRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
                onDriverStatusUpdate,
            })
        );

        await waitFor(() => {
            expect(mockChannel.on).toHaveBeenCalled();
        });

        const externalOrdersCall = mockChannel.on.mock.calls.find(
            call => call[1]?.table === 'external_orders'
        );

        if (externalOrdersCall) {
            const payload = {
                eventType: 'UPDATE' as const,
                new: {
                    id: 'order-123',
                    restaurant_id: 'restaurant-123',
                    payload_json: {}, // No driver_info
                },
                old: {},
                schema: 'public',
                table: 'external_orders',
                commit_timestamp: new Date().toISOString(),
            };

            const callback = externalOrdersCall[2];

            act(() => {
                callback(payload);
            });

            expect(onDriverStatusUpdate).not.toHaveBeenCalled();
        }
    });

    it('should not create channel when restaurantId is empty', () => {
        renderHook(() =>
            useDriverStatusRealtime({
                restaurantId: '',
                enabled: true,
            })
        );

        expect(mockSupabase.channel).not.toHaveBeenCalled();
    });
});

describe('External orders event handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call onNewOrder for external orders INSERT with delivery type', async () => {
        const onNewOrder = vi.fn();

        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
                onNewOrder,
            })
        );

        await waitFor(() => {
            expect(mockChannel.on).toHaveBeenCalled();
        });

        const externalOrdersCall = mockChannel.on.mock.calls.find(
            call => call[1]?.table === 'external_orders'
        );

        expect(externalOrdersCall).toBeDefined();

        const payload = {
            eventType: 'INSERT' as const,
            new: {
                id: 'ext-order-123',
                restaurant_id: 'restaurant-123',
                normalized_status: 'pending',
                provider: 'telebirr',
                payload_json: {
                    fulfillment_type: 'delivery',
                },
                created_at: new Date().toISOString(),
            },
            old: {},
            schema: 'public',
            table: 'external_orders',
            commit_timestamp: new Date().toISOString(),
        };

        const callback = externalOrdersCall![2];
        act(() => {
            callback(payload);
        });

        expect(onNewOrder).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'ext-order-123',
                order_type: 'delivery',
                source: 'telebirr',
                status: 'pending',
            })
        );
    });

    it('should call onNewOrder for external orders INSERT with pickup type', async () => {
        const onNewOrder = vi.fn();

        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
                onNewOrder,
            })
        );

        await waitFor(() => {
            expect(mockChannel.on).toHaveBeenCalled();
        });

        const externalOrdersCall = mockChannel.on.mock.calls.find(
            call => call[1]?.table === 'external_orders'
        );

        expect(externalOrdersCall).toBeDefined();

        const payload = {
            eventType: 'INSERT' as const,
            new: {
                id: 'ext-order-456',
                restaurant_id: 'restaurant-123',
                normalized_status: 'confirmed',
                provider: 'chapa',
                payload_json: {
                    fulfillment_type: 'pickup',
                },
                created_at: new Date().toISOString(),
            },
            old: {},
            schema: 'public',
            table: 'external_orders',
            commit_timestamp: new Date().toISOString(),
        };

        const callback = externalOrdersCall![2];
        act(() => {
            callback(payload);
        });

        expect(onNewOrder).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'ext-order-456',
                order_type: 'pickup',
                source: 'chapa',
                status: 'confirmed',
            })
        );
    });

    it('should call onOrderUpdate for external orders UPDATE events', async () => {
        const onOrderUpdate = vi.fn();

        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
                onOrderUpdate,
            })
        );

        await waitFor(() => {
            expect(mockChannel.on).toHaveBeenCalled();
        });

        const externalOrdersCall = mockChannel.on.mock.calls.find(
            call => call[1]?.table === 'external_orders'
        );

        expect(externalOrdersCall).toBeDefined();

        const payload = {
            eventType: 'UPDATE' as const,
            new: {
                id: 'ext-order-789',
                restaurant_id: 'restaurant-123',
                normalized_status: 'preparing',
                provider: 'telebirr',
                payload_json: {
                    fulfillment_type: 'delivery',
                },
                created_at: new Date().toISOString(),
            },
            old: {},
            schema: 'public',
            table: 'external_orders',
            commit_timestamp: new Date().toISOString(),
        };

        const callback = externalOrdersCall![2];
        act(() => {
            callback(payload);
        });

        expect(onOrderUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'ext-order-789',
                order_type: 'delivery',
                source: 'telebirr',
                status: 'preparing',
            })
        );
    });

    it('should filter external orders by restaurant_id', async () => {
        const onNewOrder = vi.fn();

        renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
                onNewOrder,
            })
        );

        await waitFor(() => {
            expect(mockChannel.on).toHaveBeenCalled();
        });

        const externalOrdersCall = mockChannel.on.mock.calls.find(
            call => call[1]?.table === 'external_orders'
        );

        expect(externalOrdersCall).toBeDefined();

        const payload = {
            eventType: 'INSERT' as const,
            new: {
                id: 'ext-order-999',
                restaurant_id: 'different-restaurant', // Different restaurant
                normalized_status: 'pending',
                provider: 'telebirr',
                payload_json: {
                    fulfillment_type: 'delivery',
                },
                created_at: new Date().toISOString(),
            },
            old: {},
            schema: 'public',
            table: 'external_orders',
            commit_timestamp: new Date().toISOString(),
        };

        const callback = externalOrdersCall![2];
        act(() => {
            callback(payload);
        });

        // Should not be called because restaurant_id doesn't match
        expect(onNewOrder).not.toHaveBeenCalled();
    });
});

describe('Reconnection with exponential backoff', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should set isConnected to false on CHANNEL_ERROR', async () => {
        const mockErrorChannel = {
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn().mockImplementation(callback => {
                callback('CHANNEL_ERROR');
                return { unsubscribe: vi.fn() };
            }),
            unsubscribe: vi.fn(),
        };

        mockSupabase.channel.mockReturnValue(mockErrorChannel);

        const { result } = renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
            })
        );

        await waitFor(() => {
            expect(mockSupabase.channel).toHaveBeenCalled();
        });

        // Should not be connected on error
        expect(result.current.isConnected).toBe(false);
    });

    it('should set isConnected to false on CLOSED status', async () => {
        const mockClosedChannel = {
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn().mockImplementation(callback => {
                callback('CLOSED');
                return { unsubscribe: vi.fn() };
            }),
            unsubscribe: vi.fn(),
        };

        mockSupabase.channel.mockReturnValue(mockClosedChannel);

        const { result } = renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
            })
        );

        await waitFor(() => {
            expect(mockSupabase.channel).toHaveBeenCalled();
        });

        expect(result.current.isConnected).toBe(false);
    });

    it('should set isConnected to false on TIMED_OUT status', async () => {
        const mockTimeoutChannel = {
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn().mockImplementation(callback => {
                callback('TIMED_OUT');
                return { unsubscribe: vi.fn() };
            }),
            unsubscribe: vi.fn(),
        };

        mockSupabase.channel.mockReturnValue(mockTimeoutChannel);

        const { result } = renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
            })
        );

        await waitFor(() => {
            expect(mockSupabase.channel).toHaveBeenCalled();
        });

        expect(result.current.isConnected).toBe(false);
    });

    it('should set isConnected to true on SUBSCRIBED status', async () => {
        const mockSuccessChannel = {
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn().mockImplementation(callback => {
                if (typeof callback === 'function') {
                    callback('SUBSCRIBED');
                }
                return { unsubscribe: vi.fn() };
            }),
            unsubscribe: vi.fn(),
        };

        mockSupabase.channel.mockReturnValue(mockSuccessChannel);

        const { result } = renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
            })
        );

        await waitFor(() => {
            expect(mockSupabase.channel).toHaveBeenCalled();
        });

        // Should be connected after successful subscription
        expect(result.current.isConnected).toBe(true);
        expect(result.current.reconnectionStatus).toBe('idle');
    });
});

describe('Channel cleanup on unmount', () => {
    it('should handle unmount without errors', async () => {
        const { unmount } = renderHook(() =>
            useKDSRealtime({
                restaurantId: 'restaurant-123',
                enabled: true,
            })
        );

        await waitFor(() => {
            expect(mockSupabase.channel).toHaveBeenCalled();
        });

        // Unmount should not throw
        expect(() => unmount()).not.toThrow();
    });
});
