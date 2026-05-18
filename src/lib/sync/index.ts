/**
 * Sync Module Index
 *
 * CRIT-05: Offline sync consolidation for POS and KDS
 * Replaces Dexie/localStorage with PowerSync-backed sync
 */

// Configuration
export {
    getPowerSyncConfig,
    getPowerSyncBootstrapStatus,
    initPowerSync,
    getPowerSync,
    closePowerSync,
    powerSyncSchema,
    type PowerSyncBootstrapStatus,
    type PowerSyncBootstrapState,
    type PowerSyncConfig,
} from './powersync-config';
export { Connector as PowerSyncConnector, POWERSYNC_INSTANCE_URL } from './PowerSyncConnector';

// Idempotency
export {
    generateIdempotencyKey,
    isIdempotencyKeyUsed,
    markIdempotencyKeyCompleted,
    queueSyncOperation,
    getPendingSyncOperations,
    markSyncOperationFailed,
    markSyncOperationCompleted,
    getSyncQueueStatus,
    clearCompletedSyncOperations,
    type SyncOperation,
} from './idempotency';

// Order Sync
export {
    createOfflineOrder,
    getOfflineOrder,
    getPendingOfflineOrders,
    updateOfflineOrderStatus,
    updateOfflineOrderCourseFire,
    deleteOfflineOrder,
    getOfflineOrdersByRestaurant,
    getOfflineOrdersCountByStatus,
    clearOfflineOrders,
    resolveOrderConflict,
    getConflictedOrders,
    markOrderConflict,
    batchResolveOrderConflicts,
    type OfflineOrder,
    type OfflineOrderItem,
    type OfflineOrderStatus,
    type OrderConflictResult,
} from './orderSync';

// KDS Sync
export {
    createKdsItem,
    getKdsItem,
    getKdsItemsByStation,
    getKdsItemsByOrder,
    executeKdsAction,
    getKdsStats,
    clearBumpedKdsItems,
    resolveKdsConflict,
    getConflictedKdsItems,
    batchResolveKdsConflicts,
    type OfflineKdsItem,
    type KdsItemStatus,
    type KdsAction,
    type KdsConflictResult,
} from './kdsSync';

// Printer Fallback
export {
    createPrintJob,
    getPrintJob,
    getPendingPrintJobs,
    getPrintJobsByOrder,
    startPrintJob,
    completePrintJob,
    failPrintJob,
    retryPrintJob,
    getPrinterQueueStats,
    clearOldPrintJobs,
    processPrintQueue,
    type PrinterJob,
    type PrinterJobStatus,
    type KdsPrintPayload,
} from './printerFallback';

// Table Session Sync
export {
    openOfflineTableSession,
    getOfflineTableSession,
    getOpenOfflineTableSessionByTableId,
    transferOfflineTableSession,
    updateOfflineTableSession,
    closeOfflineTableSession,
    type OfflineTableSession,
    type OfflineTableSessionStatus,
} from './tableSessionSync';

// Sync Worker
export {
    createSyncWorker,
    getSyncWorker,
    startGlobalSync,
    stopGlobalSync,
    triggerSync,
    type SyncWorkerConfig,
    type SyncProgress,
    type SyncEvent,
    type SyncEventType,
    type SyncEventListener,
} from './syncWorker';

// Conflict Resolution
export {
    detectConflict,
    getConflictType,
    resolveConflict,
    handleSyncConflict,
    logConflictResolution,
    getConflictHistory,
    getUnresolvedConflictsCount,
    batchResolveConflicts,
    type ConflictStrategy,
    type ConflictRecord,
    type SyncConflictLog,
} from './conflict-resolution';

// Reconciliation
export {
    processPendingReconciliation,
    getReconciliationStats,
    type ReconciliationEntry,
    type ReconciliationResult,
} from './reconciliation-worker';

// Checkpoints
export {
    startCheckpoint,
    updateCheckpoint,
    completeCheckpoint,
    failCheckpoint,
    getCheckpoint,
    getLatestCursor,
    cleanupOldCheckpoints,
    type SyncReplayCheckpoint,
    type CheckpointStatus,
} from './replay-checkpoints';

// React Hooks
export { PowerSyncProvider, usePowerSync, useOfflineMode, useSyncStatus } from './usePowerSync';

// Migration
export {
    migrateDexieOrdersToPowerSync,
    migrateKdsLocalStorageToPowerSync,
    migrateCartLocalStorageToPowerSync,
    runAllMigrations,
    isMigrationNeeded,
    clearLegacyStorage,
} from './migrate';
