import {
    closeOfflineTableSession,
    getOpenOfflineTableSessionByTableId,
    getPowerSync,
    openOfflineTableSession,
    transferOfflineTableSession,
    updateOfflineTableSession,
} from '@/lib/sync';

type TableUiStatus = 'available' | 'occupied' | 'reserved' | 'cleaning' | 'bill_requested';

export type SubmitTableStatusMode = 'local_session';

export interface SubmitTableStatusInput {
    restaurantId: string;
    tableId: string;
    status: TableUiStatus;
    nextTableId?: string;
    guestCount?: number;
    notes?: string | null;
}

export interface SubmitTableStatusResult {
    ok: boolean;
    mode?: SubmitTableStatusMode;
    error?: string;
}

function hasLocalRuntime(): boolean {
    return getPowerSync() !== null;
}

const LOCAL_TABLE_RUNTIME_UNAVAILABLE_ERROR =
    'Local table command runtime unavailable. Pair to store gateway and retry.';

export async function submitTableStatusUpdate(
    input: SubmitTableStatusInput
): Promise<SubmitTableStatusResult> {
    if (!hasLocalRuntime()) {
        return {
            ok: false,
            error: LOCAL_TABLE_RUNTIME_UNAVAILABLE_ERROR,
        };
    }

    if (input.status === 'occupied') {
        const existingSession = await getOpenOfflineTableSessionByTableId(input.tableId);
        const session = existingSession
            ? await updateOfflineTableSession({
                  sessionId: existingSession.id,
                  restaurantId: input.restaurantId,
                  tableId: input.tableId,
                  guestCount: input.guestCount ?? existingSession.guest_count,
                  notes: input.notes ?? null,
              }).then(result => (result ? existingSession : null))
            : await openOfflineTableSession({
                  restaurantId: input.restaurantId,
                  tableId: input.tableId,
                  guestCount: input.guestCount,
                  notes: input.notes ?? null,
              });

        if (session) {
            return { ok: true, mode: 'local_session' };
        }
        return { ok: false, error: 'Failed to open local table session.' };
    }

    if (input.status === 'reserved') {
        const existingSession = await getOpenOfflineTableSessionByTableId(input.tableId);
        if (!existingSession) {
            const session = await openOfflineTableSession({
                restaurantId: input.restaurantId,
                tableId: input.tableId,
                guestCount: input.guestCount ?? 1,
                notes: input.notes ?? 'Reserved table session',
                metadata: { ui_status: 'reserved' },
            });
            return session
                ? { ok: true, mode: 'local_session' }
                : { ok: false, error: 'Failed to open local table session.' };
        }

        const updated = await updateOfflineTableSession({
            sessionId: existingSession.id,
            restaurantId: input.restaurantId,
            tableId: input.tableId,
            guestCount: input.guestCount ?? existingSession.guest_count,
            notes: input.notes ?? 'Reserved table session',
        });
        return updated
            ? { ok: true, mode: 'local_session' }
            : { ok: false, error: 'Failed to update local table session.' };
    }

    if (input.status === 'cleaning') {
        const existingSession = await getOpenOfflineTableSessionByTableId(input.tableId);
        if (!existingSession) {
            return { ok: true, mode: 'local_session' };
        }

        const transferred = input.nextTableId
            ? await transferOfflineTableSession({
                  sessionId: existingSession.id,
                  restaurantId: input.restaurantId,
                  tableId: input.nextTableId,
                  notes: input.notes ?? 'Transferred before cleaning',
              })
            : false;

        if (input.nextTableId && transferred) {
            return { ok: true, mode: 'local_session' };
        }

        return {
            ok: false,
            error: 'Table status cleaning requires explicit transfer target for gateway-owned authority.',
        };
    }

    if (input.status === 'available') {
        const openSession = await getOpenOfflineTableSessionByTableId(input.tableId);
        if (!openSession) {
            return { ok: true, mode: 'local_session' };
        }

        const closed = await closeOfflineTableSession({
            sessionId: openSession.id,
            restaurantId: input.restaurantId,
            tableId: input.tableId,
        });

        if (closed) {
            return { ok: true, mode: 'local_session' };
        }
        return { ok: false, error: 'Failed to close local table session.' };
    }

    return {
        ok: false,
        error: `Table status ${input.status} requires gateway-owned table authority.`,
    };
}
