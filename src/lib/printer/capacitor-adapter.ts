/**
 * Capacitor ThermalPrinter Adapter
 *
 * M3: PrinterDriverAdapter for Capacitor ThermalPrinter plugin.
 * Falls back gracefully when running outside Capacitor (web/PWA mode).
 */

import type {
    PrinterDriverAdapter,
    PrinterDriverKind,
    PrinterDispatchPayload,
    PrinterDispatchResult,
    PrinterHealthSnapshot,
} from '@/lib/printer/contracts';
import { logger } from '@/lib/logger';

type CapacitorPrinterPlugin = {
    print: (options: { data: string; type: 'text' }) => Promise<{ success: boolean }>;
} | null;

let pluginCache: CapacitorPrinterPlugin = null;

async function resolvePlugin(): Promise<CapacitorPrinterPlugin> {
    if (pluginCache !== null) return pluginCache;

    try {
        const cap = await import('@capacitor/core');
        const global = cap.Capacitor as unknown as Record<string, unknown>;

        if (
            typeof global.isPluginAvailable !== 'function' ||
            !(global.isPluginAvailable as (n: string) => boolean)('ThermalPrinter')
        ) {
            return null;
        }

        pluginCache =
            (global.Plugins as Record<string, CapacitorPrinterPlugin> | undefined)
                ?.ThermalPrinter ?? null;
        return pluginCache;
    } catch {
        logger.info('[PrinterCapacitor] Capacitor not available (web/PWA)');
        return null;
    }
}

export function createCapacitorPrinterAdapter(): PrinterDriverAdapter {
    return {
        kind: 'network' as PrinterDriverKind,

        supports(input: { driverKind: PrinterDriverKind }): boolean {
            return input.driverKind === 'network';
        },

        async dispatch(payload: PrinterDispatchPayload): Promise<PrinterDispatchResult> {
            const plugin = await resolvePlugin();
            if (!plugin) {
                return {
                    ok: false,
                    state: 'failed',
                    driverKind: 'network' as PrinterDriverKind,
                    message: 'Capacitor plugin unavailable',
                };
            }

            try {
                const data = payload as unknown as Record<string, unknown>;
                const printData = data.print_data ?? data.text ?? '';

                const result = await plugin.print({
                    data: String(printData),
                    type: 'text',
                });

                return {
                    ok: result.success,
                    state: result.success ? 'completed' : 'failed',
                    driverKind: 'network' as PrinterDriverKind,
                    message: result.success ? undefined : 'Plugin reported failure',
                };
            } catch (err) {
                return {
                    ok: false,
                    state: 'failed',
                    driverKind: 'network' as PrinterDriverKind,
                    message: err instanceof Error ? err.message : 'Print dispatch error',
                };
            }
        },

        async probeHealth(input: {
            printerDeviceId: string;
            printerName: string;
            routeKeys: string[];
        }): Promise<PrinterHealthSnapshot> {
            const plugin = await resolvePlugin();
            return {
                printerDeviceId: input.printerDeviceId,
                printerName: input.printerName,
                driverKind: 'network' as PrinterDriverKind,
                state: plugin ? 'healthy' : 'offline',
                queueDepth: 0,
                failedJobs: 0,
                pendingJobs: 0,
                printingJobs: 0,
                lastHeartbeatAt: new Date().toISOString(),
                routeKeys: input.routeKeys,
            };
        },
    };
}

export default createCapacitorPrinterAdapter;
