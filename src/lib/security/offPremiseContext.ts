/**
 * Off-Premise Context Handler
 *
 * Handles URL parameter validation for off-premise ordering mode.
 * When no table session signature is provided, the app boots into off-premise mode
 * for delivery or pickup orders from direct links (e.g., Instagram).
 */

import { z } from 'zod';

// Off-premise mode types
export type FulfillmentType = 'delivery' | 'pickup';

export interface OffPremiseContext {
    mode: 'off-premise';
    restaurantId: string;
    restaurantSlug: string;
    fulfillmentType: FulfillmentType | null;
}

export interface DineInContext {
    mode: 'dine-in';
    restaurantId: string;
    restaurantSlug: string;
    tableId: string;
    tableNumber: string;
    sessionSignature: string;
}

export type GuestContext = OffPremiseContext | DineInContext;

// Validation schema for off-premise context
const OffPremiseSchema = z.object({
    slug: z.string().min(1),
    table: z.string().optional(),
    sig: z.string().optional(),
});

/**
 * Validate and parse guest context from URL parameters
 */
export function validateGuestContext(params: {
    slug: string;
    table?: string | null;
    sig?: string | null;
}): GuestContext {
    const { slug, table, sig } = OffPremiseSchema.parse(params);

    // If table and signature are provided, it's dine-in mode
    if (table && sig) {
        return {
            mode: 'dine-in',
            restaurantId: '', // Will be populated from DB
            restaurantSlug: slug,
            tableId: table,
            tableNumber: table.replace(/^T-?/i, ''),
            sessionSignature: sig,
        };
    }

    // Otherwise, it's off-premise mode
    return {
        mode: 'off-premise',
        restaurantId: '', // Will be populated from DB
        restaurantSlug: slug,
        fulfillmentType: null, // User will select later
    };
}

/**
 * Check if context is off-premise
 */
export function isOffPremise(context: GuestContext): context is OffPremiseContext {
    return context.mode === 'off-premise';
}

/**
 * Check if context is dine-in
 */
export function isDineIn(context: GuestContext): context is DineInContext {
    return context.mode === 'dine-in';
}

/**
 * Get display label for fulfillment type
 */
export function getFulfillmentLabel(type: FulfillmentType | null): string {
    switch (type) {
        case 'delivery':
            return 'Delivery';
        case 'pickup':
            return 'Pickup';
        default:
            return 'Select Order Type';
    }
}

/**
 * Validate delivery address
 */
export interface DeliveryAddress {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    area?: string;
    landmark?: string;
    phone: string;
    instructions?: string;
}

export const DeliveryAddressSchema = z.object({
    addressLine1: z.string().min(5, 'Address is required'),
    addressLine2: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    area: z.string().optional(),
    landmark: z.string().optional(),
    phone: z.string().min(9, 'Valid phone number is required'),
    instructions: z.string().optional(),
});

/**
 * Validate pickup details
 */
export interface PickupDetails {
    customerName: string;
    phone: string;
    requestedTime?: string;
    notes?: string;
}

export const PickupDetailsSchema = z.object({
    customerName: z.string().min(2, 'Name is required'),
    phone: z.string().min(9, 'Valid phone number is required'),
    requestedTime: z.string().optional(),
    notes: z.string().optional(),
});
