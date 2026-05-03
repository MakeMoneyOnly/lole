import type { PowerSyncBootstrapState } from '@/lib/sync/powersync-config';
import type { StoreOperatingMode } from '@/lib/gateway/config';
import { logger } from '@/lib/logger';

export interface StoreRuntimeModeInput {
    isOnline: boolean;
    isInitialized: boolean;
    bootstrapState: PowerSyncBootstrapState;
    pendingCount: number;
    isSyncing: boolean;
    isMqttConnected: boolean;
}

let lastResolvedMode: StoreOperatingMode | null = null;

export function resolveStoreOperatingMode(input: StoreRuntimeModeInput): StoreOperatingMode {
    let mode: StoreOperatingMode;

    if (!input.isOnline) {
        mode = 'offline-local';
    } else if (input.isOnline && !input.isMqttConnected) {
        mode = 'degraded';
    } else if (
        input.bootstrapState === 'error' ||
        input.bootstrapState === 'missing_runtime_adapter' ||
        input.bootstrapState === 'not_configured'
    ) {
        mode = 'degraded';
    } else if (input.isSyncing || input.pendingCount > 0) {
        mode = 'reconciling';
    } else if (input.isInitialized) {
        mode = 'online';
    } else {
        mode = 'degraded';
    }

    if (mode !== lastResolvedMode) {
        logger.info(
            `[Gateway] Operating mode changed: ${lastResolvedMode ?? 'initial'} → ${mode}`,
            {
                isOnline: input.isOnline,
                isMqttConnected: input.isMqttConnected,
                bootstrapState: input.bootstrapState,
                pendingCount: input.pendingCount,
                isSyncing: input.isSyncing,
            }
        );
        lastResolvedMode = mode;
    }

    return mode;
}
