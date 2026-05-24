import { executeKdsAction, getPowerSync } from '@/lib/sync';

type KdsItemAction = 'start' | 'hold' | 'ready';

export type SubmitKdsItemActionMode = 'local';

export interface SubmitKdsItemActionInput {
    orderId: string;
    itemId: string;
    kdsItemId?: string;
    action: KdsItemAction;
    isOnline: boolean;
    reason?: string;
}

export interface SubmitKdsItemActionResult {
    ok: boolean;
    mode?: SubmitKdsItemActionMode;
    error?: string;
}

function hasLocalKdsRuntime(): boolean {
    return getPowerSync() !== null;
}

export function usesLegacyKdsActionReplay(): boolean {
    return false;
}

export async function submitKdsItemAction(
    input: SubmitKdsItemActionInput
): Promise<SubmitKdsItemActionResult> {
    if (!input.kdsItemId) {
        return {
            ok: false,
            error: 'Item sync pending. Refresh in a moment and retry.',
        };
    }

    if (!hasLocalKdsRuntime()) {
        return {
            ok: false,
            error: 'Local KDS command runtime unavailable. Pair to store gateway and retry.',
        };
    }

    const success = await executeKdsAction(input.kdsItemId, input.action);
    if (success) {
        return {
            ok: true,
            mode: 'local',
        };
    }

    return {
        ok: false,
        error: 'Failed to apply KDS action locally.',
    };
}
