/**
 * Network Speed Detection Utility for Lole Restaurant OS
 *
 * Provides network connectivity detection and adaptive loading capabilities.
 * Integrates with the i18n system for localized messages.
 *
 * Features:
 * - Connection speed detection (fast, slow, offline)
 * - Adaptive loading strategies based on network conditions
 * - Effective connection type detection
 * - Bandwidth estimation via performance APIs
 */

import { t } from '@/lib/i18n/translations';
import type { AppLocale } from '@/lib/i18n/locale';

// ============================================
// TYPES
// ============================================

/**
 * Network speed classification
 */
export type NetworkSpeed = 'fast' | 'slow' | 'offline';

/**
 * Connection quality with additional metadata
 */
export interface ConnectionInfo {
    speed: NetworkSpeed;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
}

/**
 * Options for adaptive loading
 */
export interface AdaptiveLoadingOptions {
    locale?: AppLocale;
    onSpeedChange?: (speed: NetworkSpeed, info: ConnectionInfo) => void;
    pollingInterval?: number;
}

/**
 * Asset loading strategy based on network speed
 */
export type LoadingStrategy = 'full' | 'reduced' | 'minimal';

// ============================================
// CONSTANTS
// ============================================

/**
 * Speed thresholds in Mbps
 */
const SPEED_THRESHOLDS = {
    FAST: 10,
    SLOW: 1.5,
} as const;

/**
 * RTT thresholds in ms for additional detection
 */
const RTT_THRESHOLDS = {
    FAST: 100,
    SLOW: 300,
} as const;

// ============================================
// NETWORK SPEED DETECTION
// ============================================

/**
 * Detect current network speed using Navigator Connection API and bandwidth estimation
 */
export function detectNetworkSpeed(): ConnectionInfo {
    if (typeof window === 'undefined') {
        return { speed: 'offline' };
    }

    const navigator = window.navigator as Navigator & {
        connection?: {
            effectiveType?: string;
            downlink?: number;
            rtt?: number;
            saveData?: boolean;
        };
    };

    const connection = navigator.connection;

    if (!connection) {
        return { speed: 'fast' };
    }

    const { effectiveType, downlink, rtt, saveData } = connection;

    // Determine speed based on effectiveType
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
        return {
            speed: 'slow',
            effectiveType,
            downlink,
            rtt,
            saveData,
        };
    }

    if (effectiveType === '3g') {
        return {
            speed: downlink && downlink < SPEED_THRESHOLDS.SLOW ? 'slow' : 'fast',
            effectiveType,
            downlink,
            rtt,
            saveData,
        };
    }

    // For 4g and above, check additional metrics
    if (effectiveType === '4g' && downlink !== undefined && rtt !== undefined) {
        if (downlink < SPEED_THRESHOLDS.FAST || rtt > RTT_THRESHOLDS.FAST) {
            return {
                speed: 'slow',
                effectiveType,
                downlink,
                rtt,
                saveData,
            };
        }
    }

    return {
        speed: 'fast',
        effectiveType,
        downlink,
        rtt,
        saveData,
    };
}

/**
 * Estimate bandwidth using Resource Timing API
 */
export function estimateBandwidth(): number | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    if (!entries || entries.length === 0) {
        return null;
    }

    // Get recent resources to estimate bandwidth
    const recentEntries = entries.slice(-10);
    const validEntries = recentEntries.filter(
        (entry) => entry.transferSize && entry.duration > 0
    );

    if (validEntries.length === 0) {
        return null;
    }

    const totalBytes = validEntries.reduce(
        (sum, entry) => sum + (entry.transferSize || 0),
        0
    );
    const totalTime = validEntries.reduce((sum, entry) => sum + entry.duration, 0);

    if (totalTime === 0) {
        return null;
    }

    // Calculate Mbps
    const mbps = (totalBytes * 8) / (totalTime * 1000);
    return mbps;
}

/**
 * Check if the browser is online
 */
export function isOnline(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    return navigator.onLine;
}

// ============================================
// ADAPTIVE LOADING STRATEGIES
// ============================================

/**
 * Determine loading strategy based on network speed
 */
export function getLoadingStrategy(speed: NetworkSpeed): LoadingStrategy {
    switch (speed) {
        case 'fast':
            return 'full';
        case 'slow':
            return 'reduced';
        case 'offline':
            return 'minimal';
    }
}

/**
 * Get adaptive loading strategy based on current network conditions
 */
export function getAdaptiveLoadingStrategy(): LoadingStrategy {
    const { speed } = detectNetworkSpeed();
    return getLoadingStrategy(speed);
}

/**
 * Execute a callback with loading strategy applied
 */
export function withAdaptiveLoading<T>(
    callback: (strategy: LoadingStrategy) => T
): T {
    const strategy = getAdaptiveLoadingStrategy();
    return callback(strategy);
}

// ============================================
// NETWORK MONITORING
// ============================================

let currentSpeed: NetworkSpeed = 'fast';
let speedCallbacks: Array<(speed: NetworkSpeed, info: ConnectionInfo) => void> = [];

/**
 * Set up network status change listeners
 */
export function setupNetworkMonitoring(options?: AdaptiveLoadingOptions): () => void {
    if (typeof window === 'undefined') {
        return () => {};
    }

    const { onSpeedChange, pollingInterval = 30000 } = options || {};

    const checkSpeed = () => {
        const info = detectNetworkSpeed();
        if (info.speed !== currentSpeed) {
            currentSpeed = info.speed;
            speedCallbacks.forEach((cb) => cb(currentSpeed, info));
            onSpeedChange?.(currentSpeed, info);
        }
    };

    // Initial check
    checkSpeed();

    // Listen for connectivity changes
    window.addEventListener('online', checkSpeed);
    window.addEventListener('offline', checkSpeed);

    // Poll for connection changes (some browsers don't fire events reliably)
    const intervalId = setInterval(checkSpeed, pollingInterval);

    // Listen for connection change events
    const connection = (navigator as Navigator & { connection?: { addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void } }).connection;
    const connectionListener = () => checkSpeed();
    connection?.addEventListener?.('change', connectionListener);

    // Cleanup function
    return () => {
        window.removeEventListener('online', checkSpeed);
        window.removeEventListener('offline', checkSpeed);
        clearInterval(intervalId);
        connection?.removeEventListener?.('change', connectionListener);
    };
}

/**
 * Subscribe to network speed changes
 */
export function subscribeToSpeedChanges(
    callback: (speed: NetworkSpeed, info: ConnectionInfo) => void
): () => void {
    speedCallbacks.push(callback);
    return () => {
        speedCallbacks = speedCallbacks.filter((cb) => cb !== callback);
    };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get localized message for network speed
 */
export function getNetworkSpeedMessage(speed: NetworkSpeed, locale?: AppLocale): string {
    const messages = {
        fast: t('status.online', locale),
        slow: t('offline.slowNetwork', locale),
        offline: t('offline.title', locale),
    };
    return messages[speed];
}

/**
 * Check if the network is suitable for media-heavy operations
 */
export function isNetworkSuitableForMedia(): boolean {
    const { speed } = detectNetworkSpeed();
    return speed === 'fast';
}

/**
 * Check if prefetching should be enabled
 */
export function shouldEnablePrefetching(): boolean {
    const { speed } = detectNetworkSpeed();
    return speed === 'fast';
}

/**
 * Get recommended image quality based on network speed
 */
export function getImageQualityForSpeed(speed: NetworkSpeed): number {
    switch (speed) {
        case 'fast':
            return 90;
        case 'slow':
            return 60;
        case 'offline':
            return 40;
    }
}

/**
 * Get recommended batch size for API requests based on network speed
 */
export function getBatchSizeForSpeed(speed: NetworkSpeed): number {
    switch (speed) {
        case 'fast':
            return 50;
        case 'slow':
            return 10;
        case 'offline':
            return 5;
    }
}

// ============================================
// REACT HOOK (for client components)
// ============================================

/**
 * React hook state type
 */
export interface NetworkSpeedState {
    speed: NetworkSpeed;
    info: ConnectionInfo;
    message: string;
    loadingStrategy: LoadingStrategy;
}

/**
 * Initialize network speed detection (client-side only)
 * This should be called once on app initialization
 */
export function initNetworkSpeedDetection(options?: AdaptiveLoadingOptions): NetworkSpeedState {
    const info = detectNetworkSpeed();
    const speed = info.speed;

    return {
        speed,
        info,
        message: getNetworkSpeedMessage(speed, options?.locale),
        loadingStrategy: getLoadingStrategy(speed),
    };
}

// ============================================
// EXPORTS
// ============================================

export const NetworkSpeedUtils = {
    detectNetworkSpeed,
    estimateBandwidth,
    isOnline,
    getLoadingStrategy,
    getAdaptiveLoadingStrategy,
    setupNetworkMonitoring,
    subscribeToSpeedChanges,
    getNetworkSpeedMessage,
    isNetworkSuitableForMedia,
    shouldEnablePrefetching,
    getImageQualityForSpeed,
    getBatchSizeForSpeed,
    initNetworkSpeedDetection,
};

export default NetworkSpeedUtils;