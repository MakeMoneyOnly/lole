import { isCapacitorNativeRuntime } from '@/lib/mobile/capacitor';

export interface BiometricAuthResult {
    success: boolean;
    reason?: string;
    token?: string;
}

interface BiometricPlugin {
    isAvailable: () => Promise<{ available: boolean; biometryType?: number }>;
    verifyIdentity: (options: { reason: string; title?: string }) => Promise<{ verified: boolean }>;
}

async function getBiometricPlugin(): Promise<BiometricPlugin | null> {
    try {
        const importer = new Function('moduleName', 'return import(moduleName);') as (
            value: string
        ) => Promise<{ BiometricAuth?: BiometricPlugin }>;
        const mod = await importer('@capacitor/biometric');
        return mod?.BiometricAuth ?? null;
    } catch {
        return null;
    }
}

export async function isBiometricAvailable(): Promise<boolean> {
    if (!isCapacitorNativeRuntime()) {
        return false;
    }

    const plugin = await getBiometricPlugin();
    if (!plugin) {
        return false;
    }

    try {
        const result = await plugin.isAvailable();
        return result.available;
    } catch {
        return false;
    }
}

export async function authenticateWithBiometrics(reason: string): Promise<BiometricAuthResult> {
    if (!isCapacitorNativeRuntime()) {
        return { success: false, reason: 'not_native_runtime' };
    }

    const plugin = await getBiometricPlugin();
    if (!plugin) {
        return { success: false, reason: 'biometric_plugin_unavailable' };
    }

    try {
        const result = await plugin.verifyIdentity({
            reason,
            title: 'Lole Staff Auth',
        });

        if (result.verified) {
            const token = `bio_${Date.now()}_${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
            return { success: true, token };
        }

        return { success: false, reason: 'biometric_verification_failed' };
    } catch (error) {
        return {
            success: false,
            reason: error instanceof Error ? error.message : 'biometric_error',
        };
    }
}

export function isBiometricTokenValid(token: string, maxAgeMs = 4 * 60 * 60 * 1000): boolean {
    const match = /^bio_(\d+)_/.exec(token);
    if (!match) {
        return false;
    }

    const timestamp = Number.parseInt(match[1], 10);
    return Date.now() - timestamp < maxAgeMs;
}
