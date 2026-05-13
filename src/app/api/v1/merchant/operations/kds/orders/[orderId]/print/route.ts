import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import {
    DEFAULT_KDS_PRINT_POLICY,
    dispatchKdsPrintJob,
    normalizeKdsPrintPolicy,
} from '@/features/kds/lib/printer';

const PrintTicketBodySchema = z.object({
    reason: z.string().trim().min(2).max(120).optional().default('manual_print'),
});

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const restaurantContext = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!restaurantContext.ok) {
        return restaurantContext.response;
    }

    const { orderId } = await context.params;
    const parsedBody = await parseJsonBody(request, PrintTicketBodySchema);
    if (!parsedBody.success) return parsedBody.response;

    const db = restaurantContext.supabase;

    const [{ data: order, error: orderError }, { data: restaurant, error: restaurantError }] =
        await Promise.all([
            db
                .from('orders')
                .select('id, restaurant_id, order_number, table_number')
                .eq('restaurant_id', restaurantContext.restaurantId)
                .eq('id', orderId)
                .maybeSingle(),
            db
                .from('restaurants')
                .select('settings')
                .eq('id', restaurantContext.restaurantId)
                .maybeSingle(),
        ]);

    if (orderError) {
        return apiError(
            'Failed to load order for print',
            500,
            'KDS_PRINT_ORDER_FETCH_FAILED',
            orderError.message
        );
    }
    if (!order) {
        return apiError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    if (restaurantError) {
        return apiError(
            'Failed to load printer settings',
            500,
            'KDS_PRINT_SETTINGS_FETCH_FAILED',
            restaurantError.message
        );
    }

    const settings = (restaurant?.settings ?? {}) as Record<string, unknown>;
    const kds = (settings.kds ?? {}) as Record<string, unknown>;
    const policy = normalizeKdsPrintPolicy(
        (kds.print_policy as Record<string, unknown> | undefined) ?? DEFAULT_KDS_PRINT_POLICY
    );

    if (policy.mode === 'off') {
        return apiError('Printer fallback is disabled', 409, 'KDS_PRINT_MODE_OFF');
    }

    const { data: rows, error: itemsError } = await db
        .from('kds_order_items')
        .select('name, quantity, station, notes, status')
        .eq('restaurant_id', restaurantContext.restaurantId)
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });

    if (itemsError) {
        return apiError(
            'Failed to load ticket lines for print',
            500,
            'KDS_PRINT_ITEMS_FETCH_FAILED',
            itemsError.message
        );
    }

    const payload = {
        restaurantId: restaurantContext.restaurantId,
        orderId: order.id,
        orderNumber: String(order.order_number ?? order.id),
        tableNumber: order.table_number ?? null,
        firedAt: new Date().toISOString(),
        reason: parsedBody.data.reason,
        items: ((rows ?? []) as Array<Record<string, unknown>>).map(item => ({
            name: String(item.name ?? 'Item'),
            quantity: Number(item.quantity ?? 1),
            station: item.station ? String(item.station) : null,
            notes: item.notes ? String(item.notes) : null,
            status: item.status ? String(item.status) : null,
        })),
    };

    try {
        const result = await dispatchKdsPrintJob(policy, payload);

        await writeAuditLog(db, {
            restaurant_id: restaurantContext.restaurantId,
            user_id: auth.user.id,
            action: 'kds_ticket_printed',
            entity_type: 'order',
            entity_id: order.id,
            metadata: {
                source: 'kds_print_endpoint',
                reason: parsedBody.data.reason,
                provider: result.provider,
                mode: policy.mode,
                attempts: result.attempts,
                event_id: result.event_id,
                bridge_status: result.bridge_status ?? null,
            },
            new_value: {
                provider: result.provider,
                dispatched: result.dispatched,
                reason: result.reason,
                attempts: result.attempts,
                event_id: result.event_id,
                bridge_status: result.bridge_status ?? null,
            },
        });

        return apiSuccess({
            printed: result.dispatched,
            provider: result.provider,
            mode: policy.mode,
            reason: result.reason,
            attempts: result.attempts,
            event_id: result.event_id,
            bridge_status: result.bridge_status ?? null,
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'unknown_error';
        await writeAuditLog(db, {
            restaurant_id: restaurantContext.restaurantId,
            user_id: auth.user.id,
            action: 'kds_ticket_print_failed',
            entity_type: 'order',
            entity_id: order.id,
            metadata: {
                source: 'kds_print_endpoint',
                reason: parsedBody.data.reason,
                mode: policy.mode,
            },
            new_value: {
                error: errorMessage,
            },
        });

        return apiError('Failed to print ticket', 502, 'KDS_PRINT_DISPATCH_FAILED', errorMessage);
    }
}
