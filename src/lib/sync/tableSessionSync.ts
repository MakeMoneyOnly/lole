import {
    buildCloseTableSessionCommand,
    buildOpenTableSessionCommand,
    buildTransferTableSessionCommand,
    buildUpdateTableSessionCommand,
    type TableCommandContext,
} from '@/lib/domain/tables/commands';
import { appendLocalJournalEntryInDatabase } from '@/lib/journal/local-journal';
import { logger } from '@/lib/logger';
import { generateIdempotencyKey, queueSyncOperationInDatabase } from '@/lib/sync/idempotency';
import { getPowerSync } from '@/lib/sync/powersync-config';

export type OfflineTableSessionStatus = 'open' | 'closed' | 'transferred';

export interface OfflineTableSession {
    id: string;
    restaurant_id: string;
    table_id: string;
    status: OfflineTableSessionStatus;
    guest_count: number;
    assigned_staff_id?: string | null;
    notes?: string | null;
    metadata_json: string;
    opened_at: string;
    closed_at?: string | null;
    created_at: string;
    updated_at: string;
}

function getTableCommandContext(restaurantId: string): TableCommandContext {
    return {
        restaurantId,
        locationId: process.env.NEXT_PUBLIC_LOCATION_ID ?? 'default-location',
        deviceId: process.env.NEXT_PUBLIC_DEVICE_ID ?? 'table-device',
        actor: {
            actorId: process.env.NEXT_PUBLIC_DEVICE_ID ?? 'table-device',
            actorType: 'device',
        },
    };
}

async function appendTableCommandJournal(
    db: NonNullable<ReturnType<typeof getPowerSync>>,
    restaurantId: string,
    aggregateId: string,
    operationType: string,
    idempotencyKey: string,
    payload: Record<string, unknown>
): Promise<void> {
    const context = getTableCommandContext(restaurantId);

    await appendLocalJournalEntryInDatabase(db, {
        restaurantId,
        locationId: context.locationId,
        deviceId: context.deviceId,
        actorId: context.actor.actorId,
        entryKind: 'command',
        aggregateType: 'table_session',
        aggregateId,
        operationType,
        payload,
        idempotencyKey,
    });
}

export async function openOfflineTableSession(input: {
    restaurantId: string;
    tableId: string;
    guestCount?: number;
    assignedStaffId?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
}): Promise<OfflineTableSession | null> {
    const db = getPowerSync();
    if (!db) {
        return null;
    }

    const sessionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const idempotencyKey = generateIdempotencyKey('table-open');
    const context = getTableCommandContext(input.restaurantId);
    const command = buildOpenTableSessionCommand(
        context,
        {
            session_id: sessionId,
            table_id: input.tableId,
            guest_count: input.guestCount ?? 1,
            assigned_staff_id: input.assignedStaffId ?? null,
            notes: input.notes ?? null,
        },
        idempotencyKey
    );

    try {
        await db.write(async () => {
            await appendTableCommandJournal(
                db,
                input.restaurantId,
                sessionId,
                'table.open',
                idempotencyKey,
                command as unknown as Record<string, unknown>
            );

            await db.execute(
                `INSERT INTO table_sessions (
                    id, restaurant_id, table_id, status, guest_count, assigned_staff_id,
                    notes, metadata_json, opened_at, created_at, updated_at
                ) VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)`,
                [
                    sessionId,
                    input.restaurantId,
                    input.tableId,
                    input.guestCount ?? 1,
                    input.assignedStaffId ?? null,
                    input.notes ?? null,
                    JSON.stringify(input.metadata ?? {}),
                    now,
                    now,
                    now,
                ]
            );

            await queueSyncOperationInDatabase(
                db,
                'create',
                'table_sessions',
                sessionId,
                {
                    table_id: input.tableId,
                    guest_count: input.guestCount ?? 1,
                    assigned_staff_id: input.assignedStaffId ?? null,
                    notes: input.notes ?? null,
                    metadata: input.metadata ?? {},
                    domain_command: command,
                },
                {
                    restaurantId: input.restaurantId,
                    locationId: context.locationId,
                    deviceId: context.deviceId,
                    actorId: context.actor.actorId,
                }
            );
        });

        return await getOfflineTableSession(sessionId);
    } catch (error) {
        logger.error('[TableSessionSync] Failed to open table session', error);
        return null;
    }
}

export async function getOfflineTableSession(
    sessionId: string
): Promise<OfflineTableSession | null> {
    const db = getPowerSync();
    if (!db) {
        return null;
    }

    return await db.getFirstAsync<OfflineTableSession>(
        `SELECT * FROM table_sessions WHERE id = ?`,
        [sessionId]
    );
}

export async function getOpenOfflineTableSessionByTableId(
    tableId: string
): Promise<OfflineTableSession | null> {
    const db = getPowerSync();
    if (!db) {
        return null;
    }

    return await db.getFirstAsync<OfflineTableSession>(
        `SELECT * FROM table_sessions WHERE table_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
        [tableId]
    );
}

export async function transferOfflineTableSession(input: {
    sessionId: string;
    restaurantId: string;
    tableId: string;
    assignedStaffId?: string | null;
    notes?: string | null;
}): Promise<boolean> {
    const db = getPowerSync();
    if (!db) {
        return false;
    }

    const now = new Date().toISOString();
    const idempotencyKey = generateIdempotencyKey('table-transfer');
    const context = getTableCommandContext(input.restaurantId);
    const command = buildTransferTableSessionCommand(
        context,
        {
            session_id: input.sessionId,
            table_id: input.tableId,
            assigned_staff_id: input.assignedStaffId ?? null,
            notes: input.notes ?? null,
        },
        idempotencyKey
    );

    try {
        await db.write(async () => {
            await appendTableCommandJournal(
                db,
                input.restaurantId,
                input.sessionId,
                'table.transfer',
                idempotencyKey,
                command as unknown as Record<string, unknown>
            );

            await db.execute(
                `UPDATE table_sessions
                 SET table_id = ?, assigned_staff_id = ?, notes = ?, status = 'transferred', updated_at = ?
                 WHERE id = ?`,
                [
                    input.tableId,
                    input.assignedStaffId ?? null,
                    input.notes ?? null,
                    now,
                    input.sessionId,
                ]
            );

            await queueSyncOperationInDatabase(
                db,
                'update',
                'table_sessions',
                input.sessionId,
                {
                    table_id: input.tableId,
                    assigned_staff_id: input.assignedStaffId ?? null,
                    notes: input.notes ?? null,
                    status: 'transferred',
                    domain_command: command,
                },
                {
                    restaurantId: input.restaurantId,
                    locationId: context.locationId,
                    deviceId: context.deviceId,
                    actorId: context.actor.actorId,
                }
            );
        });

        return true;
    } catch (error) {
        logger.error('[TableSessionSync] Failed to transfer table session', error);
        return false;
    }
}

export async function updateOfflineTableSession(input: {
    sessionId: string;
    restaurantId: string;
    tableId: string;
    guestCount?: number | null;
    assignedStaffId?: string | null;
    notes?: string | null;
}): Promise<boolean> {
    const db = getPowerSync();
    if (!db) {
        return false;
    }

    const now = new Date().toISOString();
    const idempotencyKey = generateIdempotencyKey('table-update');
    const context = getTableCommandContext(input.restaurantId);
    const command = buildUpdateTableSessionCommand(
        context,
        {
            session_id: input.sessionId,
            table_id: input.tableId,
            guest_count: input.guestCount ?? null,
            assigned_staff_id: input.assignedStaffId ?? null,
            notes: input.notes ?? null,
        },
        idempotencyKey
    );

    try {
        await db.write(async () => {
            await appendTableCommandJournal(
                db,
                input.restaurantId,
                input.sessionId,
                'table.update',
                idempotencyKey,
                command as unknown as Record<string, unknown>
            );

            await db.execute(
                `UPDATE table_sessions
                 SET guest_count = COALESCE(?, guest_count),
                     assigned_staff_id = COALESCE(?, assigned_staff_id),
                     notes = COALESCE(?, notes),
                     updated_at = ?
                 WHERE id = ?`,
                [
                    input.guestCount ?? null,
                    input.assignedStaffId ?? null,
                    input.notes ?? null,
                    now,
                    input.sessionId,
                ]
            );

            await queueSyncOperationInDatabase(
                db,
                'update',
                'table_sessions',
                input.sessionId,
                {
                    guest_count: input.guestCount ?? null,
                    assigned_staff_id: input.assignedStaffId ?? null,
                    notes: input.notes ?? null,
                    domain_command: command,
                },
                {
                    restaurantId: input.restaurantId,
                    locationId: context.locationId,
                    deviceId: context.deviceId,
                    actorId: context.actor.actorId,
                }
            );
        });

        return true;
    } catch (error) {
        logger.error('[TableSessionSync] Failed to update table session', error);
        return false;
    }
}

export async function closeOfflineTableSession(input: {
    sessionId: string;
    restaurantId: string;
    tableId: string;
}): Promise<boolean> {
    const db = getPowerSync();
    if (!db) {
        return false;
    }

    const now = new Date().toISOString();
    const idempotencyKey = generateIdempotencyKey('table-close');
    const context = getTableCommandContext(input.restaurantId);
    const command = buildCloseTableSessionCommand(
        context,
        {
            session_id: input.sessionId,
            table_id: input.tableId,
            status: 'closed',
        },
        idempotencyKey
    );

    try {
        await db.write(async () => {
            await appendTableCommandJournal(
                db,
                input.restaurantId,
                input.sessionId,
                'table.close',
                idempotencyKey,
                command as unknown as Record<string, unknown>
            );

            await db.execute(
                `UPDATE table_sessions
                 SET status = 'closed', closed_at = ?, updated_at = ?
                 WHERE id = ?`,
                [now, now, input.sessionId]
            );

            await queueSyncOperationInDatabase(
                db,
                'update',
                'table_sessions',
                input.sessionId,
                {
                    table_id: input.tableId,
                    status: 'closed',
                    closed_at: now,
                    domain_command: command,
                },
                {
                    restaurantId: input.restaurantId,
                    locationId: context.locationId,
                    deviceId: context.deviceId,
                    actorId: context.actor.actorId,
                }
            );
        });

        return true;
    } catch (error) {
        logger.error('[TableSessionSync] Failed to close table session', error);
        return false;
    }
}
