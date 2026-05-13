/**
 * GET /api/device/orders  — active orders for the POS (kitchen/waiter view)
 * POST /api/device/orders — place a new order from the POS
 * Requires X-Device-Token header.
 *
 * @openapi
 * /api/device/orders:
 *   get:
 *     summary: Get active orders for POS
 *     tags: [Device, Orders]
 *     security:
 *       - deviceToken: []
 *     parameters:
 *       - in: query
 *         name: table_number
 *         schema:
 *           type: string
 *         description: Filter by table number
 *     responses:
 *       200:
 *         description: List of active orders
 *       401:
 *         description: Unauthorized - invalid device token
 *       429:
 *         description: Rate limit exceeded
 *   post:
 *     summary: Create order from POS device
 *     tags: [Device, Orders]
 *     security:
 *       - deviceToken: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               table_number:
 *                 type: string
 *               order_type:
 *                 type: string
 *                 enum: [dine_in, pickup, delivery, online]
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Order created
 *       400:
 *         description: Invalid request
 *       429:
 *         description: Rate limit exceeded
 */
import { apiError, apiSuccess } from '@/lib/api/response';
import { getDeviceContext } from '@/lib/api/authz';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/validation';
import { createloleEvent } from '@/lib/events/contracts';
import { publishEvent } from '@/lib/events/runtime';
import { isIdempotencyKeyValid, resolveIdempotencyKey } from '@/lib/api/idempotency';
import { prepareOrderDiscount } from '@/lib/discounts/service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
    withRateLimit,
    RATE_LIMIT_CONFIGS,
    getClientIdentifier,
    logRateLimitedRequest,
} from '@/lib/security/rateLimiter';
import { NextRequest } from 'next/server';

const ACTIVE_STATUSES = ['pending', 'acknowledged', 'preparing', 'ready', 'served'];

export async function GET(request: Request) {
    const ctx = await getDeviceContext(request);
    if (!ctx.ok) return ctx.response;

    const { searchParams } = new URL(request.url);
    const tableNumber = searchParams.get('table_number');

    const admin = createServiceRoleClient();
    let query = admin
        .from('orders')
        .select(
            'id, restaurant_id, table_id, table_number, status, order_type, total_amount, currency, customer_name, customer_phone, delivery_address, notes, created_at, updated_at'
        )
        .eq('restaurant_id', ctx.restaurantId)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false });

    if (tableNumber) {
        query = query.eq('table_number', tableNumber);
    }

    const { data, error } = await query;
    if (error) {
        return apiError('Failed to fetch orders', 500, 'ORDERS_FETCH_FAILED', error.message);
    }

    return apiSuccess({ orders: data ?? [] });
}

const PlaceOrderSchema = z.object({
    table_number: z.string().min(1).optional(),
    order_type: z.enum(['dine_in', 'pickup', 'delivery', 'online']).optional().default('dine_in'),
    customer_name: z.string().max(120).optional().nullable(),
    customer_phone: z.string().max(30).optional().nullable(),
    delivery_address: z.string().max(500).optional().nullable(),
    discount_id: z.string().uuid().optional().nullable(),
    manager_pin: z.string().min(4).max(12).optional().nullable(),
    items: z
        .array(
            z.object({
                menu_item_id: z.string().uuid(),
                name: z.string(),
                quantity: z.number().int().positive(),
                // CRIT-02: unit_price is now in SANTIM (integer), not birr
                unit_price: z
                    .number()
                    .int()
                    .nonnegative('Unit price must be a non-negative integer (in santim)'),
                notes: z.string().optional().nullable(),
                course: z.enum(['appetizer', 'main', 'dessert', 'beverage', 'side']).optional(),
            })
        )
        .min(1),
    notes: z.string().optional().nullable(),
    staff_name: z.string().optional().nullable(),
});

export async function POST(request: Request) {
    // Rate limiting for order creation
    const nextRequest = request as NextRequest;
    const { fingerprint, ipAddress, userAgent } = getClientIdentifier(nextRequest);
    await logRateLimitedRequest(fingerprint, 'device_order_create', ipAddress, userAgent);

    const ctx = await getDeviceContext(request);
    if (!ctx.ok) return ctx.response;

    // Check rate limit after device context is validated
    const rateCheck = await withRateLimit(
        async () => apiSuccess({}),
        RATE_LIMIT_CONFIGS.orderCreate
    )(nextRequest);
    if (rateCheck.status === 429) {
        return rateCheck;
    }

    const explicitIdempotencyKey = request.headers.get('x-idempotency-key');
    if (explicitIdempotencyKey && !isIdempotencyKeyValid(explicitIdempotencyKey)) {
        return apiError('Invalid idempotency key', 400, 'INVALID_IDEMPOTENCY_KEY');
    }
    const idempotencyKey = resolveIdempotencyKey(explicitIdempotencyKey);

    const parsed = await parseJsonBody(request, PlaceOrderSchema);
    if (!parsed.success) return parsed.response;

    const {
        table_number,
        order_type,
        customer_name,
        customer_phone,
        delivery_address,
        discount_id,
        manager_pin,
        items,
        notes,
        staff_name,
    } = parsed.data;
    const admin = createServiceRoleClient();

    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

    if (order_type === 'dine_in' && !table_number) {
        return apiError('table_number is required for dine-in orders', 400, 'TABLE_REQUIRED');
    }
    if (order_type === 'delivery' && !delivery_address) {
        return apiError(
            'delivery_address is required for delivery orders',
            400,
            'DELIVERY_ADDRESS_REQUIRED'
        );
    }

    let table: { id: string; status: string } | null = null;
    if (table_number) {
        const { data, error: tableError } = await admin
            .from('tables')
            .select('id, status')
            .eq('restaurant_id', ctx.restaurantId)
            .eq('table_number', table_number)
            .maybeSingle();

        if (tableError) {
            return apiError(
                'Failed to resolve table',
                500,
                'TABLE_FETCH_FAILED',
                tableError.message
            );
        }
        table = data;
    }
    if (order_type === 'dine_in' && !table) {
        return apiError('Table not found', 404, 'TABLE_NOT_FOUND');
    }

    const menuItemIds = items.map(item => item.menu_item_id);
    const { data: menuRows } = await admin
        .from('menu_items')
        .select('id, course')
        .in('id', menuItemIds);
    const menuCourseMap = new Map(
        ((menuRows ?? []) as Array<{ id?: string; course?: string | null }>)
            .filter(row => row.id)
            .map(row => [String(row.id), String(row.course ?? 'main')])
    );

    const normalizedItems = items.map(item => ({
        id: item.menu_item_id,
        name: item.name,
        quantity: item.quantity,
        price: item.unit_price,
        notes: item.notes ?? null,
        status: 'pending',
        course: item.course ?? menuCourseMap.get(item.menu_item_id) ?? 'main',
    }));

    let discountRuntime;
    try {
        discountRuntime = await prepareOrderDiscount({
            supabase: admin as SupabaseClient<Database>,
            restaurantId: ctx.restaurantId,
            discountId: discount_id ?? null,
            managerPin: manager_pin ?? null,
            items: items.map(item => ({
                id: item.menu_item_id,
                price: item.unit_price,
                quantity: item.quantity,
            })),
        });
    } catch (error) {
        return apiError(
            error instanceof Error ? error.message : 'Failed to validate discount',
            400,
            'DISCOUNT_INVALID'
        );
    }

    const { data: order, error: orderError } = await admin
        .from('orders')
        .insert({
            restaurant_id: ctx.restaurantId,
            table_number: table_number ?? null,
            status: 'pending',
            total_price: discountRuntime.calculation.total,
            order_number: orderNumber,
            idempotency_key: idempotencyKey,
            notes: notes ?? (staff_name ? `POS waiter: ${staff_name}` : null),
            items: normalizedItems,
            order_type,
            customer_name: customer_name ?? null,
            customer_phone: customer_phone ?? null,
            delivery_address: delivery_address ?? null,
            ...(discountRuntime.discount ? { discount_id: discountRuntime.discount.id } : {}),
            ...(discountRuntime.calculation.discountAmount > 0
                ? { discount_amount: discountRuntime.calculation.discountAmount }
                : {}),
        } as Record<string, unknown>)
        .select(
            'id, restaurant_id, table_number, status, total_price, order_number, order_type, customer_name, customer_phone, delivery_address, notes, created_at, updated_at'
        )
        .single();

    if (orderError || !order) {
        return apiError('Failed to create order', 500, 'ORDER_CREATE_FAILED', orderError?.message);
    }

    const orderItems = items.map(item => ({
        order_id: order.id,
        item_id: item.menu_item_id,
        name: item.name,
        quantity: item.quantity,
        price: item.unit_price,
        notes: item.notes ?? null,
        status: 'pending',
        course: item.course ?? menuCourseMap.get(item.menu_item_id) ?? 'main',
    }));

    const { error: itemsError } = await admin.from('order_items').insert(orderItems);
    if (itemsError) {
        await admin.from('orders').delete().eq('id', order.id);
        return apiError(
            'Failed to save order items',
            500,
            'ORDER_ITEMS_FAILED',
            itemsError.message
        );
    }

    if (order_type === 'dine_in' && table) {
        const { data: existingSession } = await admin
            .from('table_sessions')
            .select('id')
            .eq('restaurant_id', ctx.restaurantId)
            .eq('table_id', table.id)
            .eq('status', 'open')
            .maybeSingle();

        if (!existingSession) {
            await admin.from('table_sessions').insert({
                restaurant_id: ctx.restaurantId,
                table_id: table.id,
                guest_count: 1,
                status: 'open',
                notes: staff_name
                    ? `Opened by ${staff_name} via waiter POS`
                    : 'Opened via waiter POS',
            });
        }
    }

    await admin.from('order_events').insert({
        restaurant_id: ctx.restaurantId,
        order_id: order.id,
        event_type: 'created',
        from_status: null,
        to_status: 'pending',
        actor_user_id: null,
        metadata: {
            source: 'waiter_pos_device',
            staff_name: staff_name ?? null,
            table_number: table_number ?? null,
            order_type,
            customer_name: customer_name ?? null,
            customer_phone: customer_phone ?? null,
            discount_id: discountRuntime.discount?.id ?? null,
            discount_amount: discountRuntime.calculation.discountAmount,
        },
    });

    // Mark the table as occupied for dine-in flows only.
    if (order_type === 'dine_in' && table_number) {
        await admin
            .from('tables')
            .update({ status: 'occupied', active_order_id: order.id })
            .eq('restaurant_id', ctx.restaurantId)
            .eq('table_number', table_number);
    }

    await publishEvent(
        createloleEvent('order.created', {
            restaurant_id: ctx.restaurantId,
            order_id: order.id,
            idempotency_key: idempotencyKey,
            source: 'waiter_pos_device',
            order_type,
        })
    );

    return apiSuccess({ order }, 201);
}
