/**
 * Menu Domain - Service Layer
 * Business logic between GraphQL resolvers and the repository.
 * Mirrors the pattern used in orders/service.ts and guests/service.ts.
 */

import { menuRepository } from './repository';
import { logger } from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MenuItemFilters {
    categoryId?: string;
    availableOnly?: boolean;
    limit?: number;
}

export interface CreateMenuItemInput {
    restaurantId: string;
    categoryId?: string;
    name: string;
    name_am?: string;
    description?: string;
    description_am?: string;
    price_santim: number;
    is_available?: boolean;
    image_url?: string;
}

export interface UpdateMenuItemInput {
    id: string;
    name?: string;
    name_am?: string;
    description?: string;
    description_am?: string;
    price_santim?: number;
    is_available?: boolean;
    categoryId?: string;
    image_url?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Get menu items for a restaurant with optional filters.
 */
async function getMenuItems(
    restaurantId: string,
    filters?: MenuItemFilters
): Promise<Record<string, unknown>[]> {
    return menuRepository.getMenuItems(restaurantId, filters);
}

/**
 * Get a single menu item by ID.
 * Returns null if not found.
 */
async function getMenuItem(id: string): Promise<Record<string, unknown> | null> {
    return menuRepository.getMenuItem(id);
}

/**
 * Get all categories for a restaurant.
 */
async function getCategories(restaurantId: string): Promise<Record<string, unknown>[]> {
    return menuRepository.getMenuCategories(restaurantId);
}

/**
 * Search menu items by name (English or Amharic).
 * Currently performs in-memory filtering; replace with FTS when available.
 */
async function searchMenu(restaurantId: string, query: string): Promise<Record<string, unknown>[]> {
    const items = await menuRepository.getMenuItems(restaurantId);
    const q = query.toLowerCase();
    return items.filter(
        item =>
            (item.name as string)?.toLowerCase().includes(q) ||
            (item.name_am as string)?.toLowerCase().includes(q)
    );
}

/**
 * Mark a menu item as available or unavailable.
 * Business rule: unavailable items are hidden from guest-facing menus.
 */
async function setItemAvailability(
    id: string,
    available: boolean
): Promise<Record<string, unknown> | null> {
    // Repository mutation not yet wired — placeholder for when write-path lands.
    // The resolver already validates tenant isolation before calling this.
    logger.info(`setItemAvailability: item=${id} available=${available} (stub)`, {
        source: '[menu/service]',
    });
    return menuRepository.getMenuItem(id);
}

/**
 * Batch loaders — thin pass-throughs for DataLoader usage in context.ts.
 */
async function getMenuItemsByIds(ids: string[]): Promise<Record<string, unknown>[]> {
    return menuRepository.getMenuItemsByIds(ids);
}

async function getCategoriesByIds(ids: string[]): Promise<Record<string, unknown>[]> {
    return menuRepository.getCategoriesByIds(ids);
}

async function getModifierGroupsByMenuItemIds(
    menuItemIds: string[]
): Promise<Record<string, unknown>[]> {
    return menuRepository.getModifierGroupsByMenuItemIds(menuItemIds);
}

async function getModifierGroupsByIds(ids: string[]): Promise<Record<string, unknown>[]> {
    return menuRepository.getModifierGroupsByIds(ids);
}

async function getModifierOptionsByGroupIds(
    groupIds: string[]
): Promise<Record<string, unknown>[]> {
    return menuRepository.getModifierOptionsByGroupIds(groupIds);
}

async function getModifierOptionsByIds(ids: string[]): Promise<Record<string, unknown>[]> {
    return menuRepository.getModifierOptionsByIds(ids);
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const menuService = {
    getMenuItems,
    getMenuItem,
    getCategories,
    searchMenu,
    setItemAvailability,
    getMenuItemsByIds,
    getCategoriesByIds,
    getModifierGroupsByMenuItemIds,
    getModifierGroupsByIds,
    getModifierOptionsByGroupIds,
    getModifierOptionsByIds,
};

export default menuService;
