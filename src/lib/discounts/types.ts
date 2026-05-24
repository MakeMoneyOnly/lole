export type DiscountType = 'percentage' | 'fixed_amount' | 'bogo' | 'item_override';
export type DiscountAppliesTo = 'order' | 'item' | 'category';

export interface DiscountRecord {
    id: string;
    restaurant_id: string;
    name: string;
    name_am: string | null;
    type: DiscountType;
    value: number;
    applies_to: DiscountAppliesTo;
    target_menu_item_id: string | null;
    target_category_id: string | null;
    requires_manager_pin: boolean;
    max_uses_per_day: number | null;
    valid_from: string | null;
    valid_until: string | null;
    is_active: boolean;
}

export interface DiscountOrderItemInput {
    id: string;
    category_id: string | null;
    price: number;
    quantity: number;
}

export interface DiscountCalculationResult {
    subtotal: number;
    discountAmount: number;
    total: number;
    applied: boolean;
}
