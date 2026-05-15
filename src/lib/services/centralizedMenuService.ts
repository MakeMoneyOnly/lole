/**
 * Centralized Menu Management Service
 * TASK-MULTI-001: Push menu changes to all locations from one place
 *
 * Enables multi-location restaurants to manage menus centrally.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json, TablesInsert } from '@/types/database';
import { logger } from '@/lib/logger';

const log = logger.child('CentralizedMenu');

type DbClient = SupabaseClient<Database>;

// =========================================================
// Type Definitions
// =========================================================

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'partial' | null;

export interface MenuLocation {
    id: string;
    restaurant_id: string;
    restaurant_name: string;
    is_primary: boolean;
    sync_enabled: boolean;
    last_sync_at: string | null;
    sync_status: SyncStatus;
    pending_changes: number;
}

export interface MenuChange {
    id: string;
    change_type: 'create' | 'update' | 'delete' | 'price_change' | 'availability_change';
    entity_type: 'category' | 'menu_item' | 'modifier_group' | 'modifier_option';
    entity_id: string;
    location_ids: string[];
    change_data: Json;
    status: 'pending' | 'applied' | 'failed';
    applied_at: string | null;
    applied_to: string[];
    failed_at: string | null;
    error_message: string | null;
    created_at: string;
    created_by: string;
}

export interface CentralizedMenuConfig {
    id: string;
    primary_restaurant_id: string;
    name: string;
    description: string | null;
    sync_categories: boolean;
    sync_items: boolean;
    sync_modifiers: boolean;
    sync_pricing: boolean;
    sync_availability: boolean;
    auto_sync_enabled: boolean;
    sync_schedule: string | null;
    created_at: string;
    updated_at: string;
}

export interface SyncResult {
    location_id: string;
    location_name: string;
    success: boolean;
    changes_applied: number;
    changes_failed: number;
    errors: string[];
}

// =========================================================
// Location Management
// =========================================================

/**
 * Get all locations in a menu group
 */
export async function getMenuLocations(
    supabase: SupabaseClient<Database>,
    primaryRestaurantId: string
): Promise<MenuLocation[]> {
    const db = supabase as unknown as DbClient;

    try {
        // Get the menu group configuration
        const { data: config } = await db
            .from('centralized_menu_configs')
            .select('id')
            .eq('primary_restaurant_id', primaryRestaurantId)
            .maybeSingle();

        if (!config) {
            return [];
        }

        // Get all linked restaurants
        const { data: links, error } = await db
            .from('menu_location_links')
            .select(
                `
                restaurant_id,
                is_primary,
                sync_enabled,
                last_sync_at,
                sync_status,
                pending_changes,
                restaurants(id, name)
            `
            )
            .eq('menu_config_id', config.id);

if (error) {
                log.error('Failed to fetch locations', error);
                return [];
            }

        return (links ?? []).map(
            (link: {
                restaurant_id: string;
                is_primary: boolean;
                sync_enabled: boolean;
                last_sync_at: string | null;
                sync_status: string | null;
                pending_changes: number;
                restaurants: { name: string } | null;
            }) => ({
                id: link.restaurant_id,
                restaurant_id: link.restaurant_id,
                restaurant_name: link.restaurants?.name ?? 'Unknown',
                is_primary: link.is_primary,
                sync_enabled: link.sync_enabled,
                last_sync_at: link.last_sync_at,
                sync_status: link.sync_status as SyncStatus,
                pending_changes: link.pending_changes,
            })
        );
    } catch (error) {
        log.error('Error fetching menu locations', error);
        return [];
    }
}

/**
 * Add a location to the menu group
 */
export async function addMenuLocation(
    supabase: SupabaseClient<Database>,
    primaryRestaurantId: string,
    targetRestaurantId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    const db = supabase as unknown as DbClient;

    try {
        // Get or create menu config
        let { data: config } = await db
            .from('centralized_menu_configs')
            .select('id')
            .eq('primary_restaurant_id', primaryRestaurantId)
            .maybeSingle();

        if (!config) {
            const { data: newConfig, error: configError } = await db
                .from('centralized_menu_configs')
                .insert({
                    primary_restaurant_id: primaryRestaurantId,
                    name: 'Main Menu',
                    sync_categories: true,
                    sync_items: true,
                    sync_modifiers: true,
                    sync_pricing: false,
                    sync_availability: true,
                    auto_sync_enabled: false,
                })
                .select('id')
                .single();

            if (configError) {
                return { success: false, error: 'Failed to create menu config' };
            }
            config = newConfig;
        }

        // Add the link
        const { error: linkError } = await db.from('menu_location_links').insert({
            menu_config_id: (config as { id: string }).id,
            restaurant_id: targetRestaurantId,
            is_primary: targetRestaurantId === primaryRestaurantId,
            sync_enabled: true,
            sync_status: 'pending',
            pending_changes: 0,
        });

        if (linkError) {
            return { success: false, error: 'Failed to add location' };
        }

        // Log the change
        await db.from('audit_logs').insert({
            action: 'add_menu_location',
            entity_type: 'centralized_menu',
            entity_id: (config as { id: string }).id,
            restaurant_id: primaryRestaurantId,
            user_id: userId,
            metadata: { target_restaurant_id: targetRestaurantId },
        });

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}

// =========================================================
// Menu Sync Operations
// =========================================================

/**
 * Push menu changes to all locations
 */
export async function pushMenuToLocations(
    supabase: SupabaseClient<Database>,
    primaryRestaurantId: string,
    options?: {
        locationIds?: string[];
        syncCategories?: boolean;
        syncItems?: boolean;
        syncModifiers?: boolean;
        syncPricing?: boolean;
        syncAvailability?: boolean;
    }
): Promise<{ success: boolean; results: SyncResult[] }> {
    const db = supabase as unknown as DbClient;

    try {
        // Get config
        // HIGH-013: Explicit column selection
        const { data: config } = await db
            .from('centralized_menu_configs')
            .select(
                'id, primary_restaurant_id, name, description, sync_categories, sync_items, sync_modifiers, sync_pricing, sync_availability, auto_sync_enabled, sync_schedule, created_at, updated_at'
            )
            .eq('primary_restaurant_id', primaryRestaurantId)
            .maybeSingle();

        if (!config) {
            return { success: false, results: [] };
        }

        const menuConfig = config as MenuConfigRecord;

        // Get target locations
        let locationsQuery = db
            .from('menu_location_links')
            .select(
                `
                restaurant_id,
                sync_enabled,
                restaurants(id, name)
            `
            )
            .eq('menu_config_id', menuConfig.id)
            .eq('sync_enabled', true);

        if (options?.locationIds && options.locationIds.length > 0) {
            locationsQuery = locationsQuery.in('restaurant_id', options.locationIds);
        }

        const { data: locations } = await locationsQuery;

        if (!locations || locations.length === 0) {
            return { success: true, results: [] };
        }

        const results: SyncResult[] = [];
        for (const location of locations as unknown as MenuLocationLink[]) {
            const result = await syncMenuToLocation(
                db,
                location.restaurant_id,
                { categories: [], menuItems: [], modifierGroups: [], modifierOptions: [] },
                {
                    syncCategories: options?.syncCategories ?? menuConfig.sync_categories,
                    syncItems: options?.syncItems ?? menuConfig.sync_items,
                    syncModifiers: options?.syncModifiers ?? menuConfig.sync_modifiers,
                    syncPricing: options?.syncPricing ?? menuConfig.sync_pricing,
                    syncAvailability: options?.syncAvailability ?? menuConfig.sync_availability,
                }
            );
            results.push({
                location_id: location.restaurant_id,
                location_name: location.restaurants?.name ?? '',
                success: result.success,
                changes_applied: result.changesApplied,
                changes_failed: result.changesFailed,
                errors: result.errors,
            });
        }

        return {
            success: results.every(r => r.success),
            results,
        };
    } catch (error) {
        log.error('Push failed', error);
        return { success: false, results: [] };
    }
}

/**
 * Get full menu data from a restaurant
 */

interface MenuLocationLink {
    restaurant_id: string;
    is_primary: boolean;
    sync_enabled: boolean;
    last_sync_at: string | null;
    sync_status: string | null;
    pending_changes: number;
    restaurants: { name: string } | null;
}

interface MenuConfigRecord {
    id: string;
    primary_restaurant_id: string;
    name: string;
    description: string | null;
    sync_categories: boolean;
    sync_items: boolean;
    sync_modifiers: boolean;
    sync_pricing: boolean;
    sync_availability: boolean;
    auto_sync_enabled: boolean;
    sync_schedule: string | null;
    created_at: string;
    updated_at: string;
}

interface CategoryRow {
    id: string;
    restaurant_id: string;
    name: string;
    name_am: string | null;
    order_index: number | null;
    section?: string | null;
    created_at: string | null;
    updated_at: string | null;
}

interface MenuItemRow {
    id: string;
    category_id: string;
    name: string;
    name_am: string | null;
    description: string | null;
    description_am: string | null;
    image_url: string | null;
    is_available: boolean | null;
    is_chef_special: boolean | null;
    is_fasting: boolean | null;
    allergens: string[] | null;
    dietary_tags: string[] | null;
    station: string | null;
    course: string;
    connected_stations: string[];
    price: number;
    categories?: { restaurant_id: string };
}

interface ModifierGroupRow {
    id: string;
    restaurant_id: string;
    menu_item_id: string;
    name: string;
    name_am: string | null;
    required: boolean | null;
    multi_select: boolean | null;
    min_select: number | null;
    max_select: number | null;
    sort_order: number | null;
    is_active: boolean | null;
    created_at: string | null;
    updated_at: string | null;
}

interface ModifierOptionRow {
    id: string;
    restaurant_id: string;
    modifier_group_id: string;
    name: string;
    name_am: string | null;
    sort_order: number | null;
    is_available: boolean | null;
    price_adjustment: number | null;
    created_at: string | null;
}

interface _MenuLocationRow {
    restaurant_id: string;
    sync_enabled: boolean;
    restaurants: { name: string } | null;
}

interface MenuLinkRow {
    restaurant_id: string;
}

interface _MenuChangeQueueRow {
    id: string;
    change_type: string;
    entity_type: string;
    entity_id: string;
    location_ids: string[];
    change_data: Record<string, unknown>;
    status: string;
    applied_at: string | null;
    applied_to: string[];
    failed_at: string | null;
    error_message: string | null;
    created_at: string;
    created_by: string;
}

async function _getFullMenuData(
    db: DbClient,
    restaurantId: string
): Promise<{
    categories: CategoryRow[];
    menuItems: MenuItemRow[];
    modifierGroups: ModifierGroupRow[];
    modifierOptions: ModifierOptionRow[];
}> {
    // Get categories
    // HIGH-013: Explicit column selection
    const { data: categories } = await db
        .from('categories')
        .select('id, restaurant_id, name, name_am, order_index, section, created_at, updated_at')
        .eq('restaurant_id', restaurantId)
        .order('order_index');

    // Get menu items
    const { data: menuItems } = await db
        .from('menu_items')
        .select(
            `
            id, category_id, name, name_am, description, description_am, image_url, is_available, is_chef_special, is_fasting, allergens, dietary_tags, station, course, connected_stations, price,
            categories!inner(restaurant_id)
        `
        )
        .eq('categories.restaurant_id', restaurantId);

    // Get modifier groups
    // HIGH-013: Explicit column selection
    const { data: modifierGroups } = await db
        .from('modifier_groups')
        .select(
            'id, restaurant_id, menu_item_id, name, name_am, required, multi_select, min_select, max_select, sort_order, is_active, created_at, updated_at'
        )
        .eq('restaurant_id', restaurantId);

    // Get modifier options
    // HIGH-013: Explicit column selection (continued)
    const { data: modifierOptions } = await db
        .from('modifier_options')
        .select(
            'id, restaurant_id, modifier_group_id, name, name_am, sort_order, is_available, price_adjustment, created_at'
        )
        .eq('restaurant_id', restaurantId);

    return {
        categories: categories ?? [],
        menuItems: menuItems ?? [],
        modifierGroups: modifierGroups ?? [],
        modifierOptions: modifierOptions ?? [],
    };
}

/**
 * Sync menu data to a single location
 */

async function syncMenuToLocation(
    db: DbClient,
    targetRestaurantId: string,
    menuData: {
        categories: CategoryRow[];
        menuItems: MenuItemRow[];
        modifierGroups: ModifierGroupRow[];
        modifierOptions: ModifierOptionRow[];
    },
    options: {
        syncCategories: boolean;
        syncItems: boolean;
        syncModifiers: boolean;
        syncPricing: boolean;
        syncAvailability: boolean;
    }
): Promise<{
    success: boolean;
    changesApplied: number;
    changesFailed: number;
    errors: string[];
}> {
    const errors: string[] = [];
    let changesApplied = 0;
    let changesFailed = 0;

    try {
        // Sync categories
        if (options.syncCategories) {
            for (const category of menuData.categories) {
                try {
                    const { error } = await db.from('categories').upsert(
                        {
                            id: category.id,
                            restaurant_id: targetRestaurantId,
                            name: category.name,
                            name_am: category.name_am,
                            order_index: category.order_index,
                            section: category.section,
                        },
                        { onConflict: 'id' }
                    );

                    if (error) {
                        errors.push(`Category ${category.name}: ${error.message}`);
                        changesFailed++;
                    } else {
                        changesApplied++;
                    }
                } catch (_e) {
                    errors.push(`Category ${category.name}: Unknown error`);
                    changesFailed++;
                }
            }
        }

        // Sync menu items
        if (options.syncItems) {
            for (const item of menuData.menuItems) {
                try {
                    const itemData: Record<string, unknown> = {
                        id: item.id,
                        category_id: item.category_id,
                        name: item.name,
                        name_am: item.name_am,
                        description: item.description,
                        description_am: item.description_am,
                        image_url: item.image_url,
                        is_available: item.is_available,
                        is_chef_special: item.is_chef_special,
                        is_fasting: item.is_fasting,
                        allergens: item.allergens,
                        dietary_tags: item.dietary_tags,
                        station: item.station,
                        course: item.course,
                        connected_stations: item.connected_stations,
                    };

                    if (options.syncPricing) {
                        itemData.price = item.price;
                    }

                    if (options.syncAvailability) {
                        itemData.is_available = item.is_available;
                    }

                    const { error } = await db
                        .from('menu_items')
                        .upsert(itemData as TablesInsert<'menu_items'>, { onConflict: 'id' });

                    if (error) {
                        errors.push(`Item ${item.name}: ${error.message}`);
                        changesFailed++;
                    } else {
                        changesApplied++;
                    }
                } catch (_e) {
                    errors.push(`Item ${item.name}: Unknown error`);
                    changesFailed++;
                }
            }
        }

        // Sync modifier groups
        if (options.syncModifiers) {
            for (const group of menuData.modifierGroups) {
                try {
                    const { error } = await db.from('modifier_groups').upsert(
                        {
                            id: group.id,
                            restaurant_id: targetRestaurantId,
                            menu_item_id: group.menu_item_id,
                            name: group.name,
                            name_am: group.name_am,
                            required: group.required,
                            multi_select: group.multi_select,
                            min_select: group.min_select,
                            max_select: group.max_select,
                            sort_order: group.sort_order,
                            is_active: group.is_active,
                        },
                        { onConflict: 'id' }
                    );

                    if (error) {
                        errors.push(`Modifier group ${group.name}: ${error.message}`);
                        changesFailed++;
                    } else {
                        changesApplied++;
                    }
                } catch (_e) {
                    errors.push(`Modifier group ${group.name}: Unknown error`);
                    changesFailed++;
                }
            }

            // Sync modifier options
            for (const option of menuData.modifierOptions) {
                try {
                    const optionData: Record<string, unknown> = {
                        id: option.id,
                        restaurant_id: targetRestaurantId,
                        modifier_group_id: option.modifier_group_id,
                        name: option.name,
                        name_am: option.name_am,
                        sort_order: option.sort_order,
                        is_available: option.is_available,
                    };

                    if (options.syncPricing) {
                        optionData.price_adjustment = option.price_adjustment;
                    }

                    const { error } = await db
                        .from('modifier_options')
                        .upsert(optionData as TablesInsert<'modifier_options'>, {
                            onConflict: 'id',
                        });

                    if (error) {
                        errors.push(`Modifier option ${option.name}: ${error.message}`);
                        changesFailed++;
                    } else {
                        changesApplied++;
                    }
                } catch (_e) {
                    errors.push(`Modifier option ${option.name}: Unknown error`);
                    changesFailed++;
                }
            }
        }

        return {
            success: errors.length === 0,
            changesApplied,
            changesFailed,
            errors,
        };
    } catch (error) {
        return {
            success: false,
            changesApplied,
            changesFailed,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
        };
    }
}

// =========================================================
// Change Tracking
// =========================================================

/**
 * Record a menu change for sync
 */
export async function recordMenuChange(
    supabase: SupabaseClient<Database>,
    primaryRestaurantId: string,
    change: {
        change_type: 'create' | 'update' | 'delete' | 'price_change' | 'availability_change';
        entity_type: 'category' | 'menu_item' | 'modifier_group' | 'modifier_option';
        entity_id: string;
        change_data: Record<string, unknown>;
    },
    userId: string
): Promise<void> {
    const db = supabase as unknown as DbClient;

    try {
        // Get config
        const { data: config } = await db
            .from('centralized_menu_configs')
            .select('id')
            .eq('primary_restaurant_id', primaryRestaurantId)
            .maybeSingle();

        if (!config) {
            return;
        }

        const configId = (config as { id: string }).id;

        // Get linked locations
        const { data: links } = await db
            .from('menu_location_links')
            .select('restaurant_id')
            .eq('menu_config_id', configId)
            .eq('sync_enabled', true)
            .neq('restaurant_id', primaryRestaurantId);

        if (!links || links.length === 0) {
            return;
        }

        const typedLinks = links as MenuLinkRow[];

        // Record the change
        await db.from('menu_change_queue').insert({
            menu_config_id: configId,
            change_type: change.change_type,
            entity_type: change.entity_type,
            entity_id: change.entity_id,
            location_ids: typedLinks.map(l => l.restaurant_id),
            change_data: change.change_data as Json,
            status: 'pending',
            created_by: userId,
        });

        // Update pending changes count for each location
        for (const link of typedLinks) {
            await db.rpc('increment_pending_changes', {
                p_restaurant_id: link.restaurant_id,
                p_menu_config_id: configId,
            });
        }
    } catch (error) {
        log.error('Failed to record change', error);
    }
}

/**
 * Get pending changes for a location
 */
export async function getPendingChanges(
    supabase: SupabaseClient<Database>,
    primaryRestaurantId: string
): Promise<MenuChange[]> {
    const db = supabase as unknown as DbClient;

    try {
        const { data: config } = await db
            .from('centralized_menu_configs')
            .select('id')
            .eq('primary_restaurant_id', primaryRestaurantId)
            .maybeSingle();

        if (!config) {
            return [];
        }

        // HIGH-013: Explicit column selection
        const { data, error } = await db
            .from('menu_change_queue')
            .select(
                'id, menu_config_id, change_type, entity_type, entity_id, location_ids, change_data, status, applied_at, applied_to, failed_at, error_message, created_at, created_by'
            )
            .eq('menu_config_id', config.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: true });

        if (error) {
            log.error('Failed to fetch pending changes', error);
            return [];
        }

        return (data ?? []) as MenuChange[];
    } catch (error) {
        log.error('Error fetching pending changes', error);
        return [];
    }
}
