/**
 * Menu Engineering Service
 *
 * Implements the Star/Dog/Puzzle/Plowhorse matrix for menu optimization.
 * Based on profit margin and popularity analysis.
 *
 * P1 feature from TOAST_FEATURE_TASKS.md
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// =========================================================
// Type Definitions
// =========================================================

export type MenuEngineeringCategory = 'star' | 'dog' | 'puzzle' | 'plowhorse';

export interface MenuItemPerformance {
    id: string;
    name: string;
    category_id: string;
    category_name: string;
    price: number;
    cost: number;
    profit_margin: number;
    profit_margin_pct: number;
    total_sold: number;
    total_revenue: number;
    total_profit: number;
    popularity_rank: number;
    profitability_rank: number;
    engineering_category: MenuEngineeringCategory;
    recommendation: string;
}

export interface MenuEngineeringReport {
    restaurant_id: string;
    period_start: string;
    period_end: string;
    items: MenuItemPerformance[];
    summary: {
        total_items: number;
        stars: number;
        dogs: number;
        puzzles: number;
        plowhorses: number;
        average_profit_margin: number;
        average_popularity: number;
    };
    thresholds: {
        popularity_median: number;
        profitability_median: number;
    };
}

export interface MenuEngineeringParams {
    restaurantId: string;
    periodStart?: string;
    periodEnd?: string;
    categoryId?: string;
}

// =========================================================
// Menu Engineering Logic
// =========================================================

/**
 * Calculate menu engineering category based on popularity and profitability
 *
 * Star: High Popularity + High Profitability (Keep and promote)
 * Plowhorse: High Popularity + Low Profitability (Reprice or reduce portion)
 * Puzzle: Low Popularity + High Profitability (Promote or reposition)
 * Dog: Low Popularity + Low Profitability (Remove or rebrand)
 */
export function calculateEngineeringCategory(
    popularityRank: number,
    profitabilityRank: number,
    totalItems: number
): MenuEngineeringCategory {
    const medianRank = totalItems / 2;

    const isHighPopularity = popularityRank <= medianRank;
    const isHighProfitability = profitabilityRank <= medianRank;

    if (isHighPopularity && isHighProfitability) {
        return 'star';
    } else if (isHighPopularity && !isHighProfitability) {
        return 'plowhorse';
    } else if (!isHighPopularity && isHighProfitability) {
        return 'puzzle';
    } else {
        return 'dog';
    }
}

/**
 * Get recommendation text based on engineering category
 */
export function getRecommendation(category: MenuEngineeringCategory): string {
    switch (category) {
        case 'star':
            return 'Keep on menu. Promote heavily. Maintain quality and consistency.';
        case 'plowhorse':
            return 'High seller but low margin. Consider price increase, reduce portion size, or find cheaper ingredients.';
        case 'puzzle':
            return 'High margin but low sales. Promote more, reposition on menu, or train staff to upsell.';
        case 'dog':
            return 'Low sales and low margin. Consider removing from menu or rebranding completely.';
    }
}

/**
 * Generate menu engineering report for a restaurant
 */
export async function generateMenuEngineeringReport(
    supabase: SupabaseClient,
    params: MenuEngineeringParams
): Promise<MenuEngineeringReport> {
    const { restaurantId, periodStart, periodEnd, categoryId } = params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Default to last 30 days if no period specified
    const endDate = periodEnd ? new Date(periodEnd) : new Date();
    const startDate = periodStart
        ? new Date(periodStart)
        : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch menu items with sales data
    let menuItemsQuery = db
        .from('menu_items')
        .select(
            `
            id,
            name,
            price,
            cost,
            category_id,
            categories(name)
        `
        )
        .eq('restaurant_id', restaurantId)
        .eq('is_available', true);

    if (categoryId) {
        menuItemsQuery = menuItemsQuery.eq('category_id', categoryId);
    }

    const { data: menuItems, error: menuError } = await menuItemsQuery;

    if (menuError) {
        throw new Error(`Failed to fetch menu items: ${menuError.message}`);
    }

    // Fetch order items for the period
    const { data: orderItems, error: orderError } = await db
        .from('order_items')
        .select(
            `
            menu_item_id,
            quantity,
            unit_price,
            total_price,
            orders!inner(restaurant_id, created_at, status)
        `
        )
        .eq('orders.restaurant_id', restaurantId)
        .in('orders.status', ['completed', 'served'])
        .gte('orders.created_at', startDate.toISOString())
        .lte('orders.created_at', endDate.toISOString());

    if (orderError) {
        throw new Error(`Failed to fetch order items: ${orderError.message}`);
    }

    // Aggregate sales data by menu item
    const salesByItem = new Map<
        string,
        {
            total_sold: number;
            total_revenue: number;
        }
    >();

    for (const item of orderItems || []) {
        const menuItemId = item.menu_item_id;
        const existing = salesByItem.get(menuItemId) || { total_sold: 0, total_revenue: 0 };

        existing.total_sold += item.quantity || 0;
        existing.total_revenue += Number(item.total_price) || 0;

        salesByItem.set(menuItemId, existing);
    }

    // Calculate performance metrics for each menu item
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemPerformances: MenuItemPerformance[] = (menuItems || []).map((item: any) => {
        const sales = salesByItem.get(item.id) || { total_sold: 0, total_revenue: 0 };
        const cost = Number(item.cost) || 0;
        const price = Number(item.price) || 0;
        const profitMargin = price - cost;
        const profitMarginPct = price > 0 ? (profitMargin / price) * 100 : 0;
        const totalProfit = sales.total_sold * profitMargin;

        return {
            id: item.id,
            name: item.name,
            category_id: item.category_id,
            category_name: item.categories?.name || 'Uncategorized',
            price,
            cost,
            profit_margin: profitMargin,
            profit_margin_pct: profitMarginPct,
            total_sold: sales.total_sold,
            total_revenue: sales.total_revenue,
            total_profit: totalProfit,
            popularity_rank: 0, // Will be calculated
            profitability_rank: 0, // Will be calculated
            engineering_category: 'dog' as MenuEngineeringCategory, // Will be calculated
            recommendation: '', // Will be calculated
        };
    });

    // Sort by popularity (total sold) and assign ranks
    const sortedByPopularity = [...itemPerformances].sort((a, b) => b.total_sold - a.total_sold);
    sortedByPopularity.forEach((item, index) => {
        const original = itemPerformances.find(i => i.id === item.id);
        if (original) {
            original.popularity_rank = index + 1;
        }
    });

    // Sort by profitability (profit margin) and assign ranks
    const sortedByProfitability = [...itemPerformances].sort(
        (a, b) => b.profit_margin - a.profit_margin
    );
    sortedByProfitability.forEach((item, index) => {
        const original = itemPerformances.find(i => i.id === item.id);
        if (original) {
            original.profitability_rank = index + 1;
        }
    });

    // Calculate engineering categories
    const totalItems = itemPerformances.length;
    for (const item of itemPerformances) {
        item.engineering_category = calculateEngineeringCategory(
            item.popularity_rank,
            item.profitability_rank,
            totalItems
        );
        item.recommendation = getRecommendation(item.engineering_category);
    }

    // Calculate summary statistics
    const stars = itemPerformances.filter(i => i.engineering_category === 'star').length;
    const dogs = itemPerformances.filter(i => i.engineering_category === 'dog').length;
    const puzzles = itemPerformances.filter(i => i.engineering_category === 'puzzle').length;
    const plowhorses = itemPerformances.filter(i => i.engineering_category === 'plowhorse').length;

    const avgProfitMargin =
        totalItems > 0
            ? itemPerformances.reduce((sum, i) => sum + i.profit_margin_pct, 0) / totalItems
            : 0;

    const avgPopularity =
        totalItems > 0
            ? itemPerformances.reduce((sum, i) => sum + i.total_sold, 0) / totalItems
            : 0;

    // Calculate thresholds
    const popularityValues = itemPerformances.map(i => i.total_sold).sort((a, b) => a - b);
    const profitabilityValues = itemPerformances.map(i => i.profit_margin).sort((a, b) => a - b);

    const popularityMedian =
        popularityValues.length > 0 ? popularityValues[Math.floor(popularityValues.length / 2)] : 0;

    const profitabilityMedian =
        profitabilityValues.length > 0
            ? profitabilityValues[Math.floor(profitabilityValues.length / 2)]
            : 0;

    return {
        restaurant_id: restaurantId,
        period_start: startDate.toISOString(),
        period_end: endDate.toISOString(),
        items: itemPerformances.sort((a, b) => a.popularity_rank - b.popularity_rank),
        summary: {
            total_items: totalItems,
            stars,
            dogs,
            puzzles,
            plowhorses,
            average_profit_margin: avgProfitMargin,
            average_popularity: avgPopularity,
        },
        thresholds: {
            popularity_median: popularityMedian,
            profitability_median: profitabilityMedian,
        },
    };
}

/**
 * Get engineering category color for UI
 */
export function getCategoryColor(category: MenuEngineeringCategory): string {
    switch (category) {
        case 'star':
            return '#22c55e'; // green
        case 'plowhorse':
            return '#f59e0b'; // amber
        case 'puzzle':
            return '#3b82f6'; // blue
        case 'dog':
            return '#ef4444'; // red
    }
}

/**
 * Get engineering category icon name for UI
 */
export function getCategoryIcon(category: MenuEngineeringCategory): string {
    switch (category) {
        case 'star':
            return 'Star';
        case 'plowhorse':
            return 'Tractor';
        case 'puzzle':
            return 'Puzzle';
        case 'dog':
            return 'AlertTriangle';
    }
}
