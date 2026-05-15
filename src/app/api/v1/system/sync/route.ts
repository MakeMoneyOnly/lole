/**
 * Sync API Endpoint
 *
 * CRIT-05: PowerSync sync worker API for offline-first functionality
 * Handles bidirectional sync between client PowerSync DB and server
 *
 * Features:
 * - Authentication via user session or device token
 * - Tenant scoping (restaurant_id) for all operations
 * - Conflict resolution with last-write-wins strategy
 * - Idempotency key handling for mutations
 * - Batch operation support
 *
 * @see docs/08-reports/architecture/architecture-scalability-audit-report-2026-03-23.md
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser, getDeviceContext } from '@/lib/api/authz';
import { apiSuccess, apiError } from '@/lib/api/response';
import { parseJsonBody } from '@/lib/api/validation';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { logSecurityEvent } from '@/lib/security/securityEvents';
import {
    detectConflict,
    resolveConflict,
    logConflictResolution,
    type ConflictStrategy,
} from '@/lib/sync/conflict-resolution';
import { logger } from '@/lib/logger';

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Sync operation types
 */
const SyncOperationSchema = z.enum(['create', 'update', 'delete']);

/**
 * Single sync operation payload
 */
const SyncOperationPayloadSchema = z.object({
    id: z.string().uuid(),
    operation: SyncOperationSchema,
    tableName: z.string().min(1).max(100),
    recordId: z.string().min(1).max(100),
    data: z.record(z.string(), z.unknown()),
    version: z.number().int().positive().optional().default(1),
    lastModified: z.string().datetime(),
    idempotencyKey: z.string().min(1).max(200),
    restaurantId: z.string().uuid(),
});

/**
 * Batch sync request schema
 */
const SyncRequestSchema = z.object({
    operations: z.array(SyncOperationPayloadSchema).min(1).max(50),
    clientId: z.string().min(1).max(100),
    lastSyncAt: z.string().datetime().optional(),
});

/**
 * Sync status query params
 */
const SyncStatusQuerySchema = z.object({
    restaurantId: z.string().uuid().optional(),
    since: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Sync operation result
 */
interface SyncOperationResult {
    id: string;
    success: boolean;
    error?: string;
    conflict?: {
        detected: boolean;
        resolved: boolean;
        strategy: ConflictStrategy;
        serverVersion?: number;
        clientVersion?: number;
    };
    serverData?: Record<string, unknown>;
}

// ============================================================================
// Table-to-Supabase mapping for sync operations
// ============================================================================

const TABLE_MAPPING: Record<string, { table: string; usesVersion: boolean }> = {
    orders: { table: 'orders', usesVersion: true },
    order_items: { table: 'order_items', usesVersion: true },
    kds_items: { table: 'kds_order_items', usesVersion: true },
    tables: { table: 'tables', usesVersion: true },
    guests: { table: 'guests', usesVersion: true },
    menu_items: { table: 'menu_items', usesVersion: true },
    time_entries: { table: 'time_entries', usesVersion: false },
    tip_allocations: { table: 'tip_allocations', usesVersion: false },
};

// Tables that require special conflict handling
const CONFLICT_STRATEGIES: Record<string, ConflictStrategy> = {
    orders: 'last_write_wins',
    order_items: 'last_write_wins',
    kds_items: 'server_wins', // KDS status reflects actual kitchen state
    tables: 'last_write_wins',
    guests: 'last_write_wins',
    menu_items: 'server_wins', // Menu changes should come from server
    time_entries: 'last_write_wins',
    tip_allocations: 'last_write_wins',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get authentication context - supports both user session and device token
 */
async function getSyncAuthContext(
    request: NextRequest
): Promise<
    | { ok: true; restaurantId: string; userId?: string; deviceId?: string }
    | { ok: false; response: ReturnType<typeof apiError> }
> {
    // Try device context first (for POS/KDS devices)
    const deviceContext = await getDeviceContext(request);
    if (deviceContext.ok) {
        return {
            ok: true,
            restaurantId: deviceContext.restaurantId,
            deviceId: deviceContext.device.id,
        };
    }

    // Fall back to user authentication
    const userAuth = await getAuthenticatedUser();
    if (!userAuth.ok) {
        return { ok: false, response: userAuth.response };
    }

    // Get user's restaurant context
    const admin = createServiceRoleClient();
    const { data: staffEntry, error } = await admin
        .from('restaurant_staff')
        .select('restaurant_id')
        .eq('user_id', userAuth.user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !staffEntry?.restaurant_id) {
        return {
            ok: false,
            response: apiError('No restaurant context found', 404, 'RESTAURANT_NOT_FOUND'),
        };
    }

    return {
        ok: true,
        restaurantId: staffEntry.restaurant_id,
        userId: userAuth.user.id,
    };
}

/**
 * Check if an idempotency key has already been processed
 */
async function checkIdempotencyKey(
    idempotencyKey: string,
    restaurantId: string
): Promise<{ used: boolean; result?: SyncOperationResult }> {
    const admin = createServiceRoleClient();

    const { data, error } = await admin
        .from('sync_idempotency_keys')
        .select('result_data')
        .eq('idempotency_key', idempotencyKey)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

    if (error) {
        logger.error('[SyncAPI] Error checking idempotency key', { error, idempotencyKey });
        return { used: false };
    }

    if (data?.result_data) {
        return { used: true, result: data.result_data as unknown as SyncOperationResult };
    }

    return { used: false };
}

/**
 * Record idempotency key usage
 */
async function recordIdempotencyKey(
    idempotencyKey: string,
    restaurantId: string,
    result: SyncOperationResult,
    operationType: string = 'sync'
): Promise<void> {
    const admin = createServiceRoleClient();

    await admin.from('sync_idempotency_keys').insert({
        idempotency_key: idempotencyKey,
        restaurant_id: restaurantId,
        operation_type: operationType,
        result_data: result,
        processed_at: new Date().toISOString(),
    });
}

/**
 * Get server version of a record for conflict detection
 */
async function getServerRecord(
    tableName: string,
    recordId: string,
    restaurantId: string
): Promise<{ version: number; lastModified: string; data: Record<string, unknown> } | null> {
    const tableConfig = TABLE_MAPPING[tableName];
    if (!tableConfig) {
        return null;
    }

    const admin = createServiceRoleClient();

    const { data, error } = await admin
        .from(tableConfig.table)
        .select(tableConfig.usesVersion ? 'version, updated_at, *' : 'updated_at, *')
        .eq('id', recordId)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

    if (error || !data) {
        return null;
    }

    const serverData = data as unknown as Record<string, unknown>;

    return {
        version: tableConfig.usesVersion ? Number(serverData.version ?? 1) : 1,
        lastModified: (serverData.updated_at as string | undefined) ?? new Date().toISOString(),
        data: serverData,
    };
}

/**
 * Process a single sync operation
 */
async function processSyncOperation(
    op: z.infer<typeof SyncOperationPayloadSchema>,
    restaurantId: string
): Promise<SyncOperationResult> {
    const tableConfig = TABLE_MAPPING[op.tableName];
    if (!tableConfig) {
        return {
            id: op.id,
            success: false,
            error: `Unknown table: ${op.tableName}`,
        };
    }

    // Verify tenant ownership
    if (op.restaurantId !== restaurantId) {
        logSecurityEvent({
            type: 'tenant_isolation_violation',
            severity: 'high',
            ipAddress: 'server',
            userAgent: 'sync-api',
            restaurantId,
            timestamp: new Date(),
            metadata: {
                attemptedRestaurantId: op.restaurantId,
                authorizedRestaurantId: restaurantId,
                tableName: op.tableName,
                recordId: op.recordId,
            },
        });

        return {
            id: op.id,
            success: false,
            error: 'Tenant isolation violation',
        };
    }

    // Check idempotency
    const { used, result: cachedResult } = await checkIdempotencyKey(
        op.idempotencyKey,
        restaurantId
    );
    if (used && cachedResult) {
        logger.info('[SyncAPI] Returning cached result for idempotency key', {
            idempotencyKey: op.idempotencyKey,
        });
        return cachedResult;
    }

    const admin = createServiceRoleClient();
    const strategy = CONFLICT_STRATEGIES[op.tableName] || 'last_write_wins';

    try {
        // Handle different operations
        if (op.operation === 'create') {
            // For create, check if record already exists (conflict)
            const existingRecord = await getServerRecord(op.tableName, op.recordId, restaurantId);

            if (existingRecord) {
                // Record exists - this is a conflict
                const conflictDetected = detectConflict(
                    { version: op.version, last_modified: op.lastModified },
                    { version: existingRecord.version, last_modified: existingRecord.lastModified }
                );

                if (conflictDetected) {
                    const {
                        resolvedData,
                        strategy: usedStrategy,
                        auditDetails,
                    } = resolveConflict(
                        op.tableName,
                        { ...op.data, version: op.version, last_modified: op.lastModified },
                        {
                            ...existingRecord.data,
                            version: existingRecord.version,
                            last_modified: existingRecord.lastModified,
                        },
                        strategy
                    );

                    // Log conflict resolution
                    await logConflictResolution({
                        entityType: op.tableName,
                        entityId: op.recordId,
                        conflictType: 'concurrent_edit',
                        clientData: op.data,
                        serverData: existingRecord.data,
                        resolvedData,
                        strategy: usedStrategy,
                        auditDetails,
                    });

                    // Update with resolved data
                    const { error: updateError } = await admin
                        .from(tableConfig.table)
                        .update({
                            ...resolvedData,
                            ...(tableConfig.usesVersion
                                ? { version: existingRecord.version + 1 }
                                : {}),
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', op.recordId)
                        .eq('restaurant_id', restaurantId);

                    if (updateError) {
                        return {
                            id: op.id,
                            success: false,
                            error: updateError.message,
                            conflict: {
                                detected: true,
                                resolved: false,
                                strategy,
                                serverVersion: existingRecord.version,
                                clientVersion: op.version,
                            },
                        };
                    }

                    const result: SyncOperationResult = {
                        id: op.id,
                        success: true,
                        conflict: {
                            detected: true,
                            resolved: true,
                            strategy,
                            serverVersion: existingRecord.version,
                            clientVersion: op.version,
                        },
                    };

                    await recordIdempotencyKey(op.idempotencyKey, restaurantId, result);
                    return result;
                }
            }

            // No conflict - insert new record
            const { error: insertError } = await admin.from(tableConfig.table).insert({
                ...op.data,
                id: op.recordId,
                restaurant_id: restaurantId,
                ...(tableConfig.usesVersion ? { version: 1 } : {}),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });

            if (insertError) {
                // Check if it's a duplicate key error (race condition)
                if (insertError.code === '23505') {
                    // Record was created by another process - fetch and return
                    const serverRecord = await getServerRecord(
                        op.tableName,
                        op.recordId,
                        restaurantId
                    );
                    return {
                        id: op.id,
                        success: true,
                        conflict: {
                            detected: true,
                            resolved: true,
                            strategy: 'server_wins',
                            serverVersion: serverRecord?.version,
                            clientVersion: op.version,
                        },
                        serverData: serverRecord?.data,
                    };
                }

                return {
                    id: op.id,
                    success: false,
                    error: insertError.message,
                };
            }

            const result: SyncOperationResult = { id: op.id, success: true };
            await recordIdempotencyKey(op.idempotencyKey, restaurantId, result);
            return result;
        }

        if (op.operation === 'update') {
            // Get current server record for conflict detection
            const serverRecord = await getServerRecord(op.tableName, op.recordId, restaurantId);

            if (!serverRecord) {
                // Record doesn't exist - treat as create
                const { error: insertError } = await admin.from(tableConfig.table).insert({
                    ...op.data,
                    id: op.recordId,
                    restaurant_id: restaurantId,
                    ...(tableConfig.usesVersion ? { version: 1 } : {}),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });

                if (insertError) {
                    return {
                        id: op.id,
                        success: false,
                        error: `Record not found and insert failed: ${insertError.message}`,
                    };
                }

                const result: SyncOperationResult = { id: op.id, success: true };
                await recordIdempotencyKey(op.idempotencyKey, restaurantId, result);
                return result;
            }

            // Check for conflict
            const conflictDetected = detectConflict(
                { version: op.version, last_modified: op.lastModified },
                { version: serverRecord.version, last_modified: serverRecord.lastModified }
            );

            if (conflictDetected) {
                const {
                    resolvedData,
                    strategy: usedStrategy,
                    auditDetails,
                } = resolveConflict(
                    op.tableName,
                    { ...op.data, version: op.version, last_modified: op.lastModified },
                    {
                        ...serverRecord.data,
                        version: serverRecord.version,
                        last_modified: serverRecord.lastModified,
                    },
                    strategy
                );

                // Log conflict resolution
                await logConflictResolution({
                    entityType: op.tableName,
                    entityId: op.recordId,
                    conflictType: 'concurrent_edit',
                    clientData: op.data,
                    serverData: serverRecord.data,
                    resolvedData,
                    strategy: usedStrategy,
                    auditDetails,
                });

                // Update with resolved data
                const { error: updateError } = await admin
                    .from(tableConfig.table)
                    .update({
                        ...resolvedData,
                        ...(tableConfig.usesVersion ? { version: serverRecord.version + 1 } : {}),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', op.recordId)
                    .eq('restaurant_id', restaurantId);

                if (updateError) {
                    return {
                        id: op.id,
                        success: false,
                        error: updateError.message,
                        conflict: {
                            detected: true,
                            resolved: false,
                            strategy,
                            serverVersion: serverRecord.version,
                            clientVersion: op.version,
                        },
                    };
                }

                const result: SyncOperationResult = {
                    id: op.id,
                    success: true,
                    conflict: {
                        detected: true,
                        resolved: true,
                        strategy,
                        serverVersion: serverRecord.version,
                        clientVersion: op.version,
                    },
                };

                await recordIdempotencyKey(op.idempotencyKey, restaurantId, result);
                return result;
            }

            // No conflict - simple update
            const { error: updateError } = await admin
                .from(tableConfig.table)
                .update({
                    ...op.data,
                    ...(tableConfig.usesVersion ? { version: serverRecord.version + 1 } : {}),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', op.recordId)
                .eq('restaurant_id', restaurantId);

            if (updateError) {
                return {
                    id: op.id,
                    success: false,
                    error: updateError.message,
                };
            }

            const result: SyncOperationResult = { id: op.id, success: true };
            await recordIdempotencyKey(op.idempotencyKey, restaurantId, result);
            return result;
        }

        if (op.operation === 'delete') {
            // Verify record exists and belongs to tenant
            const serverRecord = await getServerRecord(op.tableName, op.recordId, restaurantId);

            if (!serverRecord) {
                // Already deleted or never existed - consider success
                const result: SyncOperationResult = { id: op.id, success: true };
                await recordIdempotencyKey(op.idempotencyKey, restaurantId, result);
                return result;
            }

            // Soft delete by setting deleted_at
            const { error: deleteError } = await admin
                .from(tableConfig.table)
                .update({
                    deleted_at: new Date().toISOString(),
                    ...(tableConfig.usesVersion ? { version: serverRecord.version + 1 } : {}),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', op.recordId)
                .eq('restaurant_id', restaurantId);

            if (deleteError) {
                return {
                    id: op.id,
                    success: false,
                    error: deleteError.message,
                };
            }

            const result: SyncOperationResult = { id: op.id, success: true };
            await recordIdempotencyKey(op.idempotencyKey, restaurantId, result);
            return result;
        }

        return {
            id: op.id,
            success: false,
            error: `Unknown operation: ${op.operation}`,
        };
    } catch (error) {
        logger.error('[SyncAPI] Error processing sync operation', {
            error,
            operationId: op.id,
            tableName: op.tableName,
            recordId: op.recordId,
        });

        return {
            id: op.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ============================================================================
// API Route Handlers
// ============================================================================

/**
 * POST /api/v1/system/sync
 * Process a batch of sync operations from client
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now();

    // Authenticate request
    const authContext = await getSyncAuthContext(request);
    if (!authContext.ok) {
        return authContext.response as ReturnType<typeof apiError>;
    }

    const { restaurantId, userId, deviceId } = authContext;

    // Parse and validate request body
    const parsed = await parseJsonBody(request, SyncRequestSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { operations, clientId, lastSyncAt } = parsed.data;

    logger.info('[SyncAPI] Processing sync request', {
        restaurantId,
        userId,
        deviceId,
        clientId,
        operationCount: operations.length,
        lastSyncAt,
    });

    // Process each operation
    const results: SyncOperationResult[] = [];

    for (const op of operations) {
        // Verify all operations are for the same restaurant
        if (op.restaurantId !== restaurantId) {
            results.push({
                id: op.id,
                success: false,
                error: 'Tenant isolation violation - operation restaurant_id does not match authenticated restaurant',
            });
            continue;
        }

        const result = await processSyncOperation(op, restaurantId);
        results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const conflictCount = results.filter(r => r.conflict?.detected).length;

    logger.info('[SyncAPI] Sync request completed', {
        restaurantId,
        clientId,
        totalOperations: operations.length,
        successCount,
        failureCount,
        conflictCount,
        durationMs: Date.now() - startTime,
    });

    return apiSuccess({
        results,
        summary: {
            total: operations.length,
            succeeded: successCount,
            failed: failureCount,
            conflicts: conflictCount,
        },
        processedAt: new Date().toISOString(),
    });
}

/**
 * GET /api/v1/system/sync
 * Get sync status and pending changes since last sync
 */
export async function GET(request: NextRequest) {
    const startTime = Date.now();

    // Authenticate request
    const authContext = await getSyncAuthContext(request);
    if (!authContext.ok) {
        return authContext.response as ReturnType<typeof apiError>;
    }

    const { restaurantId } = authContext;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
        restaurantId: searchParams.get('restaurantId') || undefined,
        since: searchParams.get('since') || undefined,
        limit: searchParams.get('limit') || '50',
    };

    const parsedQuery = SyncStatusQuerySchema.safeParse(queryParams);
    if (!parsedQuery.success) {
        return apiError(
            'Invalid query parameters',
            400,
            'INVALID_QUERY',
            parsedQuery.error.flatten()
        );
    }

    const { since, limit } = parsedQuery.data;

    const admin = createServiceRoleClient();

    // Get counts of changed records since last sync
    const sinceFilter = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Default 24h

    // Get order changes
    const { count: ordersChanged } = await admin
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .gte('updated_at', sinceFilter);

    // Get order items changes
    const { count: orderItemsChanged } = await admin
        .from('order_items')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .gte('updated_at', sinceFilter);

    // Get KDS items changes
    const { count: kdsItemsChanged } = await admin
        .from('kds_order_items')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .gte('updated_at', sinceFilter);

    const { count: timeEntriesChanged } = await admin
        .from('time_entries')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .gte('updated_at', sinceFilter);

    const { count: tipAllocationsChanged } = await admin
        .from('tip_allocations')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .gte('updated_at', sinceFilter);

    // Get recent sync operations for this restaurant
    const { data: recentSyncOps, error: syncOpsError } = await admin
        .from('sync_idempotency_keys')
        .select('id, idempotency_key, processed_at')
        .eq('restaurant_id', restaurantId)
        .gte('processed_at', sinceFilter)
        .order('processed_at', { ascending: false })
        .limit(limit);

    if (syncOpsError) {
        logger.error('[SyncAPI] Error fetching sync status', { error: syncOpsError, restaurantId });
        return apiError('Failed to fetch sync status', 500, 'SYNC_STATUS_ERROR');
    }

    logger.info('[SyncAPI] Sync status retrieved', {
        restaurantId,
        since: sinceFilter,
        durationMs: Date.now() - startTime,
    });

    return apiSuccess({
        restaurantId,
        since: sinceFilter,
        changes: {
            orders: ordersChanged || 0,
            orderItems: orderItemsChanged || 0,
            kdsItems: kdsItemsChanged || 0,
            timeEntries: timeEntriesChanged || 0,
            tipAllocations: tipAllocationsChanged || 0,
        },
        recentSyncOperations: recentSyncOps || [],
        serverTime: new Date().toISOString(),
    });
}
