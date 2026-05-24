import { describe, it, expect, vi } from 'vitest';
import { listActiveDiscountsForRestaurant, getDiscountById, prepareOrderDiscount } from './service';

function makeSupabase(): any {
    return {
        from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        auth: { getUser: vi.fn() },
    };
}

const baseDiscount = {
    id: 'disc-1',
    restaurant_id: 'rest-1',
    name: 'Test Discount',
    name_am: null,
    type: 'percentage',
    value: 10,
    applies_to: 'all',
    target_menu_item_id: null,
    target_category_id: null,
    requires_manager_pin: false,
    max_uses_per_day: null,
    valid_from: null,
    valid_until: null,
    is_active: true,
};

describe('discounts/service', () => {
    describe('listActiveDiscountsForRestaurant', () => {
        it('returns empty array when no discounts found', async () => {
            const supabase = makeSupabase();
            supabase.from.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
            });

            const result = await listActiveDiscountsForRestaurant(supabase, 'rest-1');
            expect(result).toEqual([]);
        });

        it('returns active discounts', async () => {
            const supabase = makeSupabase();
            supabase.from.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: [baseDiscount], error: null }),
            });

            const result = await listActiveDiscountsForRestaurant(supabase, 'rest-1');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('disc-1');
            expect(result[0].type).toBe('percentage');
            expect(result[0].value).toBe(10);
        });

        it('throws when database returns error', async () => {
            const supabase = makeSupabase();
            supabase.from.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
            });

            await expect(listActiveDiscountsForRestaurant(supabase, 'rest-1')).rejects.toThrow(
                'DB error'
            );
        });

        it('filters out discounts whose valid_from is in the future', async () => {
            const futureDiscount = {
                ...baseDiscount,
                id: 'disc-2',
                valid_from: new Date(Date.now() + 86400000).toISOString(),
            };
            const supabase = makeSupabase();
            supabase.from.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: [futureDiscount], error: null }),
            });

            const result = await listActiveDiscountsForRestaurant(supabase, 'rest-1');
            expect(result).toHaveLength(0);
        });

        it('filters out expired discounts', async () => {
            const expiredDiscount = {
                ...baseDiscount,
                id: 'disc-3',
                valid_until: new Date(Date.now() - 86400000).toISOString(),
            };
            const supabase = makeSupabase();
            supabase.from.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: [expiredDiscount], error: null }),
            });

            const result = await listActiveDiscountsForRestaurant(supabase, 'rest-1');
            expect(result).toHaveLength(0);
        });

        it('excludes manager-required discounts when excludeManagerApproval is true', async () => {
            const pinDiscount = {
                ...baseDiscount,
                id: 'disc-4',
                requires_manager_pin: true,
            };
            const supabase = makeSupabase();
            supabase.from.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: [pinDiscount], error: null }),
            });

            const result = await listActiveDiscountsForRestaurant(supabase, 'rest-1', {
                excludeManagerApproval: true,
            });
            expect(result).toHaveLength(0);
        });

        it('includes manager-required discounts when excludeManagerApproval is false', async () => {
            const pinDiscount = {
                ...baseDiscount,
                id: 'disc-5',
                requires_manager_pin: true,
            };
            const supabase = makeSupabase();
            supabase.from.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: [pinDiscount], error: null }),
            });

            const result = await listActiveDiscountsForRestaurant(supabase, 'rest-1', {
                excludeManagerApproval: false,
            });
            expect(result).toHaveLength(1);
        });
    });

    describe('getDiscountById', () => {
        it('returns null when discount not found', async () => {
            const supabase = makeSupabase();
            supabase.from.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            });

            const result = await getDiscountById(supabase, 'rest-1', 'non-existent');
            expect(result).toBeNull();
        });

        it('returns the discount when found and active', async () => {
            const supabase = makeSupabase();
            supabase.from.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: baseDiscount, error: null }),
            });

            const result = await getDiscountById(supabase, 'rest-1', 'disc-1');
            expect(result).not.toBeNull();
            expect(result?.id).toBe('disc-1');
        });

        it('returns null when discount is found but inactive', async () => {
            const supabase = makeSupabase();
            supabase.from.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { ...baseDiscount, is_active: false },
                    error: null,
                }),
            });

            const result = await getDiscountById(supabase, 'rest-1', 'disc-1');
            expect(result).toBeNull();
        });

        it('throws on database error', async () => {
            const supabase = makeSupabase();
            supabase.from.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi
                    .fn()
                    .mockResolvedValue({ data: null, error: { message: 'Timeout' } }),
            });

            await expect(getDiscountById(supabase, 'rest-1', 'disc-1')).rejects.toThrow('Timeout');
        });

        it('normalizes string fields', async () => {
            const supabase = makeSupabase();
            supabase.from.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { ...baseDiscount, name_am: 'ቅናሽ', max_uses_per_day: '10' },
                    error: null,
                }),
            });

            const result = await getDiscountById(supabase, 'rest-1', 'disc-1');
            expect(result?.name_am).toBe('ቅናሽ');
            expect(result?.max_uses_per_day).toBe(10);
        });
    });

    describe('prepareOrderDiscount', () => {
        const items = [
            { id: 'menu-1', price: 100, quantity: 2 },
            { id: 'menu-2', price: 50, quantity: 1 },
        ];

        it('returns null discount and zero calculation when no discountId', async () => {
            const supabase = makeSupabase();

            const result = await prepareOrderDiscount({
                supabase,
                restaurantId: 'rest-1',
                discountId: null,
                items,
            });

            expect(result.discount).toBeNull();
            expect(result.calculation).toBeDefined();
            expect(result.calculation.discountAmount).toBe(0);
        });

        it('throws when discount not found', async () => {
            const supabase = makeSupabase();
            supabase.from.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            });

            await expect(
                prepareOrderDiscount({
                    supabase,
                    restaurantId: 'rest-1',
                    discountId: 'non-existent',
                    items,
                })
            ).rejects.toThrow('Discount not found or inactive.');
        });

        it('throws when manager pin required but not provided', async () => {
            const supabase = makeSupabase();
            let callCount = 0;
            supabase.from.mockImplementation(() => {
                callCount++;
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    in: vi.fn().mockReturnThis(),
                    maybeSingle: vi.fn().mockResolvedValue({
                        data:
                            callCount === 1
                                ? { ...baseDiscount, requires_manager_pin: true }
                                : null,
                        error: null,
                    }),
                };
            });

            await expect(
                prepareOrderDiscount({
                    supabase,
                    restaurantId: 'rest-1',
                    discountId: 'disc-1',
                    items,
                    managerPin: null,
                })
            ).rejects.toThrow('This discount requires a manager PIN.');
        });

        it('throws when discount is not available on excluded manager surfaces', async () => {
            const supabase = makeSupabase();
            supabase.from.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({
                    data: { ...baseDiscount, requires_manager_pin: true },
                    error: null,
                }),
            });

            await expect(
                prepareOrderDiscount({
                    supabase,
                    restaurantId: 'rest-1',
                    discountId: 'disc-1',
                    items,
                    excludeManagerApproval: true,
                })
            ).rejects.toThrow('This discount is not available on this ordering surface.');
        });
    });
});
