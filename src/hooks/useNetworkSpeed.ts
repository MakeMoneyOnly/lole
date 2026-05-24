/**
 * useNetworkSpeed Hook
 *
 * Detects network connection speed and quality for adaptive loading strategies.
 * Provides information about connection type, effective connection speed,
 * and estimated round-trip time.
 *
 * Used for:
 * - Adaptive image quality loading
 * - Reducing animation complexity on slow connections
 * - Deferring non-critical data fetches
 * - Progressive enhancement strategies
 */

import { useState, useEffect } from 'react';

// Type definitions for Network Information API
interface NetworkInformation {
    effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
}

interface NavigatorWithConnection extends Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
}

export type NetworkSpeed = 'slow-2g' | '2g' | '3g' | '4g' | 'slow' | 'fast' | 'unknown';

export interface NetworkSpeedInfo {
    speed: NetworkSpeed;
    downlink?: number;
    rtt?: number;
    saveData: boolean;
    online: boolean;
}

const getNetworkSpeed = (connection?: NetworkInformation): NetworkSpeed => {
    if (!connection) return 'unknown';

    // Use effectiveType if available (modern browsers)
    if (connection.effectiveType) {
        return connection.effectiveType as NetworkSpeed;
    }

    // Fallback based on downlink speed
    if (connection.downlink !== undefined) {
        if (connection.downlink < 0.5) return 'slow-2g';
        if (connection.downlink < 1) return '2g';
        if (connection.downlink < 5) return '3g';
        return '4g';
    }

    return 'unknown';
};

const getEnhancedNetworkSpeed = (info: NetworkSpeedInfo): NetworkSpeed => {
    // Convert technical speeds to more user-friendly categories
    if (info.speed === 'unknown' || !info.online) return 'unknown';

    // Consider RTT for additional accuracy
    const rtt = info.rtt ?? 0;

    // High latency can make even fast connections feel slow
    if (rtt > 300) {
        if (info.speed === 'fast' || info.speed === '4g') return 'slow';
    }

    // Map connection types
    switch (info.speed) {
        case 'slow-2g':
        case '2g':
            return 'slow';
        case '3g':
            return rtt > 200 ? 'slow' : 'slow';
        case '4g':
        case 'fast':
            return rtt > 200 ? 'slow' : 'fast';
        default:
            return 'unknown';
    }
};

/**
 * Hook to detect network connection speed and quality
 * @returns NetworkSpeedInfo object with connection details
 */
export function useNetworkSpeed(): NetworkSpeedInfo {
    // Default values for SSR
    const [networkInfo, setNetworkInfo] = useState<NetworkSpeedInfo>({
        speed: 'unknown',
        saveData: false,
        online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    });

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const connection =
            (navigator as NavigatorWithConnection).connection ||
            (navigator as NavigatorWithConnection).mozConnection ||
            (navigator as NavigatorWithConnection).webkitConnection;

        const updateNetworkInfo = (): void => {
            const speed = getNetworkSpeed(connection);
            const info: NetworkSpeedInfo = {
                speed,
                downlink: connection?.downlink,
                rtt: connection?.rtt,
                saveData: connection?.saveData ?? false,
                online: navigator.onLine,
            };
            info.speed = getEnhancedNetworkSpeed(info);
            setNetworkInfo(info);
        };

        // Initial update
        updateNetworkInfo();

        // Listen for connection changes
        if (connection) {
            connection.addEventListener('change', updateNetworkInfo);
        }

        // Listen for online/offline changes
        window.addEventListener('online', updateNetworkInfo);
        window.addEventListener('offline', updateNetworkInfo);

        return () => {
            if (connection) {
                connection.removeEventListener('change', updateNetworkInfo);
            }
            window.removeEventListener('online', updateNetworkInfo);
            window.removeEventListener('offline', updateNetworkInfo);
        };
    }, []);

    return networkInfo;
}

/**
 * Check if network speed is considered slow
 * @param speed - NetworkSpeed value
 * @returns true if connection is slow
 */
export function isSlowNetwork(speed: NetworkSpeed): boolean {
    return speed === 'slow' || speed === 'slow-2g' || speed === '2g' || speed === '3g';
}

/**
 * Get optimal image quality based on network speed
 * @param speed - NetworkSpeed value
 * @returns Quality percentage (0-100)
 */
export function getOptimalImageQuality(speed: NetworkSpeed): number {
    switch (speed) {
        case 'slow':
        case 'slow-2g':
        case '2g':
            return 30;
        case '3g':
            return 50;
        case 'fast':
        case '4g':
            return 80;
        default:
            return 60; // Default quality for unknown connections
    }
}

/**
 * Get recommended number of parallel requests based on network speed
 * @param speed - NetworkSpeed value
 * @returns Number of parallel requests to use
 */
export function getParallelRequestLimit(speed: NetworkSpeed): number {
    switch (speed) {
        case 'slow':
        case 'slow-2g':
        case '2g':
            return 2;
        case '3g':
            return 4;
        case 'fast':
        case '4g':
            return 8;
        default:
            return 6;
    }
}

export default useNetworkSpeed;
