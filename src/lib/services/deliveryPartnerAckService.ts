/**
 * Delivery Partner Auto-Acknowledge Service
 *
 * Handles automatic acknowledgment of incoming orders from delivery partners.
 * When a merchant has "Auto-accept incoming orders" enabled, this service
 * automatically sends the Ack signal back to the delivery partner.
 */

import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/api/audit';

// Partner API configurations for sending acknowledgments
const PARTNER_ACK_CONFIGS = {
    beu: {
        name: 'Beu',
        ack_url: process.env.BEU_ACK_URL ?? 'https://api.beu.et/orders/ack',
        api_key: process.env.BEU_API_KEY,
    },
    zmall: {
        name: 'Zmall',
        ack_url: process.env.ZMALL_ACK_URL ?? 'https://api.zmall.et/orders/acknowledge',
        api_key: process.env.ZMALL_API_KEY,
    },
    deliver_addis: {
        name: 'Deliver Addis',
        ack_url: process.env.DELIVER_ADDIS_ACK_URL ?? 'https://api.deliveraddis.com/orders/accept',
        api_key: process.env.DELIVER_ADDIS_API_KEY,
    },
    esoora: {
        name: 'Esoora',
        ack_url: process.env.ESOORA_ACK_URL ?? 'https://api.esoora.et/orders/ack',
        api_key: process.env.ESOORA_API_KEY,
    },
} as const;

type DeliveryPartner = keyof typeof PARTNER_ACK_CONFIGS;

export interface AcknowledgeResult {
    success: boolean;
    acknowledgedAt?: string;
    estimatedPrepTime?: number;
    error?: string;
}

/**
 * Check if auto-accept is enabled for a restaurant
 */
export async function isAutoAcceptEnabled(restaurantId: string): Promise<boolean> {
    const supabase = await createClient();

    const { data: restaurant, error } = await supabase
        .from('restaurants')
        .select('settings')
        .eq('id', restaurantId)
        .maybeSingle();

    if (error || !restaurant) {
        return false;
    }

    const settings = (restaurant.settings ?? {}) as Record<string, unknown>;
    const channels = (settings.channels ?? {}) as Record<string, unknown>;
    const deliveryPartners = (channels.delivery_partners ?? {}) as Record<string, unknown>;

    return (deliveryPartners.auto_accept_orders as boolean) ?? false;
}

/**
 * Get estimated prep time for a restaurant
 */
export async function getEstimatedPrepTime(restaurantId: string): Promise<number> {
    const supabase = await createClient();

    const { data: restaurant, error } = await supabase
        .from('restaurants')
        .select('settings')
        .eq('id', restaurantId)
        .maybeSingle();

    if (error || !restaurant) {
        return 30; // Default 30 minutes
    }

    const settings = (restaurant.settings ?? {}) as Record<string, unknown>;
    const channels = (settings.channels ?? {}) as Record<string, unknown>;
    const onlineOrdering = (channels.online_ordering ?? {}) as Record<string, unknown>;

    return (onlineOrdering.estimated_prep_time_minutes as number) ?? 30;
}

/**
 * Auto-acknowledge an incoming order from a delivery partner
 */
export async function autoAcknowledgeOrder(
    orderId: string,
    restaurantId: string,
    partner: DeliveryPartner,
    partnerOrderId: string
): Promise<AcknowledgeResult> {
    // Check if auto-accept is enabled
    const autoAcceptEnabled = await isAutoAcceptEnabled(restaurantId);

    if (!autoAcceptEnabled) {
        return {
            success: false,
            error: 'Auto-accept is not enabled for this restaurant',
        };
    }

    const estimatedPrepTime = await getEstimatedPrepTime(restaurantId);
    const partnerConfig = PARTNER_ACK_CONFIGS[partner];

    if (!partnerConfig) {
        return {
            success: false,
            error: `Unknown delivery partner: ${partner}`,
        };
    }

    if (!partnerConfig.api_key) {
        return {
            success: false,
            error: `API key not configured for delivery partner: ${partner}`,
        };
    }

    try {
        // Send acknowledgment to partner
        const response = await fetch(partnerConfig.ack_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${partnerConfig.api_key}`,
                'X-Partner': partner,
            },
            body: JSON.stringify({
                order_id: partnerOrderId,
                status: 'accepted',
                estimated_prep_time: estimatedPrepTime,
                timestamp: new Date().toISOString(),
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message ?? `Ack failed: ${response.status}`);
        }

        // Update order status in database
        const supabase = await createClient();
        await supabase
            .from('external_orders')
            .update({
                normalized_status: 'confirmed',
                acknowledged_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        // Log the acknowledgment
        await writeAuditLog(supabase, {
            restaurant_id: restaurantId,
            action: 'order_auto_acknowledged',
            entity_type: 'external_order',
            entity_id: orderId,
            metadata: {
                partner,
                partner_order_id: partnerOrderId,
                estimated_prep_time: estimatedPrepTime,
            },
        });

        return {
            success: true,
            acknowledgedAt: new Date().toISOString(),
            estimatedPrepTime,
        };
    } catch (error) {
        console.error('Auto-acknowledge failed:', error);

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Acknowledgment failed',
        };
    }
}

/**
 * Manually acknowledge an order (when auto-accept is disabled)
 */
export async function manualAcknowledgeOrder(
    orderId: string,
    restaurantId: string,
    partner: DeliveryPartner,
    partnerOrderId: string,
    userId: string
): Promise<AcknowledgeResult> {
    const estimatedPrepTime = await getEstimatedPrepTime(restaurantId);
    const partnerConfig = PARTNER_ACK_CONFIGS[partner];

    if (!partnerConfig) {
        return {
            success: false,
            error: `Unknown delivery partner: ${partner}`,
        };
    }

    if (!partnerConfig.api_key) {
        return {
            success: false,
            error: `API key not configured for delivery partner: ${partner}`,
        };
    }

    try {
        const response = await fetch(partnerConfig.ack_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${partnerConfig.api_key}`,
            },
            body: JSON.stringify({
                order_id: partnerOrderId,
                status: 'accepted',
                estimated_prep_time: estimatedPrepTime,
                timestamp: new Date().toISOString(),
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message ?? `Ack failed: ${response.status}`);
        }

        const supabase = await createClient();
        await supabase
            .from('external_orders')
            .update({
                normalized_status: 'confirmed',
                acknowledged_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        await writeAuditLog(supabase, {
            restaurant_id: restaurantId,
            user_id: userId,
            action: 'order_manually_acknowledged',
            entity_type: 'external_order',
            entity_id: orderId,
            metadata: {
                partner,
                partner_order_id: partnerOrderId,
                estimated_prep_time: estimatedPrepTime,
            },
        });

        return {
            success: true,
            acknowledgedAt: new Date().toISOString(),
            estimatedPrepTime,
        };
    } catch (error) {
        console.error('Manual acknowledge failed:', error);

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Acknowledgment failed',
        };
    }
}

/**
 * Reject an order from a delivery partner
 */
export async function rejectOrder(
    orderId: string,
    restaurantId: string,
    partner: DeliveryPartner,
    partnerOrderId: string,
    reason: string,
    userId?: string
): Promise<{ success: boolean; error?: string }> {
    const partnerConfig = PARTNER_ACK_CONFIGS[partner];

    if (!partnerConfig) {
        return {
            success: false,
            error: `Unknown delivery partner: ${partner}`,
        };
    }

    if (!partnerConfig.api_key) {
        return {
            success: false,
            error: `API key not configured for delivery partner: ${partner}`,
        };
    }

    try {
        const response = await fetch(`${partnerConfig.ack_url.replace('/ack', '/reject')}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${partnerConfig.api_key}`,
            },
            body: JSON.stringify({
                order_id: partnerOrderId,
                status: 'rejected',
                reason: reason,
                timestamp: new Date().toISOString(),
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message ?? `Reject failed: ${response.status}`);
        }

        const supabase = await createClient();
        await supabase
            .from('external_orders')
            .update({
                normalized_status: 'cancelled',
                updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

        await writeAuditLog(supabase, {
            restaurant_id: restaurantId,
            user_id: userId,
            action: 'order_rejected',
            entity_type: 'external_order',
            entity_id: orderId,
            metadata: {
                partner,
                partner_order_id: partnerOrderId,
                reason,
            },
        });

        return { success: true };
    } catch (error) {
        console.error('Order rejection failed:', error);

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Rejection failed',
        };
    }
}
