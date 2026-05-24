import { describe, it, expect } from 'vitest';
import { calculateDiscount } from './calculator';
import type { DiscountRecord, DiscountOrderItemInput } from './types';

const baseDiscount: DiscountRecord = {
    id: 'disc-1',
    restaurant_id: 'rest-1',
    name: 'Test Discount',
    name_am: null,
    type: 'percentage',
    value: 1000, // 10% in basis points
    applies_to: 'order',
    target_menu_item_id: null,
    target_category_id: null,
    requires_manager_pin: false,
    max_uses_per_day: null,
    valid_from: null,
    valid_until: null,
    is_active: true,
};

const items: DiscountOrderItemInput[] = [
    { id: 'item-1', category_id: 'cat-1', price: 100, quantity: 2 },
    { id: 'item-2', category_id: 'cat-2', price: 50, quantity: 3 },
];

describe('calculateDiscount', () => {
    describe('no discount', () => {
        it('returns subtotal as total when discount is null', () => {
            const result = calculateDiscount(items, null);
            expect(result.subtotal).toBe(350); // 2*100 + 3*50
            expect(result.total).toBe(350);
            expect(result.discountAmount).toBe(0);
            expect(result.applied).toBe(false);
        });

        it('handles empty items list', () => {
            const result = calculateDiscount([], null);
            expect(result.subtotal).toBe(0);
            expect(result.total).toBe(0);
            expect(result.discountAmount).toBe(0);
        });
    });

    describe('percentage discount', () => {
        it('applies percentage discount to full order', () => {
            const result = calculateDiscount(items, {
                ...baseDiscount,
                type: 'percentage',
                value: 1000,
            }); // 10%
            expect(result.subtotal).toBe(350);
            expect(result.discountAmount).toBeCloseTo(35, 1);
            expect(result.total).toBeCloseTo(315, 1);
            expect(result.applied).toBe(true);
        });

        it('applies 20% discount correctly', () => {
            const result = calculateDiscount(items, {
                ...baseDiscount,
                type: 'percentage',
                value: 2000,
            }); // 20%
            expect(result.discountAmount).toBeCloseTo(70, 1);
            expect(result.total).toBeCloseTo(280, 1);
        });

        it('does not exceed subtotal', () => {
            const result = calculateDiscount(items, {
                ...baseDiscount,
                type: 'percentage',
                value: 15000,
            }); // 150%
            expect(result.discountAmount).toBe(result.subtotal);
            expect(result.total).toBe(0);
        });
    });

    describe('fixed_amount discount', () => {
        it('applies fixed amount discount', () => {
            const result = calculateDiscount(items, {
                ...baseDiscount,
                type: 'fixed_amount',
                value: 50,
            });
            expect(result.discountAmount).toBe(50);
            expect(result.total).toBe(300);
            expect(result.applied).toBe(true);
        });

        it('caps fixed discount at subtotal', () => {
            const result = calculateDiscount(items, {
                ...baseDiscount,
                type: 'fixed_amount',
                value: 1000, // more than subtotal
            });
            expect(result.discountAmount).toBe(350); // capped at subtotal
            expect(result.total).toBe(0);
        });
    });

    describe('bogo discount', () => {
        it('applies BOGO (buy one get one) discount', () => {
            const bogoItems: DiscountOrderItemInput[] = [
                { id: 'item-1', category_id: 'cat-1', price: 100, quantity: 2 },
            ];
            const result = calculateDiscount(bogoItems, {
                ...baseDiscount,
                type: 'bogo',
                applies_to: 'item',
                target_menu_item_id: 'item-1',
            });
            // 2 items at 100 each, buy 1 get 1 = 1 free (cheapest)
            expect(result.discountAmount).toBe(100);
            expect(result.total).toBe(100);
            expect(result.applied).toBe(true);
        });

        it('gives floor(n/2) free items', () => {
            const bogoItems: DiscountOrderItemInput[] = [
                { id: 'item-1', category_id: 'cat-1', price: 100, quantity: 3 },
            ];
            const result = calculateDiscount(bogoItems, {
                ...baseDiscount,
                type: 'bogo',
                applies_to: 'item',
                target_menu_item_id: 'item-1',
            });
            // 3 items, floor(3/2) = 1 free
            expect(result.discountAmount).toBe(100);
            expect(result.total).toBe(200);
        });
    });

    describe('item_override discount', () => {
        it('applies price override to items', () => {
            const result = calculateDiscount(
                [{ id: 'item-1', category_id: 'cat-1', price: 100, quantity: 2 }],
                {
                    ...baseDiscount,
                    type: 'item_override',
                    value: 70, // override price to 70
                    applies_to: 'item',
                    target_menu_item_id: 'item-1',
                }
            );
            // discount per unit = 100 - 70 = 30, total for 2 = 60
            expect(result.discountAmount).toBe(60);
            expect(result.total).toBe(140);
            expect(result.applied).toBe(true);
        });

        it('does not give negative discount when override > price', () => {
            const result = calculateDiscount(
                [{ id: 'item-1', category_id: 'cat-1', price: 50, quantity: 1 }],
                {
                    ...baseDiscount,
                    type: 'item_override',
                    value: 200, // override price to 200 (higher than actual)
                    applies_to: 'item',
                    target_menu_item_id: 'item-1',
                }
            );
            // unit discount = max(50 - 200, 0) = 0
            expect(result.discountAmount).toBe(0);
            expect(result.applied).toBe(false);
        });
    });

    describe('scope: applies_to', () => {
        it('applies discount only to matching item', () => {
            const result = calculateDiscount(items, {
                ...baseDiscount,
                type: 'fixed_amount',
                value: 30,
                applies_to: 'item',
                target_menu_item_id: 'item-1',
            });
            // Only applies to item-1 (subtotal: 200), discount: min(30, 200) = 30
            expect(result.discountAmount).toBe(30);
        });

        it('returns zero discount when target item not in items', () => {
            const result = calculateDiscount(items, {
                ...baseDiscount,
                type: 'fixed_amount',
                value: 50,
                applies_to: 'item',
                target_menu_item_id: 'item-999',
            });
            expect(result.discountAmount).toBe(0);
            expect(result.applied).toBe(false);
        });

        it('applies discount to matching category', () => {
            const result = calculateDiscount(items, {
                ...baseDiscount,
                type: 'fixed_amount',
                value: 20,
                applies_to: 'category',
                target_category_id: 'cat-1',
            });
            // cat-1 items: item-1 (2 * 100 = 200), discount: min(20, 200) = 20
            expect(result.discountAmount).toBe(20);
        });

        it('returns zero discount when target category not present', () => {
            const result = calculateDiscount(items, {
                ...baseDiscount,
                type: 'fixed_amount',
                value: 50,
                applies_to: 'category',
                target_category_id: 'cat-999',
            });
            expect(result.discountAmount).toBe(0);
            expect(result.applied).toBe(false);
        });
    });

    describe('unknown discount type', () => {
        it('returns zero discount for unknown type', () => {
            const result = calculateDiscount(items, {
                ...baseDiscount,
                type: 'unknown_type' as any,
                value: 100,
            });
            expect(result.discountAmount).toBe(0);
            expect(result.applied).toBe(false);
        });
    });

    describe('rounding', () => {
        it('rounds to 2 decimal places', () => {
            const trickItems: DiscountOrderItemInput[] = [
                { id: 'item-1', category_id: null, price: 33.33, quantity: 1 },
            ];
            const result = calculateDiscount(trickItems, {
                ...baseDiscount,
                type: 'percentage',
                value: 1000, // 10%
            });
            expect(result.discountAmount.toString()).not.toContain('e');
            expect(Number.isFinite(result.discountAmount)).toBe(true);
        });
    });
});
