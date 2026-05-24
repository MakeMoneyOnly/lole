import {
    closeOfflineTableSession,
    getOpenOfflineTableSessionByTableId,
    getPowerSync,
    updateOfflineOrderStatus,
    type OfflineOrderStatus,
} from '@/lib/sync';
import { getTableSettlementBalance, recordLocalCapturedPayment } from '@/lib/payments/local-ledger';

type SettlementProvider = 'cash' | 'chapa' | 'other';

export type SubmitTerminalSettlementMode = 'local';

export interface LocalSettlementOrder {
    id: string;
    status: string;
}

export interface SubmitTerminalSettlementInput {
    restaurantId: string;
    tableId: string;
    paymentProvider: SettlementProvider;
    orders: LocalSettlementOrder[];
    amount: number;
    providerReference?: string;
    terminalName?: string | null;
}

export interface SubmitTerminalSettlementResult {
    ok: boolean;
    mode?: SubmitTerminalSettlementMode;
    completedOrderIds?: string[];
    truthLabel?: string;
    error?: string;
}

const FINALIZABLE_ORDER_STATUSES = new Set(['ready', 'served']);

function hasLocalRuntime(): boolean {
    return getPowerSync() !== null;
}

export async function submitTerminalSettlement(
    input: SubmitTerminalSettlementInput
): Promise<SubmitTerminalSettlementResult> {
    if (!hasLocalRuntime()) {
        return {
            ok: false,
            error: 'Local terminal settlement runtime unavailable. Pair to store gateway and retry.',
        };
    }

    const openSession = await getOpenOfflineTableSessionByTableId(input.tableId);
    if (!openSession) {
        return {
            ok: false,
            error: 'No open local table session found for terminal settlement.',
        };
    }

    const db = getPowerSync();
    if (!db) {
        return {
            ok: false,
            error: 'Local terminal settlement runtime unavailable. Pair to store gateway and retry.',
        };
    }

    const balance = await getTableSettlementBalance(db, input.tableId);
    if (Math.abs(Number(input.amount.toFixed(2)) - balance.remainingAmount) > 0.009) {
        return {
            ok: false,
            error: `Settlement amount must match outstanding balance (${balance.remainingAmount.toFixed(2)} ETB).`,
        };
    }

    const verificationMode = input.paymentProvider === 'chapa' ? 'deferred' : 'immediate';
    let truthLabel = verificationMode === 'deferred' ? 'Pending Verification' : 'Local Capture';
    const completedOrderIds: string[] = [];

    for (const order of balance.orders) {
        if (order.remainingAmount <= 0) continue;

        const ledger = await recordLocalCapturedPayment(db, {
            restaurantId: input.restaurantId,
            orderId: order.orderId,
            amount: order.remainingAmount,
            method: input.paymentProvider,
            provider: input.paymentProvider,
            providerReference: input.providerReference,
            label: order.orderNumber ?? `Table ${input.tableId}`,
            terminalName: input.terminalName ?? null,
            verificationMode,
        });
        truthLabel = ledger.truthLabel;
    }

    for (const order of input.orders) {
        if (!FINALIZABLE_ORDER_STATUSES.has(order.status) && order.status !== 'completed') continue;

        const updated = await updateOfflineOrderStatus(order.id, 'completed' as OfflineOrderStatus);
        if (updated) {
            completedOrderIds.push(order.id);
        }
    }

    const closed = await closeOfflineTableSession({
        sessionId: openSession.id,
        restaurantId: input.restaurantId,
        tableId: input.tableId,
    });

    if (!closed) {
        return {
            ok: false,
            error: 'Failed to close local table session from terminal.',
        };
    }

    return {
        ok: true,
        mode: 'local',
        completedOrderIds,
        truthLabel,
    };
}
