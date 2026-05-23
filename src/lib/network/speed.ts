/**
 * Network Speed Detection Utility for Lole Restaurant OS
 *
 * Provides network connectivity detection and adaptive loading capabilities.
 * Integrates with the i18n system for localized messages.
 *
 * Features:
 * - Connection speed detection (slow, medium, fast, unknown)
 * - Adaptive loading strategies based on network conditions
 * - Effective connection type detection
 * - Bandwidth estimation via performance APIs
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { t } from '@/lib/i18n/translations';
import type { AppLocale } from '@/lib/i18n/locale';

// ============================================
// TYPES
// ============================================

/**
 * Network speed classification for adaptive loading
 */
export type NetworkSpeed = 'slow' | 'medium' | 'fast' | 'unknown';

/**
 * Connection information from Network Information API
 */
export interface ConnectionInfo {
    speed: NetworkSpeed;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Speed thresholds in Mbps
 */
const SPEED_THRESHOLDS = {
    SLOW: 1.5,
    FAST: 10,
    MEDIUM: 10,
} as const;

/**
 * RTT thresholds in ms for additional detection
 */
const RTT_THRESHOLDS = {
    FAST: 100,
    SLOW: 300,
} as const;

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
// NETWORK SPEED DETECTION
// ============================================

/**
 * Detect current network speed using Navigator Connection API and bandwidth estimation
 */
export function detectNetworkSpeed(): ConnectionInfo {
    if (typeof window === 'undefined') {
        return { speed: 'unknown' };
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
    const validEntries = recentEntries.filter(entry => entry.transferSize && entry.duration > 0);

    if (validEntries.length === 0) {
        return null;
    }

    const totalBytes = validEntries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
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
// NETWORK SPEED DETECTION (ENHANCED)
// ============================================

const TEST_IMAGE_URL =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Network Information API interface
 */
interface NetworkInformation {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
}

/**
 * Get network speed from Network Information API
 */
export function getNetworkInfoSpeed(): NetworkSpeed {
    if (typeof navigator === 'undefined') return 'unknown';

    const connection =
        (navigator as Navigator & { connection?: NetworkInformation }).connection ||
        (navigator as unknown as { mozConnection?: NetworkInformation }).mozConnection ||
        (navigator as unknown as { webkitConnection?: NetworkInformation }).webkitConnection;

    if (!connection) return 'unknown';

    const { effectiveType, downlink } = connection;

    if (downlink !== undefined) {
        const speedBps = (downlink * 1000 * 1000) / 8;
        if (speedBps < SPEED_THRESHOLDS.SLOW * 1024 * 1024) return 'slow';
        if (speedBps < SPEED_THRESHOLDS.MEDIUM * 1024 * 1024) return 'medium';
        return 'fast';
    }

    switch (effectiveType) {
        case 'slow-2g':
        case '2g':
            return 'slow';
        case '3g':
            return 'medium';
        case '4g':
        case '5g':
        case 'slow-3g':
            return 'fast';
        default:
            return 'unknown';
    }
}

/**
 * Measure connection speed using download timing
 */
async function measureDownloadSpeed(timeoutMs = 5000): Promise<NetworkSpeed> {
    if (typeof window === 'undefined' || typeof fetch === 'undefined') return 'unknown';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(TEST_IMAGE_URL, {
            method: 'GET',
            cache: 'no-cache',
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) return 'unknown';

        const startTime = performance.now();
        await response.arrayBuffer();
        const endTime = performance.now();

        const duration = endTime - startTime;
        const bytesLoaded = 67;
        const speedBps = (bytesLoaded * 8) / (duration / 1000);
        const speedMbps = speedBps / (1024 * 1024);

        if (speedMbps < SPEED_THRESHOLDS.SLOW) return 'slow';
        if (speedMbps < SPEED_THRESHOLDS.MEDIUM) return 'medium';
        return 'fast';
    } catch {
        return 'unknown';
    }
}

/**
 * Detect current network speed
 * Uses Network Information API if available, falls back to timing measurement
 */
export async function detectNetworkSpeedAsync(timeoutMs?: number): Promise<NetworkSpeed> {
    const apiSpeed = getNetworkInfoSpeed();
    if (apiSpeed !== 'unknown') return apiSpeed;
    return measureDownloadSpeed(timeoutMs);
}

/**
 * Check if high quality assets should be loaded
 * Returns true for 'fast' or 'medium' network speeds
 */
export function shouldLoadHighQualityAssets(speed: NetworkSpeed): boolean {
    return speed === 'fast' || speed === 'medium';
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
        case 'medium':
            return 'full';
        case 'slow':
            return 'reduced';
        case 'unknown':
            return 'reduced';
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
export function withAdaptiveLoading<T>(callback: (strategy: LoadingStrategy) => T): T {
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

    const checkSpeed = (): void => {
        const info = detectNetworkSpeed();
        if (info.speed !== currentSpeed) {
            currentSpeed = info.speed;
            speedCallbacks.forEach(cb => cb(currentSpeed, info));
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
    const connection = (
        navigator as Navigator & {
            connection?: {
                addEventListener?: (type: string, listener: () => void) => void;
                removeEventListener?: (type: string, listener: () => void) => void;
            };
        }
    ).connection;
    const connectionListener = (): void => checkSpeed();
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
        speedCallbacks = speedCallbacks.filter(cb => cb !== callback);
    };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get localized message for network speed
 */
export function getNetworkSpeedMessage(speed: NetworkSpeed, locale?: AppLocale): string {
    const messages: Record<NetworkSpeed, string> = {
        fast: t('status.online', locale),
        medium: t('status.online', locale),
        slow: t('offline.slowNetwork', locale),
        unknown: t('status.unknown', locale),
    };
    return messages[speed];
}

/**
 * Check if the network is suitable for media-heavy operations
 */
export function isNetworkSuitableForMedia(): boolean {
    const { speed } = detectNetworkSpeed();
    return speed === 'fast' || speed === 'medium';
}

/**
 * Check if prefetching should be enabled
 */
export function shouldEnablePrefetching(): boolean {
    const { speed } = detectNetworkSpeed();
    return speed === 'fast' || speed === 'medium';
}

/**
 * Get recommended image quality based on network speed
 */
export function getImageQualityForSpeed(speed: NetworkSpeed): number {
    switch (speed) {
        case 'fast':
            return 90;
        case 'medium':
            return 75;
        case 'slow':
            return 60;
        case 'unknown':
            return 60;
    }
}

/**
 * Get recommended batch size for API requests based on network speed
 */
export function getBatchSizeForSpeed(speed: NetworkSpeed): number {
    switch (speed) {
        case 'fast':
            return 50;
        case 'medium':
            return 30;
        case 'slow':
            return 10;
        case 'unknown':
            return 10;
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
// REACT HOOK
// ============================================

/**
 * React hook for network speed detection
 *
 * @param options Configuration options
 * @param options.pollIntervalMs Interval for re-checking network speed (default: 30000)
 * @param options.enableMeasurement Whether to use download timing as fallback (default: true)
 * @param options.timeoutMs Timeout for speed measurement in ms (default: 5000)
 *
 * @example
 * ```tsx
 * function ImageComponent() {
 *   const { speed, isMeasuring } = useNetworkSpeed();
 *
 *   const imageQuality = shouldLoadHighQualityAssets(speed) ? 'high' : 'low';
 *
 *   return <img src={`/images/photo-${imageQuality}.jpg`} alt="Photo" />;
 * }
 * ```
 */
export function useNetworkSpeed(options?: {
    pollIntervalMs?: number;
    enableMeasurement?: boolean;
    timeoutMs?: number;
}): {
    speed: NetworkSpeed;
    isMeasuring: boolean;
    measureNow: () => Promise<NetworkSpeed>;
} {
    const { pollIntervalMs = 30000, enableMeasurement = true, timeoutMs = 5000 } = options ?? {};

    const [speed, setSpeed] = useState<NetworkSpeed>('unknown');
    const [isMeasuring, setIsMeasuring] = useState(false);

    const measureSpeed = useCallback(async (): Promise<NetworkSpeed> => {
        setIsMeasuring(true);

        try {
            const apiSpeed = getNetworkInfoSpeed();
            if (apiSpeed !== 'unknown') {
                setSpeed(apiSpeed);
                return apiSpeed;
            }

            if (enableMeasurement) {
                const measuredSpeed = await measureDownloadSpeed(timeoutMs);
                setSpeed(measuredSpeed);
                return measuredSpeed;
            }

            setSpeed('unknown');
            return 'unknown';
        } finally {
            setIsMeasuring(false);
        }
    }, [enableMeasurement, timeoutMs]);

    useEffect(() => {
        measureSpeed();

        const intervalId = setInterval(measureSpeed, pollIntervalMs);
        return () => clearInterval(intervalId);
    }, [measureSpeed, pollIntervalMs]);

    return {
        speed,
        isMeasuring,
        measureNow: measureSpeed,
    };
}

// ============================================
// EXPORTS
// ============================================

export const NetworkSpeedUtils = {
    detectNetworkSpeed,
    detectNetworkSpeedAsync,
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
    shouldLoadHighQualityAssets,
};

export default NetworkSpeedUtils;
