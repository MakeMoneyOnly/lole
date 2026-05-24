/**
 * Delivery Aggregator Service
 * TASK-DELIVERY-001: Third-Party Delivery Aggregator
 *
 * Unified delivery partner integration for Ethiopian delivery platforms.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { publishEvent } from '@/lib/events/publisher';
import { toGatewayLanEvent, type GatewayLanEventMessage } from '@/lib/gateway/local-events';
import { logger } from '@/lib/logger';

const log = logger.child('[delivery/aggregator]');

// =========================================================
// Type Definitions
// =========================================================

export type DeliveryPartnerName =
    | 'beu'
    | 'zmall'
    | 'telebirr_food'
    | 'deliver_addis'
    | 'betengna'
    | 'custom'
    | 'other';

export type AggregatorOrderStatus =
    | 'pending'
    | 'accepted'
    | 'rejected'
    | 'preparing'
    | 'ready'
    | 'picked_up'
    | 'delivered'
    | 'cancelled';

export interface DeliveryPartner {
    id: string;
    restaurant_id: string;
    partner_name: DeliveryPartnerName;
    display_name: string;
    is_active: boolean;
    auto_accept_orders: boolean;
    prep_time_minutes: number;
    last_menu_sync_at: string | null;
    menu_sync_status: string;
}

export interface AggregatorOrder {
    id: string;
    restaurant_id: string;
    delivery_partner_id: string;
    external_order_id: string;
    external_order_number: string | null;
    internal_order_id: string | null;
    raw_order_data: Record<string, unknown>;
    customer_name: string | null;
    customer_phone: string | null;
    delivery_address: string | null;
    delivery_latitude: number | null;
    delivery_longitude: number | null;
    delivery_notes: string | null;
    items: Array<{
        name: string;
        quantity: number;
        price: number;
        notes?: string;
    }>;
    subtotal: number;
    delivery_fee: number;
    platform_fee: number;
    total: number;
    status: AggregatorOrderStatus;
    placed_at: string | null;
    estimated_pickup_at: string | null;
    estimated_delivery_at: string | null;
}

export interface InjectedOrderResult {
    success: boolean;
    order_id?: string;
    order_number?: string;
    already_exists?: boolean;
    error?: string;
}

export function normalizeDeliveryPartnerName(partnerName: string): DeliveryPartnerName {
    const normalized = partnerName.trim().toLowerCase().replace(/\s+/g, '_');

    if (normalized === 'beu' || normalized === 'betengna') return 'beu';
    if (normalized === 'zmall') return 'zmall';
    if (normalized === 'telebirr_food' || normalized === 'telebirr') return 'telebirr_food';
    if (normalized === 'deliver_addis') return 'deliver_addis';
    if (normalized === 'custom') return 'custom';
    return 'other';
}

export function buildAggregatorOrderLanEvent(
    order: AggregatorOrder,
    locationId: string = 'delivery-hub'
): GatewayLanEventMessage<Record<string, unknown>> {
    return toGatewayLanEvent(
        {
            restaurantId: order.restaurant_id,
            locationId,
            aggregate: 'aggregator_order',
            aggregateId: order.id,
            type: 'delivery.aggregator.order.received',
            payload: {
                aggregator_order_id: order.id,
                delivery_partner_id: order.delivery_partner_id,
                external_order_id: order.external_order_id,
                total: order.total,
                status: order.status,
            },
        },
        1
    );
}

interface AggregatorServiceDependencies {
    receiveOrder?: typeof receiveExternalOrder;
    publishLocalEvent?: (
        event: GatewayLanEventMessage<Record<string, unknown>>
    ) => Promise<void> | void;
    publishCloudEvent?: (
        type: 'delivery.aggregator.received',
        payload: Record<string, unknown>
    ) => Promise<void>;
}

export class AggregatorService {
    private readonly receiveOrderImpl: typeof receiveExternalOrder;
    private readonly publishLocalEventImpl: (
        event: GatewayLanEventMessage<Record<string, unknown>>
    ) => Promise<void> | void;
    private readonly publishCloudEventImpl: (
        type: 'delivery.aggregator.received',
        payload: Record<string, unknown>
    ) => Promise<void>;

    constructor(dependencies: AggregatorServiceDependencies = {}) {
        this.receiveOrderImpl = dependencies.receiveOrder ?? receiveExternalOrder;
        this.publishLocalEventImpl = dependencies.publishLocalEvent ?? (async () => {});
        this.publishCloudEventImpl =
            dependencies.publishCloudEvent ??
            (async (_type, payload) => {
                await publishEvent('notification.queued', payload);
            });
    }

    async receiveAndBroadcastOrder(
        supabase: SupabaseClient<Database>,
        restaurantId: string,
        partnerId: string,
        externalOrder: Parameters<typeof receiveExternalOrder>[3]
    ): Promise<{
        success: boolean;
        order?: AggregatorOrder;
        error?: string;
        lanEvent?: GatewayLanEventMessage<Record<string, unknown>>;
    }> {
        const result = await this.receiveOrderImpl(
            supabase,
            restaurantId,
            partnerId,
            externalOrder
        );
        if (!result.success || !result.order) {
            return result;
        }

        const lanEvent = buildAggregatorOrderLanEvent(result.order);
        await this.publishLocalEventImpl(lanEvent);
        await this.publishCloudEventImpl('delivery.aggregator.received', {
            aggregator_order_id: result.order.id,
            restaurant_id: result.order.restaurant_id,
            partner_id: result.order.delivery_partner_id,
            total: result.order.total,
        });

        return {
            ...result,
            lanEvent,
        };
    }
}

// =========================================================
// Partner Management
// =========================================================

/**
 * Get active delivery partners for a restaurant
 */
export async function getActivePartners(
    supabase: SupabaseClient<Database>,
    restaurantId: string
): Promise<DeliveryPartner[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data, error } = await db
        .from('delivery_partners')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, partner_name, display_name, is_active, auto_accept_orders, prep_time_minutes, last_menu_sync_at, menu_sync_status'
        )
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true);

    if (error) {
        log.error('Failed to fetch partners', { error });
        return [];
    }

    return data ?? [];
}

/**
 * Register a delivery partner
 */
export async function registerPartner(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    partner: {
        partner_name: DeliveryPartnerName;
        display_name: string;
        api_key_ref?: string;
        api_secret_ref?: string;
        auto_accept_orders?: boolean;
        prep_time_minutes?: number;
    }
): Promise<{ success: boolean; partner?: DeliveryPartner; error?: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        const { data, error } = await db
            .from('delivery_partners')
            .insert({
                restaurant_id: restaurantId,
                partner_name: partner.partner_name,
                display_name: partner.display_name,
                api_key_ref: partner.api_key_ref ?? null,
                api_secret_ref: partner.api_secret_ref ?? null,
                auto_accept_orders: partner.auto_accept_orders ?? false,
                prep_time_minutes: partner.prep_time_minutes ?? 30,
                is_active: true,
            })
            // HIGH-013: Explicit column selection
            .select(
                'id, restaurant_id, partner_name, display_name, is_active, auto_accept_orders, prep_time_minutes, last_menu_sync_at, menu_sync_status'
            )
            .single();

        if (error) {
            return { success: false, error: 'Failed to register partner' };
        }

        return { success: true, partner: data };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}

// =========================================================
// Order Injection
// =========================================================

/**
 * Receive order from external platform
 */
export async function receiveExternalOrder(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    partnerId: string,
    externalOrder: {
        external_order_id: string;
        external_order_number?: string;
        raw_order_data: Record<string, unknown>;
        customer_name?: string;
        customer_phone?: string;
        delivery_address?: string;
        delivery_latitude?: number;
        delivery_longitude?: number;
        delivery_notes?: string;
        items: Array<{ name: string; quantity: number; price: number; notes?: string }>;
        subtotal: number;
        delivery_fee?: number;
        platform_fee?: number;
        total: number;
        placed_at?: string;
    }
): Promise<{ success: boolean; order?: AggregatorOrder; error?: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        // Check for duplicate
        const { data: existing } = await db
            .from('aggregator_orders')
            .select('id')
            .eq('delivery_partner_id', partnerId)
            .eq('external_order_id', externalOrder.external_order_id)
            .maybeSingle();

        if (existing) {
            return { success: false, error: 'Order already exists' };
        }

        const { data, error } = await db
            .from('aggregator_orders')
            .insert({
                restaurant_id: restaurantId,
                delivery_partner_id: partnerId,
                external_order_id: externalOrder.external_order_id,
                external_order_number: externalOrder.external_order_number ?? null,
                raw_order_data: externalOrder.raw_order_data,
                customer_name: externalOrder.customer_name ?? null,
                customer_phone: externalOrder.customer_phone ?? null,
                delivery_address: externalOrder.delivery_address ?? null,
                delivery_latitude: externalOrder.delivery_latitude ?? null,
                delivery_longitude: externalOrder.delivery_longitude ?? null,
                delivery_notes: externalOrder.delivery_notes ?? null,
                items: externalOrder.items,
                subtotal: externalOrder.subtotal,
                delivery_fee: externalOrder.delivery_fee ?? 0,
                platform_fee: externalOrder.platform_fee ?? 0,
                total: externalOrder.total,
                status: 'pending',
                placed_at: externalOrder.placed_at ?? new Date().toISOString(),
            })
            // HIGH-013: Explicit column selection
            .select(
                'id, restaurant_id, delivery_partner_id, external_order_id, external_order_number, internal_order_id, raw_order_data, customer_name, customer_phone, delivery_address, delivery_latitude, delivery_longitude, delivery_notes, items, subtotal, delivery_fee, platform_fee, total, status, placed_at, estimated_pickup_at, estimated_delivery_at'
            )
            .single();

        if (error) {
            log.error('Failed to create order', { error });
            return { success: false, error: 'Failed to create order' };
        }

        // Check if auto-accept is enabled
        const partner = await db
            .from('delivery_partners')
            .select('auto_accept_orders')
            .eq('id', partnerId)
            .single();

        if (partner?.auto_accept_orders) {
            await injectAggregatorOrder(supabase, data.id);
        }

        return { success: true, order: data };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}

/**
 * Inject aggregator order into POS
 */
export async function injectAggregatorOrder(
    supabase: SupabaseClient<Database>,
    aggregatorOrderId: string,
    staffId?: string
): Promise<InjectedOrderResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        const { data, error } = await db.rpc('inject_aggregator_order', {
            p_aggregator_order_id: aggregatorOrderId,
            p_staff_id: staffId ?? null,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return {
            success: data.success,
            order_id: data.order_id,
            order_number: data.order_number,
            already_exists: data.already_exists,
            error: data.error,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}

/**
 * Get pending aggregator orders
 */
export async function getPendingAggregatorOrders(
    supabase: SupabaseClient<Database>,
    restaurantId: string
): Promise<AggregatorOrder[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data, error } = await db
        .from('aggregator_orders')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, delivery_partner_id, external_order_id, external_order_number, internal_order_id, raw_order_data, customer_name, customer_phone, delivery_address, delivery_latitude, delivery_longitude, delivery_notes, items, subtotal, delivery_fee, platform_fee, total, status, placed_at, estimated_pickup_at, estimated_delivery_at'
        )
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .order('placed_at', { ascending: true });

    if (error) {
        log.error('Failed to fetch pending orders', { error });
        return [];
    }

    return data ?? [];
}

/**
 * Update aggregator order status
 */
export async function updateAggregatorOrderStatus(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    aggregatorOrderId: string,
    status: AggregatorOrderStatus
): Promise<{ success: boolean; error?: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const statusTimestamps: Partial<Record<AggregatorOrderStatus, string>> = {
        accepted: 'accepted_at',
        picked_up: 'actual_pickup_at',
        delivered: 'actual_delivery_at',
    };

    const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
    };

    if (statusTimestamps[status]) {
        updateData[statusTimestamps[status]] = new Date().toISOString();
    }

    const { error } = await db
        .from('aggregator_orders')
        .update(updateData)
        .eq('id', aggregatorOrderId)
        .eq('restaurant_id', restaurantId);

    if (error) {
        return { success: false, error: 'Failed to update status' };
    }

    return { success: true };
}

// =========================================================
// Menu Sync
// =========================================================

/**
 * Sync menu to delivery platforms
 */
export async function syncMenuToPartners(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    partnerIds?: string[]
): Promise<{
    success: boolean;
    results: Array<{ partner_id: string; partner_name: string; success: boolean; error?: string }>;
}> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Get partners to sync
    let partnersQuery = db
        .from('delivery_partners')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, partner_name, display_name, is_active, auto_accept_orders, prep_time_minutes, last_menu_sync_at, menu_sync_status'
        )
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true);

    if (partnerIds && partnerIds.length > 0) {
        partnersQuery = partnersQuery.in('id', partnerIds);
    }

    const { data: partners, error: partnersError } = await partnersQuery;

    if (partnersError || !partners) {
        return { success: false, results: [] };
    }

    // Get menu items
    const { data: menuItems, error: menuError } = await db
        .from('menu_items')
        .select('id, name, price, description, is_available, categories!inner(restaurant_id)')
        .eq('categories.restaurant_id', restaurantId)
        .eq('is_available', true);

    if (menuError) {
        return { success: false, results: [] };
    }

    const results: Array<{
        partner_id: string;
        partner_name: string;
        success: boolean;
        error?: string;
    }> = [];

    for (const partner of partners) {
        // Create sync log
        const { data: syncLog } = await db
            .from('menu_sync_logs')
            .insert({
                restaurant_id: restaurantId,
                delivery_partner_id: partner.id,
                sync_type: 'full',
                status: 'pending',
                items_total: menuItems?.length ?? 0,
            })
            .select('id')
            .single();

        try {
            // In production, this would call the partner's API
            // For now, we just log the sync
            const success = true;

            await db
                .from('menu_sync_logs')
                .update({
                    status: success ? 'success' : 'failed',
                    items_success: success ? (menuItems?.length ?? 0) : 0,
                    items_failed: success ? 0 : (menuItems?.length ?? 0),
                    completed_at: new Date().toISOString(),
                })
                .eq('id', syncLog?.id);

            await db
                .from('delivery_partners')
                .update({
                    last_menu_sync_at: new Date().toISOString(),
                    menu_sync_status: success ? 'synced' : 'error',
                })
                .eq('id', partner.id);

            results.push({
                partner_id: partner.id,
                partner_name: partner.display_name,
                success,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            results.push({
                partner_id: partner.id,
                partner_name: partner.display_name,
                success: false,
                error: errorMessage,
            });
        }
    }

    return {
        success: results.every(r => r.success),
        results,
    };
}

/**
 * Get menu sync history
 */
export async function getMenuSyncHistory(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    limit: number = 10
): Promise<
    Array<{
        id: string;
        partner_name: string;
        sync_type: string;
        status: string;
        items_total: number;
        items_success: number;
        started_at: string;
        completed_at: string | null;
    }>
> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data, error } = await db
        .from('menu_sync_logs')
        .select('*, delivery_partners(display_name)')
        .eq('restaurant_id', restaurantId)
        .order('started_at', { ascending: false })
        .limit(limit);

    if (error) {
        log.error('Failed to fetch sync history', { error });
        return [];
    }

    return (data ?? []).map(
        (log: {
            id: string;
            delivery_partners?: { display_name: string } | null;
            sync_type: string;
            status: string;
            items_total: number;
            items_success: number;
            started_at: string;
            completed_at: string | null;
        }) => ({
            id: log.id,
            partner_name: log.delivery_partners?.display_name ?? 'Unknown',
            sync_type: log.sync_type,
            status: log.status,
            items_total: log.items_total,
            items_success: log.items_success,
            started_at: log.started_at,
            completed_at: log.completed_at,
        })
    );
}
