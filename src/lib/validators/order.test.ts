import { describe, it, expect } from 'vitest';
import { OrderItemSchema, CreateOrderSchema, UpdateOrderStatusSchema } from './order';

/**
 * Order Validation Schema Tests
 *
 * Addresses PLATFORM_AUDIT_REPORT finding TEST-001: Input Validation Testing
 */

describe('OrderItemSchema', () => {
    it('should validate a valid order item', () => {
        const validItem = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Test Item',
            quantity: 2,
            price: 10.99,
            notes: 'Extra spicy',
            station: 'kitchen' as const,
        };

        const result = OrderItemSchema.safeParse(validItem);
        expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
        const invalidItem = {
            id: 'not-a-uuid',
            name: 'Test Item',
            quantity: 2,
            price: 10.99,
        };

        const result = OrderItemSchema.safeParse(invalidItem);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Invalid item ID');
        }
    });

    it('should reject empty name', () => {
        const invalidItem = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: '',
            quantity: 2,
            price: 10.99,
        };

        const result = OrderItemSchema.safeParse(invalidItem);
        expect(result.success).toBe(false);
    });

    it('should reject name too long', () => {
        const invalidItem = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'a'.repeat(201),
            quantity: 2,
            price: 10.99,
        };

        const result = OrderItemSchema.safeParse(invalidItem);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Item name too long');
        }
    });

    it('should reject quantity less than 1', () => {
        const invalidItem = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Test Item',
            quantity: 0,
            price: 10.99,
        };

        const result = OrderItemSchema.safeParse(invalidItem);
        expect(result.success).toBe(false);
    });

    it('should reject quantity more than 100', () => {
        const invalidItem = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Test Item',
            quantity: 101,
            price: 10.99,
        };

        const result = OrderItemSchema.safeParse(invalidItem);
        expect(result.success).toBe(false);
    });

    it('should reject negative price', () => {
        const invalidItem = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Test Item',
            quantity: 2,
            price: -10.99,
        };

        const result = OrderItemSchema.safeParse(invalidItem);
        expect(result.success).toBe(false);
    });

    it('should reject notes too long', () => {
        const invalidItem = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Test Item',
            quantity: 2,
            price: 10.99,
            notes: 'a'.repeat(501),
        };

        const result = OrderItemSchema.safeParse(invalidItem);
        expect(result.success).toBe(false);
    });

    it('should accept valid station values', () => {
        const stations = ['kitchen', 'bar', 'dessert', 'coffee'] as const;

        for (const station of stations) {
            const item = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                name: 'Test Item',
                quantity: 2,
                price: 10.99,
                station,
            };

            const result = OrderItemSchema.safeParse(item);
            expect(result.success).toBe(true);
        }
    });

    it('should reject invalid station value', () => {
        const invalidItem = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Test Item',
            quantity: 2,
            price: 10.99,
            station: 'invalid-station',
        };

        const result = OrderItemSchema.safeParse(invalidItem);
        expect(result.success).toBe(false);
    });
});

describe('CreateOrderSchema', () => {
    const validOrder = {
        restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
        table_number: '5',
        items: [
            {
                id: '550e8400-e29b-41d4-a716-446655440001',
                name: 'Test Item',
                quantity: 2,
                price: 10.99,
            },
        ],
        total_price: 21.98,
        notes: 'Test order notes',
        idempotency_key: '550e8400-e29b-41d4-a716-446655440002',
    };

    it('should validate a valid order', () => {
        const result = CreateOrderSchema.safeParse(validOrder);
        expect(result.success).toBe(true);
    });

    it('should reject invalid restaurant_id', () => {
        const invalidOrder = {
            ...validOrder,
            restaurant_id: 'not-a-uuid',
        };

        const result = CreateOrderSchema.safeParse(invalidOrder);
        expect(result.success).toBe(false);
    });

    it('should reject empty table_number', () => {
        const invalidOrder = {
            ...validOrder,
            table_number: '',
        };

        const result = CreateOrderSchema.safeParse(invalidOrder);
        expect(result.success).toBe(false);
    });

    it('should reject table_number too long', () => {
        const invalidOrder = {
            ...validOrder,
            table_number: 'a'.repeat(21),
        };

        const result = CreateOrderSchema.safeParse(invalidOrder);
        expect(result.success).toBe(false);
    });

    it('should reject empty items array', () => {
        const invalidOrder = {
            ...validOrder,
            items: [],
        };

        const result = CreateOrderSchema.safeParse(invalidOrder);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('At least one item is required');
        }
    });

    it('should reject too many items', () => {
        const invalidOrder = {
            ...validOrder,
            items: Array(51).fill(validOrder.items[0]),
        };

        const result = CreateOrderSchema.safeParse(invalidOrder);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('Maximum 50 items per order');
        }
    });

    it('should reject negative total_price', () => {
        const invalidOrder = {
            ...validOrder,
            total_price: -10,
        };

        const result = CreateOrderSchema.safeParse(invalidOrder);
        expect(result.success).toBe(false);
    });

    it('should reject notes too long', () => {
        const invalidOrder = {
            ...validOrder,
            notes: 'a'.repeat(1001),
        };

        const result = CreateOrderSchema.safeParse(invalidOrder);
        expect(result.success).toBe(false);
    });

    it('should reject invalid idempotency_key', () => {
        const invalidOrder = {
            ...validOrder,
            idempotency_key: 'not-a-uuid',
        };

        const result = CreateOrderSchema.safeParse(invalidOrder);
        expect(result.success).toBe(false);
    });

    it('should accept order without optional notes', () => {
        const orderWithoutNotes = {
            restaurant_id: validOrder.restaurant_id,
            table_number: validOrder.table_number,
            items: validOrder.items,
            total_price: validOrder.total_price,
            idempotency_key: validOrder.idempotency_key,
        };

        const result = CreateOrderSchema.safeParse(orderWithoutNotes);
        expect(result.success).toBe(true);
    });
});

describe('UpdateOrderStatusSchema', () => {
    it('should validate valid status update', () => {
        const validUpdate = {
            order_id: '550e8400-e29b-41d4-a716-446655440000',
            status: 'preparing' as const,
            restaurant_id: '550e8400-e29b-41d4-a716-446655440001',
        };

        const result = UpdateOrderStatusSchema.safeParse(validUpdate);
        expect(result.success).toBe(true);
    });

    it('should accept all valid status values', () => {
        const statuses = [
            'pending',
            'preparing',
            'ready',
            'served',
            'closed',
            'cancelled',
        ] as const;

        for (const status of statuses) {
            const update = {
                order_id: '550e8400-e29b-41d4-a716-446655440000',
                status,
                restaurant_id: '550e8400-e29b-41d4-a716-446655440001',
            };

            const result = UpdateOrderStatusSchema.safeParse(update);
            expect(result.success).toBe(true);
        }
    });

    it('should reject invalid status', () => {
        const invalidUpdate = {
            order_id: '550e8400-e29b-41d4-a716-446655440000',
            status: 'invalid-status',
            restaurant_id: '550e8400-e29b-41d4-a716-446655440001',
        };

        const result = UpdateOrderStatusSchema.safeParse(invalidUpdate);
        expect(result.success).toBe(false);
    });

    it('should reject invalid order_id', () => {
        const invalidUpdate = {
            order_id: 'not-a-uuid',
            status: 'preparing',
            restaurant_id: '550e8400-e29b-41d4-a716-446655440001',
        };

        const result = UpdateOrderStatusSchema.safeParse(invalidUpdate);
        expect(result.success).toBe(false);
    });

    it('should reject invalid restaurant_id', () => {
        const invalidUpdate = {
            order_id: '550e8400-e29b-41d4-a716-446655440000',
            status: 'preparing',
            restaurant_id: 'not-a-uuid',
        };

        const result = UpdateOrderStatusSchema.safeParse(invalidUpdate);
        expect(result.success).toBe(false);
    });
});
