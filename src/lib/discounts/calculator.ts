import type {
    DiscountCalculationResult,
    DiscountOrderItemInput,
    DiscountRecord,
} from '@/lib/discounts/types';

function roundMoney(value: number): number {
    return Math.max(0, Number(value.toFixed(2)));
}

function getEligibleItems(
    items: DiscountOrderItemInput[],
    discount: DiscountRecord
): DiscountOrderItemInput[] {
    if (discount.applies_to === 'order') {
        return items;
    }

    if (discount.applies_to === 'item') {
        return items.filter(item => item.id === discount.target_menu_item_id);
    }

    return items.filter(item => item.category_id === discount.target_category_id);
}

export function calculateDiscount(
    items: DiscountOrderItemInput[],
    discount: DiscountRecord | null
): DiscountCalculationResult {
    const subtotal = roundMoney(
        items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0)
    );

    if (!discount) {
        return {
            subtotal,
            discountAmount: 0,
            total: subtotal,
            applied: false,
        };
    }

    const eligibleItems = getEligibleItems(items, discount);
    if (eligibleItems.length === 0) {
        return {
            subtotal,
            discountAmount: 0,
            total: subtotal,
            applied: false,
        };
    }

    const eligibleSubtotal = roundMoney(
        eligibleItems.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0)
    );

    let discountAmount = 0;

    switch (discount.type) {
        case 'percentage':
            discountAmount = eligibleSubtotal * (discount.value / 10000);
            break;
        case 'fixed_amount':
            discountAmount = Math.min(discount.value, eligibleSubtotal);
            break;
        case 'bogo': {
            const eligibleUnitPrices = eligibleItems.flatMap(item =>
                Array.from({ length: item.quantity }, () => Number(item.price))
            );
            eligibleUnitPrices.sort((left, right) => left - right);
            const freeCount = Math.floor(eligibleUnitPrices.length / 2);
            discountAmount = eligibleUnitPrices
                .slice(0, freeCount)
                .reduce((sum, unitPrice) => sum + unitPrice, 0);
            break;
        }
        case 'item_override':
            discountAmount = eligibleItems.reduce((sum, item) => {
                const unitDiscount = Math.max(Number(item.price) - discount.value, 0);
                return sum + unitDiscount * Number(item.quantity);
            }, 0);
            break;
        default:
            discountAmount = 0;
    }

    const normalizedDiscountAmount = roundMoney(Math.min(discountAmount, subtotal));
    return {
        subtotal,
        discountAmount: normalizedDiscountAmount,
        total: roundMoney(subtotal - normalizedDiscountAmount),
        applied: normalizedDiscountAmount > 0,
    };
}
