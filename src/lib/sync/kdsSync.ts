/**
 * KDS Sync Manager
 *
 * CRIT-05: Offline sync consolidation for KDS
 * Replaces localStorage KDS queue with PowerSync-backed sync
 *
 * HIGH-006: Integrated conflict resolution for KDS sync
 */

import { getPowerSync } from './powersync-config';
import { queueSyncOperationInDatabase, generateIdempotencyKey } from './idempotency';
import {
    buildCreateKdsItemCommand,
    buildUpdateKdsActionCommand,
    type KdsCommandContext,
} from '@/lib/domain/kds/commands';
import { appendLocalJournalEntryInDatabase } from '@/lib/journal/local-journal';
import {
    resolveConflict,
    logConflictResolution,
    getConflictType,
    type ConflictStrategy,
} from './conflict-resolution';
import { logger } from '@/lib/logger';

/**
 * KDS item status
 */
export type KdsItemStatus = 'queued' | 'in_progress' | 'on_hold' | 'ready' | 'recalled' | 'bumped';

/**
 * KDS action types
 */
export type KdsAction = 'start' | 'hold' | 'ready' | 'recall' | 'bump';

/**
 * KDS item for offline storage
 */
export interface OfflineKdsItem {
    id: string;
    order_id: string;
    order_item_id: string;
    station: string;
    status: KdsItemStatus;
    started_at?: string;
    ready_at?: string;
    recalled_at?: string;
    bumped_at?: string;
    priority: number;
    created_at: string;
    synced_at?: string;
    // Denormalized for display
    menu_item_name?: string;
    menu_item_name_am?: string;
    quantity?: number;
    modifiers_json?: string;
    notes?: string;
}

function getKdsCommandContext(): KdsCommandContext {
    return {
        restaurantId: process.env.NEXT_PUBLIC_RESTAURANT_ID ?? 'default-restaurant',
        locationId: process.env.NEXT_PUBLIC_LOCATION_ID ?? 'default-location',
        deviceId: process.env.NEXT_PUBLIC_DEVICE_ID ?? 'kds-device',
        actor: {
            actorId: process.env.NEXT_PUBLIC_DEVICE_ID ?? 'kds-device',
            actorType: 'device',
        },
    };
}

async function appendKdsCommandJournal(
    db: NonNullable<ReturnType<typeof getPowerSync>>,
    input: {
        aggregateId: string;
        operationType: string;
        idempotencyKey: string;
        payload: Record<string, unknown>;
    }
): Promise<void> {
    const context = getKdsCommandContext();

    await appendLocalJournalEntryInDatabase(db, {
        restaurantId: context.restaurantId,
        locationId: context.locationId,
        deviceId: context.deviceId,
        actorId: context.actor.actorId,
        entryKind: 'command',
        aggregateType: 'kds_item',
        aggregateId: input.aggregateId,
        operationType: input.operationType,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
    });
}

/**
 * Create a KDS item for an order item
 */
export async function createKdsItem(
    orderId: string,
    orderItemId: string,
    station: string,
    priority: number = 0,
    displayData?: {
        menu_item_name: string;
        menu_item_name_am?: string;
        quantity: number;
        modifiers_json?: string;
        notes?: string;
    }
): Promise<OfflineKdsItem | null> {
    const db = getPowerSync();
    if (!db) return null;

    const now = new Date().toISOString();
    const kdsId = crypto.randomUUID();
    const idempotencyKey = generateIdempotencyKey('kds-create');
    const commandContext = getKdsCommandContext();
    const createCommand = buildCreateKdsItemCommand(
        commandContext,
        {
            kds_id: kdsId,
            order_id: orderId,
            order_item_id: orderItemId,
            station,
            priority,
            status: 'queued',
            display_data: displayData,
        },
        idempotencyKey
    );

    try {
        await db.write(async () => {
            await appendKdsCommandJournal(db, {
                aggregateId: kdsId,
                operationType: 'kds.create',
                idempotencyKey,
                payload: createCommand as unknown as Record<string, unknown>,
            });

            await db.execute(
                `INSERT INTO kds_items (
                    id, order_id, order_item_id, station, status, priority, created_at
                ) VALUES (?, ?, ?, ?, 'queued', ?, ?)`,
                [kdsId, orderId, orderItemId, station, priority, now]
            );

            if (displayData) {
                await db.execute(
                    `UPDATE order_items SET station = ?, status = 'queued' WHERE id = ?`,
                    [station, orderItemId]
                );
            }

            await queueSyncOperationInDatabase(
                db,
                'create',
                'kds_items',
                kdsId,
                {
                    order_id: orderId,
                    order_item_id: orderItemId,
                    station,
                    priority,
                    status: 'queued',
                    domain_command: createCommand,
                },
                {
                    restaurantId: commandContext.restaurantId,
                    locationId: commandContext.locationId,
                    deviceId: commandContext.deviceId,
                    actorId: commandContext.actor.actorId,
                }
            );
        });

        const item = await getKdsItem(kdsId);
        return item;
    } catch (error) {
        logger.error('[KdsSync] Failed to create KDS item', {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

/**
 * Get a KDS item by ID
 */
export async function getKdsItem(kdsId: string): Promise<OfflineKdsItem | null> {
    const db = getPowerSync();
    if (!db) return null;

    const item = await db.getFirstAsync<OfflineKdsItem & { modifiers_json?: string }>(
        `SELECT k.*, oi.menu_item_name, oi.menu_item_name_am, oi.quantity, oi.modifiers_json, oi.notes
         FROM kds_items k
         JOIN order_items oi ON k.order_item_id = oi.id
         WHERE k.id = ?`,
        [kdsId]
    );

    return item ?? null;
}

/**
 * Get KDS items by station
 */
export async function getKdsItemsByStation(station: string): Promise<OfflineKdsItem[]> {
    const db = getPowerSync();
    if (!db) return [];

    const items = await db.getAllAsync<OfflineKdsItem>(
        `SELECT k.*, oi.menu_item_name, oi.menu_item_name_am, oi.quantity, oi.modifiers_json, oi.notes
         FROM kds_items k
         JOIN order_items oi ON k.order_item_id = oi.id
         WHERE k.station = ? AND k.status != 'bumped'
         ORDER BY k.priority DESC, k.created_at ASC`,
        [station]
    );

    return items;
}

/**
 * Get all KDS items for an order
 */
export async function getKdsItemsByOrder(orderId: string): Promise<OfflineKdsItem[]> {
    const db = getPowerSync();
    if (!db) return [];

    const items = await db.getAllAsync<OfflineKdsItem>(
        `SELECT k.*, oi.menu_item_name, oi.menu_item_name_am, oi.quantity, oi.modifiers_json, oi.notes
         FROM kds_items k
         JOIN order_items oi ON k.order_item_id = oi.id
         WHERE k.order_id = ?
         ORDER BY k.created_at ASC`,
        [orderId]
    );

    return items;
}

/**
 * Execute a KDS action
 */
export async function executeKdsAction(kdsId: string, action: KdsAction): Promise<boolean> {
    const db = getPowerSync();
    if (!db) return false;

    const now = new Date().toISOString();
    const idempotencyKey = generateIdempotencyKey(`kds-${action}`);
    const commandContext = getKdsCommandContext();

    try {
        let newStatus: KdsItemStatus;
        let updateFields: string[] = [];
        let updateValues: (string | null)[] = [];

        switch (action) {
            case 'start':
                newStatus = 'in_progress';
                updateFields = ['status = ?', 'started_at = ?'];
                updateValues = [newStatus, now];
                break;
            case 'hold':
                newStatus = 'on_hold';
                updateFields = ['status = ?'];
                updateValues = [newStatus];
                break;
            case 'ready':
                newStatus = 'ready';
                updateFields = ['status = ?', 'ready_at = ?'];
                updateValues = [newStatus, now];
                break;
            case 'recall':
                newStatus = 'recalled';
                updateFields = ['status = ?', 'recalled_at = ?'];
                updateValues = [newStatus, now];
                break;
            case 'bump':
                newStatus = 'bumped';
                updateFields = ['status = ?', 'bumped_at = ?'];
                updateValues = [newStatus, now];
                break;
            default:
                return false;
        }

        const actionCommand = buildUpdateKdsActionCommand(
            commandContext,
            {
                kds_id: kdsId,
                action,
                status: newStatus,
            },
            idempotencyKey
        );

        await db.write(async () => {
            await appendKdsCommandJournal(db, {
                aggregateId: kdsId,
                operationType: `kds.${action}`,
                idempotencyKey,
                payload: actionCommand as unknown as Record<string, unknown>,
            });

            await db.execute(`UPDATE kds_items SET ${updateFields.join(', ')} WHERE id = ?`, [
                ...updateValues,
                kdsId,
            ]);

            const kdsItem = await getKdsItem(kdsId);
            if (kdsItem) {
                let itemStatus: string;
                if (action === 'bump') {
                    itemStatus = 'completed';
                } else if (action === 'ready') {
                    itemStatus = 'ready';
                } else if (newStatus === 'on_hold') {
                    itemStatus = 'pending';
                } else {
                    itemStatus = 'cooking';
                }
                await db.execute(`UPDATE order_items SET status = ? WHERE id = ?`, [
                    itemStatus,
                    kdsItem.order_item_id,
                ]);
            }

            await queueSyncOperationInDatabase(
                db,
                'update',
                'kds_items',
                kdsId,
                {
                    action,
                    idempotency_key: idempotencyKey,
                    status: newStatus,
                    domain_command: actionCommand,
                },
                {
                    restaurantId: commandContext.restaurantId,
                    locationId: commandContext.locationId,
                    deviceId: commandContext.deviceId,
                    actorId: commandContext.actor.actorId,
                }
            );
        });

        return true;
    } catch (error) {
        logger.error('[KdsSync] Failed to execute KDS action', {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}

/**
 * Get KDS queue statistics
 */
export async function getKdsStats(station?: string): Promise<{
    queued: number;
    cooking: number;
    ready: number;
    total: number;
}> {
    const db = getPowerSync();
    if (!db) {
        return { queued: 0, cooking: 0, ready: 0, total: 0 };
    }

    let query = `SELECT status, COUNT(*) as count FROM kds_items WHERE status != 'bumped'`;
    const params: string[] = [];

    if (station) {
        query += ` AND station = ?`;
        params.push(station);
    }

    query += ` GROUP BY status`;

    const results = await db.getAllAsync<{ status: string; count: number }>(query, params);

    const stats = {
        queued: 0,
        cooking: 0,
        ready: 0,
        total: 0,
    };

    for (const row of results) {
        if (row.status === 'queued') stats.queued = row.count;
        else if (row.status === 'in_progress' || row.status === 'recalled') {
            stats.cooking += row.count;
        } else if (row.status === 'on_hold') {
            stats.queued += row.count;
        } else if (row.status === 'ready') stats.ready = row.count;
        stats.total += row.count;
    }

    return stats;
}

/**
 * Clear completed KDS items
 */
export async function clearBumpedKdsItems(olderThanHours: number = 24): Promise<number> {
    const db = getPowerSync();
    if (!db) return 0;

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

    const result = await db.execute(
        `DELETE FROM kds_items WHERE status = 'bumped' AND bumped_at < ?`,
        [cutoffDate.toISOString()]
    );

    return result.rowsAffected;
}

// ============================================================================
// HIGH-006: Conflict Resolution Integration for KDS
// ============================================================================

/**
 * KDS conflict resolution result
 */
export interface KdsConflictResult {
    resolved: boolean;
    strategy: ConflictStrategy;
    resolvedData?: OfflineKdsItem;
    error?: string;
    conflictType?: 'version_mismatch' | 'concurrent_edit' | 'delete_update';
}

/**
 * Resolve KDS item sync conflict
 *
 * Uses server-wins strategy for KDS items since the kitchen state
 * should reflect the actual cooking status from the server.
 *
 * @param kdsId - The KDS item ID with conflict
 * @param clientData - Local/client KDS item data
 * @param serverData - Server KDS item data
 * @param preferredStrategy - Optional override strategy (defaults to server_wins)
 */
export async function resolveKdsConflict(
    kdsId: string,
    clientData: OfflineKdsItem & { version: number; last_modified: string },
    serverData: Record<string, unknown> & { version: number; last_modified: string },
    preferredStrategy?: ConflictStrategy
): Promise<KdsConflictResult> {
    const db = getPowerSync();
    if (!db) {
        return {
            resolved: false,
            strategy: 'server_wins',
            error: 'PowerSync not initialized',
        };
    }

    try {
        // Detect conflict type
        const conflictType = getConflictType(
            clientData as unknown as { deleted_at?: string | null; version: number },
            serverData as { deleted_at?: string | null; version: number }
        );

        // KDS uses server_wins by default - kitchen state is authoritative
        const strategy: ConflictStrategy = preferredStrategy ?? 'server_wins';

        // Resolve the conflict
        const {
            resolvedData,
            strategy: usedStrategy,
            auditDetails,
        } = resolveConflict(
            'kds_items',
            clientData as unknown as Record<string, unknown> & {
                version: number;
                last_modified: string;
            },
            serverData,
            strategy
        );

        // Update local record with resolved data
        const _now = new Date().toISOString();
        await db.execute(
            `UPDATE kds_items SET
                status = ?,
                started_at = ?,
                ready_at = ?,
                recalled_at = ?,
                bumped_at = ?,
                priority = ?,
                version = ?,
                last_modified = ?
            WHERE id = ?`,
            [
                resolvedData.status ?? 'queued',
                resolvedData.started_at ?? null,
                resolvedData.ready_at ?? null,
                resolvedData.recalled_at ?? null,
                resolvedData.bumped_at ?? null,
                resolvedData.priority ?? 0,
                resolvedData.version,
                resolvedData.last_modified,
                kdsId,
            ]
        );

        // Log conflict resolution to sync_conflict_logs table
        await logConflictResolution({
            entityType: 'kds_items',
            entityId: kdsId,
            conflictType,
            clientData: clientData as unknown as Record<string, unknown>,
            serverData,
            resolvedData,
            strategy: usedStrategy,
            auditDetails,
        });

        // Also log to audit_logs for compliance
        await logKdsConflictToAuditLog(kdsId, clientData, serverData, usedStrategy, auditDetails);

        logger.info('[KdsSync] Conflict resolved', {
            kdsId,
            strategy: usedStrategy,
            conflictType,
            winner: auditDetails.winner,
        });

        // Get the resolved KDS item
        const resolvedItem = await getKdsItem(kdsId);

        return {
            resolved: true,
            strategy: usedStrategy,
            resolvedData: resolvedItem ?? undefined,
            conflictType,
        };
    } catch (error) {
        logger.error('[KdsSync] Failed to resolve conflict', {
            kdsId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return {
            resolved: false,
            strategy: preferredStrategy ?? 'server_wins',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Log KDS conflict to audit_logs table for compliance
 */
async function logKdsConflictToAuditLog(
    kdsId: string,
    clientData: OfflineKdsItem,
    serverData: Record<string, unknown>,
    strategy: ConflictStrategy,
    auditDetails: Record<string, unknown>
): Promise<void> {
    const db = getPowerSync();
    if (!db) return;

    try {
        const now = new Date().toISOString();
        const logId = crypto.randomUUID();

        await db.execute(
            `INSERT INTO audit_logs (
                id, restaurant_id, action, entity_type, entity_id,
                old_value, new_value, metadata, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                logId,
                serverData.restaurant_id ?? clientData.order_id, // Use order_id as fallback
                `sync_conflict:${strategy}`,
                'kds_items',
                kdsId,
                JSON.stringify(serverData),
                JSON.stringify(clientData),
                JSON.stringify({
                    ...auditDetails,
                    resolution_source: 'offline_sync',
                }),
                now,
            ]
        );
    } catch (error) {
        logger.error('[KdsSync] Failed to log conflict to audit_logs', {
            kdsId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

/**
 * Get KDS items with conflict status (if tracked)
 */
export async function getConflictedKdsItems(orderId?: string): Promise<OfflineKdsItem[]> {
    const db = getPowerSync();
    if (!db) return [];

    // KDS items don't have a conflict status field, but we can check sync_conflict_logs
    let query = `
        SELECT k.*, oi.menu_item_name, oi.menu_item_name_am, oi.quantity, oi.modifiers_json, oi.notes
        FROM kds_items k
        JOIN order_items oi ON k.order_item_id = oi.id
        JOIN sync_conflict_logs scl ON scl.entity_id = k.id AND scl.entity_type = 'kds_items'
        WHERE 1=1
    `;
    const params: string[] = [];

    if (orderId) {
        query += ` AND k.order_id = ?`;
        params.push(orderId);
    }

    query += ` ORDER BY scl.created_at DESC`;

    const items = await db.getAllAsync<OfflineKdsItem>(query, params);
    return items;
}

/**
 * Batch resolve multiple KDS item conflicts
 */
export async function batchResolveKdsConflicts(
    conflicts: Array<{
        kdsId: string;
        clientData: OfflineKdsItem & { version: number; last_modified: string };
        serverData: Record<string, unknown> & { version: number; last_modified: string };
    }>
): Promise<{
    resolved: number;
    failed: number;
    errors: string[];
}> {
    let resolved = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const conflict of conflicts) {
        const result = await resolveKdsConflict(
            conflict.kdsId,
            conflict.clientData,
            conflict.serverData
        );

        if (result.resolved) {
            resolved++;
        } else {
            failed++;
            errors.push(`${conflict.kdsId}: ${result.error}`);
        }
    }

    logger.info('[KdsSync] Batch conflict resolution complete', {
        total: conflicts.length,
        resolved,
        failed,
    });

    return { resolved, failed, errors };
}
