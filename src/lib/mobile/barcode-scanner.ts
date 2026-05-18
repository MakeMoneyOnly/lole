import { isCapacitorNativeRuntime } from '@/lib/mobile/capacitor';
import { logger } from '@/lib/logger';

const log = logger.child('BarcodeScanner');

export interface ScanResult {
    type: string;
    value: string;
    raw?: string;
}

interface BarcodeScannerPlugin {
    startScan: () => Promise<ScanResult>;
    stopScan: () => Promise<void>;
}

async function getBarcodeScannerPlugin(): Promise<BarcodeScannerPlugin | null> {
    try {
        const importer = new Function('moduleName', 'return import(moduleName);') as (
            value: string
        ) => Promise<{ BarcodeScanner?: BarcodeScannerPlugin }>;
        const mod = await importer('@capacitor-community/barcode-scanner');
        return mod?.BarcodeScanner ?? null;
    } catch {
        return null;
    }
}

export async function startBarcodeScan(): Promise<ScanResult | null> {
    if (!isCapacitorNativeRuntime()) {
        log.warn('Not in native runtime. Scan unavailable');
        return null;
    }

    const plugin = await getBarcodeScannerPlugin();
    if (!plugin) {
        log.warn('Plugin not installed');
        return null;
    }

    try {
        const result = await plugin.startScan();
        return {
            type: result.type,
            value: result.value,
            raw: result.raw ?? result.value,
        };
    } catch (error) {
        log.error('Scan failed', error);
        return null;
    }
}

export async function stopBarcodeScan(): Promise<void> {
    const plugin = await getBarcodeScannerPlugin();
    if (plugin) {
        try {
            await plugin.stopScan();
        } catch {
            // Scanner may already be stopped
        }
    }
}

export function parseScannedProductCode(value: string): {
    type: 'ean13' | 'upca' | 'code128' | 'qr' | 'unknown';
    code: string;
} | null {
    const trimmed = value.trim();

    if (/^\d{13}$/.test(trimmed)) {
        return { type: 'ean13', code: trimmed };
    }
    if (/^\d{12}$/.test(trimmed)) {
        return { type: 'upca', code: trimmed };
    }
    if (/^[\x20-\x7E]{1,48}$/.test(trimmed) && !trimmed.startsWith('http')) {
        return { type: 'code128', code: trimmed };
    }
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return { type: 'qr', code: trimmed };
    }
    return { type: 'unknown', code: trimmed };
}
