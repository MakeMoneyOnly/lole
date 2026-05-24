/**
 * Delivery Dispatch Service
 *
 * Handles automatic driver dispatch for direct online orders.
 * Integrates with white-label logistics partners in Addis Ababa.
 */

import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/api/audit';
import type { Json } from '@/types/database';
import { logger } from '@/lib/logger';

// Logistics partners configuration for Addis Ababa
const LOGISTICS_PARTNERS = {
    fidel: {
        name: 'Fidel Delivery',
        api_url: process.env.FIDEL_API_URL ?? 'https://api.fideldelivery.com',
        api_key: process.env.FIDEL_API_KEY,
        supported_areas: ['Bole', 'Kazanchis', 'Piazza', 'Megenagna', 'CMC', 'Gerji'],
    },
    deliver_addis_fleet: {
        name: 'Deliver Addis Fleet',
        api_url: process.env.DELIVER_ADDIS_FLEET_URL ?? 'https://fleet.deliveraddis.com',
        api_key: process.env.DELIVER_ADDIS_FLEET_KEY,
        supported_areas: ['Sarbet', 'Merkato', 'Lideta', 'Kirkos', 'Old Airport'],
    },
} as const;

type LogisticsPartner = keyof typeof LOGISTICS_PARTNERS;

export interface DispatchRequest {
    orderId: string;
    restaurantId: string;
    restaurantName: string;
    restaurantAddress: string;
    restaurantPhone: string;
    customerName: string;
    customerPhone: string;
    deliveryAddress: {
        addressLine1: string;
        addressLine2?: string;
        city: string;
        area?: string;
        landmark?: string;
    };
    orderNotes?: string;
    estimatedPickupTime: string;
}

export interface DispatchResult {
    success: boolean;
    driverId?: string;
    driverName?: string;
    driverPhone?: string;
    estimatedArrival?: string;
    trackingUrl?: string;
    error?: string;
}

export interface DeliveryFeeCalculation {
    distanceKm: number;
    baseFee: number;
    distanceFee: number;
    totalFee: number;
    estimatedTime: number;
    currency: string;
}

/**
 * Calculate delivery fee based on distance
 */
export function calculateDeliveryFee(
    distanceKm: number,
    baseFee: number = 50,
    perKmRate: number = 15
): DeliveryFeeCalculation {
    const distanceFee = Math.round(distanceKm * perKmRate);
    const totalFee = baseFee + distanceFee;
    const estimatedTime = Math.round(15 + distanceKm * 3); // Base 15 min + 3 min per km

    return {
        distanceKm: Math.round(distanceKm * 10) / 10,
        baseFee,
        distanceFee,
        totalFee,
        estimatedTime,
        currency: 'ETB',
    };
}

/**
 * Estimate distance between two points in Addis Ababa
 * Uses Haversine formula for straight-line distance
 */
export function estimateDistance(
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number }
): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((dropoff.lat - pickup.lat) * Math.PI) / 180;
    const dLng = ((dropoff.lng - pickup.lng) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((pickup.lat * Math.PI) / 180) *
            Math.cos((dropoff.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Get coordinates for an address in Addis Ababa
 * Returns approximate coordinates based on area
 */
export function getCoordinatesForAddress(address: { area?: string; city: string }): {
    lat: number;
    lng: number;
} {
    // Approximate coordinates for Addis Ababa areas
    const areaCoordinates: Record<string, { lat: number; lng: number }> = {
        Bole: { lat: 8.9806, lng: 38.7578 },
        Kazanchis: { lat: 9.005, lng: 38.7636 },
        Piazza: { lat: 9.032, lng: 38.7469 },
        Megenagna: { lat: 9.0217, lng: 38.7922 },
        CMC: { lat: 9.0283, lng: 38.8167 },
        Gerji: { lat: 9.01, lng: 38.7833 },
        Sarbet: { lat: 9.0083, lng: 38.7333 },
        Merkato: { lat: 9.0333, lng: 38.7417 },
        Lideta: { lat: 9.0083, lng: 38.7417 },
        Kirkos: { lat: 9.0, lng: 38.75 },
        'Old Airport': { lat: 8.9833, lng: 38.7667 },
    };

    const area = address.area?.trim() ?? '';
    return areaCoordinates[area] ?? { lat: 9.0, lng: 38.75 }; // Default to center
}

/**
 * Select the best logistics partner for a delivery
 */
function selectLogisticsPartner(deliveryArea: string): LogisticsPartner | null {
    const area = deliveryArea.toLowerCase();

    for (const [key, partner] of Object.entries(LOGISTICS_PARTNERS)) {
        if (partner.supported_areas.some(a => a.toLowerCase() === area)) {
            return key as LogisticsPartner;
        }
    }

    // Default to Fidel for unknown areas
    return 'fidel';
}

/**
 * Dispatch a driver for delivery
 */
export async function dispatchDriver(request: DispatchRequest): Promise<DispatchResult> {
    const partner = selectLogisticsPartner(request.deliveryAddress.area ?? '');

    if (!partner) {
        return { success: false, error: 'No delivery partner available for this area' };
    }

    const partnerConfig = LOGISTICS_PARTNERS[partner];

    // Ensure API key is configured
    if (!partnerConfig.api_key) {
        return { success: false, error: 'API key not configured for this delivery partner' };
    }

    try {
        const response = await fetch(`${partnerConfig.api_url}/dispatch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${partnerConfig.api_key}`,
            },
            body: JSON.stringify({
                order_id: request.orderId,
                pickup: {
                    name: request.restaurantName,
                    address: request.restaurantAddress,
                    phone: request.restaurantPhone,
                },
                dropoff: {
                    name: request.customerName,
                    address: `${request.deliveryAddress.addressLine1}${request.deliveryAddress.addressLine2 ? ', ' + request.deliveryAddress.addressLine2 : ''}`,
                    area: request.deliveryAddress.area,
                    city: request.deliveryAddress.city,
                    landmark: request.deliveryAddress.landmark,
                    phone: request.customerPhone,
                },
                notes: request.orderNotes,
                estimated_pickup: request.estimatedPickupTime,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message ?? 'Dispatch failed');
        }

        const supabase = await createClient();

        await supabase
            .from('orders')
            .update({
                metadata: {
                    driver_id: data.driver_id,
                    driver_name: data.driver_name,
                    driver_phone: data.driver_phone,
                    dispatch_partner: partner,
                    dispatched_at: new Date().toISOString(),
                    tracking_url: data.tracking_url,
                } as Json,
            })
            .eq('id', request.orderId);

        await writeAuditLog(supabase, {
            restaurant_id: request.restaurantId,
            action: 'driver_dispatched',
            entity_type: 'order',
            entity_id: request.orderId,
            metadata: {
                partner,
                driver_id: data.driver_id,
                driver_name: data.driver_name,
            },
        });

        return {
            success: true,
            driverId: data.driver_id,
            driverName: data.driver_name,
            driverPhone: data.driver_phone,
            estimatedArrival: data.eta,
            trackingUrl: data.tracking_url,
        };
    } catch (error) {
        logger.error('Driver dispatch failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Dispatch failed',
        };
    }
}

/**
 * Cancel a driver dispatch
 */
export async function cancelDispatch(
    orderId: string,
    restaurantId: string,
    reason: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    const { data: order } = await supabase
        .from('orders')
        .select('metadata')
        .eq('id', orderId)
        .maybeSingle();

    if (!order) {
        return { success: false, error: 'Order not found' };
    }

    const metadata = order.metadata as Record<string, unknown> | null;
    const partner = metadata?.dispatch_partner as LogisticsPartner | undefined;
    const driverId = metadata?.driver_id as string | undefined;

    if (!partner || !driverId) {
        return { success: false, error: 'No active dispatch found' };
    }

    const partnerConfig = LOGISTICS_PARTNERS[partner];

    if (!partnerConfig.api_key) {
        return { success: false, error: 'API key not configured for this delivery partner' };
    }

    try {
        await fetch(`${partnerConfig.api_url}/dispatch/${driverId}/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${partnerConfig.api_key}`,
            },
            body: JSON.stringify({
                order_id: orderId,
                reason,
            }),
        });
    } catch (error) {
        logger.error('Failed to cancel with partner:', error);
        return { success: false, error: 'Failed to cancel dispatch' };
    }

    await supabase
        .from('orders')
        .update({
            metadata: {
                ...(metadata as Record<string, Json | undefined>),
                dispatch_cancelled: true,
                dispatch_cancelled_at: new Date().toISOString(),
                dispatch_cancel_reason: reason,
            } as unknown as Json,
        })
        .eq('id', orderId);

    await writeAuditLog(supabase, {
        restaurant_id: restaurantId,
        action: 'driver_dispatch_cancelled',
        entity_type: 'order',
        entity_id: orderId,
        metadata: { reason, driver_id: driverId },
    });

    return { success: true };
}
