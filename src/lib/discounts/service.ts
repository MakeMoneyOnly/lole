import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { calculateDiscount } from '@/lib/discounts/calculator';
import type {
    DiscountCalculationResult,
    DiscountOrderItemInput,
    DiscountRecord,
} from '@/lib/discounts/types';

function isDiscountActive(discount: DiscountRecord, now = new Date()): boolean {
    if (!discount.is_active) {
        return false;
    }

    if (discount.valid_from && new Date(discount.valid_from) > now) {
        return false;
    }

    if (discount.valid_until && new Date(discount.valid_until) < now) {
        return false;
    }

    return true;
}

function normalizeDiscount(row: Record<string, unknown>): DiscountRecord {
    return {
        id: String(row.id),
        restaurant_id: String(row.restaurant_id),
        name: String(row.name),
        name_am: typeof row.name_am === 'string' ? row.name_am : null,
        type: row.type as DiscountRecord['type'],
        value: Number(row.value ?? 0),
        applies_to: row.applies_to as DiscountRecord['applies_to'],
        target_menu_item_id:
            typeof row.target_menu_item_id === 'string' ? row.target_menu_item_id : null,
        target_category_id:
            typeof row.target_category_id === 'string' ? row.target_category_id : null,
        requires_manager_pin: Boolean(row.requires_manager_pin),
        max_uses_per_day:
            typeof row.max_uses_per_day === 'number'
                ? row.max_uses_per_day
                : Number(row.max_uses_per_day ?? null),
        valid_from: typeof row.valid_from === 'string' ? row.valid_from : null,
        valid_until: typeof row.valid_until === 'string' ? row.valid_until : null,
        is_active: Boolean(row.is_active),
    };
}

export async function listActiveDiscountsForRestaurant(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    options?: { excludeManagerApproval?: boolean }
): Promise<DiscountRecord[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data, error } = await db
        .from('discounts')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, name_am, type, value, applies_to, target_menu_item_id, target_category_id, requires_manager_pin, max_uses_per_day, valid_from, valid_until, is_active'
        )
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return ((data ?? []) as Record<string, unknown>[])
        .map(normalizeDiscount)
        .filter(discount => isDiscountActive(discount))
        .filter(discount =>
            options?.excludeManagerApproval ? !discount.requires_manager_pin : true
        );
}

export async function getDiscountById(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    discountId: string
): Promise<DiscountRecord | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data, error } = await db
        .from('discounts')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, name_am, type, value, applies_to, target_menu_item_id, target_category_id, requires_manager_pin, max_uses_per_day, valid_from, valid_until, is_active'
        )
        .eq('restaurant_id', restaurantId)
        .eq('id', discountId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    if (!data) {
        return null;
    }

    const discount = normalizeDiscount(data as Record<string, unknown>);
    return isDiscountActive(discount) ? discount : null;
}

async function assertDailyLimit(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    discount: DiscountRecord
): Promise<void> {
    if (!discount.max_uses_per_day || discount.max_uses_per_day <= 0) {
        return;
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { count, error } = await db
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('discount_id', discount.id)
        .gte('created_at', startOfDay);

    if (error) {
        throw new Error(error.message);
    }

    if ((count ?? 0) >= discount.max_uses_per_day) {
        throw new Error('This discount has reached its daily usage limit.');
    }
}

async function assertManagerPin(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    discount: DiscountRecord,
    managerPin?: string | null
): Promise<void> {
    if (!discount.requires_manager_pin) {
        return;
    }

    if (!managerPin || managerPin.trim().length === 0) {
        throw new Error('This discount requires a manager PIN.');
    }

    const { data, error } = await supabase
        .from('restaurant_staff')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .in('role', ['owner', 'admin', 'manager'])
        .eq('pin_code', managerPin.trim())
        .eq('is_active', true)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    if (!data) {
        throw new Error('Manager PIN is invalid for this discount.');
    }
}

export async function prepareOrderDiscount(params: {
    supabase: SupabaseClient<Database>;
    restaurantId: string;
    discountId?: string | null;
    items: Array<{
        id: string;
        price: number;
        quantity: number;
    }>;
    managerPin?: string | null;
    excludeManagerApproval?: boolean;
}): Promise<{
    discount: DiscountRecord | null;
    calculation: DiscountCalculationResult;
}> {
    if (!params.discountId) {
        return {
            discount: null,
            calculation: calculateDiscount(
                params.items.map(item => ({
                    id: item.id,
                    category_id: null,
                    price: item.price,
                    quantity: item.quantity,
                })),
                null
            ),
        };
    }

    const discount = await getDiscountById(params.supabase, params.restaurantId, params.discountId);
    if (!discount) {
        throw new Error('Discount not found or inactive.');
    }

    if (params.excludeManagerApproval && discount.requires_manager_pin) {
        throw new Error('This discount is not available on this ordering surface.');
    }

    await assertManagerPin(params.supabase, params.restaurantId, discount, params.managerPin);
    await assertDailyLimit(params.supabase, params.restaurantId, discount);

    const itemIds = params.items.map(item => item.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (params.supabase as any)
        .from('menu_items')
        .select('id, category_id')
        .in('id', itemIds);

    if (error) {
        throw new Error(error.message);
    }

    const categoryByItemId = new Map<string, string | null>(
        ((data ?? []) as Array<{ id: string; category_id: string | null }>).map(row => [
            row.id,
            row.category_id,
        ])
    );

    const calculation = calculateDiscount(
        params.items.map<DiscountOrderItemInput>(item => ({
            id: item.id,
            category_id: categoryByItemId.get(item.id) ?? null,
            price: item.price,
            quantity: item.quantity,
        })),
        discount
    );

    return {
        discount,
        calculation,
    };
}
