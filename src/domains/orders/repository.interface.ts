// Orders Domain - Repository Interface (Ports Layer)
// Defines the contract for orders data persistence operations

import type { OrderRow, OrderItemRow } from './repository';

/**
 * Interface defining the contract for orders repository operations.
 * Implementations are provided by the Adapters layer (e.g., SupabaseRepository).
 */
export interface OrderRepositoryInterface {
    /**
     * Retrieve a single order by its unique identifier.
     * @param id - The UUID of the order to retrieve
     * @returns The order record, or null if not found
     */
    findById(id: string): Promise<OrderRow | null>;

    /**
     * Retrieve orders for a restaurant with optional filtering.
     * @param restaurantId - The UUID of the restaurant
     * @param options - Optional filtering and pagination options
     * @returns Array of order records
     */
    findByRestaurant(
        restaurantId: string,
        options?: {
            status?: string;
            tableNumber?: string;
            limit?: number;
            offset?: number;
        }
    ): Promise<OrderRow[]>;

    /**
     * HIGH-004: Find active orders with pagination to prevent unbounded result sets.
     * @param restaurantId - The UUID of the restaurant
     * @param options - Pagination options with limit (default 50, max 200) and offset
     * @returns Array of active order records
     */
    findActiveByRestaurant(
        restaurantId: string,
        options?: {
            limit?: number;
            offset?: number;
        }
    ): Promise<OrderRow[]>;

    /**
     * HIGH-005: Find orders by KDS station using database-level filtering.
     * Fixes N+1 query pattern by filtering at database level instead of in-memory.
     * @param restaurantId - The UUID of the restaurant
     * @param station - KDS station to filter orders by
     * @param options - Pagination options
     * @returns Array of order records for the specified station
     */
    findByKDSStation(
        restaurantId: string,
        station: string,
        options?: {
            limit?: number;
            offset?: number;
        }
    ): Promise<OrderRow[]>;

    /**
     * Create a new order record.
     * @param data - The order creation data
     * @returns The created order record
     */
    create(data: {
        restaurant_id: string;
        table_number?: string;
        order_number: string;
        order_type?: string;
        total_price: number;
        discount_amount?: number;
        notes?: string;
        guest_fingerprint?: string;
        staff_id?: string;
        idempotency_key: string;
    }): Promise<OrderRow>;

    /**
     * Update an order's status.
     * @param id - The UUID of the order to update
     * @param status - The new status value
     * @returns The updated order record
     */
    updateStatus(id: string, status: string): Promise<OrderRow>;

    /**
     * Cancel an order.
     * @param id - The UUID of the order to cancel
     * @param reason - Optional cancellation reason
     * @returns The cancelled order record
     */
    cancel(id: string, reason?: string): Promise<OrderRow>;

    // Order Items

    /**
     * Get all items for an order.
     * @param orderId - The UUID of the order
     * @returns Array of order item records
     */
    getItems(orderId: string): Promise<OrderItemRow[]>;

    /**
     * Create multiple order items.
     * @param restaurant_id - The UUID of the restaurant
     * @param items - Array of order item data to create
     * @returns Array of created order item records
     */
    createItems(
        restaurant_id: string,
        items: {
            order_id: string;
            item_id: string;
            quantity: number;
            price: number;
            modifiers?: Record<string, unknown> | null;
            notes?: string | null;
            station?: string;
            name?: string;
        }[]
    ): Promise<OrderItemRow[]>;

    /**
     * Get a single order item by ID.
     * Used by federation reference resolver.
     * @param id - The UUID of the order item
     * @returns The order item record, or null if not found
     */
    getItemById(id: string): Promise<OrderItemRow | null>;

    /**
     * Batch loader: Get order items for multiple orders.
     * Optimized for DataLoader to prevent N+1 query issues.
     * @param orderIds - Array of order UUIDs to retrieve items for
     * @returns Array of matching order item records
     */
    getItemsByOrderIds(orderIds: string[]): Promise<OrderItemRow[]>;

    /**
     * Validate required modifiers for a menu item via RPC.
     * @param menuItemId - The UUID of the menu item
     * @param selectedModifierIds - Array of selected modifier option IDs
     * @returns Validation result with missing groups if invalid
     */
    validateModifiers(
        menuItemId: string,
        selectedModifierIds: string[]
    ): Promise<{
        is_valid: boolean;
        missing_groups: string[];
        error_message: string | null;
        error_message_am: string | null;
    } | null>;
}
