// Menu Domain - Repository Interface (Ports Layer)
// Defines the contract for menu data persistence operations

/**
 * Interface defining the contract for menu repository operations.
 * Implementations are provided by the Adapters layer (e.g., SupabaseRepository).
 */
export interface MenuRepositoryInterface {
    /**
     * Get all menu items for a restaurant.
     * @param restaurantId - The UUID of the restaurant
     * @param options - Optional filtering options
     * @returns Array of menu item records
     */
    getMenuItems(
        restaurantId: string,
        options?: {
            categoryId?: string;
            availableOnly?: boolean;
            limit?: number;
        }
    ): Promise<Record<string, unknown>[]>;

    /**
     * Get a single menu item by ID.
     * @param id - The UUID of the menu item
     * @returns The menu item record, or null if not found
     */
    getMenuItem(id: string): Promise<Record<string, unknown> | null>;

    /**
     * Get all categories for a restaurant.
     * @param restaurantId - The UUID of the restaurant
     * @returns Array of category records
     */
    getMenuCategories(restaurantId: string): Promise<Record<string, unknown>[]>;

    /**
     * Get modifier groups for a menu item.
     * @param menuItemId - The UUID of the menu item
     * @returns Array of modifier group records
     */
    getModifierGroups(menuItemId: string): Promise<Record<string, unknown>[]>;

    /**
     * Get modifier options for a modifier group.
     * @param modifierGroupId - The UUID of the modifier group
     * @returns Array of modifier option records
     */
    getModifierOptions(modifierGroupId: string): Promise<Record<string, unknown>[]>;

    // Batch loaders - Optimized for DataLoader to prevent N+1 query issues

    /**
     * Batch loader: Get multiple menu items by IDs.
     * @param ids - Array of menu item UUIDs to retrieve
     * @returns Array of matching menu item records
     */
    getMenuItemsByIds(ids: string[]): Promise<Record<string, unknown>[]>;

    /**
     * Batch loader: Get modifier groups for multiple menu items.
     * @param menuItemIds - Array of menu item UUIDs to retrieve groups for
     * @returns Array of matching modifier group records
     */
    getModifierGroupsByMenuItemIds(menuItemIds: string[]): Promise<Record<string, unknown>[]>;

    /**
     * Batch loader: Get modifier options for multiple groups.
     * @param groupIds - Array of modifier group UUIDs to retrieve options for
     * @returns Array of matching modifier option records
     */
    getModifierOptionsByGroupIds(groupIds: string[]): Promise<Record<string, unknown>[]>;

    /**
     * Batch loader: Get multiple categories by IDs.
     * @param ids - Array of category UUIDs to retrieve
     * @returns Array of matching category records
     */
    getCategoriesByIds(ids: string[]): Promise<Record<string, unknown>[]>;

    /**
     * Batch loader: Get multiple modifier groups by their IDs.
     * @param ids - Array of modifier group UUIDs to retrieve
     * @returns Array of matching modifier group records
     */
    getModifierGroupsByIds(ids: string[]): Promise<Record<string, unknown>[]>;

    /**
     * Batch loader: Get multiple modifier options by their IDs.
     * @param ids - Array of modifier option UUIDs to retrieve
     * @returns Array of matching modifier option records
     */
    getModifierOptionsByIds(ids: string[]): Promise<Record<string, unknown>[]>;
}
