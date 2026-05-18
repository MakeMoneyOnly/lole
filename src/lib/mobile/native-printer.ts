import { isCapacitorNativeRuntime } from '@/lib/mobile/capacitor';
import { logger } from '@/lib/logger';

const log = logger.child('NativePrinter');

export interface PrinterInfo {
    id: string;
    name: string;
    address?: string;
    connectionType: 'bluetooth' | 'usb' | 'network';
    connected: boolean;
}

export interface PrintRawOptions {
    payload: string;
    encoding: 'base64' | 'hex';
    connectionType?: string;
    deviceId?: string;
    macAddress?: string;
}

export interface PrintResult {
    ok: boolean;
    reason?: string;
}

interface ThermalPrinterNativePlugin {
    discover: () => Promise<{ printers: PrinterInfo[] }>;
    printRaw: (options: PrintRawOptions) => Promise<void>;
    getStatus: (options: {
        macAddress?: string;
        deviceId?: string;
    }) => Promise<{ connected: boolean }>;
}

function getNativePrinterPlugin(): ThermalPrinterNativePlugin | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const capacitor = (
        window as typeof window & {
            Capacitor?: { Plugins?: Record<string, unknown> };
        }
    ).Capacitor;

    return (capacitor?.Plugins?.ThermalPrinter as ThermalPrinterNativePlugin | undefined) ?? null;
}

export async function discoverNativePrinters(): Promise<PrinterInfo[]> {
    if (!isCapacitorNativeRuntime()) {
        return [];
    }

    const plugin = getNativePrinterPlugin();
    if (!plugin?.discover) {
        return [];
    }

    try {
        const response = await plugin.discover();
        return response.printers ?? [];
    } catch (error) {
        log.error('Discovery failed', error);
        return [];
    }
}

export async function printRawNative(options: PrintRawOptions): Promise<PrintResult> {
    if (!isCapacitorNativeRuntime()) {
        return { ok: false, reason: 'not_native_runtime' };
    }

    const plugin = getNativePrinterPlugin();
    if (!plugin?.printRaw) {
        return { ok: false, reason: 'native_printer_plugin_missing' };
    }

    try {
        await plugin.printRaw(options);
        return { ok: true };
    } catch (error) {
        return {
            ok: false,
            reason: error instanceof Error ? error.message : 'print_failed',
        };
    }
}

export async function getPrinterStatus(
    macAddress?: string,
    deviceId?: string
): Promise<{ connected: boolean }> {
    if (!isCapacitorNativeRuntime()) {
        return { connected: false };
    }

    const plugin = getNativePrinterPlugin();
    if (!plugin?.getStatus) {
        return { connected: false };
    }

    try {
        return await plugin.getStatus({ macAddress, deviceId });
    } catch {
        return { connected: false };
    }
}
