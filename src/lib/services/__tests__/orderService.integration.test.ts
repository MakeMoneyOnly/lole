/**
 * Integration tests for order service layer
 *
 * These tests cover the orderService.ts module which is excluded from coverage
 * due to requiring database/Supabase connections.
 *
 * Uses mocks to simulate Supabase behavior without requiring actual connections.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
    validateOrderItems,
    checkRateLimit,
    checkDuplicateOrder,
    createOrder,
    generateGuestFingerprint,
    generateIdempotencyKey,
} from '../orderService';

// Mock the queries module
vi.mock('@/lib/supabase/queries', () => ({
    getOrderByIdempotencyKey: vi.fn(),
    insertOrder: vi.fn(),
    fetchItemsForValidation: vi.fn(),
}));

import {
    fetchItemsForValidation,
    getOrderByIdempotencyKey,
    insertOrder,
} from '@/lib/supabase/queries';

// Type for mocked Supabase client
type MockSupabase = ReturnType<typeof vi.fn> & {
    from: ReturnType<typeof vi.fn>;
    auth: {
        getUser: ReturnType<typeof vi.fn>;
    };
};

describe('orderService integration tests', () => {
    let mockSupabase: MockSupabase;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create a mock Supabase client
        mockSupabase = vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            single: vi.fn(),
            maybeSingle: vi.fn(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            count: vi.fn(),
        })) as MockSupabase;

        mockSupabase.from = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            single: vi.fn(),
            maybeSingle: vi.fn(),
            count: vi.fn(),
        });

        mockSupabase.auth = {
            getUser: vi.fn(),
        };
    });

    describe('validateOrderItems', () => {
        it('should validate items when all items exist and are available', async () => {
            // Arrange
            const items = [
                { id: 'item-1', name: 'Burger', quantity: 2, price: 10.0 },
                { id: 'item-2', name: 'Fries', quantity: 1, price: 5.0 },
            ];

            const mockDbItems = [
                { id: 'item-1', price: 10.0, is_available: true, station: 'grill', course: 'main' },
                { id: 'item-2', price: 5.0, is_available: true, station: 'fryer', course: 'side' },
            ];

            (fetchItemsForValidation as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: mockDbItems,
                error: null,
            });

            // Act
            const result = await validateOrderItems(
                mockSupabase as unknown as SupabaseClient<Database>,
                items,
                25.0, // claimed total: 2*10 + 1*5 = 25
                0
            );

            // Assert
            expect(result.isValid).toBe(true);
            expect(result.calculatedTotal).toBe(25);
            expect(result.enrichedItems).toHaveLength(2);
            expect(result.enrichedItems?.[0].station).toBe('grill');
            expect(result.enrichedItems?.[1].course).toBe('side');
        });

        it('should reject when items are not found in database', async () => {
            // Arrange
            const items = [{ id: 'item-1', name: 'Burger', quantity: 1, price: 10.0 }];

            (fetchItemsForValidation as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: [], // No items found
                error: null,
            });

            // Act
            const result = await validateOrderItems(
                mockSupabase as unknown as SupabaseClient<Database>,
                items,
                10.0,
                0
            );

            // Assert
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should reject when an item is sold out', async () => {
            // Arrange
            const items = [{ id: 'item-1', name: 'Burger', quantity: 1, price: 10.0 }];

            (fetchItemsForValidation as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: [
                    {
                        id: 'item-1',
                        price: 10.0,
                        is_available: false,
                        station: 'grill',
                        course: 'main',
                    },
                ],
                error: null,
            });

            // Act
            const result = await validateOrderItems(
                mockSupabase as unknown as SupabaseClient<Database>,
                items,
                10.0,
                0
            );

            // Assert
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('sold out');
        });

        it('should reject when price does not match', async () => {
            // Arrange
            const items = [
                { id: 'item-1', name: 'Burger', quantity: 1, price: 15.0 }, // Client claims 15
            ];

            (fetchItemsForValidation as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: [
                    {
                        id: 'item-1',
                        price: 10.0,
                        is_available: true,
                        station: 'grill',
                        course: 'main',
                    },
                ],
                error: null,
            });

            // Act
            const result = await validateOrderItems(
                mockSupabase as unknown as SupabaseClient<Database>,
                items,
                15.0, // Claimed total
                0
            );

            // Assert
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Price mismatch');
        });

        it('should apply discount correctly', async () => {
            // Arrange
            const items = [{ id: 'item-1', name: 'Burger', quantity: 1, price: 10.0 }];

            (fetchItemsForValidation as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: [
                    {
                        id: 'item-1',
                        price: 10.0,
                        is_available: true,
                        station: 'grill',
                        course: 'main',
                    },
                ],
                error: null,
            });

            // Act - claiming 8 (10 - 2 discount)
            const result = await validateOrderItems(
                mockSupabase as unknown as SupabaseClient<Database>,
                items,
                8.0,
                2.0 // Discount
            );

            // Assert
            expect(result.isValid).toBe(true);
            expect(result.calculatedTotal).toBe(10);
        });

        it('should handle database errors gracefully', async () => {
            // Arrange
            const items = [{ id: 'item-1', name: 'Burger', quantity: 1, price: 10.0 }];

            (fetchItemsForValidation as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: null,
                error: { message: 'Database error', code: 'ERROR' },
            });

            // Act
            const result = await validateOrderItems(
                mockSupabase as unknown as SupabaseClient<Database>,
                items,
                10.0,
                0
            );

            // Assert
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Failed to validate');
        });
    });

    describe('checkRateLimit', () => {
        // Helper to create a proper mock chain for Supabase queries
        // The query chain is: from -> select -> eq -> gt -> returns { count, error }
        const createMockChain = (count: number | null, hasError = false): React.JSX.Element => {
            // Create the final result that returns { count, error }
            const countResult = {
                count,
                error: hasError ? { message: 'Error' } : null,
            };

            // Build chain: gt returns count result, eq returns gt, select returns eq, from returns select
            const gtMock = vi.fn().mockReturnValue(countResult);
            const eqMock = vi.fn().mockReturnValue({ gt: gtMock });
            const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
            const fromMock = vi.fn().mockReturnValue({ select: selectMock });

            mockSupabase.from = fromMock;
        };

        it('should allow orders when under the limit', async () => {
            // Arrange
            createMockChain(2);

            // Act
            const result = await checkRateLimit(
                mockSupabase as unknown as SupabaseClient<Database>,
                'fingerprint-123'
            );

            // Assert
            expect(result.allowed).toBe(true);
            expect(result.remainingOrders).toBe(3); // 5 - 2
        });

        it('should deny orders when at the limit', async () => {
            // Arrange
            createMockChain(5);

            // Act
            const result = await checkRateLimit(
                mockSupabase as unknown as SupabaseClient<Database>,
                'fingerprint-123',
                5, // maxOrders
                10 // windowMinutes
            );

            // Assert
            expect(result.allowed).toBe(false);
            expect(result.remainingOrders).toBe(0);
        });

        it('should fail open when rate limit check fails', async () => {
            // Arrange
            createMockChain(null, true);

            // Act
            const result = await checkRateLimit(
                mockSupabase as unknown as SupabaseClient<Database>,
                'fingerprint-123'
            );

            // Assert - should fail open (allow)
            expect(result.allowed).toBe(true);
        });

        it('should return correct reset time', async () => {
            // Arrange
            createMockChain(0);
            const fromMock = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                gt: vi.fn().mockReturnThis(),
                count: vi.fn().mockResolvedValue({ count: 0, error: null }),
            });

            mockSupabase.from = fromMock;
            const beforeTime = Date.now();

            // Act
            const result = await checkRateLimit(
                mockSupabase as unknown as SupabaseClient<Database>,
                'fingerprint-123',
                5,
                10
            );

            // Assert
            expect(result.resetTime).toBeDefined();
            expect(result.resetTime!.getTime()).toBeGreaterThan(beforeTime);
        });
    });

    describe('checkDuplicateOrder', () => {
        it('should return existing order when idempotency key matches', async () => {
            // Arrange
            const existingOrder = { id: 'order-123', status: 'pending' as const };

            (getOrderByIdempotencyKey as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: existingOrder,
                error: null,
            });

            // Act
            const result = await checkDuplicateOrder(
                mockSupabase as unknown as SupabaseClient<Database>,
                'idempotency-key-123'
            );

            // Assert
            expect(result).toEqual(existingOrder);
        });

        it('should return null when no duplicate found', async () => {
            // Arrange
            (getOrderByIdempotencyKey as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: null,
                error: null,
            });

            // Act
            const result = await checkDuplicateOrder(
                mockSupabase as unknown as SupabaseClient<Database>,
                'new-idempotency-key'
            );

            // Assert
            expect(result).toBeNull();
        });

        it('should return null on database error', async () => {
            // Arrange
            (getOrderByIdempotencyKey as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: null,
                error: { message: 'Error' },
            });

            // Act
            const result = await checkDuplicateOrder(
                mockSupabase as unknown as SupabaseClient<Database>,
                'key'
            );

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('createOrder', () => {
        it('should create a new order successfully', async () => {
            // Arrange
            const orderData = {
                restaurant_id: 'restaurant-123',
                table_number: 'Table 5',
                items: [{ id: 'item-1', name: 'Burger', quantity: 2, price: 10.0 }],
                total_price: 20.0,
                notes: 'No onions',
                idempotency_key: 'new-idemp-key',
                guest_fingerprint: 'fp-123',
            };

            // Mock checkDuplicateOrder - returns null (no duplicate)
            (getOrderByIdempotencyKey as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: null,
                error: null,
            });

            // Mock validateOrderItems - returns valid
            (fetchItemsForValidation as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: [
                    {
                        id: 'item-1',
                        price: 10.0,
                        is_available: true,
                        station: 'grill',
                        course: 'main',
                    },
                ],
                error: null,
            });

            // Mock insertOrder - returns success
            (insertOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: {
                    id: 'new-order-id',
                    restaurant_id: 'restaurant-123',
                    table_number: 'Table 5',
                    items: [{ id: 'item-1', name: 'Burger', quantity: 2, price: 10.0 }],
                    total_price: 20.0,
                    status: 'pending',
                },
                error: null,
            });

            // Act
            const result = await createOrder(
                mockSupabase as unknown as SupabaseClient<Database>,
                orderData
            );

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.order).toBeDefined();
                expect(result.order.id).toBe('new-order-id');
                expect(result.order.status).toBe('pending');
            }
        });

        it('should return existing order for duplicate idempotency key', async () => {
            // Arrange
            const orderData = {
                restaurant_id: 'restaurant-123',
                table_number: 'Table 5',
                items: [{ id: 'item-1', name: 'Burger', quantity: 1, price: 10.0 }],
                total_price: 10.0,
                idempotency_key: 'existing-key',
                guest_fingerprint: 'fp-123',
            };

            // Mock checkDuplicateOrder - returns existing order
            (getOrderByIdempotencyKey as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: { id: 'existing-order', status: 'pending' as const },
                error: null,
            });

            // Mock supabase.from().select().eq().single() for fetching full order
            const fromMock = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                    data: { id: 'existing-order', status: 'pending' },
                    error: null,
                }),
            });
            mockSupabase.from = fromMock;

            // Act
            const result = await createOrder(
                mockSupabase as unknown as SupabaseClient<Database>,
                orderData
            );

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.order.id).toBe('existing-order');
            }
            // Should not call validate or insert
            expect(fetchItemsForValidation).not.toHaveBeenCalled();
            expect(insertOrder).not.toHaveBeenCalled();
        });

        it('should fail when item validation fails', async () => {
            // Arrange
            const orderData = {
                restaurant_id: 'restaurant-123',
                table_number: 'Table 5',
                items: [{ id: 'item-1', name: 'Burger', quantity: 1, price: 10.0 }],
                total_price: 10.0,
                idempotency_key: 'new-key',
                guest_fingerprint: 'fp-123',
            };

            // Mock checkDuplicateOrder - no duplicate
            (getOrderByIdempotencyKey as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: null,
                error: null,
            });

            // Mock validateOrderItems - returns invalid
            (fetchItemsForValidation as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: [],
                error: null,
            });

            // Act
            const result = await createOrder(
                mockSupabase as unknown as SupabaseClient<Database>,
                orderData
            );

            // Assert - validation returns "Items not found" error
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toContain('not found');
            }
            expect(insertOrder).not.toHaveBeenCalled();
        });

        it('should fail when insert fails', async () => {
            // Arrange
            const orderData = {
                restaurant_id: 'restaurant-123',
                table_number: 'Table 5',
                items: [{ id: 'item-1', name: 'Burger', quantity: 1, price: 10.0 }],
                total_price: 10.0,
                idempotency_key: 'new-key',
                guest_fingerprint: 'fp-123',
            };

            // Mock checkDuplicateOrder - no duplicate
            (getOrderByIdempotencyKey as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: null,
                error: null,
            });

            // Mock validateOrderItems - valid
            (fetchItemsForValidation as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: [
                    {
                        id: 'item-1',
                        price: 10.0,
                        is_available: true,
                        station: 'grill',
                        course: 'main',
                    },
                ],
                error: null,
            });

            // Mock insertOrder - fails
            (insertOrder as ReturnType<typeof vi.fn>).mockResolvedValue({
                data: null,
                error: { message: 'Insert failed' },
            });

            // Act
            const result = await createOrder(
                mockSupabase as unknown as SupabaseClient<Database>,
                orderData
            );

            // Assert - insert returns its own error message
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeTruthy();
            }
        });
    });

    describe('generateGuestFingerprint', () => {
        it('should generate SHA-256 hash from IP and user agent', () => {
            const fp = generateGuestFingerprint('192.168.1.100', 'Mozilla/5.0');
            // HIGH-003: Returns SHA-256 hash (64 hex characters) for security
            expect(fp).toMatch(/^[a-f0-9]{64}$/);
            // Same inputs should produce same hash (deterministic)
            const fp2 = generateGuestFingerprint('192.168.1.100', 'Mozilla/5.0');
            expect(fp).toBe(fp2);
        });

        it('should handle null user agent', () => {
            const fp = generateGuestFingerprint('10.0.0.1', null);
            // Should still return a valid SHA-256 hash
            expect(fp).toMatch(/^[a-f0-9]{64}$/);
            // Should be deterministic
            const fp2 = generateGuestFingerprint('10.0.0.1', null);
            expect(fp).toBe(fp2);
        });

        it('should handle empty string user agent', () => {
            const fp = generateGuestFingerprint('10.0.0.1', '');
            // Should still return a valid SHA-256 hash
            expect(fp).toMatch(/^[a-f0-9]{64}$/);
            // Empty string and null should produce the same result
            const fpNull = generateGuestFingerprint('10.0.0.1', null);
            expect(fp).toBe(fpNull);
        });
    });

    describe('generateIdempotencyKey', () => {
        it('should generate valid UUID', () => {
            const key = generateIdempotencyKey();
            expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        });

        it('should generate unique keys', () => {
            const key1 = generateIdempotencyKey();
            const key2 = generateIdempotencyKey();
            expect(key1).not.toBe(key2);
        });
    });
});
