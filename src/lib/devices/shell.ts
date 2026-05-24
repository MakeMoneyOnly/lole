import {
    DeviceProfileSchema,
    getBootPathForDeviceProfile,
    getDeviceProfileLabel,
    getDeviceTypeLabel,
    resolveDeviceProfile,
    type DeviceProfile,
} from '@/lib/devices/config';

export interface StoredShellSessionLike {
    device_type?: string | null;
    device_profile?: string | null;
    boot_path?: string | null;
    name?: string | null;
    metadata?: Record<string, unknown> | null;
}

export function resolveDeviceShellPath(session: StoredShellSessionLike): string {
    if (session.boot_path?.trim()) {
        return session.boot_path;
    }

    const profile = DeviceProfileSchema.safeParse(session.device_profile).success
        ? (session.device_profile as DeviceProfile)
        : resolveDeviceProfile(
              session.device_type === 'terminal' ||
                  session.device_type === 'kds' ||
                  session.device_type === 'kiosk'
                  ? session.device_type
                  : 'pos'
          );

    return getBootPathForDeviceProfile(profile);
}

export function getDeviceShellSummary(session: StoredShellSessionLike): {
    profileLabel: string;
    typeLabel: string;
    deviceName: string;
    launchPath: string;
    managedModeLabel: string;
} {
    const profileLabel = getDeviceProfileLabel(session.device_profile);
    const typeLabel = getDeviceTypeLabel(session.device_type);
    const deviceName = session.name?.trim() || profileLabel;
    const launchPath = resolveDeviceShellPath(session);
    const managedMode = session.metadata?.managed_mode;

    return {
        profileLabel,
        typeLabel,
        deviceName,
        launchPath,
        managedModeLabel:
            managedMode === 'dedicated'
                ? 'Dedicated device shell'
                : managedMode === 'pwa'
                  ? 'PWA-backed shell'
                  : 'Managed device shell',
    };
}
