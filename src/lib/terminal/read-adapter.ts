import { getPaymentOptionsForSurface, type SupportedPaymentMethod } from '@/lib/devices/config';
import {
    getTableSettlementBalance,
    listLocalPayments,
    recordLocalCapturedPayment,
} from '@/lib/payments/local-ledger';
import { getPowerSync } from '@/lib/sync';

export interface TerminalOverviewDevice {
    id: string;
    name: string;
    device_type: string;
    assigned_zones: string[];
    metadata?: {
        allowed_payment_methods?: SupportedPaymentMethod[];
        station_name?: string;
        settlement_mode?: string;
        receipt_mode?: string;
    } | null;
}

export interface TerminalOverviewTable {
    id: string;
    table_number: string;
    status: string;
    updated_at: string | null;
    outstanding_total: number;
    active_order_count: number;
}

export interface TerminalOverviewOrder {
    id: string;
    table_number: string | null;
    order_number: string | null;
    status: string;
    total_price: number;
    created_at: string | null;
}

export interface TerminalSplitSnapshot {
    order: { id: string; total_price: number; status: string };
    splits: Array<{
        id: string;
        split_index: number;
        split_label?: string | null;
        computed_amount: number;
        requested_amount?: number | null;
    }>;
    split_payments: Array<{
        id: string;
        split_id?: string | null;
        amount: number;
        status: string;
        method: string;
        truth_state: string;
        truth_label: string;
        truth_tone: string;
        provider_reference?: string | null;
        transaction_number: string;
    }>;
}

export interface TerminalRecentPayment {
    id: string;
    order_number: string | null;
    table_number: string | null;
    label: string;
    amount: number;
    method: string;
    truth_state: string;
    truth_label: string;
    truth_tone: string;
    created_at: string;
}

interface AdapterResult<T> {
    ok: boolean;
    mode?: 'local' | 'api';
    data?: T;
    error?: string;
}

function normalizeMoney(value: number): number {
    return Number(Number(value ?? 0).toFixed(2));
}

async function readLocalSplitSnapshot(orderId: string): Promise<TerminalSplitSnapshot | null> {
    const db = getPowerSync();
    if (!db) return null;

    const [order, splits, splitPayments] = await Promise.all([
        db.getFirstAsync<{ id: string; total_price: number; status: string }>(
            `SELECT id, total_santim / 100.0 as total_price, status FROM orders WHERE id = ?`,
            [orderId]
        ),
        db.getAllAsync<{
            id: string;
            split_index: number;
            split_label: string | null;
            computed_amount: number;
            requested_amount: number | null;
        }>(
            `SELECT id, split_index, split_label, computed_amount, requested_amount
             FROM order_check_splits
             WHERE order_id = ?
             ORDER BY split_index ASC`,
            [orderId]
        ),
        listLocalPayments(db, { orderId, limit: 200 }),
    ]);

    if (!order) return null;

    return {
        order: {
            id: order.id,
            total_price: normalizeMoney(order.total_price),
            status: order.status,
        },
        splits: splits.map(split => ({
            id: split.id,
            split_index: Number(split.split_index ?? 0),
            split_label: split.split_label ?? null,
            computed_amount: normalizeMoney(split.computed_amount),
            requested_amount:
                typeof split.requested_amount === 'number'
                    ? normalizeMoney(split.requested_amount)
                    : null,
        })),
        split_payments: splitPayments.map(payment => ({
            id: payment.id,
            split_id: payment.splitId ?? null,
            amount: normalizeMoney(payment.amount),
            status: payment.paymentStatus,
            method: payment.method,
            truth_state: payment.truthState,
            truth_label: payment.truthLabel,
            truth_tone: payment.truthTone,
            provider_reference: payment.providerReference ?? null,
            transaction_number: payment.transactionNumber,
        })),
    };
}

export async function readTerminalOverview(input: {
    device: TerminalOverviewDevice;
    deviceToken?: string | null;
}): Promise<
    AdapterResult<{
        device: TerminalOverviewDevice;
        payment_options: ReturnType<typeof getPaymentOptionsForSurface>;
        tables: TerminalOverviewTable[];
        orders: TerminalOverviewOrder[];
        recent_payments: TerminalRecentPayment[];
    }>
> {
    const db = getPowerSync();
    if (!db) {
        const response = await fetch('/api/v1/pos/device/terminal/overview', {
            headers: input.deviceToken
                ? {
                      'x-device-token': input.deviceToken,
                  }
                : {},
        });
        const payload = (await response.json()) as {
            data?: {
                device: TerminalOverviewDevice;
                payment_options: ReturnType<typeof getPaymentOptionsForSurface>;
                tables: TerminalOverviewTable[];
                orders: TerminalOverviewOrder[];
                recent_payments: TerminalRecentPayment[];
            };
            error?: string;
        };
        if (!response.ok || !payload.data) {
            return {
                ok: false,
                error: payload.error ?? 'Failed to load terminal workspace',
            };
        }

        return {
            ok: true,
            mode: 'api',
            data: payload.data,
        };
    }

    const [orders, openSessions, recentPayments] = await Promise.all([
        db.getAllAsync<TerminalOverviewOrder>(
            `SELECT
                id,
                CAST(table_number AS TEXT) as table_number,
                CAST(order_number AS TEXT) as order_number,
                status,
                total_santim / 100.0 as total_price,
                created_at
             FROM orders
             WHERE status IN ('pending', 'acknowledged', 'preparing', 'ready', 'served')
             ORDER BY created_at DESC`
        ),
        db.getAllAsync<{ id: string; table_id: string; status: string; updated_at: string }>(
            `SELECT id, table_id, status, updated_at
             FROM table_sessions
             WHERE status = 'open'
             ORDER BY updated_at DESC`
        ),
        listLocalPayments(db, { limit: 12 }),
    ]);

    const tablesByNumber = new Map<string, TerminalOverviewTable>();
    for (const order of orders) {
        const tableNumber = String(order.table_number ?? '').trim();
        if (!tableNumber) continue;
        const existing = tablesByNumber.get(tableNumber);
        tablesByNumber.set(tableNumber, {
            id: existing?.id ?? tableNumber,
            table_number: tableNumber,
            status: 'occupied',
            updated_at: existing?.updated_at ?? order.created_at,
            outstanding_total: normalizeMoney(
                (existing?.outstanding_total ?? 0) + Number(order.total_price ?? 0)
            ),
            active_order_count: (existing?.active_order_count ?? 0) + 1,
        });
    }

    for (const session of openSessions) {
        const key = String(session.table_id ?? '').trim();
        if (!key) continue;
        const existing = tablesByNumber.get(key);
        tablesByNumber.set(key, {
            id: session.table_id,
            table_number: existing?.table_number ?? session.table_id,
            status: existing?.status ?? 'occupied',
            updated_at: session.updated_at,
            outstanding_total: existing?.outstanding_total ?? 0,
            active_order_count: existing?.active_order_count ?? 0,
        });
    }

    const balanceMap = new Map<string, number>();
    await Promise.all(
        [...tablesByNumber.values()].map(async table => {
            const balance = await getTableSettlementBalance(db, table.id);
            balanceMap.set(table.id, balance.remainingAmount);
        })
    );

    const allowedMethods = input.device.metadata?.allowed_payment_methods ?? ['cash', 'other'];
    return {
        ok: true,
        mode: 'local',
        data: {
            device: input.device,
            payment_options: getPaymentOptionsForSurface('terminal').filter(option =>
                allowedMethods.includes(option.method)
            ),
            tables: [...tablesByNumber.values()].map(table => ({
                ...table,
                outstanding_total: balanceMap.get(table.id) ?? table.outstanding_total,
            })),
            orders: orders.map(order => ({
                ...order,
                total_price: normalizeMoney(Number(order.total_price ?? 0)),
            })),
            recent_payments: recentPayments.map(payment => ({
                id: payment.id,
                order_number: payment.orderNumber,
                table_number: payment.tableNumber,
                label: payment.label,
                amount: payment.amount,
                method: payment.method,
                truth_state: payment.truthState,
                truth_label: payment.truthLabel,
                truth_tone: payment.truthTone,
                created_at: payment.createdAt,
            })),
        },
    };
}

export async function readTerminalOrderSplit(
    orderId: string,
    deviceToken?: string | null
): Promise<AdapterResult<TerminalSplitSnapshot>> {
    const db = getPowerSync();
    if (!db) {
        const response = await fetch(`/api/v1/merchant/operations/orders/${orderId}/split`, {
            headers: deviceToken
                ? {
                      'x-device-token': deviceToken,
                  }
                : {},
        });
        const payload = (await response.json()) as { data?: TerminalSplitSnapshot; error?: string };
        if (!response.ok || !payload.data) {
            return {
                ok: false,
                error: payload.error ?? 'Failed to load split settlement',
            };
        }

        return {
            ok: true,
            mode: 'api',
            data: payload.data,
        };
    }

    const data = await readLocalSplitSnapshot(orderId);
    if (!data) {
        return {
            ok: false,
            error: 'Failed to load split settlement',
        };
    }

    return {
        ok: true,
        mode: 'local',
        data,
    };
}

export async function createTerminalEvenSplit(input: {
    orderId: string;
    guestCount: number;
    deviceToken?: string | null;
}): Promise<AdapterResult<TerminalSplitSnapshot>> {
    const db = getPowerSync();
    if (!db) {
        const response = await fetch(`/api/v1/merchant/operations/orders/${input.orderId}/split`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(input.deviceToken
                    ? {
                          'x-device-token': input.deviceToken,
                      }
                    : {}),
                'x-idempotency-key': crypto.randomUUID(),
            },
            body: JSON.stringify({
                method: 'even',
                splits: Array.from({ length: input.guestCount }, (_, index) => ({
                    guest_name: `Guest ${index + 1}`,
                })),
            }),
        });
        const payload = (await response.json()) as { data?: TerminalSplitSnapshot; error?: string };
        if (!response.ok || !payload.data) {
            return {
                ok: false,
                error: payload.error ?? 'Failed to create even split',
            };
        }
        return {
            ok: true,
            mode: 'api',
            data: payload.data,
        };
    }

    const order = await db.getFirstAsync<{
        id: string;
        restaurant_id: string;
        total_price: number;
        status: string;
    }>(
        `SELECT id, restaurant_id, total_santim / 100.0 as total_price, status FROM orders WHERE id = ?`,
        [input.orderId]
    );
    if (!order) {
        return {
            ok: false,
            error: 'Failed to create even split',
        };
    }

    const totalCents = Math.round(Number(order.total_price ?? 0) * 100);
    const base = Math.floor(totalCents / input.guestCount);
    const remainder = totalCents - base * input.guestCount;
    const nowIso = new Date().toISOString();

    await db.write(async () => {
        await db.execute(`DELETE FROM order_check_split_items WHERE order_id = ?`, [input.orderId]);
        await db.execute(`DELETE FROM order_check_splits WHERE order_id = ?`, [input.orderId]);

        for (let index = 0; index < input.guestCount; index += 1) {
            const splitId = crypto.randomUUID();
            const computedAmount = normalizeMoney((base + (index < remainder ? 1 : 0)) / 100);
            await db.execute(
                `INSERT INTO order_check_splits (
                    id, restaurant_id, order_id, split_index, split_label, requested_amount,
                    computed_amount, status, metadata_json, created_by, created_at, updated_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
                [
                    splitId,
                    order.restaurant_id,
                    input.orderId,
                    index,
                    `Guest ${index + 1}`,
                    null,
                    computedAmount,
                    JSON.stringify({ source: 'local_terminal_split' }),
                    'local-device',
                    nowIso,
                    nowIso,
                ]
            );
        }
    });

    return {
        ok: true,
        mode: 'local',
    };
}

export async function captureTerminalPayment(input: {
    orderId?: string;
    splitId?: string;
    amount: number;
    method: SupportedPaymentMethod;
    label: string;
    providerReference?: string;
    restaurantId: string;
    terminalName?: string | null;
    deviceToken?: string | null;
}): Promise<
    AdapterResult<{
        transaction_number: string;
        fiscal_request: null;
        truth_state: string;
        truth_label: string;
    }>
> {
    const db = getPowerSync();
    if (!db) {
        return {
            ok: false,
            error: 'Local payment capture runtime unavailable. Pair to store gateway and retry.',
        };
    }
    const ledger = await recordLocalCapturedPayment(db, {
        restaurantId: input.restaurantId,
        orderId: input.orderId ?? null,
        splitId: input.splitId ?? null,
        amount: normalizeMoney(input.amount),
        method: input.method,
        provider: input.method,
        providerReference: input.providerReference ?? undefined,
        label: input.label,
        terminalName: input.terminalName ?? null,
        verificationMode:
            input.method === 'chapa' || input.method === 'card' ? 'deferred' : 'immediate',
    });

    return {
        ok: true,
        mode: 'local',
        data: {
            transaction_number: ledger.transactionNumber,
            fiscal_request: null,
            truth_state: ledger.truthState,
            truth_label: ledger.truthLabel,
        },
    };
}
