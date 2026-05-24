/**
 * Domain-aware conflict resolution
 *
 * ENT-031/032/033: intent rules, split-brain matrix support, explicit operator review
 */

import { getPowerSync } from './powersync-config';
import { logger } from '@/lib/logger';

export type ConflictStrategy =
    | 'last_write_wins'
    | 'server_wins'
    | 'client_wins'
    | 'merge'
    | 'manual_review';

export interface ConflictRecord {
    id: string;
    entity_type: string;
    entity_id: string;
    strategy: ConflictStrategy;
    client_version: number;
    server_version: number;
    client_data: Record<string, unknown>;
    server_data: Record<string, unknown>;
    resolved_data: Record<string, unknown>;
    created_at: string;
    resolved_at: string;
}

export interface SyncConflictLog {
    id: string;
    entity_type: string;
    entity_id: string;
    conflict_type: 'version_mismatch' | 'concurrent_edit' | 'delete_update';
    client_timestamp: string;
    server_timestamp: string;
    resolution_strategy: ConflictStrategy;
    resolution_details: Record<string, unknown>;
    created_at: string;
}

type DomainRule = {
    defaultStrategy: ConflictStrategy;
    serverWinsFields?: string[];
    clientWinsFields?: string[];
    mergeFields?: string[];
    reviewWhen?: Array<
        (clientData: Record<string, unknown>, serverData: Record<string, unknown>) => boolean
    >;
};

const ENTITY_RULES: Record<string, DomainRule> = {
    orders: {
        defaultStrategy: 'merge',
        serverWinsFields: ['subtotal_santim', 'discount_santim', 'vat_santim', 'total_santim'],
        clientWinsFields: ['notes', 'guest_name', 'guest_phone'],
        mergeFields: ['status', 'fire_mode', 'current_course', 'table_number'],
        reviewWhen: [
            (clientData, serverData) =>
                String(clientData.status ?? '') === 'cancelled' &&
                ['preparing', 'ready', 'served', 'completed'].includes(
                    String(serverData.status ?? '')
                ),
            (clientData, serverData) =>
                String(serverData.status ?? '') === 'cancelled' &&
                ['preparing', 'ready', 'served', 'completed'].includes(
                    String(clientData.status ?? '')
                ),
        ],
    },
    table_sessions: {
        defaultStrategy: 'merge',
        clientWinsFields: ['guest_count', 'assigned_staff_id', 'notes'],
        mergeFields: ['table_id', 'status'],
        reviewWhen: [
            (clientData, serverData) =>
                String(clientData.status ?? '') === 'closed' &&
                String(serverData.status ?? '') === 'transferred',
            (clientData, serverData) =>
                String(clientData.status ?? '') === 'transferred' &&
                String(serverData.status ?? '') === 'closed',
        ],
    },
    payments: {
        defaultStrategy: 'server_wins',
        serverWinsFields: ['status', 'provider_reference', 'transaction_number'],
        mergeFields: ['metadata_json'],
        reviewWhen: [
            (clientData, serverData) =>
                Number(clientData.amount ?? 0) !==
                Number(serverData.amount ?? clientData.amount ?? 0),
        ],
    },
    reconciliation_entries: {
        defaultStrategy: 'manual_review',
        reviewWhen: [() => true],
    },
    order_voids: {
        defaultStrategy: 'manual_review',
        reviewWhen: [() => true],
    },
    kds_items: {
        defaultStrategy: 'server_wins',
        serverWinsFields: ['status', 'started_at', 'ready_at', 'bumped_at'],
    },
    tables: {
        defaultStrategy: 'merge',
        clientWinsFields: ['name', 'capacity'],
        mergeFields: ['status'],
    },
    menu_items: {
        defaultStrategy: 'server_wins',
    },
    guests: {
        defaultStrategy: 'last_write_wins',
    },
};

const EXCLUDED_FIELDS: Record<string, string[]> = {
    orders: ['synced_at', 'updated_at', 'last_modified'],
    order_items: ['synced_at', 'updated_at', 'last_modified'],
    kds_items: ['synced_at', 'updated_at', 'last_modified'],
    table_sessions: ['synced_at', 'updated_at', 'last_modified'],
    payments: ['synced_at', 'updated_at', 'last_modified'],
};

function getRule(entityType: string): DomainRule {
    return ENTITY_RULES[entityType] ?? { defaultStrategy: 'last_write_wins' };
}
function timestamps(
    clientData: Record<string, unknown>,
    serverData: Record<string, unknown>
): { clientTime: number; serverTime: number } {
    const clientTime = new Date(clientData.last_modified as string).getTime();
    const serverTime = new Date(serverData.last_modified as string).getTime();
    return { clientTime, serverTime };
}

function mergeData(
    clientData: Record<string, unknown>,
    serverData: Record<string, unknown>,
    excludedFields: string[],
    rule?: DomainRule
): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    const allKeys = new Set([...Object.keys(clientData), ...Object.keys(serverData)]);
    const mergeFields = new Set(rule?.mergeFields ?? []);
    const serverWinsFields = new Set(rule?.serverWinsFields ?? []);
    const clientWinsFields = new Set(rule?.clientWinsFields ?? []);

    for (const key of allKeys) {
        if (excludedFields.includes(key)) {
            merged[key] = serverData[key];
            continue;
        }

        if (serverWinsFields.has(key)) {
            merged[key] = serverData[key] ?? clientData[key];
            continue;
        }

        if (clientWinsFields.has(key)) {
            merged[key] = clientData[key] ?? serverData[key];
            continue;
        }

        const clientValue = clientData[key];
        const serverValue = serverData[key];

        if (mergeFields.has(key)) {
            merged[key] =
                clientValue === null || clientValue === undefined ? serverValue : clientValue;
            continue;
        }

        if (clientValue === null || clientValue === undefined) {
            merged[key] = serverValue;
        } else if (serverValue === null || serverValue === undefined) {
            merged[key] = clientValue;
        } else if (
            typeof clientValue === 'object' &&
            typeof serverValue === 'object' &&
            !Array.isArray(clientValue) &&
            !Array.isArray(serverValue)
        ) {
            merged[key] = mergeData(
                clientValue as Record<string, unknown>,
                serverValue as Record<string, unknown>,
                [],
                undefined
            );
        } else {
            merged[key] = clientValue;
        }
    }

    return merged;
}

export function detectConflict(
    clientData: { version: number; last_modified: string },
    serverData: { version: number; last_modified: string }
): boolean {
    return clientData.version !== serverData.version;
}

export function getConflictType(
    clientData: { deleted_at?: string | null; version: number },
    serverData: { deleted_at?: string | null; version: number }
): 'version_mismatch' | 'concurrent_edit' | 'delete_update' {
    const clientDeleted = !!clientData.deleted_at;
    const serverDeleted = !!serverData.deleted_at;

    if (clientDeleted !== serverDeleted) {
        return 'delete_update';
    }
    if (Math.abs(clientData.version - serverData.version) > 1) {
        return 'version_mismatch';
    }
    return 'concurrent_edit';
}

export function requiresOperatorReview(
    entityType: string,
    clientData: Record<string, unknown>,
    serverData: Record<string, unknown>
): boolean {
    const rule = getRule(entityType);
    if (rule.defaultStrategy === 'manual_review') {
        return true;
    }

    return (rule.reviewWhen ?? []).some(check => check(clientData, serverData));
}

export function resolveConflict(
    entityType: string,
    clientData: Record<string, unknown> & { version: number; last_modified: string },
    serverData: Record<string, unknown> & { version: number; last_modified: string },
    strategy?: ConflictStrategy
): {
    resolvedData: Record<string, unknown>;
    strategy: ConflictStrategy;
    auditDetails: Record<string, unknown>;
} {
    const rule = getRule(entityType);
    const resolvedStrategy =
        strategy ??
        (requiresOperatorReview(entityType, clientData, serverData)
            ? 'manual_review'
            : rule.defaultStrategy);
    const excludedFields = EXCLUDED_FIELDS[entityType] ?? [];

    const auditDetails: Record<string, unknown> = {
        strategy: resolvedStrategy,
        clientVersion: clientData.version,
        serverVersion: serverData.version,
        clientTimestamp: clientData.last_modified,
        serverTimestamp: serverData.last_modified,
    };

    let resolvedData: Record<string, unknown>;

    switch (resolvedStrategy) {
        case 'server_wins':
            resolvedData = { ...serverData };
            auditDetails.winner = 'server';
            break;
        case 'client_wins':
            resolvedData = {
                ...clientData,
                version: Math.max(clientData.version, serverData.version) + 1,
            };
            auditDetails.winner = 'client';
            break;
        case 'merge':
            resolvedData = mergeData(clientData, serverData, excludedFields, rule);
            resolvedData.version = Math.max(clientData.version, serverData.version) + 1;
            auditDetails.winner = 'merged';
            break;
        case 'manual_review':
            resolvedData = mergeData(clientData, serverData, excludedFields, rule);
            resolvedData.status = resolvedData.status ?? 'conflict';
            resolvedData.version = Math.max(clientData.version, serverData.version) + 1;
            auditDetails.winner = 'operator_review';
            auditDetails.requiresOperatorReview = true;
            break;
        case 'last_write_wins':
        default: {
            const { clientTime, serverTime } = timestamps(clientData, serverData);
            if (clientTime >= serverTime) {
                resolvedData = {
                    ...clientData,
                    version: Math.max(clientData.version, serverData.version) + 1,
                };
                auditDetails.winner = 'client';
                auditDetails.timeDiff = clientTime - serverTime;
            } else {
                resolvedData = { ...serverData };
                auditDetails.winner = 'server';
                auditDetails.timeDiff = serverTime - clientTime;
            }
            break;
        }
    }

    const nowIso = new Date().toISOString();
    resolvedData.last_modified = nowIso;
    resolvedData.updated_at = nowIso;

    return { resolvedData, strategy: resolvedStrategy, auditDetails };
}

export async function logConflictResolution(params: {
    entityType: string;
    entityId: string;
    conflictType: 'version_mismatch' | 'concurrent_edit' | 'delete_update';
    clientData: Record<string, unknown>;
    serverData: Record<string, unknown>;
    resolvedData: Record<string, unknown>;
    strategy: ConflictStrategy;
    auditDetails: Record<string, unknown>;
    operationType?: string;
}): Promise<void> {
    const db = getPowerSync();
    if (!db) {
        logger.warn('[ConflictResolution] PowerSync not initialized, skipping audit log');
        return;
    }

    try {
        const now = new Date().toISOString();
        const logId = crypto.randomUUID();

        await db.execute(
            `INSERT INTO sync_conflict_logs (
                id, entity_type, entity_id, conflict_type,
                operation_type, payload_json, client_timestamp, server_timestamp,
                resolution_strategy, resolution_details, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                logId,
                params.entityType,
                params.entityId,
                params.conflictType,
                params.operationType ?? null,
                JSON.stringify({
                    clientData: params.clientData,
                    serverData: params.serverData,
                    resolvedData: params.resolvedData,
                }),
                (params.clientData.last_modified as string) ?? now,
                (params.serverData.last_modified as string) ?? now,
                params.strategy,
                JSON.stringify(params.auditDetails),
                now,
            ]
        );
    } catch (error) {
        logger.error('[ConflictResolution] Failed to log conflict resolution', error);
    }
}

export async function handleSyncConflict(params: {
    entityType: string;
    entityId: string;
    clientData: Record<string, unknown> & { version: number; last_modified: string };
    serverData: Record<string, unknown> & { version: number; last_modified: string };
    strategy?: ConflictStrategy;
    operationType?: string;
}): Promise<{
    resolved: boolean;
    resolvedData?: Record<string, unknown>;
    error?: string;
    requiresOperatorReview?: boolean;
}> {
    const { entityType, entityId, clientData, serverData, strategy, operationType } = params;

    try {
        const conflictType = getConflictType(
            clientData as { deleted_at?: string | null; version: number },
            serverData as { deleted_at?: string | null; version: number }
        );
        const {
            resolvedData,
            strategy: usedStrategy,
            auditDetails,
        } = resolveConflict(entityType, clientData, serverData, strategy);

        await logConflictResolution({
            entityType,
            entityId,
            conflictType,
            clientData,
            serverData,
            resolvedData,
            strategy: usedStrategy,
            auditDetails,
            operationType,
        });

        return {
            resolved: true,
            resolvedData,
            requiresOperatorReview: usedStrategy === 'manual_review',
        };
    } catch (error) {
        logger.error('[ConflictResolution] Failed to handle sync conflict', {
            entityType,
            entityId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return {
            resolved: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

export async function getConflictHistory(
    entityType: string,
    entityId: string,
    limit = 10
): Promise<SyncConflictLog[]> {
    const db = getPowerSync();
    if (!db) return [];

    try {
        return await db.getAllAsync<SyncConflictLog>(
            `SELECT * FROM sync_conflict_logs
             WHERE entity_type = ? AND entity_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [entityType, entityId, limit]
        );
    } catch (error) {
        logger.error('[ConflictResolution] Failed to get conflict history', error);
        return [];
    }
}

export async function getUnresolvedConflictsCount(): Promise<number> {
    const db = getPowerSync();
    if (!db) return 0;

    try {
        const [orders, tableSessions, payments] = await Promise.all([
            db.getFirstAsync<{ count: number }>(
                `SELECT COUNT(*) as count FROM orders WHERE status = 'conflict'`
            ),
            db.getFirstAsync<{ count: number }>(
                `SELECT COUNT(*) as count FROM table_sessions WHERE status = 'conflict'`
            ),
            db.getFirstAsync<{ count: number }>(
                `SELECT COUNT(*) as count FROM payments WHERE status = 'review_required'`
            ),
        ]);

        return (
            Number(orders?.count ?? 0) +
            Number(tableSessions?.count ?? 0) +
            Number(payments?.count ?? 0)
        );
    } catch (error) {
        logger.error('[ConflictResolution] Failed to get unresolved conflicts count', error);
        return 0;
    }
}

export async function batchResolveConflicts(
    conflicts: Array<{
        entityType: string;
        entityId: string;
        clientData: Record<string, unknown> & { version: number; last_modified: string };
        serverData: Record<string, unknown> & { version: number; last_modified: string };
        operationType?: string;
    }>
): Promise<{
    resolved: number;
    failed: number;
    manualReview: number;
    errors: string[];
}> {
    let resolved = 0;
    let failed = 0;
    let manualReview = 0;
    const errors: string[] = [];

    for (const conflict of conflicts) {
        const result = await handleSyncConflict(conflict);

        if (result.resolved) {
            resolved++;
            if (result.requiresOperatorReview) {
                manualReview++;
            }
        } else {
            failed++;
            errors.push(`${conflict.entityType}:${conflict.entityId} - ${result.error}`);
        }
    }

    return { resolved, failed, manualReview, errors };
}

export async function reconcileWithServer(params: {
    entityType: string;
    entityId: string;
    serverData: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string }> {
    const db = getPowerSync();
    if (!db) {
        return { success: false, error: 'PowerSync not initialized' };
    }

    try {
        const { entityType, entityId, serverData } = params;
        const now = new Date().toISOString();

        const tableMap: Record<string, string> = {
            orders: 'orders',
            order_items: 'order_items',
            kds_items: 'kds_items',
            kds_order_items: 'kds_items',
            menu_items: 'menu_items',
            tables: 'tables',
            table_sessions: 'table_sessions',
            guests: 'guests',
            payments: 'payments',
            reconciliation_entries: 'reconciliation_entries',
        };

        const tableName = tableMap[entityType];
        if (!tableName) {
            return { success: false, error: `Unknown entity type: ${entityType}` };
        }

        const excludedFields = ['id', 'created_at', 'restaurant_id'];
        const updateFields: string[] = [];
        const updateValues: unknown[] = [];

        for (const [key, value] of Object.entries(serverData)) {
            if (excludedFields.includes(key)) continue;
            updateFields.push(`${key} = ?`);
            updateValues.push(value);
        }

        if (updateFields.length === 0) {
            return { success: true };
        }

        const versionIdx = updateFields.findIndex(field => field.startsWith('version'));
        if (serverData.version !== undefined && versionIdx >= 0) {
            updateValues[versionIdx] = serverData.version;
        } else if (serverData.version !== undefined) {
            updateFields.push('version = ?');
            updateValues.push(serverData.version);
        }

        const lastModifiedIdx = updateFields.findIndex(field => field.startsWith('last_modified'));
        if (lastModifiedIdx >= 0) {
            updateValues[lastModifiedIdx] = serverData.last_modified ?? now;
        } else {
            updateFields.push('last_modified = ?');
            updateValues.push(serverData.last_modified ?? now);
        }

        updateFields.push('updated_at = ?');
        updateValues.push(now);
        updateValues.push(entityId);

        await db.execute(
            `UPDATE ${tableName} SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        return { success: true };
    } catch (error) {
        logger.error('[ConflictResolution] Failed to reconcile with server', {
            entityType: params.entityType,
            entityId: params.entityId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
