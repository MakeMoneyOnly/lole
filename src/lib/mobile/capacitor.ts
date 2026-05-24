export interface NativeDeviceInfo {
    uuid?: string | null;
    platform: string;
    osVersion?: string | null;
    appVersion?: string | null;
    batteryLevel?: number | null;
    isNative: boolean;
}

function getWindowCapacitor(): {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
    Plugins?: Record<string, unknown>;
} | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const candidate = (window as typeof window & { Capacitor?: unknown }).Capacitor;
    if (!candidate || typeof candidate !== 'object') {
        return null;
    }

    return candidate as {
        isNativePlatform?: () => boolean;
        getPlatform?: () => string;
        Plugins?: Record<string, unknown>;
    };
}

export function isCapacitorNativeRuntime(): boolean {
    const capacitor = getWindowCapacitor();
    return Boolean(capacitor?.isNativePlatform?.());
}

async function importOptionalModule<T = unknown>(moduleName: string): Promise<T | null> {
    try {
        const importer = new Function('moduleName', 'return import(moduleName);') as (
            value: string
        ) => Promise<T>;
        return await importer(moduleName);
    } catch {
        return null;
    }
}

export async function getNativeDeviceInfo(): Promise<NativeDeviceInfo> {
    const capacitor = getWindowCapacitor();
    const platform = capacitor?.getPlatform?.() ?? 'web';

    const defaultInfo: NativeDeviceInfo = {
        platform,
        isNative: isCapacitorNativeRuntime(),
    };

    if (!defaultInfo.isNative) {
        return defaultInfo;
    }

    interface CapacitorDeviceInfo {
        osVersion?: string;
        operatingSystem?: string;
        appVersion?: string;
        batteryLevel?: number;
    }
    interface CapacitorDeviceInfo {
        osVersion?: string;
        operatingSystem?: string;
        appVersion?: string;
        batteryLevel?: number;
    }
    const deviceModule = await importOptionalModule<{
        Device?: {
            getId: () => Promise<{ identifier?: string }>;
            getInfo: () => Promise<CapacitorDeviceInfo>;
        };
    }>('@capacitor/device');

    if (!deviceModule?.Device) {
        return defaultInfo;
    }

    const [id, info] = await Promise.allSettled([
        deviceModule.Device.getId(),
        deviceModule.Device.getInfo(),
    ]);

    return {
        uuid: id.status === 'fulfilled' ? (id.value.identifier ?? null) : null,
        platform,
        osVersion:
            info.status === 'fulfilled'
                ? (info.value.osVersion ?? info.value.operatingSystem)
                : null,
        appVersion: info.status === 'fulfilled' ? (info.value.appVersion ?? null) : null,
        batteryLevel: info.status === 'fulfilled' ? (info.value.batteryLevel ?? null) : null,
        isNative: true,
    };
}
