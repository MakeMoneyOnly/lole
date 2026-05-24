import type { PowerSyncDatabase } from '@/lib/sync/powersync-config';
import { getPowerSync } from '@/lib/sync/powersync-config';

export type LocalJournalEntryKind = 'command' | 'event' | 'audit' | 'fiscal' | 'sync';
export type LocalJournalStatus = 'pending' | 'acknowledged' | 'failed' | 'replayed';

export interface LocalJournalEntry {
    id: string;
    restaurantId: string;
    locationId?: string | null;
    deviceId: string;
    actorId?: string | null;
    entryKind: LocalJournalEntryKind;
    aggregateType: string;
    aggregateId: string;
    operationType: string;
    payload: Record<string, unknown>;
    payloadHash: string;
    idempotencyKey: string;
    status: LocalJournalStatus;
    errorText?: string | null;
    createdAt: string;
    updatedAt: string;
    replayedAt?: string | null;
}

export interface CreateLocalJournalEntryInput {
    restaurantId: string;
    locationId?: string | null;
    deviceId: string;
    actorId?: string | null;
    entryKind: LocalJournalEntryKind;
    aggregateType: string;
    aggregateId: string;
    operationType: string;
    payload: Record<string, unknown>;
    idempotencyKey: string;
}

function bytesToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

async function hashPayload(payload: Record<string, unknown>): Promise<string> {
    const body = new TextEncoder().encode(JSON.stringify(payload));
    const digest = await crypto.subtle.digest('SHA-256', body);
    return bytesToHex(digest);
}

export async function createLocalJournalEntry(
    input: CreateLocalJournalEntryInput
): Promise<LocalJournalEntry> {
    const now = new Date().toISOString();

    return {
        id: crypto.randomUUID(),
        restaurantId: input.restaurantId,
        locationId: input.locationId ?? null,
        deviceId: input.deviceId,
        actorId: input.actorId ?? null,
        entryKind: input.entryKind,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        operationType: input.operationType,
        payload: input.payload,
        payloadHash: await hashPayload(input.payload),
        idempotencyKey: input.idempotencyKey,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
    };
}

async function appendJournalRow(
    db: PowerSyncDatabase,
    entry: LocalJournalEntry
): Promise<LocalJournalEntry> {
    await db.execute(
        `INSERT INTO local_journal (
            id, restaurant_id, location_id, device_id, actor_id,
            entry_kind, aggregate_type, aggregate_id, operation_type,
            payload_json, payload_hash, idempotency_key, status,
            error_text, created_at, updated_at, replayed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            entry.id,
            entry.restaurantId,
            entry.locationId ?? null,
            entry.deviceId,
            entry.actorId ?? null,
            entry.entryKind,
            entry.aggregateType,
            entry.aggregateId,
            entry.operationType,
            JSON.stringify(entry.payload),
            entry.payloadHash,
            entry.idempotencyKey,
            entry.status,
            entry.errorText ?? null,
            entry.createdAt,
            entry.updatedAt,
            entry.replayedAt ?? null,
        ]
    );

    return entry;
}

export async function appendLocalJournalEntryInDatabase(
    db: PowerSyncDatabase,
    input: CreateLocalJournalEntryInput
): Promise<LocalJournalEntry> {
    const entry = await createLocalJournalEntry(input);
    return await appendJournalRow(db, entry);
}

export async function appendLocalJournalEntry(
    input: CreateLocalJournalEntryInput
): Promise<LocalJournalEntry | null> {
    const db = getPowerSync();
    if (!db) {
        return null;
    }

    return await appendLocalJournalEntryInDatabase(db, input);
}

export async function listPendingJournalEntries(
    entryKind?: LocalJournalEntryKind,
    limit: number = 50
): Promise<LocalJournalEntry[]> {
    const db = getPowerSync();
    if (!db) {
        return [];
    }

    if (entryKind) {
        return (
            (await db.getAllAsync<LocalJournalEntry>(
                `SELECT
                    id,
                    restaurant_id as restaurantId,
                    location_id as locationId,
                    device_id as deviceId,
                    actor_id as actorId,
                    entry_kind as entryKind,
                    aggregate_type as aggregateType,
                    aggregate_id as aggregateId,
                    operation_type as operationType,
                    payload_json as payload,
                    payload_hash as payloadHash,
                    idempotency_key as idempotencyKey,
                    status,
                    error_text as errorText,
                    created_at as createdAt,
                    updated_at as updatedAt,
                    replayed_at as replayedAt
                FROM local_journal
                WHERE status = 'pending' AND entry_kind = ?
                ORDER BY created_at ASC
                LIMIT ?`,
                [entryKind, limit]
            )) ?? []
        );
    }

    return (
        (await db.getAllAsync<LocalJournalEntry>(
            `SELECT
                id,
                restaurant_id as restaurantId,
                location_id as locationId,
                device_id as deviceId,
                actor_id as actorId,
                entry_kind as entryKind,
                aggregate_type as aggregateType,
                aggregate_id as aggregateId,
                operation_type as operationType,
                payload_json as payload,
                payload_hash as payloadHash,
                idempotency_key as idempotencyKey,
                status,
                error_text as errorText,
                created_at as createdAt,
                updated_at as updatedAt,
                replayed_at as replayedAt
            FROM local_journal
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT ?`,
            [limit]
        )) ?? []
    );
}

export async function markLocalJournalEntryStatus(
    entryId: string,
    status: Exclude<LocalJournalStatus, 'pending'>,
    errorText?: string | null
): Promise<void> {
    const db = getPowerSync();
    if (!db) {
        return;
    }

    const now = new Date().toISOString();
    await db.execute(
        `UPDATE local_journal
         SET status = ?, error_text = ?, updated_at = ?, replayed_at = ?
         WHERE id = ?`,
        [status, errorText ?? null, now, status === 'replayed' ? now : null, entryId]
    );
}
