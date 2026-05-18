/**
 * Stale Device Monitor
 *
 * CRIT-05: Detects devices that haven't synced within the expected threshold
 * and triggers alerts for operations team.
 *
 * This addresses the "stale-device alerts" requirement:
 * - Detect devices that haven't synced in too long
 * - Alert operations team via Telegram
 * - Track sync health per restaurant
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { Alerts, sendWarningAlert } from '@/lib/monitoring/alerts';
import { logger } from '@/lib/logger';

/**
 * Configuration for stale device detection
 */
export interface StaleDeviceConfig {
    /** Minutes without sync before warning (default: 30) */
    warningThresholdMinutes: number;
    /** Minutes without sync before critical alert (default: 60) */
    criticalThresholdMinutes: number;
    /** Only alert during business hours (9 AM - 11 PM EAT) */
    businessHoursOnly: boolean;
    /** Maximum devices to check per run */
    maxDevicesPerRun: number;
}

export const DEFAULT_CONFIG: StaleDeviceConfig = {
    warningThresholdMinutes: 30,
    criticalThresholdMinutes: 60,
    businessHoursOnly: true,
    maxDevicesPerRun: 100,
};

/**
 * Check if current time is within business hours in Addis Ababa
 * Business hours: 9 AM - 11 PM EAT (UTC+3)
 */
function isWithinBusinessHours(): boolean {
    const now = new Date();
    const addisHour = (now.getUTCHours() + 3) % 24;
    return addisHour >= 9 && addisHour < 23;
}

/**
 * Device sync status
 */
export interface DeviceSyncStatus {
    id: string;
    restaurant_id: string;
    device_id: string;
    device_name: string | null;
    device_type: 'pos' | 'kds' | 'printer';
    last_sync_at: string | null;
    sync_status: 'online' | 'offline' | 'stale' | 'unknown';
    restaurant_name?: string;
    minutes_since_sync: number | null;
}

/**
 * Result of stale device detection
 */
export interface StaleDeviceDetectionResult {
    checked: number;
    staleDevices: DeviceSyncStatus[];
    warningDevices: DeviceSyncStatus[];
    criticalDevices: DeviceSyncStatus[];
    alertsSent: number;
    errors: string[];
}

/**
 * Find devices that haven't synced within threshold
 */
export async function findStaleDevices(config: StaleDeviceConfig = DEFAULT_CONFIG): Promise<{
    warning: DeviceSyncStatus[];
    critical: DeviceSyncStatus[];
}> {
    const admin = createServiceRoleClient();
    const warningThreshold = new Date(
        Date.now() - config.warningThresholdMinutes * 60 * 1000
    ).toISOString();
    const criticalThreshold = new Date(
        Date.now() - config.criticalThresholdMinutes * 60 * 1000
    ).toISOString();

    // Query device sync status from the database
    // This assumes a device_sync_status table exists
    const { data: devices, error } = await admin
        .from('device_sync_status')
        .select(
            `
            id,
            restaurant_id,
            device_id,
            device_name,
            device_type,
            last_sync_at,
            sync_status
        `
        )
        .eq('sync_status', 'offline')
        .or(`last_sync_at.is.null,last_sync_at.lt.${warningThreshold}`)
        .order('last_sync_at', { ascending: true })
        .limit(config.maxDevicesPerRun);

    if (error) {
        logger.error('[stale-device-monitor] Error querying devices', {
            error: error instanceof Error ? error.message : String(error),
        });
        return { warning: [], critical: [] };
    }

    if (!devices || devices.length === 0) {
        return { warning: [], critical: [] };
    }

    const restaurantIds = [...new Set(devices.map(d => d.restaurant_id))];
    const restaurantMap = new Map<string, string>();

    if (restaurantIds.length > 0) {
        const { data: restaurants } = await admin
            .from('restaurants')
            .select('id, name')
            .in('id', restaurantIds);

        if (restaurants) {
            for (const r of restaurants) {
                if (typeof r.name === 'string') restaurantMap.set(r.id, r.name);
            }
        }
    }

    const now = Date.now();
    const warning: DeviceSyncStatus[] = [];
    const critical: DeviceSyncStatus[] = [];

    for (const device of devices) {
        const minutesSinceSync = device.last_sync_at
            ? Math.round((now - new Date(device.last_sync_at).getTime()) / 60000)
            : null;

        const deviceStatus: DeviceSyncStatus = {
            id: device.id,
            restaurant_id: device.restaurant_id,
            device_id: device.device_id,
            device_name: device.device_name,
            device_type: device.device_type,
            last_sync_at: device.last_sync_at,
            sync_status: device.sync_status,
            restaurant_name: restaurantMap.get(device.restaurant_id) ?? undefined,
            minutes_since_sync: minutesSinceSync,
        };

        if (!device.last_sync_at || new Date(device.last_sync_at) < new Date(criticalThreshold)) {
            critical.push(deviceStatus);
        } else {
            warning.push(deviceStatus);
        }
    }

    return { warning, critical };
}

/**
 * Run stale device detection and send alerts
 *
 * This should be called by a scheduled job (cron) every 5-10 minutes.
 */
export async function runStaleDeviceDetection(
    config: StaleDeviceConfig = DEFAULT_CONFIG
): Promise<StaleDeviceDetectionResult> {
    const result: StaleDeviceDetectionResult = {
        checked: 0,
        staleDevices: [],
        warningDevices: [],
        criticalDevices: [],
        alertsSent: 0,
        errors: [],
    };

    // Skip if outside business hours and configured to do so
    if (config.businessHoursOnly && !isWithinBusinessHours()) {
        return result;
    }

    try {
        const { warning, critical } = await findStaleDevices(config);
        result.warningDevices = warning;
        result.criticalDevices = critical;
        result.staleDevices = [...warning, ...critical];
        result.checked = result.staleDevices.length;

        // Send critical alerts
        for (const device of critical) {
            try {
                await Alerts.posOffline(
                    device.restaurant_id,
                    device.restaurant_name || 'Unknown Restaurant',
                    device.minutes_since_sync ?? 0
                );

                // Also log detailed context
                await sendWarningAlert(`Device ${device.device_id} critically offline`, {
                    restaurant_id: device.restaurant_id,
                    restaurant_name: device.restaurant_name || 'Unknown',
                    device_id: device.device_id,
                    device_name: device.device_name || 'Unknown',
                    device_type: device.device_type,
                    minutes_offline: device.minutes_since_sync ?? 0,
                    last_sync: device.last_sync_at || 'Never',
                });

                result.alertsSent++;
            } catch (alertError) {
                result.errors.push(`Failed to alert for device ${device.device_id}: ${alertError}`);
            }
        }

        // Send warning alerts (batched to avoid spam)
        if (warning.length > 0) {
            try {
                const warningSummary = warning
                    .map(
                        d =>
                            `${d.device_type}:${d.device_name || d.device_id} (${d.minutes_since_sync}m)`
                    )
                    .join(', ');

                await sendWarningAlert(`${warning.length} device(s) approaching stale threshold`, {
                    devices: warningSummary,
                    threshold_minutes: config.warningThresholdMinutes,
                });

                result.alertsSent++;
            } catch (alertError) {
                result.errors.push(`Failed to send warning summary: ${alertError}`);
            }
        }
    } catch (error) {
        result.errors.push(
            `Detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }

    return result;
}

/**
 * Get sync health summary for a restaurant
 */
export async function getRestaurantSyncHealth(restaurantId: string): Promise<{
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
    staleDevices: number;
    oldestOfflineMinutes: number | null;
}> {
    const admin = createServiceRoleClient();

    const { data: devices, error } = await admin
        .from('device_sync_status')
        .select('sync_status, last_sync_at')
        .eq('restaurant_id', restaurantId);

    if (error || !devices) {
        return {
            totalDevices: 0,
            onlineDevices: 0,
            offlineDevices: 0,
            staleDevices: 0,
            oldestOfflineMinutes: null,
        };
    }

    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes

    let onlineDevices = 0;
    let offlineDevices = 0;
    let staleDevices = 0;
    let oldestOffline: Date | null = null;

    for (const device of devices) {
        if (device.sync_status === 'online') {
            onlineDevices++;
        } else {
            offlineDevices++;

            const lastSync = device.last_sync_at ? new Date(device.last_sync_at) : null;

            if (lastSync && now - lastSync.getTime() > staleThreshold) {
                staleDevices++;
            }

            if (lastSync && (!oldestOffline || lastSync < oldestOffline)) {
                oldestOffline = lastSync;
            }
        }
    }

    return {
        totalDevices: devices.length,
        onlineDevices,
        offlineDevices,
        staleDevices,
        oldestOfflineMinutes: oldestOffline
            ? Math.round((now - oldestOffline.getTime()) / 60000)
            : null,
    };
}

/**
 * Update device sync status (called by devices on sync)
 */
export async function updateDeviceSyncStatus(params: {
    restaurantId: string;
    deviceId: string;
    deviceName?: string;
    deviceType: 'pos' | 'kds' | 'printer';
    syncVersion?: string;
}): Promise<void> {
    const admin = createServiceRoleClient();

    await admin.from('device_sync_status').upsert(
        {
            restaurant_id: params.restaurantId,
            device_id: params.deviceId,
            device_name: params.deviceName || null,
            device_type: params.deviceType,
            last_sync_at: new Date().toISOString(),
            sync_status: 'online',
            sync_version: params.syncVersion || null,
            updated_at: new Date().toISOString(),
        },
        {
            onConflict: 'restaurant_id,device_id',
        }
    );
}

export const staleDeviceMonitor = {
    findStaleDevices,
    runStaleDeviceDetection,
    getRestaurantSyncHealth,
    updateDeviceSyncStatus,
    DEFAULT_CONFIG,
};

export default staleDeviceMonitor;
