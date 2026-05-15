/**
 * Delivery Aggregator Orders API Endpoint
 * TASK-DELIVERY-001: Third-Party Delivery Aggregator
 *
 * Handles incoming orders from delivery platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    AggregatorService,
    getActivePartners,
    normalizeDeliveryPartnerName,
} from '@/lib/delivery/aggregator';
import { createHmac, timingSafeEqual } from 'crypto';
import { redisRateLimiters } from '@/lib/security';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getStoreGatewayService } from '@/lib/gateway/service';
import { logger } from '@/lib/logger';

/**
 * HIGH-009: Zod schema for external order validation
 * Validates incoming orders from delivery platforms
 */
const ExternalOrderItemSchema = z
    .object({
        name: z.string().min(1).max(200).optional(),
        item_name: z.string().min(1).max(200).optional(),
        quantity: z.number().int().min(1).max(100).default(1),
        price: z.number().min(0).optional(),
        unit_price: z.number().min(0).optional(),
        notes: z.string().max(500).optional(),
        special_instructions: z.string().max(500).optional(),
    })
    .refine(data => data.name !== undefined || data.item_name !== undefined, {
        message: 'Either name or item_name is required',
    });

const CustomerSchema = z
    .object({
        name: z.string().max(200).optional(),
        phone: z.string().max(50).optional(),
    })
    .optional();

const LocationSchema = z
    .object({
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
    })
    .optional();

const ExternalOrderSchema = z
    .object({
        // Order identifiers - at least one required
        id: z.string().max(100).optional(),
        order_id: z.string().max(100).optional(),
        order_number: z.string().max(100).optional(),

        // Customer info
        customer: CustomerSchema,
        customer_name: z.string().max(200).optional(),
        customer_phone: z.string().max(50).optional(),

        // Delivery details
        delivery_address: z.string().max(500).optional(),
        address: z.string().max(500).optional(),
        location: LocationSchema,
        delivery_latitude: z.number().min(-90).max(90).optional(),
        delivery_longitude: z.number().min(-180).max(180).optional(),
        delivery_notes: z.string().max(500).optional(),

        // Items
        items: z.array(ExternalOrderItemSchema).min(1).max(100),

        // Pricing (all amounts must be non-negative)
        subtotal: z.number().min(0).default(0),
        delivery_fee: z.number().min(0).default(0),
        platform_fee: z.number().min(0).optional(),
        service_fee: z.number().min(0).optional(),
        total: z.number().min(0).optional(),
        total_amount: z.number().min(0).optional(),

        // Timestamps
        placed_at: z.string().datetime({ offset: true }).optional(),
        created_at: z.string().datetime({ offset: true }).optional(),
    })
    .refine(data => data.id !== undefined || data.order_id !== undefined, {
        message: 'Either id or order_id is required',
    });

type ValidatedExternalOrder = z.infer<typeof ExternalOrderSchema>;

function createDeliveryAggregatorService() {
    return new AggregatorService({
        publishLocalEvent: async event => {
            const gateway = getStoreGatewayService();
            if (!gateway) {
                return;
            }

            await gateway.publishCommand({
                type: event.type,
                aggregate: event.aggregate,
                aggregateId: event.aggregateId,
                payload: event.payload as Record<string, unknown>,
                restaurantId: event.restaurantId,
                locationId: event.locationId,
            });
        },
    });
}

export async function POST(request: NextRequest) {
    // HIGH-002: Apply rate limiting for webhook endpoint
    const rateLimitResponse = await redisRateLimiters.mutation(request as NextRequest);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        // Get platform from header
        const platform = request.headers.get('x-delivery-platform');
        const signature = request.headers.get('x-webhook-signature');
        const restaurantId = request.headers.get('x-restaurant-id');

        if (!platform || !restaurantId) {
            return NextResponse.json(
                {
                    error: {
                        code: 'MISSING_HEADERS',
                        message: 'Platform and restaurant ID required',
                    },
                },
                { status: 400 }
            );
        }

        const normalizedPlatform = normalizeDeliveryPartnerName(platform);

        // Get raw body for signature verification
        const rawBody = await request.text();

        // HIGH-009: Parse and validate with Zod schema
        let orderData: ValidatedExternalOrder;
        try {
            const parsed = JSON.parse(rawBody);
            const validationResult = ExternalOrderSchema.safeParse(parsed);

            if (!validationResult.success) {
                return NextResponse.json(
                    {
                        error: {
                            code: 'VALIDATION_ERROR',
                            message: 'Invalid order data',
                            details: validationResult.error.issues.map(issue => ({
                                path: issue.path.join('.'),
                                message: issue.message,
                            })),
                        },
                    },
                    { status: 400 }
                );
            }

            orderData = validationResult.data;
        } catch (_parseError) {
            return NextResponse.json(
                {
                    error: {
                        code: 'INVALID_JSON',
                        message: 'Failed to parse request body as JSON',
                    },
                },
                { status: 400 }
            );
        }

        // Create service client for internal operations
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SECRET_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Get active partners for this restaurant
        const partners = await getActivePartners(supabase, restaurantId);
        const partner = partners.find(p => p.partner_name === normalizedPlatform);

        if (!partner) {
            return NextResponse.json(
                { error: { code: 'NOT_CONFIGURED', message: 'Delivery platform not configured' } },
                { status: 400 }
            );
        }

        // Validate webhook signature if secret is configured
        if (signature && process.env.DELIVERY_WEBHOOK_SECRET) {
            const expectedHex = createHmac('sha256', process.env.DELIVERY_WEBHOOK_SECRET)
                .update(rawBody)
                .digest('hex');
            const expectedBase64 = createHmac('sha256', process.env.DELIVERY_WEBHOOK_SECRET)
                .update(rawBody)
                .digest('base64');
            const expectedBuf = Buffer.from(expectedHex);
            const providedBuf = Buffer.from(signature);
            const base64Buf = Buffer.from(expectedBase64);
            const isValid =
                (expectedBuf.length === providedBuf.length &&
                    timingSafeEqual(expectedBuf, providedBuf)) ||
                (base64Buf.length === providedBuf.length &&
                    timingSafeEqual(base64Buf, providedBuf));
            if (!isValid) {
                return NextResponse.json(
                    {
                        error: {
                            code: 'INVALID_SIGNATURE',
                            message: 'Webhook signature verification failed',
                        },
                    },
                    { status: 401 }
                );
            }
        }

        // HIGH-009: Parse order items from validated external format
        const items = orderData.items.map(item => ({
            name: item.name || item.item_name || 'Unknown Item',
            quantity: item.quantity,
            price: item.price ?? item.unit_price ?? 0,
            notes: item.notes || item.special_instructions,
        }));

        // Receive the external order
        const aggregatorService = createDeliveryAggregatorService();
        const result = await aggregatorService.receiveAndBroadcastOrder(
            supabase,
            restaurantId,
            partner.id,
            {
                external_order_id: orderData.id || orderData.order_id!,
                external_order_number: orderData.order_number,
                raw_order_data: orderData,
                customer_name: orderData.customer?.name || orderData.customer_name,
                customer_phone: orderData.customer?.phone || orderData.customer_phone,
                delivery_address: orderData.delivery_address || orderData.address,
                delivery_latitude: orderData.location?.lat || orderData.delivery_latitude,
                delivery_longitude: orderData.location?.lng || orderData.delivery_longitude,
                delivery_notes: orderData.delivery_notes,
                items,
                subtotal: orderData.subtotal,
                delivery_fee: orderData.delivery_fee,
                platform_fee: orderData.platform_fee || orderData.service_fee || 0,
                total: orderData.total || orderData.total_amount || 0,
                placed_at: orderData.placed_at || orderData.created_at,
            }
        );

        if (!result.success) {
            return NextResponse.json(
                { error: { code: 'ORDER_FAILED', message: result.error } },
                { status: 400 }
            );
        }

        // Log the injection
        await (supabase as SupabaseClient<Database>).from('audit_logs').insert({
            action: 'delivery_order_received',
            entity_type: 'aggregator_order',
            entity_id: result.order?.id,
            restaurant_id: restaurantId,
            metadata: {
                platform: normalizedPlatform,
                external_order_id: orderData.id || orderData.order_id,
                partner_id: partner.id,
            },
        });

        return NextResponse.json({
            data: {
                success: true,
                aggregatorOrderId: result.order?.id,
                platform: normalizedPlatform,
            },
        });
    } catch (error) {
        logger.error('[Delivery Aggregator API] Error', { error });
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const restaurantId = searchParams.get('restaurantId');
        const _platform = searchParams.get('platform');

        if (!restaurantId) {
            return NextResponse.json(
                { error: { code: 'MISSING_RESTAURANT_ID', message: 'Restaurant ID required' } },
                { status: 400 }
            );
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SECRET_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Get aggregator status
        const { data: configs, error } = await (supabase as SupabaseClient<Database>)
            .from('delivery_aggregator_configs')
            // HIGH-013: Explicit column selection
            .select(
                'id, restaurant_id, aggregator_name, api_key, api_secret_ref, webhook_url, settings_json, status, last_sync_at, created_at, updated_at'
            )
            .eq('restaurant_id', restaurantId);

        if (error) {
            return NextResponse.json(
                { error: { code: 'QUERY_FAILED', message: 'Failed to get aggregator configs' } },
                { status: 400 }
            );
        }

        return NextResponse.json({
            data: {
                configs: configs ?? [],
            },
        });
    } catch (error) {
        logger.error('[Delivery Aggregator API] Error', { error });
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
            { status: 500 }
        );
    }
}
