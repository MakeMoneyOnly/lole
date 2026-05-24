import { MenuItem, RestaurantWithMenu } from '@/types/database';

/**
 * UpsellEngine - Logic for finding the best pairings and recommendations
 */
export function getSmartUpsells(
    currentItem: MenuItem,
    restaurant: RestaurantWithMenu,
    limit: number = 4
): MenuItem[] {
    const allItems = restaurant.categories.flatMap(c => c.items);

    // 1. Explicit Pairings (Manual curation always comes first)
    const recommendations: MenuItem[] = [];
    if (currentItem.pairings && currentItem.pairings.length > 0) {
        const pairedItems = allItems.filter(
            i => currentItem.pairings?.includes(i.id) && i.is_available && i.id !== currentItem.id
        );
        recommendations.push(...pairedItems);
    }

    // 2. If we need more, find items in "Drinks" or "Desserts" category
    if (recommendations.length < limit) {
        const sideCategories = restaurant.categories.filter(
            c =>
                c.name.toLowerCase().includes('drink') ||
                c.name.toLowerCase().includes('dessert') ||
                c.name.toLowerCase().includes('side') ||
                c.name_am?.includes('መጠጥ') ||
                c.name_am?.includes('ጣፋጭ')
        );

        const sideItems = sideCategories
            .flatMap(c => c.items)
            .filter(
                i =>
                    i.id !== currentItem.id &&
                    i.is_available &&
                    !recommendations.some(r => r.id === i.id)
            )
            // Sort by popularity if order_count exists
            .sort(
                (a, b) =>
                    ((a as unknown as { order_count?: number }).order_count || 0) -
                    ((b as unknown as { order_count?: number }).order_count || 0)
            )
            .slice(0, limit - recommendations.length);

        recommendations.push(...sideItems);
    }

    // 3. Last fallback: High popularity items from any category
    if (recommendations.length < limit) {
        const popularItems = allItems
            .filter(
                i =>
                    i.id !== currentItem.id &&
                    i.is_available &&
                    !recommendations.some(r => r.id === i.id)
            )
            .sort(
                (a, b) =>
                    ((a as unknown as { order_count?: number }).order_count || 0) -
                    ((b as unknown as { order_count?: number }).order_count || 0)
            )
            .slice(0, limit - recommendations.length);

        recommendations.push(...popularItems);
    }

    return recommendations.slice(0, limit);
}

/**
 * Filter items by fasting status if the user is in fasting mode
 */
export function filterFastingItems(items: MenuItem[], isFasting: boolean): MenuItem[] {
    if (!isFasting) return items;
    return items.filter(item => item.is_fasting);
}
