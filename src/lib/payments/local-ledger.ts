import { appendLocalJournalEntryInDatabase } from '@/lib/journal/local-journal';
import { allocateOfflineReceiptNumber } from '@/lib/domain/core/identifiers';
import type { PowerSyncDatabase } from '@/lib/sync/powersync-config';

export type LocalPaymentTruthState =
    | 'local_capture'
    | 'pending_verification'
    | 'verified'
    | 'failed'
    | 'review_required';

export type LocalPaymentTruthTone = 'amber' | 'sky' | 'emerald' | 'red' | 'violet';
export type LocalPaymentVerificationMode = 'immediate' | 'deferred';
export type LocalPaymentReconciliationOutcome =
    | 'verified'
    | 'failed'
    | 'duplicate'
    | 'manual_review';

export interface RecordLocalCapturedPaymentInput {
    restaurantId: string;
    orderId?: string | null;
    splitId?: string | null;
    amount: number;
    method: string;
    provider: string;
    providerReference?: string;
    label: string;
    terminalName?: string | null;
    locationId?: string | null;
    deviceId?: string | null;
    actorId?: string | null;
    verificationMode?: LocalPaymentVerificationMode;
    source?: string;
}

export interface LocalCapturedPaymentResult {
    paymentSessionId: string;
    paymentId: string;
    paymentEventId: string;
    reconciliationEntryId: string;
    transactionNumber: string;
    truthState: LocalPaymentTruthState;
    truthLabel: string;
}

export interface LocalPaymentSummary {
    id: string;
    paymentSessionId: string | null;
    orderId: string | null;
    splitId: string | null;
    orderNumber: string | null;
    tableNumber: string | null;
    label: string;
    amount: number;
    method: string;
    provider: string;
    providerReference: string | null;
    transactionNumber: string;
    paymentStatus: string;
    sessionStatus: string | null;
    reconciliationStatus: string | null;
    truthState: LocalPaymentTruthState;
    truthLabel: string;
    truthTone: LocalPaymentTruthTone;
    createdAt: string;
    occurredAt: string | null;
}

export interface OrderOutstandingBalance {
    orderId: string;
    orderNumber: string | null;
    tableNumber: string | null;
    totalAmount: number;
    operationallySettledAmount: number;
    verifiedAmount: number;
    remainingAmount: number;
}

export interface TableSettlementBalance {
    tableId: string;
    totalAmount: number;
    operationallySettledAmount: number;
    remainingAmount: number;
    orders: OrderOutstandingBalance[];
}

export interface ReconcileLocalPaymentOutcomeInput {
    paymentId?: string;
    paymentSessionId?: string;
    providerReference?: string;
    providerTransactionId?: string | null;
    outcome: LocalPaymentReconciliationOutcome;
    settledAmount?: number;
    notes?: string;
}

export interface ReconcileLocalPaymentsResult {
    matched: number;
    rejected: number;
    duplicate: number;
    manualReview: number;
    processedPaymentIds: string[];
}

interface PaymentRuntimeContext {
    locationId: string | null;
    deviceId: string;
    actorId: string;
    terminalName: string | null;
    source: string;
}

interface PaymentTruthDescriptor {
    state: LocalPaymentTruthState;
    label: string;
    tone: LocalPaymentTruthTone;
}

interface LocalLedgerRow {
    id: string;
    payment_session_id: string | null;
    order_id: string | null;
    split_id: string | null;
    order_number: string | null;
    table_number: string | null;
    amount: number;
    method: string;
    provider: string;
    provider_reference: string | null;
    transaction_number: string;
    status: string;
    payment_metadata_json: string | null;
    session_status: string | null;
    session_metadata_json: string | null;
    reconciliation_status: string | null;
    reconciliation_metadata_json: string | null;
    reconciliation_notes: string | null;
    created_at: string;
    captured_at: string | null;
}

function buildOperationKey(operation: string): string {
    return `${operation}-${crypto.randomUUID()}`;
}

function normalizeMoney(amount: number): number {
    return Number(Number(amount ?? 0).toFixed(2));
}

function parseMetadata(raw: string | null | undefined): Record<string, unknown> {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw) as unknown;
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

function getRuntimeContext(input: RecordLocalCapturedPaymentInput): PaymentRuntimeContext {
    return {
        locationId: input.locationId ?? process.env.NEXT_PUBLIC_LOCATION_ID ?? null,
        deviceId: input.deviceId ?? process.env.NEXT_PUBLIC_DEVICE_ID ?? 'payment-device',
        actorId: input.actorId ?? process.env.NEXT_PUBLIC_DEVICE_ID ?? 'payment-device',
        terminalName: input.terminalName ?? null,
        source: input.source ?? 'local_terminal_capture',
    };
}

function getTruthDescriptor(state: LocalPaymentTruthState): PaymentTruthDescriptor {
    switch (state) {
        case 'pending_verification':
            return { state, label: 'Pending Verification', tone: 'sky' };
        case 'verified':
            return { state, label: 'Verified', tone: 'emerald' };
        case 'failed':
            return { state, label: 'Failed', tone: 'red' };
        case 'review_required':
            return { state, label: 'Review Required', tone: 'violet' };
        case 'local_capture':
        default:
            return { state: 'local_capture', label: 'Local Capture', tone: 'amber' };
    }
}

export function getLocalPaymentStateDescriptor(
    state: LocalPaymentTruthState
): PaymentTruthDescriptor {
    return getTruthDescriptor(state);
}

function getInitialTruthState(
    verificationMode: LocalPaymentVerificationMode | undefined
): LocalPaymentTruthState {
    return verificationMode === 'deferred' ? 'pending_verification' : 'local_capture';
}

function getInitialStatuses(truthState: LocalPaymentTruthState): {
    sessionStatus: string;
    paymentStatus: string;
    eventType: string;
    eventStatus: string;
    reconciliationStatus: string;
} {
    if (truthState === 'pending_verification') {
        return {
            sessionStatus: 'pending_verification',
            paymentStatus: 'pending',
            eventType: 'payment.verification_pending',
            eventStatus: 'pending_verification',
            reconciliationStatus: 'pending_verification',
        };
    }

    return {
        sessionStatus: 'captured',
        paymentStatus: 'captured',
        eventType: 'payment.captured',
        eventStatus: 'captured',
        reconciliationStatus: 'pending_replay',
    };
}

async function appendPaymentJournal(
    db: PowerSyncDatabase,
    args: {
        restaurantId: string;
        aggregateType: 'payment_session' | 'payment';
        aggregateId: string;
        operationType: string;
        payload: Record<string, unknown>;
        entryKind: 'command' | 'event' | 'audit';
        idempotencyKey: string;
        context: PaymentRuntimeContext;
    }
): Promise<void> {
    await appendLocalJournalEntryInDatabase(db, {
        restaurantId: args.restaurantId,
        locationId: args.context.locationId,
        deviceId: args.context.deviceId,
        actorId: args.context.actorId,
        entryKind: args.entryKind,
        aggregateType: args.aggregateType,
        aggregateId: args.aggregateId,
        operationType: args.operationType,
        payload: args.payload,
        idempotencyKey: args.idempotencyKey,
    });
}

function createBaseMetadata(
    input: RecordLocalCapturedPaymentInput,
    context: PaymentRuntimeContext,
    truthState: LocalPaymentTruthState
): Record<string, unknown> {
    const descriptor = getTruthDescriptor(truthState);
    return {
        source: context.source,
        label: input.label,
        terminal_name: context.terminalName,
        settlement_mode:
            truthState === 'pending_verification'
                ? 'offline_deferred_verification'
                : 'offline_manual_capture',
        verification_mode: input.verificationMode ?? 'immediate',
        payment_truth_state: descriptor.state,
        payment_truth_label: descriptor.label,
        payment_truth_tone: descriptor.tone,
    };
}

export async function recordLocalCapturedPayment(
    db: PowerSyncDatabase,
    input: RecordLocalCapturedPaymentInput
): Promise<LocalCapturedPaymentResult> {
    const nowIso = new Date().toISOString();
    const normalizedAmount = normalizeMoney(input.amount);
    const paymentSessionId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    const paymentEventId = crypto.randomUUID();
    const reconciliationEntryId = crypto.randomUUID();
    const truthState = getInitialTruthState(input.verificationMode);
    const truthDescriptor = getTruthDescriptor(truthState);
    const statuses = getInitialStatuses(truthState);
    const context = getRuntimeContext(input);
    const transactionNumber = await allocateOfflineReceiptNumber(
        db,
        {
            restaurantId: input.restaurantId,
            locationId: context.locationId ?? 'default-location',
            deviceId: context.deviceId,
        },
        'PAY'
    );
    const metadata = createBaseMetadata(input, context, truthState);

    await db.write(async () => {
        await appendPaymentJournal(db, {
            restaurantId: input.restaurantId,
            aggregateType: 'payment_session',
            aggregateId: paymentSessionId,
            operationType: 'payment.session_open',
            entryKind: 'command',
            idempotencyKey: buildOperationKey('payment-session-open'),
            payload: {
                payment_session_id: paymentSessionId,
                order_id: input.orderId ?? null,
                split_id: input.splitId ?? null,
                amount: normalizedAmount,
                method: input.method,
                provider: input.provider,
                provider_reference: input.providerReference ?? null,
                payment_truth_state: truthState,
            },
            context,
        });

        await db.execute(
            `INSERT INTO payment_sessions (
                id, restaurant_id, order_id, surface, channel, intent_type, status,
                selected_method, selected_provider, amount, currency, checkout_url,
                provider_transaction_id, provider_reference, metadata_json, authorized_at,
                captured_at, expires_at, created_by, created_at, updated_at
             ) VALUES (?, ?, ?, 'terminal', 'dine_in', 'staff_recorded', ?,
                ?, ?, ?, 'ETB', NULL, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
            [
                paymentSessionId,
                input.restaurantId,
                input.orderId ?? null,
                statuses.sessionStatus,
                input.method,
                input.provider,
                normalizedAmount,
                truthState === 'verified' ? transactionNumber : null,
                input.providerReference ?? null,
                JSON.stringify({
                    ...metadata,
                    payment_session_id: paymentSessionId,
                    transaction_number: transactionNumber,
                }),
                nowIso,
                truthState === 'pending_verification' ? null : nowIso,
                context.actorId,
                nowIso,
                nowIso,
            ]
        );

        await appendPaymentJournal(db, {
            restaurantId: input.restaurantId,
            aggregateType: 'payment',
            aggregateId: paymentId,
            operationType: 'payment.capture',
            entryKind: 'command',
            idempotencyKey: buildOperationKey('payment-capture'),
            payload: {
                payment_id: paymentId,
                payment_session_id: paymentSessionId,
                order_id: input.orderId ?? null,
                split_id: input.splitId ?? null,
                amount: normalizedAmount,
                method: input.method,
                provider: input.provider,
                provider_reference: input.providerReference ?? null,
                transaction_number: transactionNumber,
                payment_truth_state: truthState,
            },
            context,
        });

        await db.execute(
            `INSERT INTO payments (
                id, restaurant_id, order_id, payment_session_id, split_id, amount, currency,
                created_by, idempotency_key, tip_amount, authorized_at, captured_at,
                method, provider, provider_reference, tip_allocation_id, tip_pool_id,
                transaction_number, status, metadata_json, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, 'ETB', ?, ?, 0, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)`,
            [
                paymentId,
                input.restaurantId,
                input.orderId ?? null,
                paymentSessionId,
                input.splitId ?? null,
                normalizedAmount,
                context.actorId,
                buildOperationKey('payment-row'),
                nowIso,
                truthState === 'pending_verification' ? null : nowIso,
                input.method,
                input.provider,
                input.providerReference ?? null,
                transactionNumber,
                statuses.paymentStatus,
                JSON.stringify({
                    ...metadata,
                    payment_id: paymentId,
                    transaction_number: transactionNumber,
                }),
                nowIso,
                nowIso,
            ]
        );

        await db.execute(
            `INSERT INTO payment_events (
                id, restaurant_id, payment_session_id, payment_id, order_id, split_id,
                event_type, status, provider, provider_reference, idempotency_key,
                payload_json, metadata_json, occurred_at, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                paymentEventId,
                input.restaurantId,
                paymentSessionId,
                paymentId,
                input.orderId ?? null,
                input.splitId ?? null,
                statuses.eventType,
                statuses.eventStatus,
                input.provider,
                input.providerReference ?? null,
                buildOperationKey('payment-event'),
                JSON.stringify({
                    amount: normalizedAmount,
                    transaction_number: transactionNumber,
                    method: input.method,
                    payment_truth_state: truthState,
                }),
                JSON.stringify(metadata),
                nowIso,
                nowIso,
            ]
        );

        await db.execute(
            `INSERT INTO reconciliation_entries (
                id, restaurant_id, payment_id, payment_session_id, ledger_type, ledger_id,
                source_type, source_id, expected_amount, settled_amount, delta_amount, status,
                notes, metadata_json, created_by, created_at, updated_at
             ) VALUES (?, ?, ?, ?, 'payment_session', ?, 'payment', ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
            [
                reconciliationEntryId,
                input.restaurantId,
                paymentId,
                paymentSessionId,
                paymentSessionId,
                paymentId,
                normalizedAmount,
                normalizedAmount,
                statuses.reconciliationStatus,
                truthState === 'pending_verification'
                    ? 'Offline payment intent captured locally pending provider confirmation'
                    : 'Offline payment captured locally and awaiting upstream replay',
                JSON.stringify({
                    ...metadata,
                    reconciliation_entry_id: reconciliationEntryId,
                    expected_amount: normalizedAmount,
                    settled_amount: normalizedAmount,
                }),
                context.actorId,
                nowIso,
                nowIso,
            ]
        );

        await appendPaymentJournal(db, {
            restaurantId: input.restaurantId,
            aggregateType: 'payment',
            aggregateId: paymentId,
            operationType: statuses.eventType,
            entryKind: 'event',
            idempotencyKey: buildOperationKey('payment-journal-event'),
            payload: {
                payment_id: paymentId,
                payment_session_id: paymentSessionId,
                reconciliation_entry_id: reconciliationEntryId,
                amount: normalizedAmount,
                payment_truth_state: truthState,
                payment_truth_label: truthDescriptor.label,
            },
            context,
        });
    });

    return {
        paymentSessionId,
        paymentId,
        paymentEventId,
        reconciliationEntryId,
        transactionNumber,
        truthState,
        truthLabel: truthDescriptor.label,
    };
}

function deriveTruthStateFromRow(row: LocalLedgerRow): LocalPaymentTruthState {
    const paymentMeta = parseMetadata(row.payment_metadata_json);
    const sessionMeta = parseMetadata(row.session_metadata_json);
    const reconciliationMeta = parseMetadata(row.reconciliation_metadata_json);
    const explicitState =
        paymentMeta.payment_truth_state ??
        sessionMeta.payment_truth_state ??
        reconciliationMeta.payment_truth_state;

    if (
        explicitState === 'local_capture' ||
        explicitState === 'pending_verification' ||
        explicitState === 'verified' ||
        explicitState === 'failed' ||
        explicitState === 'review_required'
    ) {
        return explicitState;
    }

    if (
        row.reconciliation_status === 'manual_review' ||
        row.reconciliation_status === 'duplicate'
    ) {
        return 'review_required';
    }

    if (row.status === 'failed' || row.reconciliation_status === 'failed') {
        return 'failed';
    }

    if (row.status === 'verified' || row.reconciliation_status === 'matched') {
        return 'verified';
    }

    if (row.session_status === 'pending_verification' || row.status === 'pending') {
        return 'pending_verification';
    }

    return 'local_capture';
}

export async function listLocalPayments(
    db: PowerSyncDatabase,
    input: {
        orderId?: string;
        limit?: number;
    } = {}
): Promise<LocalPaymentSummary[]> {
    const params: unknown[] = [];
    const whereClauses: string[] = [];

    if (input.orderId) {
        whereClauses.push('p.order_id = ?');
        params.push(input.orderId);
    }

    params.push(input.limit ?? 25);

    const rows = await db.getAllAsync<LocalLedgerRow>(
        `SELECT
            p.id,
            p.payment_session_id,
            p.order_id,
            p.split_id,
            CAST(o.order_number AS TEXT) as order_number,
            CAST(o.table_number AS TEXT) as table_number,
            p.amount,
            p.method,
            p.provider,
            p.provider_reference,
            p.transaction_number,
            p.status,
            p.metadata_json as payment_metadata_json,
            ps.status as session_status,
            ps.metadata_json as session_metadata_json,
            re.status as reconciliation_status,
            re.metadata_json as reconciliation_metadata_json,
            re.notes as reconciliation_notes,
            p.created_at,
            COALESCE(p.captured_at, ps.captured_at) as captured_at
         FROM payments p
         LEFT JOIN payment_sessions ps ON ps.id = p.payment_session_id
         LEFT JOIN reconciliation_entries re ON re.payment_id = p.id
         LEFT JOIN orders o ON o.id = p.order_id
         ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''}
         ORDER BY p.created_at DESC
         LIMIT ?`,
        params
    );

    return rows.map(row => {
        const truthState = deriveTruthStateFromRow(row);
        const descriptor = getTruthDescriptor(truthState);
        const paymentMeta = parseMetadata(row.payment_metadata_json);

        return {
            id: row.id,
            paymentSessionId: row.payment_session_id,
            orderId: row.order_id,
            splitId: row.split_id,
            orderNumber: row.order_number,
            tableNumber: row.table_number,
            label:
                typeof paymentMeta.label === 'string' && paymentMeta.label.length > 0
                    ? paymentMeta.label
                    : row.split_id
                      ? 'Split Settlement'
                      : (row.order_number ?? row.transaction_number),
            amount: normalizeMoney(row.amount),
            method: row.method,
            provider: row.provider,
            providerReference: row.provider_reference,
            transactionNumber: row.transaction_number,
            paymentStatus: row.status,
            sessionStatus: row.session_status,
            reconciliationStatus: row.reconciliation_status,
            truthState,
            truthLabel: descriptor.label,
            truthTone: descriptor.tone,
            createdAt: row.created_at,
            occurredAt: row.captured_at,
        };
    });
}

export async function getTableSettlementBalance(
    db: PowerSyncDatabase,
    tableId: string
): Promise<TableSettlementBalance> {
    const orders = await db.getAllAsync<{
        id: string;
        order_number: string | null;
        table_number: string | null;
        total_amount: number;
    }>(
        `SELECT
            id,
            CAST(order_number AS TEXT) as order_number,
            CAST(table_number AS TEXT) as table_number,
            total_santim / 100.0 as total_amount
         FROM orders
         WHERE CAST(table_number AS TEXT) = ?
           AND status IN ('pending', 'acknowledged', 'preparing', 'ready', 'served', 'completed')
         ORDER BY created_at ASC`,
        [tableId]
    );

    const balances: OrderOutstandingBalance[] = [];

    for (const order of orders) {
        const payments = await listLocalPayments(db, {
            orderId: order.id,
            limit: 200,
        });
        const operationallySettledAmount = normalizeMoney(
            payments
                .filter(payment =>
                    ['local_capture', 'pending_verification', 'verified'].includes(
                        payment.truthState
                    )
                )
                .reduce((sum, payment) => sum + payment.amount, 0)
        );
        const verifiedAmount = normalizeMoney(
            payments
                .filter(payment => payment.truthState === 'verified')
                .reduce((sum, payment) => sum + payment.amount, 0)
        );
        const remainingAmount = normalizeMoney(
            Math.max(0, Number(order.total_amount ?? 0) - operationallySettledAmount)
        );

        balances.push({
            orderId: order.id,
            orderNumber: order.order_number,
            tableNumber: order.table_number,
            totalAmount: normalizeMoney(order.total_amount),
            operationallySettledAmount,
            verifiedAmount,
            remainingAmount,
        });
    }

    return {
        tableId,
        totalAmount: normalizeMoney(balances.reduce((sum, order) => sum + order.totalAmount, 0)),
        operationallySettledAmount: normalizeMoney(
            balances.reduce((sum, order) => sum + order.operationallySettledAmount, 0)
        ),
        remainingAmount: normalizeMoney(
            balances.reduce((sum, order) => sum + order.remainingAmount, 0)
        ),
        orders: balances,
    };
}

function mapReconciliationOutcome(outcome: LocalPaymentReconciliationOutcome): {
    truthState: LocalPaymentTruthState;
    sessionStatus: string;
    paymentStatus: string;
    eventType: string;
    eventStatus: string;
    reconciliationStatus: string;
} {
    switch (outcome) {
        case 'verified':
            return {
                truthState: 'verified',
                sessionStatus: 'verified',
                paymentStatus: 'verified',
                eventType: 'payment.verified',
                eventStatus: 'verified',
                reconciliationStatus: 'matched',
            };
        case 'duplicate':
            return {
                truthState: 'review_required',
                sessionStatus: 'review_required',
                paymentStatus: 'review_required',
                eventType: 'payment.duplicate_detected',
                eventStatus: 'duplicate',
                reconciliationStatus: 'duplicate',
            };
        case 'manual_review':
            return {
                truthState: 'review_required',
                sessionStatus: 'review_required',
                paymentStatus: 'review_required',
                eventType: 'payment.review_required',
                eventStatus: 'manual_review',
                reconciliationStatus: 'manual_review',
            };
        case 'failed':
        default:
            return {
                truthState: 'failed',
                sessionStatus: 'failed',
                paymentStatus: 'failed',
                eventType: 'payment.failed',
                eventStatus: 'failed',
                reconciliationStatus: 'failed',
            };
    }
}

export async function reconcileLocalPayments(
    db: PowerSyncDatabase,
    input: {
        restaurantId: string;
        locationId?: string | null;
        deviceId?: string | null;
        actorId?: string | null;
        outcomes: ReconcileLocalPaymentOutcomeInput[];
    }
): Promise<ReconcileLocalPaymentsResult> {
    const nowIso = new Date().toISOString();
    const processedPaymentIds: string[] = [];
    let matched = 0;
    let rejected = 0;
    let duplicate = 0;
    let manualReview = 0;

    await db.write(async () => {
        for (const outcome of input.outcomes) {
            const match = await db.getFirstAsync<{
                payment_id: string;
                payment_session_id: string | null;
                provider_reference: string | null;
                metadata_json: string | null;
            }>(
                `SELECT
                    p.id as payment_id,
                    p.payment_session_id,
                    p.provider_reference,
                    p.metadata_json
                 FROM payments p
                 WHERE (? IS NOT NULL AND p.id = ?)
                    OR (? IS NOT NULL AND p.payment_session_id = ?)
                    OR (? IS NOT NULL AND p.provider_reference = ?)
                 ORDER BY p.created_at DESC
                 LIMIT 1`,
                [
                    outcome.paymentId ?? null,
                    outcome.paymentId ?? null,
                    outcome.paymentSessionId ?? null,
                    outcome.paymentSessionId ?? null,
                    outcome.providerReference ?? null,
                    outcome.providerReference ?? null,
                ]
            );

            if (!match) {
                continue;
            }

            const mapped = mapReconciliationOutcome(outcome.outcome);
            const descriptor = getTruthDescriptor(mapped.truthState);
            const paymentMeta = parseMetadata(match.metadata_json);
            const reconciliationEntryId = crypto.randomUUID();
            const eventId = crypto.randomUUID();
            const settledAmount = normalizeMoney(outcome.settledAmount ?? 0);
            const notes =
                outcome.notes ??
                (outcome.outcome === 'verified'
                    ? 'Reconciled with upstream provider confirmation'
                    : outcome.outcome === 'duplicate'
                      ? 'Duplicate payment detected during replay'
                      : outcome.outcome === 'manual_review'
                        ? 'Manual review required during replay'
                        : 'Upstream provider rejected local payment');

            await appendPaymentJournal(db, {
                restaurantId: input.restaurantId,
                aggregateType: 'payment',
                aggregateId: match.payment_id,
                operationType: 'payment.reconcile',
                entryKind: 'command',
                idempotencyKey: buildOperationKey('payment-reconcile'),
                payload: {
                    payment_id: match.payment_id,
                    payment_session_id: match.payment_session_id,
                    provider_reference: outcome.providerReference ?? match.provider_reference,
                    reconciliation_outcome: outcome.outcome,
                    settled_amount: settledAmount,
                },
                context: {
                    locationId: input.locationId ?? null,
                    deviceId: input.deviceId ?? 'payment-reconciler',
                    actorId: input.actorId ?? 'payment-reconciler',
                    terminalName: null,
                    source: 'payment_reconciliation_worker',
                },
            });

            await db.execute(
                `UPDATE payment_sessions
                 SET status = ?, provider_transaction_id = COALESCE(?, provider_transaction_id), updated_at = ?
                 WHERE id = ?`,
                [
                    mapped.sessionStatus,
                    outcome.providerTransactionId ?? null,
                    nowIso,
                    match.payment_session_id,
                ]
            );

            await db.execute(
                `UPDATE payments
                 SET status = ?, captured_at = CASE WHEN ? = 'verified' THEN COALESCE(captured_at, ?) ELSE captured_at END,
                     provider_reference = COALESCE(?, provider_reference),
                     metadata_json = ?, updated_at = ?
                 WHERE id = ?`,
                [
                    mapped.paymentStatus,
                    mapped.paymentStatus,
                    nowIso,
                    outcome.providerReference ?? null,
                    JSON.stringify({
                        ...paymentMeta,
                        payment_truth_state: mapped.truthState,
                        payment_truth_label: descriptor.label,
                        payment_truth_tone: descriptor.tone,
                        reconciliation_outcome: outcome.outcome,
                    }),
                    nowIso,
                    match.payment_id,
                ]
            );

            await db.execute(
                `UPDATE reconciliation_entries
                 SET status = ?, settled_amount = CASE WHEN ? > 0 THEN ? ELSE settled_amount END,
                     delta_amount = CASE WHEN ? > 0 THEN expected_amount - ? ELSE delta_amount END,
                     notes = ?, metadata_json = ?, updated_at = ?
                 WHERE payment_id = ?`,
                [
                    mapped.reconciliationStatus,
                    settledAmount,
                    settledAmount,
                    settledAmount,
                    settledAmount,
                    notes,
                    JSON.stringify({
                        payment_truth_state: mapped.truthState,
                        payment_truth_label: descriptor.label,
                        payment_truth_tone: descriptor.tone,
                        provider_transaction_id: outcome.providerTransactionId ?? null,
                    }),
                    nowIso,
                    match.payment_id,
                ]
            );

            await db.execute(
                `INSERT INTO payment_events (
                    id, restaurant_id, payment_session_id, payment_id, order_id, split_id,
                    event_type, status, provider, provider_reference, idempotency_key,
                    payload_json, metadata_json, occurred_at, created_at
                 )
                 SELECT
                    ?, ?, p.payment_session_id, p.id, p.order_id, p.split_id,
                    ?, ?, p.provider, COALESCE(?, p.provider_reference), ?, ?, ?, ?, ?
                 FROM payments p
                 WHERE p.id = ?`,
                [
                    eventId,
                    input.restaurantId,
                    mapped.eventType,
                    mapped.eventStatus,
                    outcome.providerReference ?? null,
                    buildOperationKey('payment-reconcile-event'),
                    JSON.stringify({
                        reconciliation_outcome: outcome.outcome,
                        settled_amount: settledAmount,
                        notes,
                    }),
                    JSON.stringify({
                        payment_truth_state: mapped.truthState,
                        payment_truth_label: descriptor.label,
                        payment_truth_tone: descriptor.tone,
                    }),
                    nowIso,
                    nowIso,
                    match.payment_id,
                ]
            );

            await appendPaymentJournal(db, {
                restaurantId: input.restaurantId,
                aggregateType: 'payment',
                aggregateId: match.payment_id,
                operationType: mapped.eventType,
                entryKind: 'event',
                idempotencyKey: buildOperationKey('payment-reconcile-journal'),
                payload: {
                    payment_id: match.payment_id,
                    payment_session_id: match.payment_session_id,
                    reconciliation_outcome: outcome.outcome,
                    payment_truth_state: mapped.truthState,
                    payment_truth_label: descriptor.label,
                },
                context: {
                    locationId: input.locationId ?? null,
                    deviceId: input.deviceId ?? 'payment-reconciler',
                    actorId: input.actorId ?? 'payment-reconciler',
                    terminalName: null,
                    source: 'payment_reconciliation_worker',
                },
            });

            processedPaymentIds.push(match.payment_id);

            if (outcome.outcome === 'verified') {
                matched += 1;
            } else if (outcome.outcome === 'duplicate') {
                duplicate += 1;
            } else if (outcome.outcome === 'manual_review') {
                manualReview += 1;
            } else {
                rejected += 1;
            }

            await db.execute(
                `INSERT INTO reconciliation_entries (
                    id, restaurant_id, payment_id, payment_session_id, ledger_type, ledger_id,
                    source_type, source_id, expected_amount, settled_amount, delta_amount, status,
                    notes, metadata_json, created_by, created_at, updated_at
                 )
                 SELECT
                    ?, ?, p.id, p.payment_session_id, 'payment', p.id,
                    'payment', p.id, p.amount, CASE WHEN ? > 0 THEN ? ELSE p.amount END,
                    CASE WHEN ? > 0 THEN p.amount - ? ELSE 0 END, ?, ?, ?, ?, ?, ?
                 FROM payments p
                 WHERE p.id = ?`,
                [
                    reconciliationEntryId,
                    input.restaurantId,
                    settledAmount,
                    settledAmount,
                    settledAmount,
                    settledAmount,
                    mapped.reconciliationStatus,
                    notes,
                    JSON.stringify({
                        payment_truth_state: mapped.truthState,
                        payment_truth_label: descriptor.label,
                        payment_truth_tone: descriptor.tone,
                        replay_source: 'payment_reconciliation_worker',
                    }),
                    input.actorId ?? 'payment-reconciler',
                    nowIso,
                    nowIso,
                    match.payment_id,
                ]
            );
        }
    });

    return {
        matched,
        rejected,
        duplicate,
        manualReview,
        processedPaymentIds,
    };
}
