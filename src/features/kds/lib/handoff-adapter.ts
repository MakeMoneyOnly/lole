import { getKdsItemsByOrder, getPowerSync, updateOfflineOrderStatus } from '@/lib/sync';

export type SubmitKdsHandoffMode = 'local';

export interface SubmitKdsHandoffInput {
    orderId: string;
    reason?: string;
}

export interface SubmitKdsHandoffResult {
    ok: boolean;
    mode?: SubmitKdsHandoffMode;
    error?: string;
}

function hasLocalRuntime(): boolean {
    return getPowerSync() !== null;
}

export async function submitFinalKdsHandoff(
    input: SubmitKdsHandoffInput
): Promise<SubmitKdsHandoffResult> {
    if (!hasLocalRuntime()) {
        return {
            ok: false,
            error: 'Local KDS handoff runtime unavailable. Pair to store gateway and retry.',
        };
    }

    const items = await getKdsItemsByOrder(input.orderId);
    if (items.some(item => item.status !== 'ready')) {
        return {
            ok: false,
            error: 'Ticket is not fully ready for final handoff',
        };
    }

    const updated = await updateOfflineOrderStatus(input.orderId, 'served');
    if (updated) {
        return { ok: true, mode: 'local' };
    }

    return { ok: false, error: 'Failed to mark order served locally.' };
}
