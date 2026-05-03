/**
 * PowerSync React Provider and Hooks
 *
 * CRIT-05: Offline sync consolidation
 * Provides React context for PowerSync operations
 */

'use client';

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    type ReactNode,
} from 'react';
import {
    getPowerSyncBootstrapStatus,
    initPowerSync,
    type PowerSyncBootstrapStatus,
    type PowerSyncDatabase,
} from './powersync-config';
import { resolveStoreOperatingMode } from '@/lib/gateway/runtime-mode';
import type { StoreOperatingMode } from '@/lib/gateway/config';
import { logger } from '@/lib/logger';

// Use unknown since @powersync/core types may not be available yet
type PowerSyncDb = PowerSyncDatabase | null;
import { startGlobalSync, stopGlobalSync, triggerSync, getSyncWorker } from './syncWorker';

/**
 * PowerSync context value
 */
interface PowerSyncContextValue {
    /** Whether PowerSync is initialized */
    isInitialized: boolean;
    /** Whether we're currently syncing */
    isSyncing: boolean;
    /** Whether we're online */
    isOnline: boolean;
    /** Last sync timestamp */
    lastSyncAt: string | null;
    /** Pending operations count */
    pendingCount: number;
    /** Error if any */
    error: Error | null;
    /** Bootstrap status */
    bootstrapStatus: PowerSyncBootstrapStatus;
    /** Derived operating mode */
    operatingMode: StoreOperatingMode;
    /** Trigger a manual sync */
    sync: () => Promise<void>;
    /** Get the PowerSync database */
    db: PowerSyncDb;
}

/**
 * Create the context
 */
const PowerSyncContext = createContext<PowerSyncContextValue | null>(null);

/**
 * PowerSync Provider component
 */
export function PowerSyncProvider({ children }: { children: ReactNode }) {
    const [isInitialized, setIsInitialized] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [error, setError] = useState<Error | null>(null);
    const [db, setDb] = useState<PowerSyncDb>(null);
    const [bootstrapStatus, setBootstrapStatus] = useState<PowerSyncBootstrapStatus>(
        getPowerSyncBootstrapStatus()
    );

    // Initialize PowerSync on mount
    useEffect(() => {
        async function init() {
            try {
                const database = await initPowerSync();
                setDb(database);
                setBootstrapStatus(getPowerSyncBootstrapStatus());

                if (database) {
                    // Start the sync worker
                    startGlobalSync();
                    setIsInitialized(true);
                } else {
                    setIsInitialized(false);
                }
            } catch (err) {
                logger.error('[PowerSync] Failed to initialize', {
                    error: err instanceof Error ? err.message : String(err),
                });
                setError(err instanceof Error ? err : new Error(String(err)));
                setBootstrapStatus(getPowerSyncBootstrapStatus());
            }
        }

        init();

        return () => {
            stopGlobalSync();
        };
    }, []);

    // Listen for online/offline events
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Trigger sync when coming back online
            triggerSync();
            setBootstrapStatus(getPowerSyncBootstrapStatus());
        };

        const handleOffline = () => {
            setIsOnline(false);
            setBootstrapStatus(getPowerSyncBootstrapStatus());
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Set initial online state
        setIsOnline(navigator.onLine);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Update sync status periodically
    useEffect(() => {
        if (!isInitialized) return;

        const updateStatus = async () => {
            try {
                const worker = getSyncWorker();
                const status = await worker.getStatus();
                setLastSyncAt(status.lastSyncAt);
                setPendingCount(status.pendingOperations);
                setBootstrapStatus(getPowerSyncBootstrapStatus());
            } catch (_err) {
                // Silently ignore errors in status update
            }
        };

        // Initial update
        updateStatus();

        // Update every 5 seconds
        const interval = setInterval(updateStatus, 5000);

        return () => clearInterval(interval);
    }, [isInitialized]);

    // Sync function
    const sync = useCallback(async () => {
        if (!isOnline || !isInitialized) return;

        setIsSyncing(true);
        try {
            await triggerSync();
        } finally {
            setIsSyncing(false);
        }
    }, [isOnline, isInitialized]);

    const operatingMode = resolveStoreOperatingMode({
        isOnline,
        isInitialized,
        bootstrapState: bootstrapStatus.state,
        pendingCount,
        isSyncing,
        isMqttConnected: true,
    });

    const value: PowerSyncContextValue = {
        isInitialized,
        isSyncing,
        isOnline,
        lastSyncAt,
        pendingCount,
        error,
        bootstrapStatus,
        operatingMode,
        sync,
        db,
    };

    return <PowerSyncContext.Provider value={value}>{children}</PowerSyncContext.Provider>;
}

/**
 * Hook to access PowerSync context
 */
export function usePowerSync() {
    const context = useContext(PowerSyncContext);

    if (!context) {
        throw new Error('usePowerSync must be used within a PowerSyncProvider');
    }

    return context;
}

/**
 * Hook to check if we're in offline mode
 */
export function useOfflineMode() {
    const { operatingMode } = usePowerSync();
    return operatingMode === 'offline-local' || operatingMode === 'degraded';
}

/**
 * Hook to get sync status
 */
export function useSyncStatus() {
    const { isSyncing, isOnline, lastSyncAt, pendingCount, sync, operatingMode, bootstrapStatus } =
        usePowerSync();
    return {
        isSyncing,
        isOnline,
        lastSyncAt: lastSyncAt ? new Date(lastSyncAt) : null,
        pendingCount,
        operatingMode,
        bootstrapStatus,
        sync,
    };
}
