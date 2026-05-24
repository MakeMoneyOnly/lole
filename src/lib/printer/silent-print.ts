import { encodeReceiptToEscPos, type EscPosReceiptPayload } from '@/lib/printer/escpos';
import {
    getStoredPrinterSelection,
    storePrinterSelection,
    type StoredPrinterSelection,
} from '@/lib/mobile/device-storage';
import { isCapacitorNativeRuntime } from '@/lib/mobile/capacitor';

export interface SilentPrintResult {
    ok: boolean;
    channel: 'native' | 'browser-fallback' | 'queue';
    printer?: StoredPrinterSelection | null;
    reason?: string;
}

export interface SilentPrintOptions {
    networkBridgeUrl?: string;
    queueFallback?: (input: {
        receipt: EscPosReceiptPayload;
        bytes: Uint8Array;
        payloadBase64: string;
        printer: StoredPrinterSelection | null;
    }) => Promise<{ ok: boolean; reason?: string }>;
}

function toBase64(bytes: Uint8Array): string {
    if (typeof window === 'undefined') {
        return Buffer.from(bytes).toString('base64');
    }

    let binary = '';
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });
    return window.btoa(binary);
}

interface NativePrinterPlugin {
    discover?: () => Promise<{ printers?: Array<Record<string, unknown>> }>;
    printRaw?: (options: Record<string, unknown>) => Promise<void>;
    print?: (options: Record<string, unknown>) => Promise<void>;
}

function getNativePrinterPlugin(): NativePrinterPlugin | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const capacitor = (
        window as typeof window & {
            Capacitor?: { Plugins?: Record<string, unknown> };
        }
    ).Capacitor;
    return (
        (capacitor?.Plugins?.ThermalPrinter as NativePrinterPlugin | undefined) ??
        (capacitor?.Plugins?.PrinterBridge as NativePrinterPlugin | undefined) ??
        null
    );
}

export async function rememberPrinterSelection(selection: StoredPrinterSelection): Promise<void> {
    await storePrinterSelection(selection);
}

export async function discoverNativePrinters(): Promise<StoredPrinterSelection[]> {
    const plugin = getNativePrinterPlugin();
    if (!plugin?.discover) {
        return [];
    }

    const response = await plugin.discover();
    const printers = Array.isArray(response?.printers) ? response.printers : [];
    return printers.map((printer: Record<string, unknown>) => ({
        connection_type:
            (printer.connection_type as StoredPrinterSelection['connection_type']) ?? 'bluetooth',
        device_id: String(printer.device_id ?? printer.id ?? ''),
        device_name: String(printer.device_name ?? printer.name ?? ''),
        mac_address: printer.mac_address !== undefined ? String(printer.mac_address) : null,
    }));
}

export async function silentPrintReceipt(
    receipt: EscPosReceiptPayload,
    printerSelection?: StoredPrinterSelection | null,
    options?: SilentPrintOptions
): Promise<SilentPrintResult> {
    const bytes = await encodeReceiptToEscPos(receipt);
    const selectedPrinter = printerSelection ?? (await getStoredPrinterSelection());
    const payloadBase64 = toBase64(bytes);

    if (
        selectedPrinter?.connection_type === 'network' &&
        options?.networkBridgeUrl &&
        typeof fetch === 'function'
    ) {
        const response = await fetch(options.networkBridgeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                payload: payloadBase64,
                encoding: 'base64',
                connectionType: selectedPrinter.connection_type,
                deviceId: selectedPrinter.device_id,
                macAddress: selectedPrinter.mac_address,
            }),
        });

        if (response.ok) {
            return {
                ok: true,
                channel: 'native',
                printer: selectedPrinter,
            };
        }
    }

    if (!isCapacitorNativeRuntime()) {
        if (options?.queueFallback) {
            const queued = await options.queueFallback({
                receipt,
                bytes,
                payloadBase64,
                printer: selectedPrinter,
            });
            return {
                ok: queued.ok,
                channel: 'queue',
                printer: selectedPrinter,
                reason: queued.reason,
            };
        }
        return {
            ok: false,
            channel: 'browser-fallback',
            printer: selectedPrinter,
            reason: 'native_runtime_unavailable',
        };
    }

    const plugin = getNativePrinterPlugin();
    if (!plugin) {
        return {
            ok: false,
            channel: 'queue',
            printer: selectedPrinter,
            reason: 'native_printer_plugin_missing',
        };
    }

    if (typeof plugin.printRaw === 'function') {
        await plugin.printRaw({
            payload: payloadBase64,
            encoding: 'base64',
            connectionType: selectedPrinter?.connection_type,
            deviceId: selectedPrinter?.device_id,
            macAddress: selectedPrinter?.mac_address,
        });
    } else if (typeof plugin.print === 'function') {
        await plugin.print({
            payload: Array.from(bytes),
            connectionType: selectedPrinter?.connection_type,
            deviceId: selectedPrinter?.device_id,
            macAddress: selectedPrinter?.mac_address,
        });
    } else {
        return {
            ok: false,
            channel: 'queue',
            printer: selectedPrinter,
            reason: 'native_printer_plugin_no_supported_method',
        };
    }

    return {
        ok: true,
        channel: 'native',
        printer: selectedPrinter,
    };
}
