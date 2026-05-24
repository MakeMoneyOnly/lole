import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { CalculateFeeQuerySchema, type FeeCalculationResult } from '../contracts';
import {
    calculateDeliveryFee,
    estimateDistance,
    getCoordinatesForAddress,
} from '@/lib/services/deliveryDispatchService';

const RESTAURANT_COORDINATES: Record<string, { lat: number; lng: number }> = {
    default: { lat: 9.0, lng: 38.75 },
};

export async function calculateFeeHandler(request: NextRequest): Promise<Response> {
    try {
        const { searchParams } = new URL(request.url);

        const params = {
            restaurantId: searchParams.get('restaurantId'),
            deliveryArea: searchParams.get('deliveryArea'),
            deliveryCity: searchParams.get('deliveryCity') ?? 'Addis Ababa',
        };

        const parseResult = CalculateFeeQuerySchema.safeParse(params);
        if (!parseResult.success) {
            return apiError(
                'Invalid parameters',
                400,
                'VALIDATION_ERROR',
                parseResult.error.flatten()
            );
        }

        const { restaurantId, deliveryArea, deliveryCity } = parseResult.data;

        // Get restaurant coordinates (in production, fetch from database)
        const restaurantCoords =
            RESTAURANT_COORDINATES[restaurantId] ?? RESTAURANT_COORDINATES['default'];

        // Get delivery coordinates based on area
        const deliveryCoords = getCoordinatesForAddress({
            area: deliveryArea,
            city: deliveryCity,
        });

        // Calculate distance
        const distanceKm = estimateDistance(restaurantCoords, deliveryCoords);

        // Calculate fee
        const feeCalculation = calculateDeliveryFee(distanceKm);

        // Map to our schema
        const result: FeeCalculationResult = {
            distanceKm: feeCalculation.distanceKm,
            baseFee: feeCalculation.baseFee,
            distanceFee: feeCalculation.distanceFee,
            deliveryFee: feeCalculation.distanceFee,
            platformFee: 0,
            totalFee: feeCalculation.totalFee,
            estimatedTime: feeCalculation.estimatedTime,
            currency: feeCalculation.currency,
            restaurantId,
            deliveryArea,
            deliveryCity,
        };

        return apiSuccess(result);
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'calculateFee',
        });
    }
}
