/**
 * Menu Domain - Repository Layer
 * CRIT-07: GraphQL Federation - Menu subgraph data access
 * MED-001: Use explicit column selections instead of SELECT *
 */

import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import {
    MENU_ITEM_LIST_COLUMNS,
    MENU_ITEM_DETAIL_COLUMNS,
    CATEGORY_LIST_COLUMNS,
    MODIFIER_GROUP_COLUMNS,
    MODIFIER_OPTION_COLUMNS,
    columnsToString,
} from '@/lib/constants/query-columns';

// Use 'any' for database row types to avoid schema sync issues
// In production, these would be generated from Supabase types

/**
 * Get all menu items for a restaurant
 */
export async function getMenuItems(
    restaurantId: string,
    options?: {
        categoryId?: string;
        availableOnly?: boolean;
        limit?: number;
    }
): Promise<Record<string, unknown>[]> {
    const supabase = createClient();

    // MED-001: Use explicit columns for menu items
    let query = supabase
        .from('menu_items')
        .select(columnsToString(MENU_ITEM_LIST_COLUMNS))
        .eq('restaurant_id', restaurantId);

    if (options?.categoryId) {
        query = query.eq('category_id', options.categoryId);
    }

    if (options?.availableOnly) {
        query = query.eq('is_available', true);
    }

    // Apply limit to prevent unbounded result sets
    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
        logger.error('Error fetching menu items', error, { source: '[menu/repository]' });
        throw error;
    }

    return (data as unknown as Record<string, unknown>[]) || [];
}

/**
 * Get a single menu item by ID
 */
export async function getMenuItem(id: string): Promise<Record<string, unknown> | null> {
    const supabase = createClient();

    // MED-001: Use explicit columns for menu item detail
    const { data, error } = await supabase
        .from('menu_items')
        .select(columnsToString(MENU_ITEM_DETAIL_COLUMNS))
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        logger.error('Error fetching menu item', error, { source: '[menu/repository]' });
        throw error;
    }

    return data as unknown as Record<string, unknown> | null;
}

/**
 * Get all categories for a restaurant
 */
export async function getMenuCategories(restaurantId: string): Promise<Record<string, unknown>[]> {
    const supabase = createClient();

    // MED-001: Use explicit columns for categories
    const { data, error } = await supabase
        .from('categories')
        .select(columnsToString(CATEGORY_LIST_COLUMNS))
        .eq('restaurant_id', restaurantId);

    if (error) {
        logger.error('Error fetching categories', error, { source: '[menu/repository]' });
        throw error;
    }

    return (data as unknown as Record<string, unknown>[]) || [];
}

/**
 * Get modifier groups for a menu item
 */
export async function getModifierGroups(menuItemId: string): Promise<Record<string, unknown>[]> {
    const supabase = createClient();

    // MED-001: Use explicit columns for modifier groups
    const { data, error } = await supabase
        .from('modifier_groups')
        .select(columnsToString(MODIFIER_GROUP_COLUMNS))
        .eq('menu_item_id', menuItemId)
        .eq('is_active', true);

    if (error) {
        logger.error('Error fetching modifier groups', error, { source: '[menu/repository]' });
        throw error;
    }

    return (data as unknown as Record<string, unknown>[]) || [];
}

/**
 * Get modifier options for a modifier group
 */
export async function getModifierOptions(
    modifierGroupId: string
): Promise<Record<string, unknown>[]> {
    const supabase = createClient();

    // MED-001: Use explicit columns for modifier options
    const { data, error } = await supabase
        .from('modifier_options')
        .select(columnsToString(MODIFIER_OPTION_COLUMNS))
        .eq('modifier_group_id', modifierGroupId)
        .eq('is_available', true);

    if (error) {
        logger.error('Error fetching modifier options', error, { source: '[menu/repository]' });
        throw error;
    }

    return (data as unknown as Record<string, unknown>[]) || [];
}

/**
 * Batch loader: Get multiple menu items by IDs
 * Used by DataLoader for N+1 query prevention
 */
export async function getMenuItemsByIds(ids: string[]): Promise<Record<string, unknown>[]> {
    if (ids.length === 0) return [];
    const supabase = createClient();

    // MED-001: Use explicit columns for menu items batch
    const { data, error } = await supabase
        .from('menu_items')
        .select(columnsToString(MENU_ITEM_LIST_COLUMNS))
        .in('id', ids);

    if (error) {
        logger.error('Error fetching menu items by IDs', error, { source: '[menu/repository]' });
        throw error;
    }

    return (data as unknown as Record<string, unknown>[]) || [];
}

/**
 * Batch loader: Get modifier groups for multiple menu items
 * Used by DataLoader for N+1 query prevention
 */
export async function getModifierGroupsByMenuItemIds(
    menuItemIds: string[]
): Promise<Record<string, unknown>[]> {
    if (menuItemIds.length === 0) return [];
    const supabase = createClient();

    // MED-001: Use explicit columns for modifier groups batch
    const { data, error } = await supabase
        .from('modifier_groups')
        .select(columnsToString(MODIFIER_GROUP_COLUMNS))
        .in('menu_item_id', menuItemIds)
        .eq('is_active', true);

    if (error) {
        logger.error('Error fetching modifier groups by menu item IDs', error, { source: '[menu/repository]' });
        throw error;
    }

    return (data as unknown as Record<string, unknown>[]) || [];
}

/**
 * Batch loader: Get modifier options for multiple groups
 * Used by DataLoader for N+1 query prevention
 */
export async function getModifierOptionsByGroupIds(
    groupIds: string[]
): Promise<Record<string, unknown>[]> {
    if (groupIds.length === 0) return [];
    const supabase = createClient();

    // MED-001: Use explicit columns for modifier options batch
    const { data, error } = await supabase
        .from('modifier_options')
        .select(columnsToString(MODIFIER_OPTION_COLUMNS))
        .in('modifier_group_id', groupIds)
        .eq('is_available', true);

    if (error) {
        logger.error('Error fetching modifier options by group IDs', error, { source: '[menu/repository]' });
        throw error;
    }

    return (data as unknown as Record<string, unknown>[]) || [];
}

/**
 * Batch loader: Get multiple categories by IDs
 * Used by DataLoader for N+1 query prevention
 */
export async function getCategoriesByIds(ids: string[]): Promise<Record<string, unknown>[]> {
    if (ids.length === 0) return [];
    const supabase = createClient();

    // MED-001: Use explicit columns for categories batch
    const { data, error } = await supabase
        .from('categories')
        .select(columnsToString(CATEGORY_LIST_COLUMNS))
        .in('id', ids);

    if (error) {
        logger.error('Error fetching categories by IDs', error, { source: '[menu/repository]' });
        throw error;
    }

    return (data as unknown as Record<string, unknown>[]) || [];
}

/**
 * Batch loader: Get multiple modifier groups by their IDs
 * Used by DataLoader for federation reference resolution
 */
export async function getModifierGroupsByIds(ids: string[]): Promise<Record<string, unknown>[]> {
    if (ids.length === 0) return [];
    const supabase = createClient();

    // MED-001: Use explicit columns for modifier groups batch
    const { data, error } = await supabase
        .from('modifier_groups')
        .select(columnsToString(MODIFIER_GROUP_COLUMNS))
        .in('id', ids);

    if (error) {
        logger.error('Error fetching modifier groups by IDs', error, { source: '[menu/repository]' });
        throw error;
    }

    return (data as unknown as Record<string, unknown>[]) || [];
}

/**
 * Batch loader: Get multiple modifier options by their IDs
 * Used by DataLoader for federation reference resolution
 */
export async function getModifierOptionsByIds(ids: string[]): Promise<Record<string, unknown>[]> {
    if (ids.length === 0) return [];
    const supabase = createClient();

    // MED-001: Use explicit columns for modifier options batch
    const { data, error } = await supabase
        .from('modifier_options')
        .select(columnsToString(MODIFIER_OPTION_COLUMNS))
        .in('id', ids);

    if (error) {
        logger.error('Error fetching modifier options by IDs', error, { source: '[menu/repository]' });
        throw error;
    }

    return (data as unknown as Record<string, unknown>[]) || [];
}

export const menuRepository = {
    getMenuItems,
    getMenuItem,
    getMenuCategories,
    getModifierGroups,
    getModifierOptions,
    getMenuItemsByIds,
    getModifierGroupsByMenuItemIds,
    getModifierOptionsByGroupIds,
    getCategoriesByIds,
    getModifierGroupsByIds,
    getModifierOptionsByIds,
};

export default menuRepository;
