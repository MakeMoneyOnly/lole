/**
 * Request Signing Utility
 *
 * Provides unified request signing and verification for:
 * - Outbound API requests to delivery partners
 * - Webhook signature verification from payment providers
 * - Internal API request integrity verification
 *
 * LOW-022: Consolidates duplicated signing logic from delivery integrations
 * and provides a single source of truth for request signing patterns.
 */

import { createHmac, createHash, timingSafeEqual as nodeTimingSafeEqual } from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface SignedRequest {
    timestamp: string;
    signature: string;
}

// ============================================================================
// Timing-Safe Comparison
// ============================================================================

/**
 * Timing-safe string comparison.
 * Both strings must be the same length for the comparison to be valid.
 * When lengths differ, a dummy comparison is still performed to avoid
 * leaking length information via timing side-channels.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns Whether the strings are equal
 */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        const bufA = Buffer.from(a);
        const bufB = Buffer.from(b);
        if (bufA.length === bufB.length) {
            return nodeTimingSafeEqual(bufA, bufB);
        }
        return false;
    }
    return nodeTimingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ============================================================================
// Delivery Partner Request Signing (extracted from zmall/esoora/deliver-addis/beu)
// ============================================================================

/**
 * Sign a request with HMAC-SHA256 for delivery partner authentication.
 * Uses timestamp-based signing to prevent replay attacks.
 *
 * The signature is computed over a message composed of:
 *   `{secret}\n{timestamp}\n{sha256(body)}`
 *
 * This function was previously duplicated across 4 delivery integration files:
 * zmall.ts, esoora.ts, deliver-addis.ts, beu.ts
 *
 * @param partnerSecret - The shared secret key for the partner
 * @param body - Optional request body to include in signature computation
 * @returns Signed request with timestamp and signature for request headers
 */
export function signRequest(partnerSecret: string, body: string | null = null): SignedRequest {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyHash = body ? createHash('sha256').update(body, 'utf8').digest('hex') : '';
    const message = `${partnerSecret}\n${timestamp}\n${bodyHash}`;
    const signature = createHmac('sha256', partnerSecret).update(message).digest('hex');
    return { timestamp, signature };
}

// ============================================================================
// Webhook Signature Verification
// ============================================================================

/**
 * Verify a signed request from a delivery partner or payment provider.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * Verification checks:
 * 1. Timestamp freshness — rejects requests older than `maxAgeMs` to prevent replay attacks.
 * 2. Signature validity — recomputes the HMAC-SHA256 signature and compares it
 *    with the provided value using a constant-time comparison.
 *
 * @param timestamp - The timestamp from the request header (Unix seconds)
 * @param signature - The signature from the request header
 * @param secret - The shared secret key
 * @param body - The raw request body
 * @param maxAgeMs - Maximum age of the request in milliseconds (default: 5 minutes)
 * @returns Whether the signature is valid and the request is not expired
 */
export function verifySignedRequest(
    timestamp: string,
    signature: string,
    secret: string,
    body: string,
    maxAgeMs: number = 5 * 60 * 1000
): boolean {
    const requestTime = parseInt(timestamp, 10) * 1000;
    const now = Date.now();
    if (isNaN(requestTime) || Math.abs(now - requestTime) > maxAgeMs) {
        return false;
    }

    const bodyHash = createHash('sha256').update(body, 'utf8').digest('hex');
    const message = `${secret}\n${timestamp}\n${bodyHash}`;
    const expectedSignature = createHmac('sha256', secret).update(message).digest('hex');

    return timingSafeEqual(signature, expectedSignature);
}
