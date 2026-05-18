import type { DeviceProfile, PrinterConnectionType } from '@/lib/devices/config';
import type { DeviceGatewayBootstrapSession } from '@/lib/gateway/device-bootstrap';
import { isCapacitorNativeRuntime } from '@/lib/mobile/capacitor';

export interface StoredDeviceSession {
    device_token: string;
    device_type: string;
    device_profile?: DeviceProfile | null;
    name?: string | null;
    restaurant_id?: string | null;
    location_id?: string | null;
    boot_path?: string | null;
    metadata?: Record<string, unknown> | null;
    gateway?: DeviceGatewayBootstrapSession | null;
    gateway_bootstrap_status?: 'ready' | 'unavailable' | 'failed';
}

export interface StoredPrinterSelection {
    connection_type: PrinterConnectionType;
    device_id?: string | null;
    device_name?: string | null;
    mac_address?: string | null;
}

const DEVICE_SESSION_KEY = 'lole_device_session_v2';
const PRINTER_SELECTION_KEY = 'lole_printer_selection_v1';

function isValidPrinterConnectionType(value: unknown): value is PrinterConnectionType {
    return value === 'bluetooth' || value === 'usb' || value === 'network' || value === 'none';
}

function resolvePrinterSelectionFromSession(
    session: StoredDeviceSession | null
): StoredPrinterSelection | null {
    const printer =
        session?.metadata && typeof session.metadata === 'object'
            ? (session.metadata.printer as Record<string, unknown> | undefined)
            : undefined;

    if (!printer || !isValidPrinterConnectionType(printer.connection_type)) {
        return null;
    }

    return {
        connection_type: printer.connection_type,
        device_id: typeof printer.device_id === 'string' ? printer.device_id : null,
        device_name: typeof printer.device_name === 'string' ? printer.device_name : null,
        mac_address: typeof printer.mac_address === 'string' ? printer.mac_address : null,
    };
}

async function withPreferences<T>(
    run: (preferences: {
        get: (options: { key: string }) => Promise<{ value: string | null }>;
        set: (options: { key: string; value: string }) => Promise<void>;
        remove: (options: { key: string }) => Promise<void>;
    }) => Promise<T>
): Promise<T | null> {
    if (!isCapacitorNativeRuntime()) {
        return null;
    }

    try {
        const importer = new Function('moduleName', 'return import(moduleName);') as (
            value: string
        ) => Promise<{
            Preferences?: {
                get: (options: { key: string }) => Promise<{ value: string | null }>;
                set: (options: { key: string; value: string }) => Promise<void>;
                remove: (options: { key: string }) => Promise<void>;
            };
        }>;
        const capacitorModule = await importer('@capacitor/preferences');
        if (!capacitorModule?.Preferences) {
            return null;
        }
        return await run(capacitorModule.Preferences);
    } catch {
        return null;
    }
}

function readBrowserStorage<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}
function writeBrowserStorage(key: string, value: unknown): void {
    if (typeof window === 'undefined') return;
    const serialized = JSON.stringify(value);
    window.localStorage.setItem(key, serialized);
    window.sessionStorage.setItem(key, serialized);
}
function removeBrowserStorage(key: string): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
}

export async function getStoredDeviceSession(): Promise<StoredDeviceSession | null> {
    const nativeValue = await withPreferences(async preferences => {
        const entry = await preferences.get({ key: DEVICE_SESSION_KEY });
        return entry.value ? (JSON.parse(entry.value) as StoredDeviceSession) : null;
    });

    return nativeValue ?? readBrowserStorage<StoredDeviceSession>(DEVICE_SESSION_KEY);
}

export async function storeDeviceSession(session: StoredDeviceSession): Promise<void> {
    const serialized = JSON.stringify(session);

    await withPreferences(async preferences => {
        await preferences.set({ key: DEVICE_SESSION_KEY, value: serialized });
        return true;
    });

    // Mirror to browser storage too so the local Capacitor bootstrap can read
    // the current paired state before the full routed shell takes over.
    writeBrowserStorage(DEVICE_SESSION_KEY, session);
}

export async function clearDeviceSession(): Promise<void> {
    await withPreferences(async preferences => {
        await preferences.remove({ key: DEVICE_SESSION_KEY });
        return true;
    });

    removeBrowserStorage(DEVICE_SESSION_KEY);
}

export async function getStoredPrinterSelection(): Promise<StoredPrinterSelection | null> {
    const nativeValue = await withPreferences(async preferences => {
        const entry = await preferences.get({ key: PRINTER_SELECTION_KEY });
        return entry.value ? (JSON.parse(entry.value) as StoredPrinterSelection) : null;
    });

    const storedSelection =
        nativeValue ?? readBrowserStorage<StoredPrinterSelection>(PRINTER_SELECTION_KEY);
    if (storedSelection) {
        return storedSelection;
    }

    const sessionFallback = resolvePrinterSelectionFromSession(await getStoredDeviceSession());
    if (sessionFallback) {
        await storePrinterSelection(sessionFallback);
        return sessionFallback;
    }

    return null;
}

export async function storePrinterSelection(selection: StoredPrinterSelection): Promise<void> {
    const serialized = JSON.stringify(selection);

    await withPreferences(async preferences => {
        await preferences.set({ key: PRINTER_SELECTION_KEY, value: serialized });
        return true;
    });

    writeBrowserStorage(PRINTER_SELECTION_KEY, selection);
}

export async function clearPrinterSelection(): Promise<void> {
    await withPreferences(async preferences => {
        await preferences.remove({ key: PRINTER_SELECTION_KEY });
        return true;
    });

    removeBrowserStorage(PRINTER_SELECTION_KEY);
}
