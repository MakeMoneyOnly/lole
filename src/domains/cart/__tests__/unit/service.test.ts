import { describe, it, expect, beforeEach } from 'vitest';
import { CartService, CartItem } from '../../service';

describe('CartService', () => {
    let service: CartService;

    beforeEach(() => {
        service = new CartService();
    });

    describe('addItem', () => {
        it('adds a new item to an empty cart', () => {
            const result = service.addItem([], {
                menuItemId: 'item-1',
                title: 'Burger',
                price: 10.5,
            });

            expect(result).toHaveLength(1);
            expect(result[0].menuItemId).toBe('item-1');
            expect(result[0].title).toBe('Burger');
            expect(result[0].price).toBe(10.5);
            expect(result[0].quantity).toBe(1);
            expect(result[0].uniqueId).toBeDefined();
        });

        it('adds a new item with custom quantity', () => {
            const result = service.addItem([], {
                menuItemId: 'item-1',
                title: 'Fries',
                price: 5,
                quantity: 3,
            });

            expect(result).toHaveLength(1);
            expect(result[0].quantity).toBe(3);
        });

        it('increments quantity for identical item (same menuItemId and instructions)', () => {
            const existingItems: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Burger',
                    price: 10,
                    quantity: 1,
                    instructions: 'No pickles',
                },
            ];

            const result = service.addItem(existingItems, {
                menuItemId: 'item-1',
                title: 'Burger',
                price: 10,
                instructions: 'No pickles',
            });

            expect(result).toHaveLength(1);
            expect(result[0].quantity).toBe(2);
            expect(result[0].uniqueId).toBe('uid-1');
        });

        it('creates separate item when instructions differ', () => {
            const existingItems: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Burger',
                    price: 10,
                    quantity: 1,
                    instructions: 'No pickles',
                },
            ];

            const result = service.addItem(existingItems, {
                menuItemId: 'item-1',
                title: 'Burger',
                price: 10,
                instructions: 'Extra cheese',
            });

            expect(result).toHaveLength(2);
            expect(result[0].instructions).toBe('No pickles');
            expect(result[1].instructions).toBe('Extra cheese');
        });

        it('adds item with course property', () => {
            const result = service.addItem([], {
                menuItemId: 'item-1',
                title: 'Salad',
                price: 8,
                course: 'appetizer',
            });

            expect(result[0].course).toBe('appetizer');
        });

        it('adds item with image property', () => {
            const result = service.addItem([], {
                menuItemId: 'item-1',
                title: 'Pizza',
                price: 12,
                image: 'https://example.com/pizza.jpg',
            });

            expect(result[0].image).toBe('https://example.com/pizza.jpg');
        });
    });

    describe('removeItem', () => {
        it('removes item by uniqueId', () => {
            const items: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Burger',
                    price: 10,
                    quantity: 1,
                },
                { menuItemId: 'item-2', uniqueId: 'uid-2', title: 'Fries', price: 5, quantity: 1 },
            ];

            const result = service.removeItem(items, 'uid-1');

            expect(result).toHaveLength(1);
            expect(result[0].uniqueId).toBe('uid-2');
        });

        it('returns unchanged cart when uniqueId not found', () => {
            const items: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Burger',
                    price: 10,
                    quantity: 1,
                },
            ];

            const result = service.removeItem(items, 'non-existent');

            expect(result).toHaveLength(1);
        });

        it('returns empty array when removing last item', () => {
            const items: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Burger',
                    price: 10,
                    quantity: 1,
                },
            ];

            const result = service.removeItem(items, 'uid-1');

            expect(result).toHaveLength(0);
        });
    });

    describe('updateQuantity', () => {
        it('increases quantity by delta', () => {
            const items: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Burger',
                    price: 10,
                    quantity: 1,
                },
            ];

            const result = service.updateQuantity(items, 'uid-1', 2);

            expect(result[0].quantity).toBe(3);
        });

        it('decreases quantity by delta', () => {
            const items: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Burger',
                    price: 10,
                    quantity: 5,
                },
            ];

            const result = service.updateQuantity(items, 'uid-1', -2);

            expect(result[0].quantity).toBe(3);
        });

        it('removes item when quantity becomes zero', () => {
            const items: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Burger',
                    price: 10,
                    quantity: 2,
                },
            ];

            const result = service.updateQuantity(items, 'uid-1', -2);

            expect(result).toHaveLength(0);
        });

        it('removes item when quantity would go negative', () => {
            const items: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Burger',
                    price: 10,
                    quantity: 1,
                },
            ];

            const result = service.updateQuantity(items, 'uid-1', -5);

            expect(result).toHaveLength(0);
        });

        it('leaves other items unchanged', () => {
            const items: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Burger',
                    price: 10,
                    quantity: 1,
                },
                { menuItemId: 'item-2', uniqueId: 'uid-2', title: 'Fries', price: 5, quantity: 3 },
            ];

            const result = service.updateQuantity(items, 'uid-1', 1);

            expect(result).toHaveLength(2);
            expect(result[0].quantity).toBe(2);
            expect(result[1].quantity).toBe(3);
        });

        it('returns unchanged cart when uniqueId not found', () => {
            const items: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Burger',
                    price: 10,
                    quantity: 1,
                },
            ];

            const result = service.updateQuantity(items, 'non-existent', 1);

            expect(result).toHaveLength(1);
            expect(result[0].quantity).toBe(1);
        });
    });

    describe('updateInstructions', () => {
        it('updates instructions for an item', () => {
            const items: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Burger',
                    price: 10,
                    quantity: 1,
                },
            ];

            const result = service.updateInstructions(items, 'uid-1', 'No onions, extra sauce');

            expect(result[0].instructions).toBe('No onions, extra sauce');
        });

        it('preserves other item properties', () => {
            const items: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Burger',
                    price: 10,
                    quantity: 2,
                },
            ];

            const result = service.updateInstructions(items, 'uid-1', 'Well done');

            expect(result[0].title).toBe('Burger');
            expect(result[0].price).toBe(10);
            expect(result[0].quantity).toBe(2);
            expect(result[0].menuItemId).toBe('item-1');
        });

        it('returns unchanged cart when uniqueId not found', () => {
            const items: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Burger',
                    price: 10,
                    quantity: 1,
                },
            ];

            const result = service.updateInstructions(items, 'non-existent', 'New instructions');

            expect(result[0].instructions).toBeUndefined();
        });
    });

    describe('clearCart', () => {
        it('returns empty array', () => {
            const result = service.clearCart();

            expect(result).toEqual([]);
        });
    });

    describe('calculateTotals', () => {
        it('returns zero totals for empty cart', () => {
            const result = service.calculateTotals([]);

            expect(result.total).toBe(0);
            expect(result.count).toBe(0);
        });

        it('calculates total and count for single item', () => {
            const items: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Burger',
                    price: 10,
                    quantity: 2,
                },
            ];

            const result = service.calculateTotals(items);

            expect(result.total).toBe(20);
            expect(result.count).toBe(2);
        });

        it('calculates total and count for multiple items', () => {
            const items: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Burger',
                    price: 10,
                    quantity: 2,
                },
                { menuItemId: 'item-2', uniqueId: 'uid-2', title: 'Fries', price: 5, quantity: 1 },
                { menuItemId: 'item-3', uniqueId: 'uid-3', title: 'Drink', price: 3, quantity: 3 },
            ];

            const result = service.calculateTotals(items);

            expect(result.total).toBe(34);
            expect(result.count).toBe(6);
        });

        it('handles decimal prices correctly', () => {
            const items: CartItem[] = [
                {
                    menuItemId: 'item-1',
                    uniqueId: 'uid-1',
                    title: 'Pizza',
                    price: 12.99,
                    quantity: 2,
                },
            ];

            const result = service.calculateTotals(items);

            expect(result.total).toBeCloseTo(25.98);
        });
    });
});
