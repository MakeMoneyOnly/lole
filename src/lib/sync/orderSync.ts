/**
 * Order Sync Manager
 *
 * CRIT-05: Offline sync consolidation for POS
 * Replaces Dexie.js order queue with PowerSync-backed sync
 *
 * HIGH-006: Integrated conflict resolution for order sync
 */

import { getPowerSync } from './powersync-config';
import { generateIdempotencyKey, queueSyncOperationInDatabase } from './idempotency';
import {
    buildFireOfflineOrderCourseCommand,
    buildCreateOfflineOrderCommand,
    buildDeleteOfflineOrderCommand,
    buildUpdateOfflineOrderStatusCommand,
    type OfflineOrderDraft,
    type OfflineOrderCommandContext,
} from '@/lib/domain/orders/commands';
import { allocateOfflineOrderNumber } from '@/lib/domain/core/identifiers';
import { resolveCoursePacing } from '@/lib/domain/orders/course-pacing';
import { appendLocalJournalEntryInDatabase } from '@/lib/journal/local-journal';
import {
    resolveConflict,
    logConflictResolution,
    getConflictType,
    type ConflictStrategy,
} from './conflict-resolution';
import { logger } from '@/lib/logger';

/**
 * Order status for offline tracking
 */
export type OfflineOrderStatus =
    | 'payment_pending'
    | 'pending'
    | 'acknowledged'
    | 'preparing'
    | 'ready'
    | 'served'
    | 'completed'
    | 'cancelled'
    | 'syncing'
    | 'conflict'
    | 'resolved';

/**
 * Order item for offline storage
 */
export interface OfflineOrderItem {
    id: string;
    order_id: string;
    menu_item_id: string;
    menu_item_name: string;
    menu_item_name_am?: string;
    quantity: number;
    unit_price_santim: number;
    total_price_santim: number;
    modifiers_json?: string;
    notes?: string;
    status: string;
    station?: string;
    fired_at?: string;
    created_at: string;
    synced_at?: string;
}

/**
 * Order for offline storage
 */
export interface OfflineOrder {
    id: string;
    restaurant_id: string;
    order_number: number;
    table_number?: number;
    guest_name?: string;
    guest_phone?: string;
    status: OfflineOrderStatus;
    order_type: string;
    subtotal_santim: number;
    discount_santim: number;
    vat_santim: number;
    total_santim: number;
    notes?: string;
    idempotency_key: string;
    guest_fingerprint?: string;
    created_at: string;
    updated_at: string;
    synced_at?: string;
    last_modified: string;
    version: number;
    items?: OfflineOrderItem[];
    fire_mode?: string | null;
    current_course?: string | null;
}

function isOrderFireMode(value: string | null | undefined): value is 'auto' | 'manual' {
    return value === 'auto' || value === 'manual';
}

function isOrderCourseName(
    value: string | null | undefined
): value is 'appetizer' | 'main' | 'dessert' | 'beverage' | 'side' {
    return (
        value === 'appetizer' ||
        value === 'main' ||
        value === 'dessert' ||
        value === 'beverage' ||
        value === 'side'
    );
}

function getOfflineOrderCommandContext(restaurantId: string): OfflineOrderCommandContext {
    return {
        restaurantId,
        locationId: process.env.NEXT_PUBLIC_LOCATION_ID ?? 'default-location',
        deviceId: process.env.NEXT_PUBLIC_DEVICE_ID ?? 'offline-device',
        actor: {
            actorId: process.env.NEXT_PUBLIC_DEVICE_ID ?? 'offline-device',
            actorType: 'device',
        },
    };
}

async function appendOrderCommandJournal(
    db: NonNullable<ReturnType<typeof getPowerSync>>,
    input: {
        restaurantId: string;
        aggregateId: string;
        operationType: 'order.create' | 'order.update' | 'order.delete' | 'order.fire_course';
        idempotencyKey: string;
        payload: Record<string, unknown>;
    }
): Promise<void> {
    const context = getOfflineOrderCommandContext(input.restaurantId);

    await appendLocalJournalEntryInDatabase(db, {
        restaurantId: context.restaurantId,
        locationId: context.locationId,
        deviceId: context.deviceId,
        actorId: context.actor.actorId,
        entryKind: 'command',
        aggregateType: 'order',
        aggregateId: input.aggregateId,
        operationType: input.operationType,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
    });
}

/**
 * Create a new order locally (offline-first)
 */
export async function createOfflineOrder(
    orderData: OfflineOrderDraft,
    guestFingerprint?: string
): Promise<{ success: boolean; order?: OfflineOrder; error?: string }> {
    const db = getPowerSync();
    if (!db) {
        return { success: false, error: 'PowerSync not initialized' };
    }

    const idempotencyKey = generateIdempotencyKey('order');
    const now = new Date().toISOString();
    const orderId = crypto.randomUUID();
    const commandContext = getOfflineOrderCommandContext(orderData.restaurant_id);

    try {
        const orderNumber = await allocateOfflineOrderNumber(db, {
            restaurantId: orderData.restaurant_id,
            locationId: commandContext.locationId,
            deviceId: commandContext.deviceId,
        });
        const createCommand = buildCreateOfflineOrderCommand(
            commandContext,
            {
                ...orderData,
                order_id: orderId,
                order_number: orderNumber,
                guest_fingerprint: guestFingerprint,
            },
            idempotencyKey
        );

        await db.write(async () => {
            await appendOrderCommandJournal(db, {
                restaurantId: orderData.restaurant_id,
                aggregateId: orderId,
                operationType: 'order.create',
                idempotencyKey,
                payload: createCommand as unknown as Record<string, unknown>,
            });

            await db.execute(
                `INSERT INTO orders (
                    id, restaurant_id, order_number, table_number, guest_name, guest_phone,
                    status, order_type, subtotal_santim, discount_santim, vat_santim, total_santim,
                    notes, idempotency_key, guest_fingerprint, created_at, updated_at, last_modified, version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderId,
                    orderData.restaurant_id,
                    orderNumber,
                    orderData.table_number ?? null,
                    orderData.guest_name ?? null,
                    orderData.guest_phone ?? null,
                    'pending',
                    orderData.order_type ?? 'dine_in',
                    orderData.subtotal_santim,
                    orderData.discount_santim ?? 0,
                    orderData.vat_santim,
                    orderData.total_santim,
                    orderData.notes ?? null,
                    idempotencyKey,
                    guestFingerprint ?? null,
                    now,
                    now,
                    now,
                    1,
                ]
            );

            for (const item of orderData.items) {
                const itemId = crypto.randomUUID();
                await db.execute(
                    `INSERT INTO order_items (
                        id, order_id, menu_item_id, menu_item_name, menu_item_name_am,
                        quantity, unit_price_santim, total_price_santim, modifiers_json,
                        notes, status, station, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        itemId,
                        orderId,
                        item.menu_item_id,
                        item.menu_item_name,
                        item.menu_item_name_am ?? null,
                        item.quantity,
                        item.unit_price_santim,
                        item.total_price_santim,
                        item.modifiers_json ?? null,
                        item.notes ?? null,
                        'pending',
                        item.station ?? null,
                        now,
                    ]
                );
            }

            await queueSyncOperationInDatabase(
                db,
                'create',
                'orders',
                orderId,
                {
                    ...orderData,
                    id: orderId,
                    idempotency_key: idempotencyKey,
                    domain_command: createCommand,
                },
                {
                    restaurantId: orderData.restaurant_id,
                    locationId: commandContext.locationId,
                    deviceId: commandContext.deviceId,
                    actorId: commandContext.actor.actorId,
                }
            );
        });

        const order = await getOfflineOrder(orderId);

        return { success: true, order: order! };
    } catch (error) {
        logger.error('[OrderSync] Failed to create offline order', {
            error: error instanceof Error ? error.message : String(error),
        });
        return { success: false, error: String(error) };
    }
}

/**
 * Get an order by ID
 */
export async function getOfflineOrder(orderId: string): Promise<OfflineOrder | null> {
    const db = getPowerSync();
    if (!db) return null;

    const order = await db.getFirstAsync<OfflineOrder>(`SELECT * FROM orders WHERE id = ?`, [
        orderId,
    ]);

    if (!order) return null;

    // Get order items
    const items = await db.getAllAsync<OfflineOrderItem>(
        `SELECT * FROM order_items WHERE order_id = ?`,
        [orderId]
    );

    return { ...order, items };
}

/**
 * Get all pending orders
 */
export async function getPendingOfflineOrders(): Promise<OfflineOrder[]> {
    const db = getPowerSync();
    if (!db) return [];

    const orders = await db.getAllAsync<OfflineOrder>(
        `SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC`
    );

    return orders;
}

/**
 * Update order status
 */
export async function updateOfflineOrderStatus(
    orderId: string,
    status: OfflineOrderStatus
): Promise<boolean> {
    const db = getPowerSync();
    if (!db) return false;

    const now = new Date().toISOString();

    try {
        const existingOrder = await getOfflineOrder(orderId);
        if (!existingOrder) {
            return false;
        }

        const commandContext = getOfflineOrderCommandContext(existingOrder.restaurant_id);
        const idempotencyKey = generateIdempotencyKey('order-update');
        const updateCommand = buildUpdateOfflineOrderStatusCommand(
            commandContext,
            {
                order_id: orderId,
                status,
            },
            idempotencyKey
        );

        await db.write(async () => {
            await appendOrderCommandJournal(db, {
                restaurantId: existingOrder.restaurant_id,
                aggregateId: orderId,
                operationType: 'order.update',
                idempotencyKey,
                payload: updateCommand as unknown as Record<string, unknown>,
            });

            await db.execute(
                `UPDATE orders SET status = ?, updated_at = ?, last_modified = ?, version = version + 1 WHERE id = ?`,
                [status, now, now, orderId]
            );

            await queueSyncOperationInDatabase(
                db,
                'update',
                'orders',
                orderId,
                { status, domain_command: updateCommand },
                {
                    restaurantId: existingOrder.restaurant_id,
                    locationId: commandContext.locationId,
                    deviceId: commandContext.deviceId,
                    actorId: commandContext.actor.actorId,
                }
            );
        });

        return true;
    } catch (error) {
        logger.error('[OrderSync] Failed to update order status', {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}

export async function updateOfflineOrderCourseFire(
    orderId: string,
    input: {
        fire_mode?: 'auto' | 'manual';
        current_course?: 'appetizer' | 'main' | 'dessert' | 'beverage' | 'side';
    }
): Promise<boolean> {
    const db = getPowerSync();
    if (!db) return false;

    const now = new Date().toISOString();

    try {
        const existingOrder = await getOfflineOrder(orderId);
        if (!existingOrder) {
            return false;
        }

        const commandContext = getOfflineOrderCommandContext(existingOrder.restaurant_id);
        const idempotencyKey = generateIdempotencyKey('order-course-fire');
        const pacing = resolveCoursePacing({
            currentStatus: existingOrder.status,
            existingFireMode: isOrderFireMode(existingOrder.fire_mode)
                ? existingOrder.fire_mode
                : undefined,
            existingCourse: isOrderCourseName(existingOrder.current_course)
                ? existingOrder.current_course
                : undefined,
            requestedFireMode: input.fire_mode,
            requestedCourse: input.current_course,
        });
        const nextOrderStatus = pacing.nextOrderStatus as OfflineOrderStatus;
        const updateCommand = buildFireOfflineOrderCourseCommand(
            commandContext,
            {
                order_id: orderId,
                status: nextOrderStatus,
                fire_mode: pacing.fireMode,
                current_course: pacing.currentCourse,
            },
            idempotencyKey
        );

        await db.write(async () => {
            await appendOrderCommandJournal(db, {
                restaurantId: existingOrder.restaurant_id,
                aggregateId: orderId,
                operationType: 'order.fire_course',
                idempotencyKey,
                payload: updateCommand as unknown as Record<string, unknown>,
            });

            await db.execute(
                `UPDATE orders
                 SET status = ?,
                     fire_mode = ?,
                     current_course = ?,
                     updated_at = ?,
                     last_modified = ?,
                     version = version + 1
                 WHERE id = ?`,
                [nextOrderStatus, pacing.fireMode, pacing.currentCourse, now, now, orderId]
            );

            await queueSyncOperationInDatabase(
                db,
                'update',
                'orders',
                orderId,
                {
                    status: nextOrderStatus,
                    fire_mode: pacing.fireMode,
                    current_course: pacing.currentCourse,
                    domain_command: updateCommand,
                },
                {
                    restaurantId: existingOrder.restaurant_id,
                    locationId: commandContext.locationId,
                    deviceId: commandContext.deviceId,
                    actorId: commandContext.actor.actorId,
                }
            );
        });

        return true;
    } catch (error) {
        logger.error('[OrderSync] Failed to update order course fire', {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}

/**
 * Delete an order (soft delete for sync)
 */
export async function deleteOfflineOrder(orderId: string): Promise<boolean> {
    const db = getPowerSync();
    if (!db) return false;

    const now = new Date().toISOString();

    try {
        const existingOrder = await getOfflineOrder(orderId);
        if (!existingOrder) {
            return false;
        }

        const commandContext = getOfflineOrderCommandContext(existingOrder.restaurant_id);
        const idempotencyKey = generateIdempotencyKey('order-delete');
        const deleteCommand = buildDeleteOfflineOrderCommand(
            commandContext,
            {
                order_id: orderId,
                status: 'cancelled',
            },
            idempotencyKey
        );

        await db.write(async () => {
            await appendOrderCommandJournal(db, {
                restaurantId: existingOrder.restaurant_id,
                aggregateId: orderId,
                operationType: 'order.delete',
                idempotencyKey,
                payload: deleteCommand as unknown as Record<string, unknown>,
            });

            await db.execute(
                `UPDATE orders SET status = 'cancelled', updated_at = ?, last_modified = ?, version = version + 1 WHERE id = ?`,
                [now, now, orderId]
            );

            await queueSyncOperationInDatabase(
                db,
                'delete',
                'orders',
                orderId,
                {
                    status: 'cancelled',
                    domain_command: deleteCommand,
                },
                {
                    restaurantId: existingOrder.restaurant_id,
                    locationId: commandContext.locationId,
                    deviceId: commandContext.deviceId,
                    actorId: commandContext.actor.actorId,
                }
            );
        });

        return true;
    } catch (error) {
        logger.error('[OrderSync] Failed to delete order', {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}

/**
 * Get orders by restaurant
 */
export async function getOfflineOrdersByRestaurant(
    restaurantId: string,
    limit: number = 50
): Promise<OfflineOrder[]> {
    const db = getPowerSync();
    if (!db) return [];

    const orders = await db.getAllAsync<OfflineOrder>(
        `SELECT * FROM orders WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT ?`,
        [restaurantId, limit]
    );

    return orders;
}

/**
 * Get orders count by status
 */
export async function getOfflineOrdersCountByStatus(
    restaurantId?: string
): Promise<Record<OfflineOrderStatus, number>> {
    const db = getPowerSync();
    if (!db) {
        return {
            payment_pending: 0,
            pending: 0,
            acknowledged: 0,
            preparing: 0,
            ready: 0,
            served: 0,
            completed: 0,
            cancelled: 0,
            syncing: 0,
            conflict: 0,
            resolved: 0,
        };
    }

    let query = `SELECT status, COUNT(*) as count FROM orders`;
    const params: string[] = [];

    if (restaurantId) {
        query += ` WHERE restaurant_id = ?`;
        params.push(restaurantId);
    }

    query += ` GROUP BY status`;

    const results = await db.getAllAsync<{ status: OfflineOrderStatus; count: number }>(
        query,
        params
    );

    const counts: Record<OfflineOrderStatus, number> = {
        payment_pending: 0,
        pending: 0,
        acknowledged: 0,
        preparing: 0,
        ready: 0,
        served: 0,
        completed: 0,
        cancelled: 0,
        syncing: 0,
        conflict: 0,
        resolved: 0,
    };

    for (const row of results) {
        const status = row.status as OfflineOrderStatus;
        if (status in counts) {
            counts[status] = row.count;
        }
    }

    return counts;
}

/**
 * Clear all pending orders (for testing)
 */
export async function clearOfflineOrders(): Promise<void> {
    const db = getPowerSync();
    if (!db) return;

    await db.write(async () => {
        await db.execute(`DELETE FROM order_items`);
        await db.execute(`DELETE FROM orders`);
        await db.execute(`DELETE FROM sync_queue`);
    });
}

// ============================================================================
// HIGH-006: Conflict Resolution Integration
// ============================================================================

/**
 * Order conflict resolution result
 */
export interface OrderConflictResult {
    resolved: boolean;
    strategy: ConflictStrategy;
    resolvedData?: OfflineOrder;
    error?: string;
    conflictType?: 'version_mismatch' | 'concurrent_edit' | 'delete_update';
}

/**
 * Resolve order sync conflict
 *
 * Uses last-write-wins for non-critical fields (names, notes)
 * and server-wins for financial data (prices, totals)
 *
 * @param orderId - The order ID with conflict
 * @param clientData - Local/client order data
 * @param serverData - Server order data
 * @param preferredStrategy - Optional override strategy
 */
export async function resolveOrderConflict(
    orderId: string,
    clientData: OfflineOrder & { version: number; last_modified: string },
    serverData: Record<string, unknown> & { version: number; last_modified: string },
    preferredStrategy?: ConflictStrategy
): Promise<OrderConflictResult> {
    const db = getPowerSync();
    if (!db) {
        return {
            resolved: false,
            strategy: 'last_write_wins',
            error: 'PowerSync not initialized',
        };
    }

    try {
        // Detect conflict type
        const conflictType = getConflictType(
            clientData as { deleted_at?: string | null; version: number },
            serverData as { deleted_at?: string | null; version: number }
        );

        // Determine strategy based on data type
        // Server wins for financial data, last-write-wins for other fields
        const strategy: ConflictStrategy = preferredStrategy ?? 'last_write_wins';

        // Resolve the conflict
        const {
            resolvedData,
            strategy: usedStrategy,
            auditDetails,
        } = resolveConflict(
            'orders',
            clientData as unknown as Record<string, unknown> & {
                version: number;
                last_modified: string;
            },
            serverData,
            strategy
        );

        // Apply financial data protection - server wins for prices
        if (strategy === 'last_write_wins') {
            // Override financial fields with server values
            resolvedData.subtotal_santim = serverData.subtotal_santim ?? clientData.subtotal_santim;
            resolvedData.discount_santim = serverData.discount_santim ?? clientData.discount_santim;
            resolvedData.vat_santim = serverData.vat_santim ?? clientData.vat_santim;
            resolvedData.total_santim = serverData.total_santim ?? clientData.total_santim;
        }

        // Update local record with resolved data
        const now = new Date().toISOString();
        await db.execute(
            `UPDATE orders SET
                status = 'resolved',
                version = ?,
                last_modified = ?,
                updated_at = ?,
                subtotal_santim = ?,
                discount_santim = ?,
                vat_santim = ?,
                total_santim = ?,
                guest_name = ?,
                guest_phone = ?,
                notes = ?,
                table_number = ?
            WHERE id = ?`,
            [
                resolvedData.version,
                resolvedData.last_modified,
                now,
                resolvedData.subtotal_santim,
                resolvedData.discount_santim ?? 0,
                resolvedData.vat_santim,
                resolvedData.total_santim,
                resolvedData.guest_name ?? null,
                resolvedData.guest_phone ?? null,
                resolvedData.notes ?? null,
                resolvedData.table_number ?? null,
                orderId,
            ]
        );

        // Log conflict resolution to sync_conflict_logs table
        await logConflictResolution({
            entityType: 'orders',
            entityId: orderId,
            conflictType,
            clientData: clientData as unknown as Record<string, unknown>,
            serverData,
            resolvedData,
            strategy: usedStrategy,
            auditDetails,
        });

        // Also log to audit_logs for compliance
        await logOrderConflictToAuditLog(
            orderId,
            clientData,
            serverData,
            usedStrategy,
            auditDetails
        );

        logger.info('[OrderSync] Conflict resolved', {
            orderId,
            strategy: usedStrategy,
            conflictType,
            winner: auditDetails.winner,
        });

        // Get the resolved order
        const resolvedOrder = await getOfflineOrder(orderId);

        return {
            resolved: true,
            strategy: usedStrategy,
            resolvedData: resolvedOrder ?? undefined,
            conflictType,
        };
    } catch (error) {
        logger.error('[OrderSync] Failed to resolve conflict', {
            orderId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return {
            resolved: false,
            strategy: preferredStrategy ?? 'last_write_wins',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Log order conflict to audit_logs table for compliance
 */
async function logOrderConflictToAuditLog(
    orderId: string,
    clientData: OfflineOrder,
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
                clientData.restaurant_id,
                `sync_conflict:${strategy}`,
                'orders',
                orderId,
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
        logger.error('[OrderSync] Failed to log conflict to audit_logs', {
            orderId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

/**
 * Get orders with conflict status
 */
export async function getConflictedOrders(restaurantId?: string): Promise<OfflineOrder[]> {
    const db = getPowerSync();
    if (!db) return [];

    let query = `SELECT * FROM orders WHERE status = 'conflict'`;
    const params: string[] = [];

    if (restaurantId) {
        query += ` AND restaurant_id = ?`;
        params.push(restaurantId);
    }

    query += ` ORDER BY updated_at DESC`;

    const orders = await db.getAllAsync<OfflineOrder>(query, params);
    return orders;
}

/**
 * Mark order as having a conflict (for manual resolution)
 */
export async function markOrderConflict(orderId: string, reason?: string): Promise<boolean> {
    const db = getPowerSync();
    if (!db) return false;

    const now = new Date().toISOString();

    try {
        await db.execute(
            `UPDATE orders SET status = 'conflict', updated_at = ?, last_modified = ? WHERE id = ?`,
            [now, now, orderId]
        );

        logger.warn('[OrderSync] Order marked as conflict', { orderId, reason });
        return true;
    } catch (error) {
        logger.error('[OrderSync] Failed to mark order as conflict', {
            orderId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false;
    }
}

/**
 * Batch resolve multiple order conflicts
 */
export async function batchResolveOrderConflicts(
    conflicts: Array<{
        orderId: string;
        clientData: OfflineOrder & { version: number; last_modified: string };
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
        const result = await resolveOrderConflict(
            conflict.orderId,
            conflict.clientData,
            conflict.serverData
        );

        if (result.resolved) {
            resolved++;
        } else {
            failed++;
            errors.push(`${conflict.orderId}: ${result.error}`);
        }
    }

    logger.info('[OrderSync] Batch conflict resolution complete', {
        total: conflicts.length,
        resolved,
        failed,
    });

    return { resolved, failed, errors };
}
