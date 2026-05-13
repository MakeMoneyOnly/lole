import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import {
    getAuthenticatedUser,
    getAuthorizedRestaurantContext,
    getDeviceContext,
} from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { resolveIdempotencyKey } from '@/lib/api/idempotency';
import type { Json, TablesInsert } from '@/types/database';
import { redisRateLimiters } from '@/lib/security';
import type { NextRequest } from 'next/server';
import { createClient as _createClient } from '@/lib/supabase/server';

const SplitMethodSchema = z.enum(['even', 'items', 'custom']);

const SplitRequestLineSchema = z.object({
    guest_name: z.string().trim().max(80).optional(),
    item_ids: z.array(z.string().uuid()).max(250).optional(),
    amount: z.coerce.number().min(0).max(100000000).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

const UpsertOrderSplitSchema = z.object({
    method: SplitMethodSchema,
    splits: z.array(SplitRequestLineSchema).min(2).max(20),
});

type SplitMethod = z.infer<typeof SplitMethodSchema>;
type SplitRequest = z.infer<typeof UpsertOrderSplitSchema>;

function toCents(amount: number): number {
    return Math.round(amount * 100);
}

function fromCents(cents: number): number {
    return Number((cents / 100).toFixed(2));
}

function buildEvenAmounts(totalPrice: number, splitCount: number): number[] {
    const totalCents = toCents(totalPrice);
    const base = Math.floor(totalCents / splitCount);
    const remainder = totalCents - base * splitCount;

    const cents = Array.from({ length: splitCount }, (_, idx) =>
        idx < remainder ? base + 1 : base
    );
    return cents.map(fromCents);
}

export async function GET(_request: Request, context: { params: Promise<{ orderId: string }> }) {
    const auth = await getAuthenticatedUser();
    let restaurantId: string;
    let db: Awaited<ReturnType<typeof getAuthorizedRestaurantContext>>['supabase'] | undefined;

    if (auth.ok) {
        const restaurantContext = await getAuthorizedRestaurantContext(auth.user.id);
        if (!restaurantContext.ok) {
            return restaurantContext.response;
        }
        restaurantId = restaurantContext.restaurantId;
        db = restaurantContext.supabase;
    } else {
        const deviceContext = await getDeviceContext(_request);
        if (!deviceContext.ok) {
            return auth.response;
        }
        restaurantId = deviceContext.restaurantId;
        db = deviceContext.admin;
    }

    const { orderId } = await context.params;

    const { data: order, error: orderError } = await db
        .from('orders')
        .select('id, total_price, status')
        .eq('restaurant_id', restaurantId)
        .eq('id', orderId)
        .maybeSingle();

    if (orderError) {
        return apiError('Failed to load order', 500, 'ORDER_FETCH_FAILED', orderError.message);
    }
    if (!order) {
        return apiError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    // HIGH-013: Explicit column selection
    const { data: splits, error: splitsError } = await db
        .from('order_check_splits')
        .select(
            'id, restaurant_id, order_id, split_index, split_label, requested_amount, computed_amount, status, metadata, created_by, created_at, updated_at'
        )
        .eq('restaurant_id', restaurantId)
        .eq('order_id', orderId)
        .order('split_index', { ascending: true });

    if (splitsError) {
        return apiError(
            'Failed to load check splits',
            500,
            'ORDER_SPLITS_FETCH_FAILED',
            splitsError.message
        );
    }

    const splitRows = (splits ?? []) as unknown as Array<Record<string, unknown>>;
    const splitIds = splitRows.map(row => String(row.id)).filter(Boolean);

    let splitItems: Array<Record<string, unknown>> = [];
    let splitPayments: Array<Record<string, unknown>> = [];
    let orderItems: Array<Record<string, unknown>> = [];

    const { data: orderItemsData, error: orderItemsError } = await db
        .from('order_items')
        .select('id, name, quantity, price, notes, created_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

    if (orderItemsError) {
        return apiError(
            'Failed to load order items',
            500,
            'ORDER_ITEMS_FETCH_FAILED',
            orderItemsError.message
        );
    }

    orderItems = (orderItemsData ?? []) as Array<Record<string, unknown>>;

    if (splitIds.length > 0) {
        const [
            { data: splitItemsData, error: splitItemsError },
            { data: splitPaymentsData, error: splitPaymentsError },
        ] = await Promise.all([
            db
                .from('order_check_split_items')
                .select(
                    'id, restaurant_id, order_id, split_id, order_item_id, quantity, line_amount, idempotency_key, created_at'
                )
                .eq('restaurant_id', restaurantId)
                .eq('order_id', orderId),
            db
                .from('payments')
                .select('id, split_id, amount, tip_amount, method, status, created_at')
                .eq('restaurant_id', restaurantId)
                .in('split_id', splitIds),
        ]);

        if (splitItemsError) {
            return apiError(
                'Failed to load split items',
                500,
                'ORDER_SPLIT_ITEMS_FETCH_FAILED',
                splitItemsError.message
            );
        }
        if (splitPaymentsError) {
            return apiError(
                'Failed to load split payments',
                500,
                'ORDER_SPLIT_PAYMENTS_FETCH_FAILED',
                splitPaymentsError.message
            );
        }

        splitItems = (splitItemsData ?? []) as unknown as Array<Record<string, unknown>>;
        splitPayments = (splitPaymentsData ?? []) as Array<Record<string, unknown>>;
    }

    const inferredMethod: SplitMethod =
        splitItems.length > 0
            ? 'items'
            : splitRows.some(
                    row => row.requested_amount !== null && row.requested_amount !== undefined
                )
              ? 'custom'
              : 'even';

    return apiSuccess({
        order: {
            id: order.id,
            total_price: Number(order.total_price ?? 0),
            status: order.status,
        },
        method: inferredMethod,
        order_items: orderItems,
        splits: splitRows,
        split_items: splitItems,
        split_payments: splitPayments,
    });
}

type ComputedSplit = {
    split_index: number;
    split_label: string | null;
    requested_amount: number | null;
    computed_amount: number;
    item_ids: string[];
    metadata: Json;
};

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
    // Apply rate limiting for order split (mutation endpoint)
    const rateLimitResponse = await redisRateLimiters.mutation(request as NextRequest);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    const auth = await getAuthenticatedUser();
    let actorUserId: string | null = null;
    let restaurantId: string;
    let db: Awaited<ReturnType<typeof getAuthorizedRestaurantContext>>['supabase'] | undefined;

    if (auth.ok) {
        const restaurantContext = await getAuthorizedRestaurantContext(auth.user.id);
        if (!restaurantContext.ok) {
            return restaurantContext.response;
        }
        actorUserId = auth.user.id;
        restaurantId = restaurantContext.restaurantId;
        db = restaurantContext.supabase;
    } else {
        const deviceContext = await getDeviceContext(request);
        if (!deviceContext.ok) {
            return auth.response;
        }
        restaurantId = deviceContext.restaurantId;
        db = deviceContext.admin;
    }

    // Extract idempotency key from headers for retry safety
    const explicitIdempotencyKey = request.headers.get('x-idempotency-key');
    const idempotencyKey = resolveIdempotencyKey(explicitIdempotencyKey);

    const parsed = await parseJsonBody(request, UpsertOrderSplitSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const payload = parsed.data;
    const { orderId } = await context.params;

    const { data: order, error: orderError } = await db
        .from('orders')
        .select('id, total_price, status')
        .eq('restaurant_id', restaurantId)
        .eq('id', orderId)
        .maybeSingle();

    if (orderError) {
        return apiError('Failed to load order', 500, 'ORDER_FETCH_FAILED', orderError.message);
    }
    if (!order) {
        return apiError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    if (order.status === 'cancelled' || order.status === 'completed') {
        return apiError(
            'Order cannot be split in current status',
            409,
            'ORDER_SPLIT_INVALID_STATUS'
        );
    }

    const totalPrice = Number(order.total_price ?? 0);
    const computed = await computeSplitPlan(db, restaurantId, orderId, totalPrice, payload);
    if (!computed.ok) {
        return computed.response;
    }

    const { error: deleteItemsError } = await db
        .from('order_check_split_items')
        .delete()
        .eq('restaurant_id', restaurantId)
        .eq('order_id', orderId);

    if (deleteItemsError) {
        return apiError(
            'Failed to reset existing split items',
            500,
            'ORDER_SPLIT_RESET_FAILED',
            deleteItemsError.message
        );
    }

    const { error: deleteSplitsError } = await db
        .from('order_check_splits')
        .delete()
        .eq('restaurant_id', restaurantId)
        .eq('order_id', orderId);

    if (deleteSplitsError) {
        return apiError(
            'Failed to reset existing splits',
            500,
            'ORDER_SPLIT_RESET_FAILED',
            deleteSplitsError.message
        );
    }

    const splitRowsToInsert: TablesInsert<'order_check_splits'>[] = computed.plan.map(split => ({
        restaurant_id: restaurantId,
        order_id: orderId,
        split_index: split.split_index,
        split_label: split.split_label,
        requested_amount: split.requested_amount,
        computed_amount: split.computed_amount,
        status: 'open',
        metadata: split.metadata,
        created_by: actorUserId,
    }));

    // HIGH-013: Explicit column selection
    const { data: insertedSplits, error: insertSplitsError } = await db
        .from('order_check_splits')
        .insert(splitRowsToInsert)
        .select(
            'id, restaurant_id, order_id, split_index, split_label, requested_amount, computed_amount, status, metadata, created_by, created_at, updated_at'
        )
        .order('split_index', { ascending: true });

    if (insertSplitsError) {
        return apiError(
            'Failed to create check splits',
            500,
            'ORDER_SPLIT_CREATE_FAILED',
            insertSplitsError.message
        );
    }

    const splitIdByIndex = new Map<number, string>();
    for (const row of (insertedSplits ?? []) as unknown as Array<Record<string, unknown>>) {
        const splitIndex = Number(row.split_index);
        const splitId = String(row.id ?? '');
        if (Number.isFinite(splitIndex) && splitId.length > 0) {
            splitIdByIndex.set(splitIndex, splitId);
        }
    }

    const splitItemRows = computed.plan.flatMap(split => {
        const splitId = splitIdByIndex.get(split.split_index);
        if (!splitId) return [];
        return split.item_ids.map(orderItemId => ({
            restaurant_id: restaurantId,
            order_id: orderId,
            split_id: splitId,
            order_item_id: orderItemId,
            quantity: 1 as number,
            line_amount: computed.itemAmountById.get(orderItemId) ?? 0,
        }));
    }) as TablesInsert<'order_check_split_items'>[];

    let insertedSplitItems: Array<Record<string, unknown>> = [];
    if (splitItemRows.length > 0) {
        // HIGH-013: Explicit column selection
        const { data: insertItemsData, error: insertItemsError } = await db
            .from('order_check_split_items')
            .insert(splitItemRows)
            .select(
                'id, restaurant_id, order_id, split_id, order_item_id, quantity, line_amount, idempotency_key, created_at'
            );

        if (insertItemsError) {
            return apiError(
                'Failed to create split item mapping',
                500,
                'ORDER_SPLIT_ITEMS_CREATE_FAILED',
                insertItemsError.message
            );
        }

        insertedSplitItems = (insertItemsData ?? []) as unknown as Array<Record<string, unknown>>;
    }

    await writeAuditLog(db, {
        restaurant_id: restaurantId,
        user_id: actorUserId,
        action: 'order_split_configured',
        entity_type: 'order',
        entity_id: orderId,
        metadata: {
            method: payload.method,
            split_count: payload.splits.length,
            source: 'merchant_dashboard',
            idempotency_key: idempotencyKey,
        },
        new_value: {
            method: payload.method,
            splits: splitRowsToInsert,
        } as Json,
    });

    return apiSuccess(
        {
            order_id: orderId,
            method: payload.method,
            splits: insertedSplits ?? [],
            split_items: insertedSplitItems,
        },
        201
    );
}

async function computeSplitPlan(
    db: Awaited<ReturnType<typeof getAuthorizedRestaurantContext>>['supabase'],
    restaurantId: string,
    orderId: string,
    totalPrice: number,
    payload: SplitRequest
): Promise<
    | { ok: true; plan: ComputedSplit[]; itemAmountById: Map<string, number> }
    | { ok: false; response: ReturnType<typeof apiError> }
> {
    const plan: ComputedSplit[] = [];
    const itemAmountById = new Map<string, number>();
    const splitCount = payload.splits.length;

    if (payload.method === 'even') {
        const amounts = buildEvenAmounts(totalPrice, splitCount);
        for (let index = 0; index < splitCount; index += 1) {
            const input = payload.splits[index];
            plan.push({
                split_index: index,
                split_label: input.guest_name?.trim() || `Guest ${index + 1}`,
                requested_amount: null,
                computed_amount: amounts[index],
                item_ids: [],
                metadata: (input.metadata ?? {}) as Json,
            });
        }
        return { ok: true, plan, itemAmountById };
    }

    if (payload.method === 'custom') {
        const amounts = payload.splits.map((split, index) => {
            if (
                typeof split.amount !== 'number' ||
                !Number.isFinite(split.amount) ||
                split.amount <= 0
            ) {
                return { index, amount: null };
            }
            return { index, amount: Number(split.amount.toFixed(2)) };
        });

        if (amounts.some(entry => entry.amount === null)) {
            return {
                ok: false,
                response: apiError(
                    'Custom split requires an amount for each guest',
                    400,
                    'ORDER_SPLIT_INVALID_CUSTOM_AMOUNTS'
                ),
            };
        }

        const sum = amounts.reduce((acc, entry) => acc + (entry.amount ?? 0), 0);
        if (Math.abs(sum - totalPrice) > 0.01) {
            return {
                ok: false,
                response: apiError(
                    'Custom split amounts must match order total',
                    400,
                    'ORDER_SPLIT_TOTAL_MISMATCH',
                    {
                        expected_total: Number(totalPrice.toFixed(2)),
                        provided_total: Number(sum.toFixed(2)),
                    }
                ),
            };
        }

        for (const entry of amounts) {
            const input = payload.splits[entry.index];
            const amount = entry.amount ?? 0;
            plan.push({
                split_index: entry.index,
                split_label: input.guest_name?.trim() || `Guest ${entry.index + 1}`,
                requested_amount: amount,
                computed_amount: amount,
                item_ids: [],
                metadata: (input.metadata ?? {}) as Json,
            });
        }
        return { ok: true, plan, itemAmountById };
    }

    if (!db) {
        return {
            ok: false,
            response: apiError('Database not initialized', 500, 'DB_NOT_INITIALIZED'),
        };
    }

    if (!db) {
        return {
            ok: false,
            response: apiError('Database not initialized', 500, 'DB_NOT_INITIALIZED'),
        };
    }

    const { data: orderItems, error: orderItemsError } = await db
        .from('order_items')
        .select('id, quantity, price')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

    if (orderItemsError) {
        return {
            ok: false,
            response: apiError(
                'Failed to load order items for split',
                500,
                'ORDER_ITEMS_FETCH_FAILED',
                orderItemsError.message
            ),
        };
    }

    const rows = (orderItems ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) {
        return {
            ok: false,
            response: apiError(
                'Item-based split requires relational order items',
                409,
                'ORDER_SPLIT_ITEMS_NOT_AVAILABLE'
            ),
        };
    }

    const knownOrderItemIds = new Set<string>();
    for (const row of rows) {
        const id = String(row.id ?? '');
        const quantity = Number(row.quantity ?? 1);
        const unitPrice = Number(row.price ?? 0);
        const lineAmount = Number((quantity * unitPrice).toFixed(2));
        if (id.length > 0) {
            knownOrderItemIds.add(id);
            itemAmountById.set(id, lineAmount);
        }
    }

    const seen = new Set<string>();
    for (let index = 0; index < splitCount; index += 1) {
        const input = payload.splits[index];
        const itemIds = input.item_ids ?? [];

        if (itemIds.length === 0) {
            return {
                ok: false,
                response: apiError(
                    'Each split must include at least one order item',
                    400,
                    'ORDER_SPLIT_MISSING_ITEMS'
                ),
            };
        }

        const deduped = [...new Set(itemIds)];
        for (const itemId of deduped) {
            if (!knownOrderItemIds.has(itemId)) {
                return {
                    ok: false,
                    response: apiError(
                        'Split references unknown order item',
                        400,
                        'ORDER_SPLIT_UNKNOWN_ITEM',
                        { order_item_id: itemId }
                    ),
                };
            }
            if (seen.has(itemId)) {
                return {
                    ok: false,
                    response: apiError(
                        'Each order item can only belong to one split',
                        400,
                        'ORDER_SPLIT_DUPLICATE_ITEM',
                        { order_item_id: itemId }
                    ),
                };
            }
            seen.add(itemId);
        }

        const computedAmount = deduped.reduce(
            (acc, itemId) => acc + (itemAmountById.get(itemId) ?? 0),
            0
        );
        plan.push({
            split_index: index,
            split_label: input.guest_name?.trim() || `Guest ${index + 1}`,
            requested_amount: null,
            computed_amount: Number(computedAmount.toFixed(2)),
            item_ids: deduped,
            metadata: (input.metadata ?? {}) as Json,
        });
    }

    if (seen.size !== knownOrderItemIds.size) {
        return {
            ok: false,
            response: apiError(
                'Item split must allocate all order items',
                400,
                'ORDER_SPLIT_INCOMPLETE_ITEMS',
                { allocated_items: seen.size, total_items: knownOrderItemIds.size }
            ),
        };
    }

    const allocatedTotal = Number(
        plan.reduce((acc, split) => acc + split.computed_amount, 0).toFixed(2)
    );
    if (Math.abs(allocatedTotal - totalPrice) > 0.01) {
        return {
            ok: false,
            response: apiError(
                'Allocated split total does not match order total',
                400,
                'ORDER_SPLIT_TOTAL_MISMATCH',
                { expected_total: Number(totalPrice.toFixed(2)), allocated_total: allocatedTotal }
            ),
        };
    }

    return { ok: true, plan, itemAmountById };
}
