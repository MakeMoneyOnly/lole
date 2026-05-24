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
import { NextRequest, NextResponse } from 'next/server';
import { listOrdersHandler } from '@/features/operations/orders/api/list-orders';

/**
 * GET /api/v1/merchant/operations/orders
 * Lists orders with optional filtering.
 * Delegates to the Phase 1 API handler.
 */
export async function GET(request: NextRequest): Promise<Response> {
    return listOrdersHandler(request);
}

/**
 * POST /api/v1/merchant/operations/orders
 * Creates a new order.
 * Note: For Phase 1, this endpoint remains implemented in the legacy route handler
 * due to complex guest context validation and discount logic. The handler is available
 * at createOrderHandler for future migration.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    // Legacy implementation preserved for backward compatibility
    // Migration to Phase 1 handler pending discount/order type transition
    const startedAt = Date.now();
    let responseStatus = 500;
    let restaurantIdForMetrics: string | null = null;
    let supabaseForMetrics: Awaited<
        ReturnType<typeof import('@/lib/supabase/server').createClient>
    > | null = null;

    try {
        const supabase = await import('@/lib/supabase/server').then(m => m.createClient());
        supabaseForMetrics = supabase;
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            responseStatus = 401;
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { resolveRestaurantIdForUser } = await import('@/lib/api/route-utils');
        const { restaurantId, error: restaurantError } = await resolveRestaurantIdForUser(user.id);
        if (restaurantError) {
            responseStatus = 500;
            return NextResponse.json(
                { error: 'Failed to resolve restaurant context' },
                { status: 500 }
            );
        }
        if (!restaurantId) {
            responseStatus = 404;
            return NextResponse.json({ error: 'No restaurant found for user' }, { status: 404 });
        }
        restaurantIdForMetrics = restaurantId;

        const body = await request.json();

        const { CreateOrderSchema } = await import('@/lib/validators/order');
        const parsed = CreateOrderSchema.safeParse(body);

        if (!parsed.success) {
            responseStatus = 400;
            return NextResponse.json(
                { error: 'Invalid request payload', details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { createOrder } = await import('@/lib/services/orderService');

        const result = await createOrder(supabase, {
            restaurant_id: restaurantId,
            table_number: parsed.data.table_number,
            items: parsed.data.items,
            total_price: parsed.data.total_price,
            notes: parsed.data.notes,
            idempotency_key: body.idempotency_key,
            guest_fingerprint: body.guest_fingerprint,
            order_type: body.order_type,
            delivery_address: body.delivery_address,
            customer_name: body.customer_name,
            customer_phone: body.customer_phone,
        });

        if (!result.success) {
            responseStatus = 400;
            return NextResponse.json(
                { error: result.error ?? 'Failed to create order' },
                { status: 400 }
            );
        }

        responseStatus = 201;
        return NextResponse.json({ data: result.order }, { status: 201 });
    } catch (_error) {
        responseStatus = 500;
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    } finally {
        if (supabaseForMetrics) {
            const durationMs = Date.now() - startedAt;
            await import('@/lib/api/metrics').then(m =>
                m.trackApiMetric(supabaseForMetrics!, {
                    restaurantId: restaurantIdForMetrics,
                    endpoint: '/api/orders',
                    method: 'POST',
                    statusCode: responseStatus,
                    durationMs,
                })
            );
        }
    }
}
