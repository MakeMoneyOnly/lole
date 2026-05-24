import { isCapacitorNativeRuntime } from '@/lib/mobile/capacitor';
import { createHmac, timingSafeEqual } from 'crypto';

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

function getBiometricTokenSecret(): string {
    const secret = process.env.DEVICE_TOKEN_SIGNATURE_SECRET || process.env.AUTH_SECRET;

    if (!secret) {
        throw new Error(
            'DEVICE_TOKEN_SIGNATURE_SECRET or AUTH_SECRET is required for biometric token signing'
        );
    }

    return secret;
}

export async function authenticateWithBiometrics(
    reason: string,
    deviceId?: string,
    userId?: string
): Promise<BiometricAuthResult> {
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
            const iat = Math.floor(Date.now() / 1000);
            const exp = iat + 300; // 5 minutes for POS, overridable per context
            const jti = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 14);

            const payload = JSON.stringify({
                sub: userId ?? 'unknown',
                device_id: deviceId ?? 'unknown',
                jti,
                iat,
                exp,
            });

            const encoded = Buffer.from(payload, 'utf8').toString('base64url');
            const signature = createHmac('sha256', getBiometricTokenSecret())
                .update(encoded)
                .digest('base64url');

            const token = `bio.${encoded}.${signature}`;
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

export function isBiometricTokenValid(
    token: string,
    maxAgeMs = 5 * 60 * 1000,
    acceptableDeviceIds?: string[]
): { valid: boolean; reason?: string } {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'bio') {
        return { valid: false, reason: 'Invalid token format' };
    }

    const [, encodedPayload, providedSignature] = parts;
    if (!encodedPayload || !providedSignature) {
        return { valid: false, reason: 'Missing token payload or signature' };
    }

    try {
        const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
        const payload = JSON.parse(payloadJson) as {
            sub?: string;
            device_id?: string;
            jti?: string;
            iat?: number;
            exp?: number;
        };

        const nowSec = Math.floor(Date.now() / 1000);
        if (typeof payload.exp === 'number' && payload.exp < nowSec) {
            return { valid: false, reason: 'Token expired' };
        }
        if (typeof payload.iat === 'number') {
            const ageMs = (nowSec - payload.iat) * 1000;
            if (ageMs > maxAgeMs) {
                return { valid: false, reason: 'Token exceeds maximum age' };
            }
        }

        if (
            acceptableDeviceIds &&
            acceptableDeviceIds.length > 0 &&
            payload.device_id &&
            !acceptableDeviceIds.includes(payload.device_id)
        ) {
            return { valid: false, reason: 'Token not valid for this device' };
        }

        const expectedSignature = createHmac('sha256', getBiometricTokenSecret())
            .update(encodedPayload)
            .digest('base64url');

        const expectedBuffer = Buffer.from(expectedSignature, 'base64url');
        const providedBuffer = Buffer.from(providedSignature, 'base64url');

        if (expectedBuffer.length !== providedBuffer.length) {
            return { valid: false, reason: 'Invalid token signature' };
        }

        try {
            if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
                return { valid: false, reason: 'Invalid token signature' };
            }
        } catch {
            if (expectedSignature !== providedSignature) {
                return { valid: false, reason: 'Invalid token signature' };
            }
        }

        return { valid: true };
    } catch {
        return { valid: false, reason: 'Failed to parse token' };
    }
}
