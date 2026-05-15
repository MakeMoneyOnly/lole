/**
 * CSP Nonce Helper for Server Components
 *
 * HIGH-022: Provides utilities for accessing CSP nonce in Server Components
 * The nonce is set by middleware and can be accessed via headers
 */

import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

const log = logger.child('[CSP]');

/**
 * Get the CSP nonce for the current request
 * This should be called in Server Components to get the nonce
 * for use in script and style tags
 *
 * @returns The nonce string or undefined if not available
 */
export async function getCSPNonce(): Promise<string | undefined> {
    const headersList = await headers();
    return headersList.get('x-csp-nonce') ?? undefined;
}

/**
 * Get script attributes with nonce for CSP
 * Use this when rendering script tags in Server Components
 *
 * @returns Object with nonce attribute or empty object
 */
export async function getScriptNonceAttrs(): Promise<{ nonce: string }> {
    const nonce = await getCSPNonce();
    if (!nonce) {
        // In development, this might happen - return empty but warn
        if (process.env.NODE_ENV === 'development') {
            log.warn('No nonce available - CSP may block inline scripts');
        }
        return { nonce: '' };
    }
    return { nonce };
}

/**
 * Get style attributes with nonce for CSP
 * Use this when rendering style tags in Server Components
 *
 * @returns Object with nonce attribute or empty object
 */
export async function getStyleNonceAttrs(): Promise<{ nonce: string }> {
    const nonce = await getCSPNonce();
    if (!nonce) {
        if (process.env.NODE_ENV === 'development') {
            log.warn('No nonce available - CSP may block inline styles');
        }
        return { nonce: '' };
    }
    return { nonce };
}

/**
 * Create a script tag with nonce for CSP compliance
 * Use this for dynamically creating scripts in Server Components
 *
 * @param src - Script source URL
 * @param options - Additional script attributes
 * @returns Script tag props with nonce
 */
export async function createScriptProps(
    src: string,
    options?: {
        async?: boolean;
        defer?: boolean;
        type?: string;
        crossOrigin?: 'anonymous' | 'use-credentials';
    }
): Promise<{
    src: string;
    nonce: string;
    async?: boolean;
    defer?: boolean;
    type?: string;
    crossOrigin?: 'anonymous' | 'use-credentials';
}> {
    const nonceAttrs = await getScriptNonceAttrs();
    return {
        src,
        ...nonceAttrs,
        ...options,
    };
}

/**
 * Create a style tag with nonce for CSP compliance
 *
 * @param children - CSS content
 * @returns Style tag props with nonce
 */
export async function createStyleProps(): Promise<{ nonce: string }> {
    return getStyleNonceAttrs();
}
