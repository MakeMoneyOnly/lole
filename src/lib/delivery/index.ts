/**
 * Delivery Partner API Clients Index
 *
 * Unified exports for all Ethiopian delivery partner integrations:
 * - BEU (ቤዩ)
 * - Deliver Addis
 * - Zmall
 * - Esoora
 *
 * Each client provides:
 * - createOrder(): Send order to delivery partner
 * - updateOrderStatus(): Update delivery status
 * - cancelOrder(): Cancel a delivery
 * - getDeliveryFee(): Calculate delivery fee
 * - sendStatusWebhook(): Push status updates to partner
 * - verifyWebhookSignature(): Verify incoming webhook signatures
 * - parseWebhookEvent(): Parse incoming webhook payloads
 * - mapStatusTolole(): Convert partner status to lole status
 * - mapStatusToPartner(): Convert lole status to partner status
 */

import * as BeuClient from './beu';
import * as DeliverAddisClient from './deliver-addis';
import * as ZmallClient from './zmall';
import * as EsooraClient from './esoora';

// Re-export with explicit names to avoid conflicts
export { BeuClient, DeliverAddisClient, ZmallClient, EsooraClient };

// Re-export specific types
export type {
    BEUOrder,
    BEUOrderItem,
    BEUOrderResponse,
    BEUOrderStatus,
    BEUStatusUpdate,
    BEUDeliveryFeeRequest,
    BEUDeliveryFeeResponse,
} from './beu';

export type {
    DeliverAddisOrder,
    DeliverAddisOrderItem,
    DeliverAddisOrderResponse,
    DeliverAddisOrderStatus,
    DeliverAddisStatusUpdate,
    DeliverAddisDeliveryFeeRequest,
    DeliverAddisDeliveryFeeResponse,
} from './deliver-addis';

export type {
    ZmallOrder,
    ZmallOrderItem,
    ZmallOrderResponse,
    ZmallOrderStatus,
    ZmallStatusUpdate,
    ZmallDeliveryFeeRequest,
    ZmallDeliveryFeeResponse,
} from './zmall';

export type {
    EsooraOrder,
    EsooraOrderItem,
    EsooraOrderResponse,
    EsooraOrderStatus,
    EsooraStatusUpdate,
    EsooraDeliveryFeeRequest,
    EsooraDeliveryFeeResponse,
} from './esoora';

// =========================================================
// Provider Types
// =========================================================

export type DeliveryProvider = 'beu' | 'deliver_addis' | 'zmall' | 'esoora' | 'custom_local';

export interface DeliveryPartnerOrder {
    restaurant_slug: string;
    partner_order_id: string;
    estimated_pickup_at: string;
    delivery_note?: string;
    customer_name: string;
    customer_phone: string;
    delivery_address: string;
    delivery_latitude?: number;
    delivery_longitude?: number;
    items: Array<{
        menu_item_id: string;
        name_en: string;
        name_am?: string;
        quantity: number;
        unit_price_santim: number;
        special_instructions?: string;
        modifiers?: Array<{
            modifier_group_id: string;
            modifier_option_id: string;
            name: string;
            price_santim: number;
        }>;
    }>;
    subtotal_santim: number;
    delivery_fee_santim: number;
    total_santim: number;
}

export interface DeliveryPartnerResponse {
    success: boolean;
    partner_order_id: string;
    status: string;
    error?: string;
    error_code?: string;
}

export interface DeliveryFeeRequest {
    origin_latitude: number;
    origin_longitude: number;
    destination_latitude: number;
    destination_longitude: number;
    restaurant_slug?: string;
}

export interface DeliveryFeeResponse {
    success: boolean;
    distance_km: number;
    fee_santim: number;
    estimated_minutes: number;
    error?: string;
}

export interface StatusUpdate {
    status: 'picked_up' | 'delivered' | 'cancelled';
    picked_up_at?: string;
    delivered_at?: string;
    driver_name?: string;
    driver_phone?: string;
    reason?: string;
}

export type OrderStatus =
    | 'pending_confirmation'
    | 'confirmed'
    | 'preparing'
    | 'ready'
    | 'picked_up'
    | 'delivered'
    | 'cancelled';

// =========================================================
// Provider Configuration Map
// =========================================================

export const PROVIDER_CONFIGS = {
    beu: {
        name: 'BEU',
        color: '#FF6B00', // Orange
        orderPrefix: 'BEU',
    },
    deliver_addis: {
        name: 'Deliver Addis',
        color: '#2196F3', // Blue
        orderPrefix: 'DA',
    },
    zmall: {
        name: 'Zmall',
        color: '#00A651', // Green
        orderPrefix: 'ZML',
    },
    esoora: {
        name: 'Esoora',
        color: '#9C27B0', // Purple
        orderPrefix: 'ESR',
    },
    custom_local: {
        name: 'Custom Local',
        color: '#607D8B', // Grey
        orderPrefix: 'LOC',
    },
} as const;

// =========================================================
// Status Mapping Utilities
// =========================================================

/**
 * Map any provider status to lole standard status
 */
export function mapProviderStatusTolole(provider: DeliveryProvider, status: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
        pending: 'pending_confirmation',
        new: 'pending_confirmation',
        confirmed: 'confirmed',
        accepted: 'confirmed',
        preparing: 'preparing',
        cooking: 'preparing',
        ready: 'ready',
        picked_up: 'picked_up',
        on_the_way: 'picked_up',
        delivered: 'delivered',
        completed: 'delivered',
        cancelled: 'cancelled',
        canceled: 'cancelled',
    };

    return statusMap[status.toLowerCase()] || 'pending_confirmation';
}

/**
 * Map lole status to any provider status
 */
export function maploleStatusToProvider(provider: DeliveryProvider, status: OrderStatus): string {
    const statusMap: Record<string, string> = {
        pending_confirmation: 'pending',
        confirmed: 'confirmed',
        preparing: 'preparing',
        ready: 'ready',
        picked_up: 'picked_up',
        delivered: 'delivered',
        cancelled: 'cancelled',
    };

    return statusMap[status] || 'pending';
}

// =========================================================
// Generic Factory (for future extensibility)
// =========================================================

type SupportedProvider = 'beu' | 'deliver_addis' | 'zmall' | 'esoora';

const clients: Record<
    SupportedProvider,
    typeof BeuClient | typeof DeliverAddisClient | typeof ZmallClient | typeof EsooraClient
> = {
    beu: BeuClient,
    deliver_addis: DeliverAddisClient,
    zmall: ZmallClient,
    esoora: EsooraClient,
};

/**
 * Get the appropriate delivery client for a provider
 */
export function getDeliveryClient(
    provider: SupportedProvider
): typeof BeuClient | typeof DeliverAddisClient | typeof ZmallClient | typeof EsooraClient {
    const client = clients[provider];
    if (!client) {
        throw new Error(`Unsupported delivery provider: ${provider}`);
    }
    return client;
}

export async function getPartnerConfig(
    provider: SupportedProvider,
    supabase: import('@supabase/supabase-js').SupabaseClient<import('@/types/database').Database>,
    restaurantId: string
): Promise<{ name: string; color: string; orderPrefix: string } | null> {
    switch (provider) {
        case 'beu':
            return BeuClient.getBEUConfig(supabase, restaurantId);
        case 'deliver_addis':
            return DeliverAddisClient.getDeliverAddisConfig(supabase, restaurantId);
        case 'zmall':
            return ZmallClient.getZmallConfig(supabase, restaurantId);
        case 'esoora':
            return EsooraClient.getEsooraConfig(supabase, restaurantId);
        default:
            throw new Error(`Unsupported delivery provider: ${provider}`);
    }
}
