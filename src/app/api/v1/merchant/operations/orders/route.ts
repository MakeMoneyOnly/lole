/**
 * @openapi
 * /api/orders:
 *   get:
 *     summary: List orders
 *     description: Retrieve a paginated list of orders for the authenticated user's restaurant
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by order status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by table number, order number, or customer name
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *         description: Maximum number of orders to return
 *     responses:
 *       200:
 *         description: List of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     orders:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Order'
 *                     total:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: No restaurant found for user
 *   post:
 *     summary: Create a new order
 *     description: Create a new order from guest context with HMAC-validated QR code
 *     tags:
 *       - Orders
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - guest_context
 *               - items
 *               - total_price
 *             properties:
 *               guest_context:
 *                 type: object
 *                 required:
 *                   - slug
 *                   - table
 *                   - sig
 *                   - exp
 *                 properties:
 *                   slug:
 *                     type: string
 *                   table:
 *                     type: string
 *                   sig:
 *                     type: string
 *                   exp:
 *                     type: string
 *               items:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/OrderItem'
 *               total_price:
 *                 type: number
 *               notes:
 *                 type: string
 *               idempotency_key:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Order created successfully
 *       400:
 *         description: Invalid request
 *       429:
 *         description: Rate limit exceeded
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { CreateOrderSchema } from '@/lib/validators/order';
import { apiError, apiSuccess } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { monitoredQuery } from '@/lib/services/queryMonitor';
import {
    checkRateLimit,
    createOrder,
    generateGuestFingerprint,
    generateIdempotencyKey,
} from '@/lib/services/orderService';
import { resolveGuestContext } from '@/lib/security/guestContext';
import { trackApiMetric } from '@/lib/api/metrics';
import { enforcePilotAccess } from '@/lib/api/pilotGate';
import { isIdempotencyKeyValid } from '@/lib/api/idempotency';
import { createloleEvent } from '@/lib/events/contracts';
import { publishEvent } from '@/lib/events/runtime';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { prepareOrderDiscount } from '@/lib/discounts/service';
import { redisRateLimiters } from '@/lib/security';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const OrdersQuerySchema = z.object({
    status: z.string().optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).optional().default(50),
    offset: z.coerce.number().int().nonnegative().optional().default(0),
});

const OnlineOrderGuestContextSchema = z.object({
    slug: z.string().min(1),
    is_online_order: z.literal(true),
    // For online orders, table/sig/exp are not real QR values
    table: z.string().optional(),
    sig: z.string().optional(),
    exp: z.union([z.string(), z.number()]).optional(),
});

const DineInGuestContextSchema = z.object({
    slug: z.string().min(1),
    table: z.string().min(1),
    sig: z.string().min(1),
    exp: z.union([z.string(), z.number()]),
    is_online_order: z.literal(false).optional(),
});

const GuestContextInputSchema = z.union([OnlineOrderGuestContextSchema, DineInGuestContextSchema]);

const CreateOrderRequestSchema = CreateOrderSchema.omit({
    idempotency_key: true,
    restaurant_id: true,
    table_number: true,
}).extend({
    guest_context: GuestContextInputSchema,
    order_type: z.enum(['dine_in', 'online', 'delivery', 'pickup']).optional().default('dine_in'),
    delivery_address: z.string().max(500).optional(),
    customer_name: z.string().max(100).optional(),
    customer_phone: z.string().max(30).optional(),
    discount_id: z.string().uuid().optional(),
    idempotency_key: z.string().uuid().optional(),
    campaign_attribution: z
        .object({
            campaign_delivery_id: z.string().uuid(),
            campaign_id: z.string().uuid().optional(),
        })
        .optional(),
});

async function resolveRestaurantIdForUser(userId: string) {
    const supabase = await createClient();
    const { data: staffEntry, error: staffError } = await supabase
        .from('restaurant_staff')
        .select('restaurant_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (staffError) {
        return { error: staffError.message };
    }

    if (staffEntry?.restaurant_id) {
        return { restaurantId: staffEntry.restaurant_id };
    }

    const { data: agencyUser, error: agencyError } = await supabase
        .from('agency_users')
        .select('restaurant_ids')
        .eq('user_id', userId)
        .maybeSingle();

    if (agencyError) {
        return { error: agencyError.message };
    }

    return { restaurantId: agencyUser?.restaurant_ids?.[0] ?? null };
}

export async function GET(request: NextRequest) {
    const startedAt = Date.now();
    let responseStatus = 500;
    let restaurantIdForMetrics: string | null = null;
    let supabaseForMetrics: Awaited<ReturnType<typeof createClient>> | null = null;

    try {
        const supabase = await createClient();
        supabaseForMetrics = supabase;
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            responseStatus = 401;
            return apiError('Unauthorized', 401, 'UNAUTHORIZED');
        }

        const { restaurantId, error: restaurantError } = await resolveRestaurantIdForUser(user.id);
        if (restaurantError) {
            responseStatus = 500;
            return apiError(
                'Failed to resolve restaurant context',
                500,
                'RESTAURANT_RESOLVE_FAILED',
                restaurantError
            );
        }
        if (!restaurantId) {
            responseStatus = 404;
            return apiError('No restaurant found for user', 404, 'RESTAURANT_NOT_FOUND');
        }
        restaurantIdForMetrics = restaurantId;

        const pilotGateResponse = enforcePilotAccess(restaurantId, request.method);
        if (pilotGateResponse) {
            responseStatus = pilotGateResponse.status;
            return pilotGateResponse;
        }

        const parsed = OrdersQuerySchema.safeParse({
            status: request.nextUrl.searchParams.get('status') ?? undefined,
            search: request.nextUrl.searchParams.get('search') ?? undefined,
            limit: request.nextUrl.searchParams.get('limit') ?? undefined,
            offset: request.nextUrl.searchParams.get('offset') ?? undefined,
        });
        if (!parsed.success) {
            responseStatus = 400;
            return apiError('Invalid query params', 400, 'INVALID_QUERY', parsed.error.flatten());
        }

        const { data, error, count } = await monitoredQuery(
            'orders:list-active',
            async () => {
                let q = supabase
                    .from('orders')
                    .select('*', { count: 'exact' })
                    .eq('restaurant_id', restaurantId)
                    .order('created_at', { ascending: false })
                    .range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);

                if (parsed.data.status && parsed.data.status !== 'all') {
                    q = q.eq('status', parsed.data.status);
                }

                if (parsed.data.search) {
                    const s = parsed.data.search.trim();
                    if (s.length > 0) {
                        q = q.or(
                            `table_number.ilike.%${s}%,order_number.ilike.%${s}%,customer_name.ilike.%${s}%`
                        );
                    }
                }

                return q;
            },
            { restaurantId }
        );

        if (error) {
            responseStatus = 500;
            return apiError('Failed to load orders', 500, 'ORDERS_FETCH_FAILED', error.message);
        }

        responseStatus = 200;
        return apiSuccess({
            orders: data?.map(o => ({ ...o, total_price: Number(o.total_price ?? 0) / 100 })) ?? [],
            total: count ?? 0,
        });
    } catch (error) {
        responseStatus = 500;
        return apiError(
            'Internal server error',
            500,
            'INTERNAL_ERROR',
            error instanceof Error ? error.message : 'Unknown error'
        );
    } finally {
        if (supabaseForMetrics) {
            const durationMs = Date.now() - startedAt;
            await trackApiMetric(supabaseForMetrics, {
                restaurantId: restaurantIdForMetrics,
                endpoint: '/api/orders',
                method: 'GET',
                statusCode: responseStatus,
                durationMs,
            });
        }
    }
}

export async function POST(request: NextRequest) {
    // Apply rate limiting for order creation
    const rateLimitResponse = await redisRateLimiters.orderCreate(request);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    try {
        const body = await request.json();
        const parsed = CreateOrderRequestSchema.safeParse(body);

        if (!parsed.success) {
            return apiError(
                'Invalid request payload',
                400,
                'VALIDATION_ERROR',
                parsed.error.flatten()
            );
        }

        const supabase = await createClient();
        const isOnlineOrder =
            parsed.data.order_type === 'online' ||
            parsed.data.order_type === 'delivery' ||
            parsed.data.order_type === 'pickup' ||
            (parsed.data.guest_context as { is_online_order?: boolean }).is_online_order === true;

        let restaurantId: string;
        let tableNumber: string;

        if (isOnlineOrder) {
            // ── Online / Delivery / Pickup: resolve restaurant by slug only ──
            const slug = parsed.data.guest_context.slug;
            const { data: restaurant, error: restaurantError } = await supabase
                .from('restaurants')
                .select('id, is_active')
                .eq('slug', slug)
                .maybeSingle();

            if (restaurantError) {
                return apiError('Failed to resolve restaurant', 500, 'RESTAURANT_RESOLVE_FAILED');
            }
            if (!restaurant || restaurant.is_active === false) {
                return apiError('Restaurant not found or inactive', 404, 'RESTAURANT_NOT_FOUND');
            }
            restaurantId = restaurant.id;
            // Represent the order type as the table label for legacy display
            tableNumber =
                parsed.data.order_type === 'delivery'
                    ? 'Delivery'
                    : parsed.data.order_type === 'pickup'
                      ? 'Pickup'
                      : 'Online Order';
        } else {
            // ── Dine-in: full QR validation via resolveGuestContext ──
            const guestContext = await resolveGuestContext(supabase, parsed.data.guest_context);
            if (!guestContext.valid) {
                return apiError(
                    guestContext.reason ?? 'Invalid guest context',
                    guestContext.status ?? 401,
                    'INVALID_GUEST_CONTEXT'
                );
            }
            restaurantId = guestContext.data.restaurantId;
            tableNumber = guestContext.data.tableNumber;
        }

        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
        const fingerprint = generateGuestFingerprint(ip, request.headers.get('user-agent'));

        const rateLimit = await checkRateLimit(supabase, fingerprint);
        if (!rateLimit.allowed) {
            return apiError(
                'Rate limit exceeded. Please wait before placing another order.',
                429,
                'RATE_LIMITED',
                { remainingOrders: rateLimit.remainingOrders ?? 0 }
            );
        }

        const explicitIdempotencyKey = request.headers.get('x-idempotency-key');
        if (explicitIdempotencyKey && !isIdempotencyKeyValid(explicitIdempotencyKey)) {
            return apiError('Invalid idempotency key', 400, 'INVALID_IDEMPOTENCY_KEY');
        }

        const idempotencyKey =
            explicitIdempotencyKey?.trim() ||
            parsed.data.idempotency_key ||
            generateIdempotencyKey();
        let discountRuntime: {
            discount: { id: string } | null;
            calculation: {
                subtotal: number;
                discountAmount: number;
                total: number;
                applied: boolean;
            };
        };
        try {
            discountRuntime = parsed.data.discount_id
                ? await prepareOrderDiscount({
                      supabase: createServiceRoleClient(),
                      restaurantId,
                      discountId: parsed.data.discount_id,
                      items: parsed.data.items.map(item => ({
                          id: item.id,
                          price: item.price,
                          quantity: item.quantity,
                      })),
                      excludeManagerApproval: true,
                  })
                : {
                      discount: null,
                      calculation: {
                          subtotal: parsed.data.total_price,
                          discountAmount: 0,
                          total: parsed.data.total_price,
                          applied: false,
                      },
                  };
        } catch (error) {
            return apiError(
                error instanceof Error ? error.message : 'Failed to validate discount',
                400,
                'DISCOUNT_VALIDATION_FAILED'
            );
        }

        const result = await createOrder(supabase, {
            restaurant_id: restaurantId,
            table_number: tableNumber,
            items: parsed.data.items,
            total_price: discountRuntime.calculation.total,
            notes: parsed.data.notes,
            idempotency_key: idempotencyKey,
            guest_fingerprint: fingerprint,
            order_type: parsed.data.order_type,
            delivery_address: parsed.data.delivery_address,
            customer_name: parsed.data.customer_name,
            customer_phone: parsed.data.customer_phone,
            discount_id: discountRuntime.discount?.id,
            discount_amount: discountRuntime.calculation.discountAmount,
        });

        if (!result.success) {
            return apiError(result.error ?? 'Failed to create order', 400, 'ORDER_CREATE_FAILED');
        }

        let campaignAttributionApplied = false;
        if (parsed.data.campaign_attribution) {
            const attribution = parsed.data.campaign_attribution;
            const { data: delivery, error: deliveryError } = await (
                supabase as SupabaseClient<Database>
            )
                .from('campaign_deliveries')
                .select('id, campaign_id, conversion_order_id')
                .eq('id', attribution.campaign_delivery_id)
                .maybeSingle();

            if (deliveryError) {
                logger.warn('[POST /api/orders] campaign delivery lookup failed', {
                    error: deliveryError.message,
                });
            } else if (delivery) {
                const campaignMatches =
                    !attribution.campaign_id || attribution.campaign_id === delivery.campaign_id;
                if (campaignMatches) {
                    const { data: campaign, error: campaignError } = await (
                        supabase as SupabaseClient<Database>
                    )
                        .from('campaigns')
                        .select('id')
                        .eq('id', delivery.campaign_id)
                        .eq('restaurant_id', restaurantId)
                        .maybeSingle();

                    if (campaignError) {
                        logger.warn('[POST /api/orders] campaign validation failed', {
                            error: campaignError.message,
                        });
                    } else if (campaign && !delivery.conversion_order_id) {
                        const { error: updateDeliveryError } = await (
                            supabase as SupabaseClient<Database>
                        )
                            .from('campaign_deliveries')
                            .update({
                                status: 'converted',
                                conversion_order_id: result.order.id,
                                clicked_at: new Date().toISOString(),
                            })
                            .eq('id', delivery.id);

                        if (updateDeliveryError) {
                            logger.warn('[POST /api/orders] campaign conversion update failed', {
                                error: updateDeliveryError.message,
                            });
                        } else {
                            campaignAttributionApplied = true;
                        }
                    }
                }
            }
        }

        const { error: auditError } = await supabase.from('audit_logs').insert({
            restaurant_id: restaurantId,
            action: 'order_created_guest',
            entity_type: 'order',
            entity_id: result.order.id,
            metadata: {
                table_number: tableNumber,
                item_count: parsed.data.items.length,
                source: isOnlineOrder ? 'online_ordering' : 'guest_web',
                order_type: parsed.data.order_type,
                slug: parsed.data.guest_context.slug,
                campaign_attribution: parsed.data.campaign_attribution ?? null,
                campaign_attribution_applied: campaignAttributionApplied,
            },
            new_value: {
                status: result.order.status,
                total_price: discountRuntime.calculation.total,
                discount_amount: discountRuntime.calculation.discountAmount,
            },
        });
        if (auditError) {
            logger.warn('[POST /api/orders] audit insert failed', { error: auditError.message });
        }

        await publishEvent(
            createloleEvent('order.created', {
                restaurant_id: restaurantId,
                order_id: result.order.id,
                idempotency_key: idempotencyKey,
                source: isOnlineOrder ? 'online_ordering' : 'guest_web',
                order_type: parsed.data.order_type,
            })
        );

        return apiSuccess(
            {
                id: result.order.id,
                order_number: result.order.order_number,
                status: result.order.status,
                idempotency_key: idempotencyKey,
                campaign_attribution_applied: campaignAttributionApplied,
            },
            201
        );
    } catch (error) {
        logger.error('[POST /api/orders] failed', error);
        return apiError('Internal server error', 500, 'INTERNAL_ERROR');
    }
}
