/**
 * POST /api/device/tables/close
 * Settle a dine-in table and close its open table session.
 * Requires X-Device-Token header.
 *
 * IMPORTANT: This endpoint now publishes order.completed events to the
 * event bus instead of processing loyalty/ERCA synchronously. Background
 * jobs handle those side effects asynchronously.
 */
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getDeviceContext } from '@/lib/api/authz';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { parseJsonBody } from '@/lib/api/validation';
import { isChapaConfigured, verifyChapaTransaction } from '@/lib/services/chapaService';
import { ensurePaymentSessionForRecordedPayment } from '@/lib/payments/payment-sessions';
import { createloleEvent } from '@/lib/events/contracts';
import { enqueueInternalJob } from '@/lib/events/runtime';

const CloseTableSchema = z.object({
    table_id: z.string().uuid().optional(),
    table_number: z.string().trim().min(1).optional(),
    payment: z.object({
        provider: z.enum(['cash', 'chapa', 'other']),
        tx_ref: z.string().trim().min(3).optional(),
        amount: z.number().nonnegative().optional(),
        tip_amount: z.number().nonnegative().optional().default(0),
    }),
    notes: z.string().trim().max(500).optional(),
});

const BLOCKING_ORDER_STATUSES = [
    'payment_pending',
    'pending',
    'acknowledged',
    'preparing',
] as const;
const FINALIZABLE_ORDER_STATUSES = ['ready', 'served'] as const;

export async function POST(request: Request) {
    const ctx = await getDeviceContext(request);
    if (!ctx.ok) return ctx.response;

    const parsed = await parseJsonBody(request, CloseTableSchema);
    if (!parsed.success) return parsed.response;

    const admin = createServiceRoleClient();
    const { table_id, table_number, payment, notes } = parsed.data;

    if (!table_id && !table_number) {
        return apiError('table_id or table_number is required', 400, 'TABLE_SELECTOR_REQUIRED');
    }

    let tableQuery = admin
        .from('tables')
        .select('id, table_number, status')
        .eq('restaurant_id', ctx.restaurantId);

    if (table_id) {
        tableQuery = tableQuery.eq('id', table_id);
    } else if (table_number) {
        tableQuery = tableQuery.eq('table_number', table_number);
    }

    const { data: table, error: tableError } = await tableQuery.maybeSingle();
    if (tableError) {
        return apiError('Failed to fetch table', 500, 'TABLE_FETCH_FAILED', tableError.message);
    }
    if (!table) {
        return apiError('Table not found', 404, 'TABLE_NOT_FOUND');
    }

    const { data: openSession, error: sessionError } = await admin
        .from('table_sessions')
        .select('id, notes')
        .eq('restaurant_id', ctx.restaurantId)
        .eq('table_id', table.id)
        .eq('status', 'open')
        .maybeSingle();

    const { data: tableOrders, error: ordersError } = await admin
        .from('orders')
        .select('id, status, total_price, chapa_tx_ref, paid_at, chapa_verified')
        .eq('restaurant_id', ctx.restaurantId)
        .eq('table_number', table.table_number)
        .in('status', [
            'payment_pending',
            'pending',
            'acknowledged',
            'preparing',
            'ready',
            'served',
        ]);

    if (sessionError) {
        return apiError(
            'Failed to resolve table session',
            500,
            'TABLE_SESSION_FETCH_FAILED',
            sessionError.message
        );
    }
    if (ordersError) {
        return apiError(
            'Failed to fetch table orders',
            500,
            'TABLE_ORDERS_FETCH_FAILED',
            ordersError.message
        );
    }

    let ensuredOpenSession = openSession;
    if (!ensuredOpenSession) {
        const { data: createdSession, error: createSessionError } = await admin
            .from('table_sessions')
            .insert({
                restaurant_id: ctx.restaurantId,
                table_id: table.id,
                guest_count: 1,
                status: 'open',
                notes: 'Auto-recovered during waiter settlement (missing legacy open session)',
            })
            .select('id, notes')
            .single();

        if (createSessionError) {
            if (createSessionError.code === '23505') {
                const { data: recoveredSession, error: recoverSessionError } = await admin
                    .from('table_sessions')
                    .select('id, notes')
                    .eq('restaurant_id', ctx.restaurantId)
                    .eq('table_id', table.id)
                    .eq('status', 'open')
                    .maybeSingle();
                if (recoverSessionError) {
                    return apiError(
                        'Failed to recover open table session',
                        500,
                        'TABLE_SESSION_RECOVERY_FAILED',
                        recoverSessionError.message
                    );
                }
                ensuredOpenSession = recoveredSession;
            } else {
                return apiError(
                    'Failed to auto-create open table session',
                    500,
                    'TABLE_SESSION_CREATE_FAILED',
                    createSessionError.message
                );
            }
        } else {
            ensuredOpenSession = createdSession;
        }
    }

    if (!ensuredOpenSession) {
        return apiError('Open table session not found', 409, 'TABLE_SESSION_NOT_OPEN');
    }

    const tableStatus = String(table.status ?? 'available');
    if (tableStatus !== 'bill_requested') {
        return apiError(
            'Table must be in bill requested state before settlement',
            409,
            'TABLE_NOT_BILL_REQUESTED'
        );
    }

    const activeOrders = tableOrders ?? [];
    const blockingOrders = activeOrders.filter(order =>
        BLOCKING_ORDER_STATUSES.includes(
            String(order.status) as (typeof BLOCKING_ORDER_STATUSES)[number]
        )
    );
    if (blockingOrders.length > 0) {
        return apiError(
            'Table has unpaid or in-progress orders. Complete prep/payment first.',
            409,
            'TABLE_CLOSE_BLOCKED',
            {
                blocking_order_ids: blockingOrders.map(order => order.id),
                blocking_statuses: [...new Set(blockingOrders.map(order => order.status))],
            }
        );
    }

    const settlementAmount = Number(
        activeOrders.reduce((sum, order) => sum + Number(order.total_price ?? 0), 0).toFixed(2)
    );

    if (activeOrders.length === 0) {
        const now = new Date().toISOString();
        const mergedCloseNotes =
            [ensuredOpenSession.notes, notes, 'Closed via waiter POS (no active orders)']
                .filter(Boolean)
                .join(' | ') || null;

        await Promise.all([
            admin
                .from('table_sessions')
                .update({
                    status: 'closed',
                    closed_at: now,
                    notes: mergedCloseNotes,
                    updated_at: now,
                })
                .eq('id', ensuredOpenSession.id)
                .eq('restaurant_id', ctx.restaurantId),
            admin
                .from('tables')
                .update({
                    status: 'available',
                    active_order_id: null,
                    updated_at: now,
                })
                .eq('id', table.id)
                .eq('restaurant_id', ctx.restaurantId),
            admin.from('audit_logs').insert({
                restaurant_id: ctx.restaurantId,
                user_id: null,
                action: 'waiter_table_closed',
                entity_type: 'table',
                entity_id: table.id,
                metadata: {
                    source: 'waiter_pos_device',
                    table_number: table.table_number,
                    session_id: ensuredOpenSession.id,
                    settled_amount: 0,
                },
            }),
        ]);

        return apiSuccess({
            table_id: table.id,
            table_number: table.table_number,
            closed_session_id: ensuredOpenSession.id,
            payment: null,
            completed_order_ids: [],
        });
    }

    if (settlementAmount <= 0) {
        return apiError(
            'No billable orders found for this table',
            409,
            'TABLE_CLOSE_NO_BILLABLE_ORDERS'
        );
    }

    if (typeof payment.amount === 'number') {
        const provided = Number(payment.amount.toFixed(2));
        if (Math.abs(provided - settlementAmount) > 0.01) {
            return apiError(
                `Settlement amount mismatch. Expected ${settlementAmount.toFixed(2)} ETB`,
                409,
                'TABLE_CLOSE_AMOUNT_MISMATCH'
            );
        }
    }

    const paymentProvider = payment.provider;
    const hasTxRef = Boolean(payment.tx_ref?.trim());
    if (paymentProvider === 'chapa' && hasTxRef) {
        if (isChapaConfigured()) {
            const verified = await verifyChapaTransaction(String(payment.tx_ref));
            const verifiedStatus = String(verified.data?.status ?? '').toLowerCase();
            if (verifiedStatus !== 'success') {
                return apiError(
                    'Chapa payment is not verified as successful',
                    409,
                    'CHAPA_PAYMENT_NOT_VERIFIED',
                    verified.data ?? null
                );
            }
        }
    } else if (paymentProvider === 'chapa') {
        const unpaidOrders = activeOrders.filter(
            order =>
                !order.paid_at ||
                order.chapa_verified !== true ||
                !String(order.chapa_tx_ref ?? '').trim()
        );
        if (unpaidOrders.length > 0) {
            return apiError(
                'Missing Chapa tx_ref. Some orders are not marked as paid via Chapa.',
                409,
                'TABLE_CLOSE_MISSING_TX_REF'
            );
        }
    }

    const now = new Date().toISOString();
    const finalizableOrders = activeOrders.filter(order =>
        FINALIZABLE_ORDER_STATUSES.includes(
            String(order.status) as (typeof FINALIZABLE_ORDER_STATUSES)[number]
        )
    );
    const finalizableOrderIds = finalizableOrders.map(order => order.id);

    const paymentSession = await ensurePaymentSessionForRecordedPayment(
        admin as unknown as Parameters<typeof ensurePaymentSessionForRecordedPayment>[0],
        {
            restaurantId: ctx.restaurantId,
            orderId: null,
            surface: ctx.device.device_type === 'terminal' ? 'terminal' : 'waiter_pos',
            channel: 'dine_in',
            method:
                paymentProvider === 'cash'
                    ? 'cash'
                    : paymentProvider === 'other'
                      ? 'other'
                      : paymentProvider,
            provider:
                paymentProvider === 'cash' || paymentProvider === 'other'
                    ? 'internal'
                    : paymentProvider,
            amount: settlementAmount,
            status: 'captured',
            metadata: {
                source: `${ctx.device.device_type}_close_table`,
                table_id: table.id,
                table_number: table.table_number,
                order_ids: activeOrders.map(order => order.id),
            },
        }
    );

    const { data: paymentRecord, error: paymentError } = await admin
        .from('payments')
        .insert({
            restaurant_id: ctx.restaurantId,
            order_id: null,
            payment_session_id: paymentSession.id,
            method: paymentProvider,
            provider:
                paymentProvider === 'cash' || paymentProvider === 'other'
                    ? 'internal'
                    : paymentProvider,
            provider_reference: payment.tx_ref?.trim() || null,
            amount: settlementAmount,
            tip_amount: Number((payment.tip_amount ?? 0).toFixed(2)),
            currency: 'ETB',
            status: 'captured',
            captured_at: now,
            metadata: {
                source: `${ctx.device.device_type}_close_table`,
                payment_session_id: paymentSession.id,
                table_id: table.id,
                table_number: table.table_number,
                order_ids: activeOrders.map(order => order.id),
                paid_order_tx_refs: activeOrders
                    .map(order => String(order.chapa_tx_ref ?? '').trim())
                    .filter(Boolean),
            },
            created_by: null,
        })
        .select('id, amount, provider_reference')
        .single();

    if (paymentError || !paymentRecord) {
        return apiError(
            'Failed to record settlement payment',
            500,
            'PAYMENT_RECORD_FAILED',
            paymentError?.message
        );
    }

    if (finalizableOrderIds.length > 0) {
        await admin
            .from('orders')
            .update({
                status: 'completed',
                completed_at: now,
                updated_at: now,
            })
            .in('id', finalizableOrderIds)
            .eq('restaurant_id', ctx.restaurantId);

        await admin.from('order_events').insert(
            finalizableOrders.map(order => ({
                restaurant_id: ctx.restaurantId,
                order_id: order.id,
                event_type: 'status_changed',
                from_status: String(order.status ?? 'ready'),
                to_status: 'completed',
                actor_user_id: null,
                metadata: {
                    source: 'waiter_pos_close_table',
                    payment_id: paymentRecord.id,
                    tx_ref: payment.tx_ref?.trim() || null,
                },
            }))
        );

        // Queue background jobs for each completed order
        // This removes synchronous cross-domain side effects (loyalty, ERCA, etc.)
        const jobQueuePromises = finalizableOrderIds.map(orderId =>
            enqueueInternalJob({
                path: '/api/jobs/orders/completed',
                body: createloleEvent('order.completed', {
                    order_id: orderId,
                    restaurant_id: ctx.restaurantId,
                    completed_at: now,
                    trigger: 'table_close',
                }) as unknown as Record<string, unknown>,
                deduplicationKey: `order-completed-${orderId}`,
            }).catch(err => {
                console.error(`[close-table] Failed to queue job for order ${orderId}:`, err);
                return undefined;
            })
        );

        // Fire and forget - don't block the response on job queuing
        Promise.all(jobQueuePromises).catch(() => {});
    }

    const mergedCloseNotes =
        [
            ensuredOpenSession.notes,
            notes,
            payment.tx_ref?.trim()
                ? `Settled via ${paymentProvider}: ${payment.tx_ref}`
                : `Settled via ${paymentProvider}`,
        ]
            .filter(Boolean)
            .join(' | ') || null;

    await Promise.all([
        admin
            .from('table_sessions')
            .update({
                status: 'closed',
                closed_at: now,
                notes: mergedCloseNotes,
                updated_at: now,
            })
            .eq('id', ensuredOpenSession.id)
            .eq('restaurant_id', ctx.restaurantId),
        admin
            .from('tables')
            .update({
                status: 'available',
                active_order_id: null,
                updated_at: now,
            })
            .eq('id', table.id)
            .eq('restaurant_id', ctx.restaurantId),
        admin.from('audit_logs').insert({
            restaurant_id: ctx.restaurantId,
            user_id: null,
            action: 'waiter_table_closed',
            entity_type: 'table',
            entity_id: table.id,
            metadata: {
                source: `${ctx.device.device_type}_device`,
                table_number: table.table_number,
                session_id: ensuredOpenSession.id,
                payment_id: paymentRecord.id,
                payment_session_id: paymentSession.id,
                tx_ref: payment.tx_ref,
                settled_amount: settlementAmount,
            },
        }),
    ]);

    return apiSuccess({
        table_id: table.id,
        table_number: table.table_number,
        closed_session_id: ensuredOpenSession.id,
        payment: paymentRecord,
        completed_order_ids: finalizableOrderIds,
    });
}
