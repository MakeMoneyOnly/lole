import { isCapacitorNativeRuntime } from '@/lib/mobile/capacitor';

export interface CashDrawerResult {
    ok: boolean;
    reason?: string;
}

interface CashDrawerNativePlugin {
    open: () => Promise<void>;
}

function getCashDrawerPlugin(): CashDrawerNativePlugin | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const capacitor = (
        window as typeof window & {
            Capacitor?: { Plugins?: Record<string, unknown> };
        }
    ).Capacitor;

    return (capacitor?.Plugins?.CashDrawer as CashDrawerNativePlugin | undefined) ?? null;
}

export async function openCashDrawer(): Promise<CashDrawerResult> {
    if (!isCapacitorNativeRuntime()) {
        return { ok: false, reason: 'not_native_runtime' };
    }

    const plugin = getCashDrawerPlugin();
    if (!plugin) {
        return { ok: false, reason: 'cash_drawer_plugin_missing' };
    }

    try {
        await plugin.open();
        return { ok: true };
    } catch (error) {
        return {
            ok: false,
            reason: error instanceof Error ? error.message : 'cash_drawer_failed',
        };
    }
}
