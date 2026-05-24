import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { logger } from '@/lib/logger';

const log = logger.child('[hmac]');

/**
 * HMAC Utilities for QR Code Signing
 *
 * Addresses PLATFORM_AUDIT_REPORT finding SEC-H6: HMAC-signed QR codes
 * Ensures QR codes are authentic and haven't been tampered with
 *
 * SECURITY: QR_HMAC_SECRET is required for production use.
 * Generate a secure key: openssl rand -hex 32
 */

function getHmacSecret(): string {
    const secret = process.env.QR_HMAC_SECRET;
    if (!secret) {
        // SECURITY: No fallback secret - fail closed
        // During build time, we can proceed without the secret as signing happens at runtime
        if (process.env.NEXT_PHASE === 'phase-production-build') {
            log.warn(
                'QR_HMAC_SECRET is missing during build. This is acceptable - secret will be injected at runtime.'
            );
            return 'build_placeholder_not_used_at_runtime';
        }
        // In development or production, the secret MUST be set
        throw new Error(
            'QR_HMAC_SECRET environment variable is required. ' +
                'Generate a secure key: openssl rand -hex 32'
        );
    }
    return secret;
}

const HMAC_SECRET: string = getHmacSecret();

/**
 * Generate HMAC signature for QR code data
 * @param data - The data to sign (e.g., restaurant slug and table number)
 * @returns Hex-encoded HMAC signature
 */
export function generateQRSignature(data: string): string {
    return createHmac('sha256', HMAC_SECRET).update(data).digest('hex');
}

/**
 * Verify HMAC signature for QR code data
 * @param data - The original data
 * @param signature - The signature to verify
 * @returns boolean indicating if signature is valid
 */
export function verifyQRSignature(data: string, signature: string): boolean {
    try {
        const expectedSignature = generateQRSignature(data);
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');
        const providedBuffer = Buffer.from(signature, 'hex');

        // Use timing-safe comparison to prevent timing attacks
        return (
            expectedBuffer.length === providedBuffer.length &&
            timingSafeEqual(expectedBuffer, providedBuffer)
        );
    } catch {
        return false;
    }
}

function getBaseUrl(): string {
    // If deployed to Vercel, prioritize Vercel's system environment variables
    // to prevent local overrides (like ngrok) from taking precedence in production.
    if (process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_ENV) {
        const vercelUrl =
            process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
            process.env.NEXT_PUBLIC_VERCEL_URL ||
            process.env.VERCEL_PROJECT_PRODUCTION_URL ||
            process.env.VERCEL_URL;

        if (vercelUrl) {
            return `https://${vercelUrl}`;
        }
    }

    // Default fallbacks
    const url =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        'https://lolemenu.com';

    // Clean up trailing slash if any
    return url.replace(/\/$/, '');
}

/**
 * Generate signed QR code URL
 * @param restaurantSlug - Restaurant identifier
 * @param tableNumber - Table number
 * @param baseUrlOverride - Optional base URL override (e.g. derived from the request host)
 * @returns Object containing URL and signature
 */
export function generateSignedQRCode(
    restaurantSlug: string,
    tableNumber: string,
    baseUrlOverride?: string
): { url: string; signature: string; expiresAt: number } {
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    const data = `${restaurantSlug}:${tableNumber}:${expiresAt}`;
    const signature = generateQRSignature(data);

    const baseUrl = (baseUrlOverride ?? getBaseUrl()).replace(/\/$/, '');
    const url = new URL(`${baseUrl}/${restaurantSlug}`);
    url.searchParams.set('table', tableNumber);
    url.searchParams.set('sig', signature);
    url.searchParams.set('exp', expiresAt.toString());

    return {
        url: url.toString(),
        signature,
        expiresAt,
    };
}

/**
 * Verify signed QR code URL
 * @param restaurantSlug - Restaurant identifier from URL
 * @param tableNumber - Table number from URL
 * @param signature - Signature from URL
 * @param expiresAt - Expiration timestamp from URL
 * @returns boolean indicating if QR code is valid
 */
export function verifySignedQRCode(
    restaurantSlug: string,
    tableNumber: string,
    signature: string,
    expiresAt: number
): { valid: boolean; reason?: string } {
    // Check expiration
    if (Date.now() > expiresAt) {
        return { valid: false, reason: 'QR code has expired' };
    }

    // SECURITY: Demo signature bypass removed - all QR codes must have valid signatures
    // This prevents unauthorized access through forged demo signatures

    // Verify signature
    const data = `${restaurantSlug}:${tableNumber}:${expiresAt}`;
    if (!verifyQRSignature(data, signature)) {
        return { valid: false, reason: 'Invalid signature' };
    }

    return { valid: true };
}

// ============================================================
// Session-specific HMAC Utilities
// Used for guest session token signing and verification
// ============================================================

/**
 * Generate a secure HMAC secret for session signing
 * Uses crypto.randomBytes(32) for cryptographic randomness
 * @returns Base64-encoded secure random string
 */
export function generateHmacSecret(): string {
    return randomBytes(32).toString('base64');
}

/**
 * Sign a payload using HMAC-SHA256
 * @param payload - The data to sign
 * @param secret - The HMAC secret (base64-encoded)
 * @returns Base64-encoded signature
 */
export function signPayload(payload: string, secret: string): string {
    const secretBuffer = Buffer.from(secret, 'base64');
    return createHmac('sha256', secretBuffer).update(payload, 'utf8').digest('base64');
}

/**
 * Verify a signature using HMAC-SHA256 with timing-safe comparison
 * @param payload - The original payload
 * @param signature - The signature to verify (base64-encoded)
 * @param secret - The HMAC secret (base64-encoded)
 * @returns boolean indicating if signature is valid
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
    try {
        const expectedSignature = signPayload(payload, secret);
        const expectedBuffer = Buffer.from(expectedSignature, 'base64');
        const providedBuffer = Buffer.from(signature, 'base64');

        // Use timing-safe comparison to prevent timing attacks
        return (
            expectedBuffer.length === providedBuffer.length &&
            timingSafeEqual(expectedBuffer, providedBuffer)
        );
    } catch {
        return false;
    }
}

/**
 * Get the master HMAC secret for guest session validation
 * Uses HMAC_SECRET env var as additional security layer
 * @returns The master HMAC secret or throws if not configured
 */
function getMasterHmacSecret(): string {
    const secret = process.env.HMAC_SECRET;
    if (!secret) {
        if (process.env.NEXT_PHASE === 'phase-production-build') {
            log.warn(
                'HMAC_SECRET is missing during build. This is acceptable - secret will be injected at runtime.'
            );
            return 'build_placeholder_not_used_at_runtime';
        }
        throw new Error(
            'HMAC_SECRET environment variable is required for guest session signing. ' +
                'Generate a secure key: openssl rand -hex 32'
        );
    }
    return secret;
}

const MASTER_HMAC_SECRET: string = getMasterHmacSecret();

/**
 * Sign a session token with the master HMAC secret
 * Used for additional validation layer beyond per-session secrets
 * @param payload - The session data to sign
 * @returns Base64-encoded master signature
 */
export function signWithMasterSecret(payload: string): string {
    return signPayload(payload, MASTER_HMAC_SECRET);
}

/**
 * Verify a session token signature against the master HMAC secret
 * @param payload - The original payload
 * @param signature - The signature to verify
 * @returns boolean indicating if signature is valid
 */
export function verifyMasterSignature(payload: string, signature: string): boolean {
    return verifySignature(payload, signature, MASTER_HMAC_SECRET);
}
