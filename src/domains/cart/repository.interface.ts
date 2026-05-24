// Cart Domain - Repository Interface (Ports Layer)
// Defines the contract for cart data persistence operations

import type { CartItem } from './service';

/**
 * Interface defining the contract for cart repository operations.
 * Implementations are provided by the Adapters layer (PowerSync).
 */
export interface CartRepositoryInterface {
    /**
     * Load cart items from PowerSync database.
     * @returns Array of cart items, empty array if not available or on error
     */
    loadCartFromPowerSync(): Promise<CartItem[]>;

    /**
     * Sync cart items to PowerSync database.
     * Replaces all existing cart items with the provided items.
     * @param items - Array of cart items to sync
     */
    syncCartToPowerSync(items: CartItem[]): Promise<void>;

    /**
     * Clear all cart items from PowerSync database.
     */
    clearCartFromPowerSync(): Promise<void>;

    /**
     * Check if PowerSync database is available.
     * @returns True if PowerSync is available, false otherwise
     */
    isAvailable(): boolean;
}
