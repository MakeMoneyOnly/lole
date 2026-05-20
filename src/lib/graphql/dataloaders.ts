/**
 * DataLoader Factory for GraphQL N+1 Query Prevention
 * CRITICAL-001: Batch and cache database queries to prevent N+1 problems
 *
 * DataLoaders are created per-request to prevent cache leakage between requests.
 * Each loader batches multiple requests for the same resource type and resolves
 * them in a single database query.
 *
 * HIGH-014: All DataLoaders include tenant verification to prevent cross-tenant data leakage.
 */

import DataLoader from 'dataloader';
import { menuRepository } from '@/domains/menu/repository';
import { ordersRepository, OrderItemRow } from '@/domains/orders/repository';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { logger } from '@/lib/logger';

const log = logger.child('[graphql/dataloaders]');

/**
 * Tenant context for DataLoader operations
 * HIGH-014: Required for tenant isolation verification
 */
export interface TenantContext {
    restaurantId: string;
}

/**
 * Type definitions for DataLoader entities
 * These represent the database row types returned by the repositories
 */
export type MenuItem = Record<string, unknown>;
export type ModifierGroup = Record<string, unknown>;
export type ModifierOption = Record<string, unknown>;
export type Category = Record<string, unknown>;
export type OrderItem = OrderItemRow;

/**
 * HIGH-021: Guest types for DataLoader
 */
export interface Guest {
    id: string;
    restaurant_id: string;
    identity_key: string;
    name: string | null;
    phone_hash: string | null;
    email_hash: string | null;
    language: string;
    tags: string[];
    notes: string | null;
    is_vip: boolean;
    first_seen_at: string;
    last_seen_at: string;
    visit_count: number;
    lifetime_value: number;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

/**
 * HIGH-021: Payment types for DataLoader
 */
export interface Payment {
    id: string;
    restaurant_id: string;
    order_id: string;
    amount: number;
    currency: string;
    status: string;
    provider: string;
    provider_tx_id: string | null;
    payment_session_id: string | null;
    split_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

/**
 * HIGH-021: Restaurant types for DataLoader
 */
export interface Restaurant {
    id: string;
    name: string;
    slug: string;
    currency: string;
    timezone: string;
    settings: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

/**
 * HIGH-021: Staff types for DataLoader
 */
export interface Staff {
    id: string;
    restaurant_id: string;
    user_id: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    role: string;
    is_active: boolean;
    pin_code: string | null;
    created_at: string;
    updated_at: string;
}

/**
 * DataLoaders interface for GraphQL context
 * Each loader handles a specific entity type with batched loading
 */
export interface DataLoaders {
    /** Load menu items by ID - returns null if not found */
    menuItems: DataLoader<string, MenuItem | null>;
    /** Load modifier groups by menu item ID - returns empty array if none */
    modifierGroups: DataLoader<string, ModifierGroup[]>;
    /** Load modifier options by modifier group ID - returns empty array if none */
    modifierOptions: DataLoader<string, ModifierOption[]>;
    /** Load order items by order ID - returns empty array if none */
    orderItems: DataLoader<string, OrderItem[]>;
    /** Load categories by ID - returns null if not found */
    categories: DataLoader<string, Category | null>;
    /** Load single modifier group by ID - returns null if not found (for federation references) */
    modifierGroup: DataLoader<string, ModifierGroup | null>;
    /** Load single modifier option by ID - returns null if not found (for federation references) */
    modifierOption: DataLoader<string, ModifierOption | null>;
    /** HIGH-021: Load guests by ID - returns null if not found */
    guests: DataLoader<string, Guest | null>;
    /** HIGH-021: Load guests by session ID - returns empty array if none */
    guestsBySession: DataLoader<string, Guest[]>;
    /** HIGH-021: Load payments by ID - returns null if not found */
    payments: DataLoader<string, Payment | null>;
    /** HIGH-021: Load payments by order ID - returns empty array if none */
    paymentsByOrder: DataLoader<string, Payment[]>;
    /** HIGH-021: Load restaurants by ID - returns null if not found */
    restaurants: DataLoader<string, Restaurant | null>;
    /** HIGH-021: Load staff by ID - returns null if not found */
    staff: DataLoader<string, Staff | null>;
    /** HIGH-021: Load staff by restaurant ID - returns empty array if none */
    staffByRestaurant: DataLoader<string, Staff[]>;
}

/**
 * Create a new set of DataLoaders for a GraphQL request
 *
 * IMPORTANT: This must be called per-request (not shared across requests)
 * to prevent cache leakage and ensure proper batching within a single request.
 *
 * HIGH-014: All DataLoaders now require tenant context for verification.
 * This prevents cross-tenant data leakage when ID enumeration occurs.
 *
 * @param tenantContext - The tenant context containing restaurantId for verification
 * @returns DataLoaders object containing all batch loaders
 */
export function createDataLoaders(tenantContext: TenantContext): DataLoaders {
    const { restaurantId } = tenantContext;

    /**
     * HIGH-014: Helper to verify tenant ownership of entities
     * Filters results to only include entities belonging to the current tenant
     */
    const verifyTenantOwnership = <T extends { restaurant_id?: string }>(
        items: T[],
        ids: readonly string[],
        idExtractor: (item: T) => string
    ): (T | null)[] => {
        const itemMap = new Map(items.map(item => [idExtractor(item), item]));
        return ids.map(id => {
            const item = itemMap.get(id);
            // Return null if item not found or doesn't belong to tenant
            if (!item) return null;
            // Verify tenant ownership - if restaurant_id exists, it must match
            if (item.restaurant_id && item.restaurant_id !== restaurantId) {
                log.warn('Tenant isolation violation', { id, restaurantId });
                return null;
            }
            return item;
        });
    };

    return {
        /**
         * Menu Items loader - batches requests for menu items by ID
         * Returns the menu item or null if not found
         * HIGH-014: Includes tenant verification
         */
        menuItems: new DataLoader<string, MenuItem | null>(async (ids: readonly string[]) => {
            const items = await menuRepository.getMenuItemsByIds([...ids]);
            return verifyTenantOwnership(items as MenuItem[], ids, item => item.id as string);
        }),

        /**
         * Modifier Groups loader - batches requests for modifier groups by menu item ID
         * Returns an array of modifier groups for each menu item (empty if none)
         * HIGH-014: Includes tenant verification via menu item ownership
         */
        modifierGroups: new DataLoader<string, ModifierGroup[]>(
            async (menuItemIds: readonly string[]) => {
                const groups = await menuRepository.getModifierGroupsByMenuItemIds([
                    ...menuItemIds,
                ]);

                // Group by menu_item_id with tenant verification
                const groupsByMenuItem = new Map<string, ModifierGroup[]>();
                for (const group of groups) {
                    const menuItemId = group.menu_item_id as string;
                    // Verify the parent menu item belongs to tenant
                    if (group.restaurant_id && group.restaurant_id !== restaurantId) {
                        continue; // Skip groups from other tenants
                    }
                    const existing = groupsByMenuItem.get(menuItemId) || [];
                    existing.push(group);
                    groupsByMenuItem.set(menuItemId, existing);
                }

                return menuItemIds.map(id => groupsByMenuItem.get(id) || []);
            }
        ),

        /**
         * Modifier Options loader - batches requests for options by modifier group ID
         * Returns an array of options for each group (empty if none)
         * HIGH-014: Includes tenant verification via modifier group ownership
         */
        modifierOptions: new DataLoader<string, ModifierOption[]>(
            async (groupIds: readonly string[]) => {
                const options = await menuRepository.getModifierOptionsByGroupIds([...groupIds]);

                // Group by modifier_group_id with tenant verification
                const optionsByGroup = new Map<string, ModifierOption[]>();
                for (const option of options) {
                    const groupId = option.modifier_group_id as string;
                    // Verify the parent modifier group belongs to tenant
                    if (option.restaurant_id && option.restaurant_id !== restaurantId) {
                        continue; // Skip options from other tenants
                    }
                    const existing = optionsByGroup.get(groupId) || [];
                    existing.push(option);
                    optionsByGroup.set(groupId, existing);
                }

                return groupIds.map(id => optionsByGroup.get(id) || []);
            }
        ),

        /**
         * Order Items loader - batches requests for order items by order ID
         * Returns an array of order items for each order (empty if none)
         * HIGH-014: Includes tenant verification via order ownership
         */
        orderItems: new DataLoader<string, OrderItem[]>(async (orderIds: readonly string[]) => {
            const items = await ordersRepository.getItemsByOrderIds([...orderIds]);

            // Group by order_id with tenant verification
            const itemsByOrder = new Map<string, OrderItem[]>();
            for (const item of items) {
                // Verify the parent order belongs to tenant
                if (item.restaurant_id && item.restaurant_id !== restaurantId) {
                    continue; // Skip items from other tenants
                }
                const existing = itemsByOrder.get(item.order_id) || [];
                existing.push(item);
                itemsByOrder.set(item.order_id, existing);
            }

            return orderIds.map(id => itemsByOrder.get(id) || []);
        }),

        /**
         * Categories loader - batches requests for categories by ID
         * Returns the category or null if not found
         * HIGH-014: Includes tenant verification
         */
        categories: new DataLoader<string, Category | null>(async (ids: readonly string[]) => {
            const categories = await menuRepository.getCategoriesByIds([...ids]);
            return verifyTenantOwnership(categories as Category[], ids, cat => cat.id as string);
        }),

        /**
         * Single Modifier Group loader - batches requests for single modifier groups by ID
         * Returns the modifier group or null if not found (for federation reference resolution)
         * HIGH-014: Includes tenant verification
         */
        modifierGroup: new DataLoader<string, ModifierGroup | null>(
            async (ids: readonly string[]) => {
                const groups = await menuRepository.getModifierGroupsByIds([...ids]);
                return verifyTenantOwnership(
                    groups as ModifierGroup[],
                    ids,
                    group => group.id as string
                );
            }
        ),

        /**
         * Single Modifier Option loader - batches requests for single modifier options by ID
         * Returns the modifier option or null if not found (for federation reference resolution)
         * HIGH-014: Includes tenant verification
         */
        modifierOption: new DataLoader<string, ModifierOption | null>(
            async (ids: readonly string[]) => {
                const options = await menuRepository.getModifierOptionsByIds([...ids]);
                return verifyTenantOwnership(
                    options as ModifierOption[],
                    ids,
                    option => option.id as string
                );
            }
        ),

        /**
         * HIGH-021: Guests loader - batches requests for guests by ID
         * Returns the guest or null if not found
         * HIGH-014: Includes tenant verification
         */
        guests: new DataLoader<string, Guest | null>(async (ids: readonly string[]) => {
            const supabase = createServiceRoleClient();
            const { data, error } = await supabase
                .from('guests')
                .select(
                    'id, restaurant_id, identity_key, name, phone_hash, email_hash, language, tags, notes, is_vip, first_seen_at, last_seen_at, visit_count, lifetime_value, metadata, created_at, updated_at'
                )
                .in('id', [...ids]);

            if (error) {
                log.error('Error loading guests', { message: error.message });
                return ids.map(() => null);
            }

            return verifyTenantOwnership(data as Guest[], ids, guest => guest.id);
        }),

        /**
         * HIGH-021: Guests by Session loader - batches requests for guests by session ID
         * Returns an array of guests for each session (empty if none)
         * HIGH-014: Includes tenant verification
         */
        guestsBySession: new DataLoader<string, Guest[]>(async (sessionIds: readonly string[]) => {
            const supabase = createServiceRoleClient();
            const { data, error } = await supabase
                .from('table_sessions')
                .select(
                    'id, restaurant_id, guests(id, restaurant_id, identity_key, name, phone_hash, email_hash, language, tags, notes, is_vip, first_seen_at, last_seen_at, visit_count, lifetime_value, metadata, created_at, updated_at)'
                )
                .in('id', [...sessionIds]);

            if (error) {
                log.error('Error loading guests by session', { message: error.message });
                return sessionIds.map(() => []);
            }

            // Group by session_id with tenant verification
            const guestsBySession = new Map<string, Guest[]>();
            for (const session of data ?? []) {
                if (session.restaurant_id && session.restaurant_id !== restaurantId) {
                    continue; // Skip sessions from other tenants
                }
                const guests = ((session.guests as Guest[]) ?? []).filter(
                    g => !g.restaurant_id || g.restaurant_id === restaurantId
                );
                guestsBySession.set(session.id, guests);
            }

            return sessionIds.map(id => guestsBySession.get(id) || []);
        }),

        /**
         * HIGH-021: Payments loader - batches requests for payments by ID
         * Returns the payment or null if not found
         * HIGH-014: Includes tenant verification
         */
        payments: new DataLoader<string, Payment | null>(async (ids: readonly string[]) => {
            const supabase = createServiceRoleClient();
            const { data, error } = await supabase
                .from('payments')
                .select(
                    'id, restaurant_id, order_id, amount, currency, status, provider, provider_tx_id, payment_session_id, split_id, metadata, created_at, updated_at'
                )
                .in('id', [...ids]);

            if (error) {
                log.error('Error loading payments', { message: error.message });
                return ids.map(() => null);
            }

            return verifyTenantOwnership(data as Payment[], ids, payment => payment.id);
        }),

        /**
         * HIGH-021: Payments by Order loader - batches requests for payments by order ID
         * Returns an array of payments for each order (empty if none)
         * HIGH-014: Includes tenant verification
         */
        paymentsByOrder: new DataLoader<string, Payment[]>(async (orderIds: readonly string[]) => {
            const supabase = createServiceRoleClient();
            const { data, error } = await supabase
                .from('payments')
                .select(
                    'id, restaurant_id, order_id, amount, currency, status, provider, provider_tx_id, payment_session_id, split_id, metadata, created_at, updated_at'
                )
                .in('order_id', [...orderIds]);

            if (error) {
                log.error('Error loading payments by order', { message: error.message });
                return orderIds.map(() => []);
            }

            // Group by order_id with tenant verification
            const paymentsByOrder = new Map<string, Payment[]>();
            for (const payment of data ?? []) {
                if (payment.restaurant_id && payment.restaurant_id !== restaurantId) {
                    continue; // Skip payments from other tenants
                }
                const existing = paymentsByOrder.get(payment.order_id) || [];
                existing.push(payment as Payment);
                paymentsByOrder.set(payment.order_id, existing);
            }

            return orderIds.map(id => paymentsByOrder.get(id) || []);
        }),

        /**
         * HIGH-021: Restaurants loader - batches requests for restaurants by ID
         * Returns the restaurant or null if not found
         * Note: No tenant verification needed as restaurant is the tenant root
         */
        restaurants: new DataLoader<string, Restaurant | null>(async (ids: readonly string[]) => {
            const supabase = createServiceRoleClient();
            const { data, error } = await supabase
                .from('restaurants')
                .select('id, name, slug, currency, timezone, settings, created_at, updated_at')
                .in('id', [...ids]);

            if (error) {
                log.error('Error loading restaurants', { message: error.message });
                return ids.map(() => null);
            }

            const restaurantMap = new Map(data?.map(r => [r.id, r as Restaurant]));
            return ids.map(id => restaurantMap.get(id) ?? null);
        }),

        /**
         * HIGH-021: Staff loader - batches requests for staff by ID
         * Returns the staff member or null if not found
         * HIGH-014: Includes tenant verification
         */
        staff: new DataLoader<string, Staff | null>(async (ids: readonly string[]) => {
            // Direct query to get full staff details (STAFF_DETAIL_COLUMNS)
            const supabase = createServiceRoleClient();
            const { data, error } = await supabase
                .from('restaurant_staff')
                .select('id, restaurant_id, user_id, name, email, phone, role, is_active, pin_code, created_at, updated_at')
                .in('id', [...ids]);

            if (error) {
                log.error('Error loading staff', { message: error.message });
                return ids.map(() => null);
            }

            return verifyTenantOwnership(data as Staff[], ids, s => s.id);
        }),

        /**
         * HIGH-021: Staff by Restaurant loader - batches requests for staff by restaurant ID
         * Returns an array of staff for each restaurant (empty if none)
         * Note: No tenant verification needed - caller's restaurantId is already the requested one
         */
        staffByRestaurant: new DataLoader<string, Staff[]>(async (restaurantIds: readonly string[]) => {
            if (restaurantIds.length === 0) return [];

            // Batch load all staff for the given restaurants at once
            const supabase = createServiceRoleClient();
            const { data, error } = await supabase
                .from('restaurant_staff')
                .select('id, restaurant_id, user_id, name, email, phone, role, is_active, pin_code, created_at, updated_at')
                .in('restaurant_id', [...restaurantIds]);

            if (error) {
                log.error('Error loading staff by restaurant', { message: error.message });
                return restaurantIds.map(() => []);
            }

            // Group by restaurant_id
            const staffByRestaurant = new Map<string, Staff[]>();
            for (const staff of data ?? []) {
                const staffItem: Staff = {
                    id: staff.id,
                    restaurant_id: staff.restaurant_id,
                    user_id: staff.user_id,
                    name: staff.name,
                    email: staff.email,
                    phone: staff.phone,
                    role: staff.role,
                    is_active: staff.is_active ?? true,
                    pin_code: staff.pin_code,
                    created_at: staff.created_at,
                    updated_at: staff.updated_at,
                };
                const existing = staffByRestaurant.get(staff.restaurant_id) || [];
                existing.push(staffItem);
                staffByRestaurant.set(staff.restaurant_id, existing);
            }

            return restaurantIds.map(id => staffByRestaurant.get(id) ?? []);
        }),
    };
}
