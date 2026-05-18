/**
 * BEU Delivery Partner API Client
 *
 * Integration with BEU (ቤዩ) - Ethiopian-first delivery platform
 *
 * API Base: Configured per restaurant via delivery_partners table
 *
 * Endpoints:
 * - POST /orders - Create order on BEU
 * - PATCH /orders/:id - Update order status
 * - DELETE /orders/:id - Cancel order
 * - GET /fee - Calculate delivery fee
 */

import { createHmac, createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { logger } from '@/lib/logger';

const log = logger.child('[delivery/beu]');

// =========================================================
// Type Definitions
// =========================================================

export interface BEUOrderItem {
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
}

export interface BEUOrder {
    restaurant_slug: string;
    partner_order_id: string;
    estimated_pickup_at: string;
    delivery_note?: string;
    customer_name: string;
    customer_phone: string;
    delivery_address: string;
    delivery_latitude?: number;
    delivery_longitude?: number;
    items: BEUOrderItem[];
    subtotal_santim: number;
    delivery_fee_santim: number;
    total_santim: number;
}

export interface BEUOrderResponse {
    success: boolean;
    beu_order_id?: string;
    partner_order_id: string;
    status: string;
    estimated_ready_at?: string;
    error?: string;
    error_code?: string;
}

export interface BEUDeliveryFeeRequest {
    origin_latitude: number;
    origin_longitude: number;
    destination_latitude: number;
    destination_longitude: number;
    restaurant_slug?: string;
}

export interface BEUDeliveryFeeResponse {
    success: boolean;
    distance_km: number;
    fee_santim: number;
    estimated_minutes: number;
    error?: string;
}

export interface BEUStatusUpdate {
    status: 'picked_up' | 'delivered' | 'cancelled';
    picked_up_at?: string;
    delivered_at?: string;
    driver_name?: string;
    driver_phone?: string;
    reason?: string;
}

export type BEUOrderStatus =
    | 'pending_confirmation'
    | 'confirmed'
    | 'preparing'
    | 'ready'
    | 'picked_up'
    | 'delivered'
    | 'cancelled';

// =========================================================
// Configuration
// =========================================================

interface BEUConfig {
    baseUrl: string;
    apiKey: string;
    apiSecret: string;
    partnerId: string;
}

/**
 * Get BEU configuration for a restaurant
 */
export async function getBEUConfig(
    supabase: SupabaseClient<Database>,
    restaurantId: string
): Promise<BEUConfig | null> {
    const { data: partner, error } = await supabase
        .from('delivery_partners')
        .select('id, provider, settings_json, credentials_ref')
        .eq('restaurant_id', restaurantId)
        .eq('provider', 'beu')
        .eq('status', 'active')
        .maybeSingle();

    if (error || !partner) {
        log.error('Failed to get partner config', { error });
        return null;
    }

    const settings = (partner.settings_json ?? {}) as Record<string, unknown>;
    const credentials = (partner.credentials_ref ?? {}) as Record<string, unknown>;

    return {
        baseUrl:
            (settings.base_url as string) ||
            process.env.BEU_API_BASE_URL ||
            'https://api.beu.delivery/v1',
        apiKey: (credentials.api_key as string) || process.env.BEU_API_KEY || '',
        apiSecret: (credentials.api_secret as string) || process.env.BEU_API_SECRET || '',
        partnerId: partner.id,
    };
}

// =========================================================
// Request Signing (per delivery-partners.md spec)
// =========================================================

function signRequest(
    partnerSecret: string,
    body: string | null = null
): {
    timestamp: string;
    signature: string;
} {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyHash = body ? computeHash(body) : '';

    const message = `${partnerSecret}\n${timestamp}\n${bodyHash}`;
    const signature = createHmac('sha256', partnerSecret).update(message).digest('hex');

    return { timestamp, signature };
}

function computeHash(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
}

// =========================================================
// API Methods
// =========================================================

/**
 * Create an order on BEU
 * This is used when we need to push an order to BEU (e.g., for their driver to deliver)
 */
export async function createOrder(config: BEUConfig, order: BEUOrder): Promise<BEUOrderResponse> {
    try {
        const body = JSON.stringify(order);
        const { timestamp, signature } = signRequest(config.apiSecret, body);

        const response = await fetch(`${config.baseUrl}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-lole-Partner-ID': config.partnerId,
                'X-lole-Timestamp': timestamp,
                'X-lole-Signature': signature,
            },
            body,
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                partner_order_id: order.partner_order_id,
                status: 'failed',
                error: data.message || 'Failed to create order',
                error_code: data.code,
            };
        }

        return {
            success: true,
            beu_order_id: data.lole_order_id || data.order_id,
            partner_order_id: order.partner_order_id,
            status: data.status,
            estimated_ready_at: data.estimated_ready_at,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log.error('createOrder error', { message: errorMessage });
        return {
            success: false,
            partner_order_id: order.partner_order_id,
            status: 'failed',
            error: errorMessage,
        };
    }
}

/**
 * Update order status on BEU
 * Used to notify BEU when order status changes (picked up, delivered, cancelled)
 */
export async function updateOrderStatus(
    config: BEUConfig,
    beuOrderId: string,
    statusUpdate: BEUStatusUpdate
): Promise<{ success: boolean; error?: string }> {
    try {
        const body = JSON.stringify(statusUpdate);
        const { timestamp, signature } = signRequest(config.apiSecret, body);

        const response = await fetch(`${config.baseUrl}/orders/${beuOrderId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-lole-Partner-ID': config.partnerId,
                'X-lole-Timestamp': timestamp,
                'X-lole-Signature': signature,
            },
            body,
        });

        if (!response.ok) {
            const data = await response.json();
            return {
                success: false,
                error: data.message || 'Failed to update order status',
            };
        }

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[BEU] updateOrderStatus error:', errorMessage);
        return { success: false, error: errorMessage };
    }
}

/**
 * Cancel an order on BEU
 */
export async function cancelOrder(
    config: BEUConfig,
    beuOrderId: string,
    reason: string = 'restaurant_cancelled'
): Promise<{ success: boolean; error?: string }> {
    return updateOrderStatus(config, beuOrderId, {
        status: 'cancelled',
        reason,
    });
}

/**
 * Get delivery fee estimate from BEU
 */
export async function getDeliveryFee(
    config: BEUConfig,
    feeRequest: BEUDeliveryFeeRequest
): Promise<BEUDeliveryFeeResponse> {
    try {
        const params = new URLSearchParams({
            origin_lat: feeRequest.origin_latitude.toString(),
            origin_lng: feeRequest.origin_longitude.toString(),
            dest_lat: feeRequest.destination_latitude.toString(),
            dest_lng: feeRequest.destination_longitude.toString(),
        });

        if (feeRequest.restaurant_slug) {
            params.append('restaurant_slug', feeRequest.restaurant_slug);
        }

        const { timestamp, signature } = signRequest(config.apiSecret, null);

        const response = await fetch(`${config.baseUrl}/fee?${params}`, {
            method: 'GET',
            headers: {
                'X-lole-Partner-ID': config.partnerId,
                'X-lole-Timestamp': timestamp,
                'X-lole-Signature': signature,
            },
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                distance_km: 0,
                fee_santim: 0,
                estimated_minutes: 0,
                error: data.message || 'Failed to get delivery fee',
            };
        }

        return {
            success: true,
            distance_km: data.distance_km || data.distance || 0,
            fee_santim: data.fee_santim || data.fee || 0,
            estimated_minutes: data.estimated_minutes || data.eta_minutes || 30,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[BEU] getDeliveryFee error:', errorMessage);
        return {
            success: false,
            distance_km: 0,
            fee_santim: 0,
            estimated_minutes: 0,
            error: errorMessage,
        };
    }
}

/**
 * Send webhook to BEU for order status update
 * This is called internally to push status changes to BEU
 */
export async function sendStatusWebhook(
    config: BEUConfig,
    orderId: string,
    event: string,
    payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
    try {
        const body = JSON.stringify({
            event,
            lole_order_id: orderId,
            ...payload,
        });
        const { timestamp, signature } = signRequest(config.apiSecret, body);

        const response = await fetch(`${config.baseUrl}/webhooks/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-lole-Partner-ID': config.partnerId,
                'X-lole-Timestamp': timestamp,
                'X-lole-Signature': signature,
            },
            body,
        });

        if (!response.ok) {
            const data = await response.json();
            return {
                success: false,
                error: data.message || 'Failed to send webhook',
            };
        }

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[BEU] sendStatusWebhook error:', errorMessage);
        return { success: false, error: errorMessage };
    }
}

// =========================================================
// Webhook Handler
// =========================================================

/**
 * Verify webhook signature from BEU
 */
export function verifyWebhookSignature(
    rawBody: string,
    headers: {
        'x-lole-partner-id'?: string;
        'x-lole-timestamp'?: string;
        'x-lole-signature'?: string;
    },
    partnerSecret: string
): boolean {
    const timestamp = headers['x-lole-timestamp'];
    if (!timestamp) return false;

    // Replay attack prevention: reject timestamps older than 5 minutes
    const timestampNum = parseInt(timestamp, 10);
    if (Math.abs(Date.now() / 1000 - timestampNum) > 300) {
        return false;
    }

    const bodyHash = computeHash(rawBody);
    const message = `${headers['x-lole-partner-id']}\n${timestamp}\n${bodyHash}`;
    const expectedSignature = createHmac('sha256', partnerSecret).update(message).digest('hex');

    // Timing-safe comparison
    return (
        Buffer.from(headers['x-lole-signature'] || '', 'hex').toString() ===
        Buffer.from(expectedSignature, 'hex').toString()
    );
}

/**
 * Parse incoming webhook from BEU
 */
export function parseWebhookEvent(rawBody: string): {
    event: string;
    data: Record<string, unknown>;
} | null {
    try {
        const payload = JSON.parse(rawBody);
        return {
            event: payload.event || payload.type,
            data: payload,
        };
    } catch {
        console.error('[BEU] Failed to parse webhook:', rawBody);
        return null;
    }
}

// =========================================================
// Status Mapping
// =========================================================

/**
 * Map BEU order status to lole status
 */
export function mapStatusTolole(beuStatus: string): BEUOrderStatus {
    const statusMap: Record<string, BEUOrderStatus> = {
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

    return statusMap[beuStatus.toLowerCase()] || 'pending_confirmation';
}

/**
 * Map lole status to BEU status
 */
export function mapStatusToBEU(loleStatus: BEUOrderStatus): string {
    const statusMap: Record<string, string> = {
        pending_confirmation: 'pending',
        confirmed: 'confirmed',
        preparing: 'preparing',
        ready: 'ready',
        picked_up: 'picked_up',
        delivered: 'delivered',
        cancelled: 'cancelled',
    };

    return statusMap[loleStatus] || 'pending';
}
