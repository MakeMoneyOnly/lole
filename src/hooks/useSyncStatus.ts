/**
 * useSyncStatus Hook
 *
 * HIGH-005: Provides sync status to UI components
 * Tracks offline queue, sync progress, and conflict status
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSyncQueueStatus, getSyncWorker } from '@/lib/sync';
import { getUnresolvedConflictsCount } from '@/lib/sync/conflict-resolution';
import { logger } from '@/lib/logger';

/**
 * Sync status for UI display
 */
export interface SyncStatus {
    /** Whether the device is online */
    isOnline: boolean;
    /** Number of pending operations in queue */
    pendingOperations: number;
    /** Number of completed operations */
    completedOperations: number;
    /** Number of failed operations */
    failedOperations: number;
    /** Number of unresolved conflicts */
    unresolvedConflicts: number;
    /** Whether sync is currently in progress */
    isSyncing: boolean;
    /** Last sync timestamp */
    lastSyncAt: string | null;
    /** Sync error if any */
    error?: string;
}

/**
 * Hook return type
 */
export interface UseSyncStatusReturn {
    /** Current sync status */
    status: SyncStatus;
    /** Manually trigger a sync */
    triggerSync: () => Promise<void>;
    /** Refresh status immediately */
    refreshStatus: () => Promise<void>;
    /** Whether status is being loaded */
    isLoading: boolean;
}

/**
 * Default sync status
 */
const DEFAULT_STATUS: SyncStatus = {
    isOnline: true,
    pendingOperations: 0,
    completedOperations: 0,
    failedOperations: 0,
    unresolvedConflicts: 0,
    isSyncing: false,
    lastSyncAt: null,
};

/**
 * Hook for tracking sync status in UI components
 *
 * @param options Configuration options
 * @param options.pollIntervalMs Interval for polling status updates (default: 5000ms)
 * @param options.onSyncComplete Callback when sync completes
 * @param options.onSyncError Callback when sync errors
 * @param options.onConflict Callback when conflict is detected
 *
 * @example
 * ```tsx
 * function SyncIndicator() {
 *   const { status, triggerSync, isLoading } = useSyncStatus({
 *     pollIntervalMs: 3000,
 *     onSyncError: (error) => toast.error(error),
 *   });
 *
 *   return (
 *     <div>
 *       {status.isOnline ? (
 *         <span>{status.pendingOperations} pending</span>
 *       ) : (
 *         <span>Offline</span>
 *       )}
 *       {status.unresolvedConflicts > 0 && (
 *         <span>{status.unresolvedConflicts} conflicts</span>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSyncStatus(options?: {
    pollIntervalMs?: number;
    onSyncComplete?: (status: SyncStatus) => void;
    onSyncError?: (error: string) => void;
    onConflict?: (count: number) => void;
}): UseSyncStatusReturn {
    const { pollIntervalMs = 5000, onSyncComplete, onSyncError, onConflict } = options ?? {};

    const [status, setStatus] = useState<SyncStatus>(DEFAULT_STATUS);
    const [isLoading, setIsLoading] = useState(true);
    const isRefreshing = useRef(false);
    const previousConflicts = useRef(0);

    /**
     * Refresh sync status from worker and database
     */
    const refreshStatus = useCallback(async () => {
        if (isRefreshing.current) return;
        isRefreshing.current = true;

        try {
            // Get queue status from database
            const queueStatus = await getSyncQueueStatus();

            // Get unresolved conflicts count
            const conflictsCount = await getUnresolvedConflictsCount();

            // Check if conflicts increased
            if (conflictsCount > previousConflicts.current && onConflict) {
                onConflict(conflictsCount);
            }
            previousConflicts.current = conflictsCount;

            // Get worker status
            const worker = getSyncWorker();
            const workerStatus = await worker.getStatus();

            setStatus({
                isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
                pendingOperations: queueStatus.pending,
                completedOperations: queueStatus.completed,
                failedOperations: queueStatus.failed,
                unresolvedConflicts: conflictsCount,
                isSyncing: workerStatus.pendingOperations > 0,
                lastSyncAt: workerStatus.lastSyncAt,
            });
        } catch (error) {
            logger.error('[useSyncStatus] Failed to refresh status:', error);
            setStatus(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : 'Unknown error',
            }));
        } finally {
            isRefreshing.current = false;
            setIsLoading(false);
        }
    }, [onConflict]);

    /**
     * Manually trigger a sync
     */
    const triggerSync = useCallback(async () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            setStatus(prev => ({
                ...prev,
                error: 'Cannot sync while offline',
            }));
            onSyncError?.('Cannot sync while offline');
            return;
        }

        setStatus(prev => ({ ...prev, isSyncing: true, error: undefined }));

        try {
            const worker = getSyncWorker();
            const result = await worker.syncOnce();

            // Refresh status after sync
            await refreshStatus();

            // Notify completion
            if (onSyncComplete) {
                onSyncComplete({
                    ...status,
                    pendingOperations: result.pendingOperations,
                    completedOperations: result.completedOperations,
                    failedOperations: result.failedOperations,
                    lastSyncAt: result.lastSyncAt,
                });
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Sync failed';
            setStatus(prev => ({
                ...prev,
                isSyncing: false,
                error: errorMessage,
            }));
            onSyncError?.(errorMessage);
        }
    }, [refreshStatus, onSyncComplete, onSyncError, status]);

    // Set up polling for status updates
    useEffect(() => {
        // Initial refresh
        refreshStatus();

        // Set up polling interval
        const intervalId = setInterval(refreshStatus, pollIntervalMs);

        return () => {
            clearInterval(intervalId);
        };
    }, [refreshStatus, pollIntervalMs]);

    // Listen for online/offline events
    useEffect(() => {
        const handleOnline = (): void => {
            setStatus(prev => ({ ...prev, isOnline: true }));
            // Trigger sync when coming back online
            triggerSync();
        };

        const handleOffline = (): void => {
            setStatus(prev => ({ ...prev, isOnline: false }));
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [triggerSync]);

    return {
        status,
        triggerSync,
        refreshStatus,
        isLoading,
    };
}

/**
 * Simplified hook for just checking if online and pending count
 */
export function useOnlineStatus(): {
    isOnline: boolean;
    pendingCount: number;
} {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        const updateStatus = async (): Promise<void> => {
            const queueStatus = await getSyncQueueStatus();
            setPendingCount(queueStatus.pending);
        };

        updateStatus();
        const intervalId = setInterval(updateStatus, 10000);

        const handleOnline = (): void => {
            setIsOnline(true);
            updateStatus();
        };

        const handleOffline = (): void => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return { isOnline, pendingCount };
}

export default useSyncStatus;
