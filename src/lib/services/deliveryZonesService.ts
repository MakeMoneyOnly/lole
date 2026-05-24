/**
 * Delivery Zones Service
 *
 * Manages geographic delivery zones with fee calculation.
 * P2 feature from TOAST_FEATURE_TASKS.md
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// =========================================================
// Type Definitions
// =========================================================

export interface DeliveryZone {
    id: string;
    restaurant_id: string;
    name: string;
    description: string | null;
    // Geographic boundary (GeoJSON Polygon or Circle)
    boundary_type: 'polygon' | 'circle' | 'radius';
    center_latitude: number | null;
    center_longitude: number | null;
    radius_meters: number | null;
    polygon_coordinates: Array<[number, number]> | null;
    // Fee structure
    base_fee: number;
    per_km_fee: number;
    minimum_order: number;
    maximum_order: number | null;
    // Availability
    is_active: boolean;
    estimated_delivery_minutes_min: number;
    estimated_delivery_minutes_max: number;
    // Scheduling
    available_days: number[] | null; // 0-6 (Sunday-Saturday)
    available_hours_start: string | null;
    available_hours_end: string | null;
    // Metadata
    created_at: string;
    updated_at: string;
}

export interface CreateDeliveryZoneInput {
    name: string;
    description?: string;
    boundary_type: 'polygon' | 'circle' | 'radius';
    center_latitude?: number;
    center_longitude?: number;
    radius_meters?: number;
    polygon_coordinates?: Array<[number, number]>;
    base_fee: number;
    per_km_fee?: number;
    minimum_order?: number;
    maximum_order?: number;
    is_active?: boolean;
    estimated_delivery_minutes_min?: number;
    estimated_delivery_minutes_max?: number;
    available_days?: number[];
    available_hours_start?: string;
    available_hours_end?: string;
}

export interface DeliveryFeeCalculation {
    zone_id: string;
    zone_name: string;
    is_deliverable: boolean;
    base_fee: number;
    distance_meters: number;
    distance_km: number;
    per_km_fee: number;
    total_fee: number;
    estimated_minutes_min: number;
    estimated_minutes_max: number;
    minimum_order: number;
    reason?: string;
}

// =========================================================
// Distance Calculation (Haversine Formula)
// =========================================================

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in meters
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * Check if a point is inside a polygon (Ray Casting algorithm)
 */
export function isPointInPolygon(
    point: [number, number],
    polygon: Array<[number, number]>
): boolean {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];

        const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

        if (intersect) {
            inside = !inside;
        }
    }

    return inside;
}

/**
 * Check if a point is within a circle
 */
export function isPointInCircle(
    pointLat: number,
    pointLon: number,
    centerLat: number,
    centerLon: number,
    radiusMeters: number
): boolean {
    const distance = calculateDistance(pointLat, pointLon, centerLat, centerLon);
    return distance <= radiusMeters;
}

// =========================================================
// Delivery Zone Operations
// =========================================================

/**
 * Get all delivery zones for a restaurant
 */
export async function getDeliveryZones(
    supabase: SupabaseClient,
    restaurantId: string
): Promise<DeliveryZone[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // HIGH-013: Explicit column selection
    const { data, error } = await db
        .from('delivery_zones')
        .select(
            'id, restaurant_id, name, description, boundary_type, center_latitude, center_longitude, radius_meters, polygon_coordinates, base_fee, per_km_fee, minimum_order, maximum_order, is_active, estimated_delivery_minutes_min, estimated_delivery_minutes_max, available_days, available_hours_start, available_hours_end, created_at, updated_at'
        )
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: true });

    if (error) {
        throw new Error(`Failed to fetch delivery zones: ${error.message}`);
    }

    return (data || []) as DeliveryZone[];
}

/**
 * Create a new delivery zone
 */
export async function createDeliveryZone(
    supabase: SupabaseClient,
    restaurantId: string,
    input: CreateDeliveryZoneInput
): Promise<DeliveryZone> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Validate boundary data based on type
    if (input.boundary_type === 'circle' || input.boundary_type === 'radius') {
        if (!input.center_latitude || !input.center_longitude || !input.radius_meters) {
            throw new Error('Circle zones require center coordinates and radius');
        }
    } else if (input.boundary_type === 'polygon') {
        if (!input.polygon_coordinates || input.polygon_coordinates.length < 3) {
            throw new Error('Polygon zones require at least 3 coordinates');
        }
    }

    const { data, error } = await db
        .from('delivery_zones')
        .insert({
            restaurant_id: restaurantId,
            name: input.name,
            description: input.description ?? null,
            boundary_type: input.boundary_type,
            center_latitude: input.center_latitude ?? null,
            center_longitude: input.center_longitude ?? null,
            radius_meters: input.radius_meters ?? null,
            polygon_coordinates: input.polygon_coordinates ?? null,
            base_fee: input.base_fee,
            per_km_fee: input.per_km_fee ?? 0,
            minimum_order: input.minimum_order ?? 0,
            maximum_order: input.maximum_order ?? null,
            is_active: input.is_active ?? true,
            estimated_delivery_minutes_min: input.estimated_delivery_minutes_min ?? 15,
            estimated_delivery_minutes_max: input.estimated_delivery_minutes_max ?? 45,
            available_days: input.available_days ?? null,
            available_hours_start: input.available_hours_start ?? null,
            available_hours_end: input.available_hours_end ?? null,
        })
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, description, boundary_type, center_latitude, center_longitude, radius_meters, polygon_coordinates, base_fee, per_km_fee, minimum_order, maximum_order, is_active, estimated_delivery_minutes_min, estimated_delivery_minutes_max, available_days, available_hours_start, available_hours_end, created_at, updated_at'
        )
        .single();

    if (error) {
        throw new Error(`Failed to create delivery zone: ${error.message}`);
    }

    return data as DeliveryZone;
}

/**
 * Update a delivery zone
 */
export async function updateDeliveryZone(
    supabase: SupabaseClient,
    restaurantId: string,
    zoneId: string,
    updates: Partial<CreateDeliveryZoneInput>
): Promise<DeliveryZone> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data, error } = await db
        .from('delivery_zones')
        .update({
            ...updates,
            updated_at: new Date().toISOString(),
        })
        .eq('id', zoneId)
        .eq('restaurant_id', restaurantId)
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, description, boundary_type, center_latitude, center_longitude, radius_meters, polygon_coordinates, base_fee, per_km_fee, minimum_order, maximum_order, is_active, estimated_delivery_minutes_min, estimated_delivery_minutes_max, available_days, available_hours_start, available_hours_end, created_at, updated_at'
        )
        .single();

    if (error) {
        throw new Error(`Failed to update delivery zone: ${error.message}`);
    }

    return data as DeliveryZone;
}

/**
 * Delete a delivery zone
 */
export async function deleteDeliveryZone(
    supabase: SupabaseClient,
    restaurantId: string,
    zoneId: string
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { error } = await db
        .from('delivery_zones')
        .delete()
        .eq('id', zoneId)
        .eq('restaurant_id', restaurantId);

    if (error) {
        throw new Error(`Failed to delete delivery zone: ${error.message}`);
    }
}

/**
 * Check if delivery is available for a zone at current time
 */
export function isDeliveryAvailableNow(zone: DeliveryZone): boolean {
    if (!zone.is_active) {
        return false;
    }

    const now = new Date();
    const currentDay = now.getDay();

    // Check if current day is available
    if (zone.available_days && !zone.available_days.includes(currentDay)) {
        return false;
    }

    // Check if current time is within available hours
    if (zone.available_hours_start && zone.available_hours_end) {
        const currentTime = now.toTimeString().slice(0, 5);
        if (currentTime < zone.available_hours_start || currentTime > zone.available_hours_end) {
            return false;
        }
    }

    return true;
}

/**
 * Calculate delivery fee for a location
 */
export async function calculateDeliveryFee(
    supabase: SupabaseClient,
    restaurantId: string,
    deliveryLat: number,
    deliveryLon: number,
    restaurantLat?: number,
    restaurantLon?: number
): Promise<DeliveryFeeCalculation> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Get restaurant location if not provided
    let restLat = restaurantLat;
    let restLon = restaurantLon;

    if (!restLat || !restLon) {
        const { data: restaurant } = await db
            .from('restaurants')
            .select('latitude, longitude')
            .eq('id', restaurantId)
            .maybeSingle();

        restLat = restaurant?.latitude;
        restLon = restaurant?.longitude;
    }

    // Get all active delivery zones
    const zones = await getDeliveryZones(supabase, restaurantId);
    const activeZones = zones.filter(z => z.is_active);

    if (activeZones.length === 0) {
        return {
            zone_id: '',
            zone_name: '',
            is_deliverable: false,
            base_fee: 0,
            distance_meters: 0,
            distance_km: 0,
            per_km_fee: 0,
            total_fee: 0,
            estimated_minutes_min: 0,
            estimated_minutes_max: 0,
            minimum_order: 0,
            reason: 'No delivery zones configured',
        };
    }

    // Find matching zone
    for (const zone of activeZones) {
        let isInZone = false;
        let distanceMeters = 0;

        if (zone.boundary_type === 'circle' || zone.boundary_type === 'radius') {
            if (zone.center_latitude && zone.center_longitude && zone.radius_meters) {
                isInZone = isPointInCircle(
                    deliveryLat,
                    deliveryLon,
                    zone.center_latitude,
                    zone.center_longitude,
                    zone.radius_meters
                );
                distanceMeters = calculateDistance(
                    deliveryLat,
                    deliveryLon,
                    zone.center_latitude,
                    zone.center_longitude
                );
            }
        } else if (zone.boundary_type === 'polygon' && zone.polygon_coordinates) {
            isInZone = isPointInPolygon([deliveryLon, deliveryLat], zone.polygon_coordinates);
            // Calculate distance from restaurant for polygon zones
            if (restLat && restLon) {
                distanceMeters = calculateDistance(restLat, restLon, deliveryLat, deliveryLon);
            }
        }

        if (isInZone) {
            const distanceKm = distanceMeters / 1000;
            const perKmFee = zone.per_km_fee * distanceKm;
            const totalFee = zone.base_fee + perKmFee;

            return {
                zone_id: zone.id,
                zone_name: zone.name,
                is_deliverable: isDeliveryAvailableNow(zone),
                base_fee: zone.base_fee,
                distance_meters: Math.round(distanceMeters),
                distance_km: Math.round(distanceKm * 10) / 10,
                per_km_fee: Math.round(perKmFee * 100) / 100,
                total_fee: Math.round(totalFee * 100) / 100,
                estimated_minutes_min: zone.estimated_delivery_minutes_min,
                estimated_minutes_max: zone.estimated_delivery_minutes_max,
                minimum_order: zone.minimum_order,
                reason: isDeliveryAvailableNow(zone)
                    ? undefined
                    : 'Delivery not available at this time',
            };
        }
    }

    // Not in any zone - calculate distance from restaurant for reference
    let distanceFromRestaurant = 0;
    if (restLat && restLon) {
        distanceFromRestaurant = calculateDistance(restLat, restLon, deliveryLat, deliveryLon);
    }

    return {
        zone_id: '',
        zone_name: '',
        is_deliverable: false,
        base_fee: 0,
        distance_meters: Math.round(distanceFromRestaurant),
        distance_km: Math.round((distanceFromRestaurant / 1000) * 10) / 10,
        per_km_fee: 0,
        total_fee: 0,
        estimated_minutes_min: 0,
        estimated_minutes_max: 0,
        minimum_order: 0,
        reason: 'Location is outside all delivery zones',
    };
}
