/**
 * CSRF Protection Utility for Server Actions
 *
 * This is a convenience wrapper around the comprehensive CSRF implementation
 * in @/lib/security/csrf. It provides a simple origin-check based CSRF validation
 * suitable for Server Actions in Next.js App Router.
 *
 * Usage in Server Actions:
 * ```typescript
 * 'use server';
 *
 * import { validateCsrf } from '@/lib/csrf';
 *
 * export async function myAction(formData: FormData) {
 *   await validateCsrf(); // Throws if CSRF check fails
 *   // ... action logic
 * }
 * ```
 */

import { headers } from 'next/headers';

/**
 * Allowed origins for CSRF validation
 * - Production: Uses NEXT_PUBLIC_APP_URL environment variable
 * - Development: localhost:3000, 127.0.0.1:3000
 */
function getAllowedOrigins(): string[] {
    const origins: string[] = [];

    // Add production origin if configured
    if (process.env.NEXT_PUBLIC_APP_URL) {
        origins.push(process.env.NEXT_PUBLIC_APP_URL);
    }

    // Always allow localhost for development
    origins.push('http://localhost:3000');
    origins.push('http://127.0.0.1:3000');
    origins.push('https://localhost:3000');
    origins.push('https://127.0.0.1:3000');

    // Add any custom allowed origins from environment
    if (process.env.ALLOWED_ORIGINS) {
        const customOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
        origins.push(...customOrigins);
    }

    return origins;
}

/**
 * Check if the given origin is in the allowed list
 */
function isOriginAllowed(origin: string | null): boolean {
    if (!origin) return false;

    const allowedOrigins = getAllowedOrigins();

    try {
        const requestOrigin = new URL(origin);
        return allowedOrigins.some(allowed => {
            try {
                const allowedUrl = new URL(allowed);
                return requestOrigin.origin === allowedUrl.origin;
            } catch {
                return false;
            }
        });
    } catch {
        return false;
    }
}

/**
 * Validate CSRF token for Server Actions
 *
 * This function verifies the request origin matches an allowed origin,
 * providing protection against Cross-Site Request Forgery attacks.
 *
 * @throws Error if CSRF validation fails (invalid origin)
 */
export async function validateCsrf(): Promise<void> {
    const headersList = await headers();
    const origin = headersList.get('origin');
    const referer = headersList.get('referer');

    // Check origin header first (preferred)
    if (origin && isOriginAllowed(origin)) {
        return;
    }

    // Fall back to referer check
    if (referer) {
        try {
            const refererUrl = new URL(referer);
            if (isOriginAllowed(refererUrl.origin)) {
                return;
            }
        } catch {
            // Invalid referer URL
        }
    }

    // Get allowed origins for error message
    const allowedOrigins = getAllowedOrigins();

    throw new Error(
        `CSRF validation failed: Invalid origin. ` +
            `Allowed origins: ${allowedOrigins.join(', ')}. ` +
            `Received origin: ${origin || 'none'}, referer: ${referer || 'none'}`
    );
}

/**
 * Validate CSRF with detailed response
 *
 * @returns Object with valid boolean and optional error message
 */
export async function validateCsrfSafe(): Promise<{ valid: boolean; error?: string }> {
    try {
        await validateCsrf();
        return { valid: true };
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'CSRF validation failed',
        };
    }
}

/**
 * Get the current request origin for debugging/logging
 */
export async function getCurrentOrigin(): Promise<string | null> {
    const headersList = await headers();
    return headersList.get('origin');
}
