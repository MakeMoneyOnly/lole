/**
 * Delivery Fee Calculation API
 *
 * GET /api/delivery/fee
 *
 * Calculates delivery fee based on distance between restaurant and delivery address.
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api/response';
import { z } from 'zod';
import {
    calculateDeliveryFee,
    estimateDistance,
    getCoordinatesForAddress,
} from '@/lib/services/deliveryDispatchService';

const FeeRequestSchema = z.object({
    restaurant_id: z.string().uuid('Invalid restaurant ID'),
    delivery_area: z.string().min(1, 'Delivery area is required'),
    delivery_city: z.string().default('Addis Ababa'),
});

// Restaurant coordinates cache (in production, fetch from DB)
const RESTAURANT_COORDINATES: Record<string, { lat: number; lng: number }> = {
    // Default Addis Ababa center
    default: { lat: 9.0, lng: 38.75 },
};

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const params = {
        restaurant_id: searchParams.get('restaurant_id'),
        delivery_area: searchParams.get('delivery_area'),
        delivery_city: searchParams.get('delivery_city') ?? 'Addis Ababa',
    };

    const parseResult = FeeRequestSchema.safeParse(params);
    if (!parseResult.success) {
        return apiError('Invalid parameters', 400, 'VALIDATION_ERROR', parseResult.error.flatten());
    }

    const { restaurant_id, delivery_area, delivery_city } = parseResult.data;

    // Get restaurant coordinates (in production, fetch from database)
    const restaurantCoords =
        RESTAURANT_COORDINATES[restaurant_id] ?? RESTAURANT_COORDINATES['default'];

    // Get delivery coordinates based on area
    const deliveryCoords = getCoordinatesForAddress({
        area: delivery_area,
        city: delivery_city,
    });

    // Calculate distance
    const distanceKm = estimateDistance(restaurantCoords, deliveryCoords);

    // Calculate fee
    const feeCalculation = calculateDeliveryFee(distanceKm);

    return apiSuccess({
        ...feeCalculation,
        restaurant_id,
        delivery_area,
        delivery_city,
    });
}

export async function POST(request: NextRequest) {
    const body = await request.json();

    const parseResult = z
        .object({
            restaurant_id: z.string().uuid(),
            restaurant_area: z.string().optional(),
            delivery_area: z.string().min(1),
            delivery_city: z.string().default('Addis Ababa'),
        })
        .safeParse(body);

    if (!parseResult.success) {
        return apiError(
            'Invalid request body',
            400,
            'VALIDATION_ERROR',
            parseResult.error.flatten()
        );
    }

    const { restaurant_id, restaurant_area, delivery_area, delivery_city } = parseResult.data;

    // Get coordinates
    const restaurantCoords = restaurant_area
        ? getCoordinatesForAddress({ area: restaurant_area, city: 'Addis Ababa' })
        : (RESTAURANT_COORDINATES[restaurant_id] ?? RESTAURANT_COORDINATES['default']);

    const deliveryCoords = getCoordinatesForAddress({
        area: delivery_area,
        city: delivery_city,
    });

    // Calculate distance and fee
    const distanceKm = estimateDistance(restaurantCoords, deliveryCoords);
    const feeCalculation = calculateDeliveryFee(distanceKm);

    return apiSuccess({
        ...feeCalculation,
        pickup_area: restaurant_area ?? 'Restaurant',
        delivery_area,
    });
}
