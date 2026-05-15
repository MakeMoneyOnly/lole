// Orders Domain - Repository Layer
// Database access layer - Supabase queries only, no business logic
import { Database } from '@/types/database';
import { logger } from '@/lib/logger';
import {
    ORDER_LIST_COLUMNS,
    ORDER_DETAIL_COLUMNS,
    ORDER_KDS_COLUMNS,
    ORDER_ITEM_LIST_COLUMNS,
    ORDER_ITEM_KDS_COLUMNS,
    columnsToString,
} from '@/lib/constants/query-columns';
import { getRepositoryClient, normalizePagination } from '@/lib/db/repository-base';

export type OrderRow = Database['public']['Tables']['orders']['Row'];

export type OrderItemRow = Database['public']['Tables']['order_items']['Row'];

export class OrdersRepository {
    async findById(id: string): Promise<OrderRow | null> {
        // MED-001: Use explicit columns for order detail
        const { data } = await getRepositoryClient()
            .from('orders')
            .select(columnsToString(ORDER_DETAIL_COLUMNS))
            .eq('id', id)
            .single();
        return data as OrderRow | null;
    }

    async findByRestaurant(
        restaurantId: string,
        options: {
            status?: string;
            tableNumber?: string;
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<OrderRow[]> {
        // MED-001: Use explicit columns for order list
        let query = getRepositoryClient()
            .from('orders')
            .select(columnsToString(ORDER_LIST_COLUMNS))
            .eq('restaurant_id', restaurantId);

        if (options.status) {
            query = query.eq('status', options.status);
        }
        if (options.tableNumber) {
            query = query.eq('table_number', options.tableNumber);
        }

        const { limit, offset } = normalizePagination(options);
        query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

        const { data } = await query;
        return (data as unknown as OrderRow[]) ?? [];
    }

    /**
     * HIGH-004: Find active orders with pagination to prevent unbounded result sets
     * @param restaurantId - Restaurant ID to filter by
     * @param options - Pagination options with limit (default 50, max 200) and offset
     */
    async findActiveByRestaurant(
        restaurantId: string,
        options: { limit?: number; offset?: number } = {}
    ): Promise<OrderRow[]> {
        const { limit, offset } = normalizePagination(options);

        // MED-001: Use explicit columns for active orders
        const { data } = await getRepositoryClient()
            .from('orders')
            .select(columnsToString(ORDER_LIST_COLUMNS))
            .eq('restaurant_id', restaurantId)
            .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        return (data as unknown as OrderRow[]) ?? [];
    }

    /**
     * HIGH-005: Find orders by KDS station using database-level filtering
     * Fixes N+1 query pattern by filtering at database level instead of in-memory
     * @param restaurantId - Restaurant ID to filter by
     * @param station - KDS station to filter orders by
     * @param options - Pagination options
     */
    async findByKDSStation(
        restaurantId: string,
        station: string,
        options: { limit?: number; offset?: number } = {}
    ): Promise<OrderRow[]> {
        const { limit, offset } = normalizePagination(options);

        // MED-001: Use explicit columns for KDS orders
        // Use a subquery to filter orders that have order_items with the specified station
        // This moves filtering to the database level instead of in-memory
        const { data } = await getRepositoryClient()
            .from('orders')
            .select(
                `${columnsToString(ORDER_KDS_COLUMNS)}, order_items!inner(${columnsToString(ORDER_ITEM_KDS_COLUMNS)})`
            )
            .eq('restaurant_id', restaurantId)
            .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
            .eq('order_items.station', station)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        return (data as unknown as OrderRow[]) ?? [];
    }

    async create(data: {
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
    }): Promise<OrderRow> {
        const { data: order, error } = await getRepositoryClient()
            .from('orders')
            .insert({
                restaurant_id: data.restaurant_id,
                table_number: data.table_number ?? '',
                order_number: data.order_number,
                status: 'pending',
                order_type: data.order_type ?? 'dine_in',
                total_price: data.total_price,
                discount_amount: data.discount_amount ?? 0,
                notes: data.notes ?? null,
                guest_fingerprint: data.guest_fingerprint ?? null,
                items: [],
                fire_mode: 'full',
                idempotency_key: data.idempotency_key,
            })
            .select(columnsToString(ORDER_DETAIL_COLUMNS))
            .single();

        if (error) throw new Error(error.message);
        return order as unknown as OrderRow;
    }

    async updateStatus(id: string, status: string): Promise<OrderRow> {
        const { data: order, error } = await getRepositoryClient()
            .from('orders')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select(columnsToString(ORDER_DETAIL_COLUMNS))
            .single();

        if (error) throw new Error(error.message);
        return order as unknown as OrderRow;
    }

    async cancel(id: string, reason?: string): Promise<OrderRow> {
        const { data: order, error } = await getRepositoryClient()
            .from('orders')
            .update({
                status: 'cancelled',
                notes: reason ? `Cancelled: ${reason}` : null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select(columnsToString(ORDER_DETAIL_COLUMNS))
            .single();

        if (error) throw new Error(error.message);
        return order as unknown as OrderRow;
    }

    // Order Items
    async getItems(orderId: string): Promise<OrderItemRow[]> {
        // MED-001: Use explicit columns for order items
        const { data } = await getRepositoryClient()
            .from('order_items')
            .select(columnsToString(ORDER_ITEM_LIST_COLUMNS) as '*')
            .eq('order_id', orderId)
            .order('created_at', { ascending: true });
        return data ?? [];
    }

    async createItems(
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
    ): Promise<OrderItemRow[]> {
        const { data, error } = await getRepositoryClient()
            .from('order_items')
            .insert(
                items.map(item => ({
                    restaurant_id,
                    order_id: item.order_id,
                    item_id: item.item_id,
                    quantity: item.quantity,
                    price: item.price,
                    modifiers: item.modifiers ? JSON.parse(JSON.stringify(item.modifiers)) : null,
                    notes: item.notes ?? null,
                    status: 'pending',
                    station: item.station ?? null,
                    course: 'main',
                    name: item.name || 'Item',
                }))
            )
            .select(columnsToString(ORDER_ITEM_LIST_COLUMNS) as '*');

        if (error) throw new Error(error.message);
        return data ?? [];
    }

    /**
     * Get a single order item by ID
     * Used by federation reference resolver
     */
    async getItemById(id: string): Promise<OrderItemRow | null> {
        // MED-001: Use explicit columns for order item
        const { data, error } = await getRepositoryClient()
            .from('order_items')
            .select(columnsToString(ORDER_ITEM_LIST_COLUMNS) as '*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            logger.error('Error fetching order item', error, { source: '[orders/repository]' });
            throw new Error(error.message);
        }

        return data;
    }

    /**
     * Batch loader: Get order items for multiple orders
     * Used by DataLoader for N+1 query prevention
     */
    async getItemsByOrderIds(orderIds: string[]): Promise<OrderItemRow[]> {
        if (orderIds.length === 0) return [];

        // MED-001: Use explicit columns for order items batch
        const { data, error } = await getRepositoryClient()
            .from('order_items')
            .select(columnsToString(ORDER_ITEM_LIST_COLUMNS) as '*')
            .in('order_id', orderIds)
            .order('created_at', { ascending: true });

        if (error) {
            logger.error('Error fetching order items by order IDs', error, { source: '[orders/repository]' });
            throw new Error(error.message);
        }

        return data ?? [];
    }

    /**
     * Validate required modifiers for a menu item via RPC
     */
    async validateModifiers(
        menuItemId: string,
        selectedModifierIds: string[]
    ): Promise<{
        is_valid: boolean;
        missing_groups: string[];
        error_message: string | null;
        error_message_am: string | null;
    } | null> {
        try {
            // Cast to any for custom RPC function not in generated types
            const client = getRepositoryClient() as any;
            const { data, error } = await client.rpc('validate_required_modifiers', {
                p_menu_item_id: menuItemId,
                p_selected_modifier_ids: selectedModifierIds,
            });

            if (error) {
                logger.error('Modifier validation error', error, { source: '[orders/repository]' });
                return null;
            }

            if (data && typeof data === 'object' && !Array.isArray(data) && 'is_valid' in data) {
                return data as {
                    is_valid: boolean;
                    missing_groups: string[];
                    error_message: string | null;
                    error_message_am: string | null;
                };
            }

            return null;
        } catch (err) {
            logger.error('Modifier validation exception', err, { source: '[orders/repository]' });
            return null;
        }
    }
}

export const ordersRepository = new OrdersRepository();
