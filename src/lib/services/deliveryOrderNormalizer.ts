/**
 * Delivery Order Normalizer
 *
 * Transforms incoming orders from different delivery partners (Beu, Zmall, Deliver Addis, Esoora)
 * into a standardized format for the external_orders table.
 */

import { z } from 'zod';
import { logger } from '@/lib/logger';

// Standard normalized order structure
export interface NormalizedExternalOrder {
    provider: 'beu' | 'zmall' | 'deliver_addis' | 'esoora' | 'custom_local';
    provider_order_id: string;
    restaurant_id: string;
    customer_name: string;
    customer_phone: string;
    delivery_address: {
        address_line_1: string;
        address_line_2?: string;
        city: string;
        area?: string;
        landmark?: string;
    };
    items: Array<{
        id: string;
        name: string;
        quantity: number;
        price: number;
        notes?: string;
        modifiers?: string[];
    }>;
    subtotal: number;
    delivery_fee: number;
    total: number;
    notes?: string;
    payment_status: 'pending' | 'paid' | 'cod';
    payment_method?: string;
    normalized_status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
    payload_json: Record<string, unknown>;
}

// Beu order schema
const BeuOrderSchema = z.object({
    order_id: z.string(),
    restaurant_id: z.string().optional(),
    customer: z.object({
        name: z.string(),
        phone: z.string(),
    }),
    delivery_address: z.object({
        address: z.string(),
        city: z.string().optional(),
        area: z.string().optional(),
    }),
    items: z.array(
        z.object({
            id: z.string().or(z.number()),
            name: z.string(),
            quantity: z.number(),
            price: z.number(),
            notes: z.string().optional(),
        })
    ),
    subtotal: z.number(),
    delivery_fee: z.number().optional(),
    total: z.number(),
    notes: z.string().optional(),
    payment_status: z.enum(['pending', 'paid', 'cod']).optional(),
    status: z.string().optional(),
});

// Zmall order schema
const ZmallOrderSchema = z.object({
    orderId: z.string(),
    storeId: z.string().optional(),
    customerInfo: z.object({
        fullName: z.string(),
        phoneNumber: z.string(),
    }),
    deliveryInfo: z.object({
        addressLine1: z.string(),
        addressLine2: z.string().optional(),
        city: z.string(),
        subCity: z.string().optional(),
    }),
    orderItems: z.array(
        z.object({
            itemId: z.string().or(z.number()),
            itemName: z.string(),
            qty: z.number(),
            unitPrice: z.number(),
            specialRequest: z.string().optional(),
        })
    ),
    orderTotal: z.number(),
    deliveryCharge: z.number().optional(),
    grandTotal: z.number(),
    specialInstructions: z.string().optional(),
    paymentType: z.string().optional(),
    orderStatus: z.string().optional(),
});

// Deliver Addis order schema
const DeliverAddisOrderSchema = z.object({
    id: z.string(),
    vendor_id: z.string().optional(),
    customer: z.object({
        name: z.string(),
        phone: z.string(),
    }),
    address: z.object({
        street: z.string(),
        city: z.string().optional(),
        landmark: z.string().optional(),
    }),
    products: z.array(
        z.object({
            product_id: z.string().or(z.number()),
            name: z.string(),
            quantity: z.number(),
            price: z.number(),
            extras: z.array(z.string()).optional(),
        })
    ),
    subtotal: z.number(),
    delivery_cost: z.number().optional(),
    total: z.number(),
    note: z.string().optional(),
    payment_method: z.string().optional(),
    status: z.string().optional(),
});

// Esoora order schema
const EsooraOrderSchema = z.object({
    orderNumber: z.string(),
    merchantId: z.string().optional(),
    customerDetails: z.object({
        name: z.string(),
        phone: z.string(),
    }),
    deliveryAddress: z.object({
        line1: z.string(),
        line2: z.string().optional(),
        city: z.string(),
        area: z.string().optional(),
    }),
    lineItems: z.array(
        z.object({
            sku: z.string().or(z.number()),
            title: z.string(),
            count: z.number(),
            price: z.number(),
            options: z.array(z.string()).optional(),
        })
    ),
    itemsTotal: z.number(),
    shippingFee: z.number().optional(),
    orderTotal: z.number(),
    instructions: z.string().optional(),
    paid: z.boolean().optional(),
    state: z.string().optional(),
});

/**
 * Parse and normalize a Beu order
 */
export function parseBeuOrder(
    rawOrder: unknown,
    restaurantId: string
): NormalizedExternalOrder | null {
    try {
        const order = BeuOrderSchema.parse(rawOrder);

        return {
            provider: 'beu',
            provider_order_id: order.order_id,
            restaurant_id: restaurantId,
            customer_name: order.customer.name,
            customer_phone: order.customer.phone,
            delivery_address: {
                address_line_1: order.delivery_address.address,
                city: order.delivery_address.city ?? 'Addis Ababa',
                area: order.delivery_address.area,
            },
            items: order.items.map(item => ({
                id: String(item.id),
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                notes: item.notes,
            })),
            subtotal: order.subtotal,
            delivery_fee: order.delivery_fee ?? 0,
            total: order.total,
            notes: order.notes,
            payment_status: order.payment_status ?? 'cod',
            normalized_status: mapBeuStatus(order.status),
            payload_json: order as unknown as Record<string, unknown>,
        };
    } catch (error) {
        logger.error('Failed to parse Beu order:', error);
        return null;
    }
}

/**
 * Parse and normalize a Zmall order
 */
export function parseZmallOrder(
    rawOrder: unknown,
    restaurantId: string
): NormalizedExternalOrder | null {
    try {
        const order = ZmallOrderSchema.parse(rawOrder);

        return {
            provider: 'zmall',
            provider_order_id: order.orderId,
            restaurant_id: restaurantId,
            customer_name: order.customerInfo.fullName,
            customer_phone: order.customerInfo.phoneNumber,
            delivery_address: {
                address_line_1: order.deliveryInfo.addressLine1,
                address_line_2: order.deliveryInfo.addressLine2,
                city: order.deliveryInfo.city,
                area: order.deliveryInfo.subCity,
            },
            items: order.orderItems.map(item => ({
                id: String(item.itemId),
                name: item.itemName,
                quantity: item.qty,
                price: item.unitPrice,
                notes: item.specialRequest,
            })),
            subtotal: order.orderTotal,
            delivery_fee: order.deliveryCharge ?? 0,
            total: order.grandTotal,
            notes: order.specialInstructions,
            payment_status: order.paymentType === 'prepaid' ? 'paid' : 'cod',
            payment_method: order.paymentType,
            normalized_status: mapZmallStatus(order.orderStatus),
            payload_json: order as unknown as Record<string, unknown>,
        };
    } catch (error) {
        logger.error('Failed to parse Zmall order:', error);
        return null;
    }
}

/**
 * Parse and normalize a Deliver Addis order
 */
export function parseDeliverAddisOrder(
    rawOrder: unknown,
    restaurantId: string
): NormalizedExternalOrder | null {
    try {
        const order = DeliverAddisOrderSchema.parse(rawOrder);

        return {
            provider: 'deliver_addis',
            provider_order_id: order.id,
            restaurant_id: restaurantId,
            customer_name: order.customer.name,
            customer_phone: order.customer.phone,
            delivery_address: {
                address_line_1: order.address.street,
                city: order.address.city ?? 'Addis Ababa',
                landmark: order.address.landmark,
            },
            items: order.products.map(product => ({
                id: String(product.product_id),
                name: product.name,
                quantity: product.quantity,
                price: product.price,
                modifiers: product.extras,
            })),
            subtotal: order.subtotal,
            delivery_fee: order.delivery_cost ?? 0,
            total: order.total,
            notes: order.note,
            payment_status: order.payment_method === 'card' ? 'paid' : 'cod',
            payment_method: order.payment_method,
            normalized_status: mapDeliverAddisStatus(order.status),
            payload_json: order as unknown as Record<string, unknown>,
        };
    } catch (error) {
        logger.error('Failed to parse Deliver Addis order:', error);
        return null;
    }
}

/**
 * Parse and normalize an Esoora order
 */
export function parseEsooraOrder(
    rawOrder: unknown,
    restaurantId: string
): NormalizedExternalOrder | null {
    try {
        const order = EsooraOrderSchema.parse(rawOrder);

        return {
            provider: 'esoora',
            provider_order_id: order.orderNumber,
            restaurant_id: restaurantId,
            customer_name: order.customerDetails.name,
            customer_phone: order.customerDetails.phone,
            delivery_address: {
                address_line_1: order.deliveryAddress.line1,
                address_line_2: order.deliveryAddress.line2,
                city: order.deliveryAddress.city,
                area: order.deliveryAddress.area,
            },
            items: order.lineItems.map(item => ({
                id: String(item.sku),
                name: item.title,
                quantity: item.count,
                price: item.price,
                modifiers: item.options,
            })),
            subtotal: order.itemsTotal,
            delivery_fee: order.shippingFee ?? 0,
            total: order.orderTotal,
            notes: order.instructions,
            payment_status: order.paid ? 'paid' : 'cod',
            normalized_status: mapEsooraStatus(order.state),
            payload_json: order as unknown as Record<string, unknown>,
        };
    } catch (error) {
        logger.error('Failed to parse Esoora order:', error);
        return null;
    }
}

// Status mapping functions
function mapBeuStatus(
    status?: string
): 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled' {
    const map: Record<
        string,
        'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
    > = {
        new: 'pending',
        accepted: 'confirmed',
        preparing: 'preparing',
        ready: 'ready',
        delivered: 'delivered',
        cancelled: 'cancelled',
    };
    return map[status?.toLowerCase() ?? ''] ?? 'pending';
}

function mapZmallStatus(
    status?: string
): 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled' {
    const map: Record<
        string,
        'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
    > = {
        placed: 'pending',
        confirmed: 'confirmed',
        in_progress: 'preparing',
        ready_for_pickup: 'ready',
        delivered: 'delivered',
        cancelled: 'cancelled',
    };
    return map[status?.toLowerCase() ?? ''] ?? 'pending';
}

function mapDeliverAddisStatus(
    status?: string
): 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled' {
    const map: Record<
        string,
        'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
    > = {
        pending: 'pending',
        accepted: 'confirmed',
        cooking: 'preparing',
        ready: 'ready',
        completed: 'delivered',
        cancelled: 'cancelled',
    };
    return map[status?.toLowerCase() ?? ''] ?? 'pending';
}

function mapEsooraStatus(
    status?: string
): 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled' {
    const map: Record<
        string,
        'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
    > = {
        received: 'pending',
        acknowledged: 'confirmed',
        in_preparation: 'preparing',
        out_for_delivery: 'ready',
        fulfilled: 'delivered',
        voided: 'cancelled',
    };
    return map[status?.toLowerCase() ?? ''] ?? 'pending';
}

/**
 * Get the appropriate parser for a delivery partner
 */
export function getParserForProvider(
    provider: string
): ((rawOrder: unknown, restaurantId: string) => NormalizedExternalOrder | null) | null {
    switch (provider.toLowerCase()) {
        case 'beu':
            return parseBeuOrder;
        case 'zmall':
            return parseZmallOrder;
        case 'deliver_addis':
        case 'deliveraddis':
            return parseDeliverAddisOrder;
        case 'esoora':
            return parseEsooraOrder;
        default:
            return null;
    }
}
