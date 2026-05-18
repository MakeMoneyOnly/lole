/**
 * Host Header Validation Utility
 *
 * HIGH-008: Validate x-forwarded-host header against whitelist
 * Prevents host header injection attacks by validating host values
 * against a configured allowlist before using them.
 */

import { logger } from '@/lib/logger';

const log = logger.child('[SECURITY]');

/**
 * Get allowed hosts from environment configuration
 * Supports both production and development environments
 */
export function getAllowedHosts(): string[] {
    const hosts: string[] = [];

    // Production hosts from environment
    if (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
        hosts.push(process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL);
    }

    // Additional allowed hosts from environment variable (comma-separated)
    if (process.env.ALLOWED_HOSTS) {
        const additionalHosts = process.env.ALLOWED_HOSTS.split(',')
            .map(h => h.trim())
            .filter(h => h.length > 0);
        hosts.push(...additionalHosts);
    }

    // Default production hosts
    hosts.push('lolemenu.com');
    hosts.push('www.lolemenu.com');

    // Remove duplicates using Array.from for compatibility
    return Array.from(new Set(hosts));
}

/**
 * Validate a host value against the allowed hosts whitelist
 *
 * @param host - The host value to validate
 * @param options - Validation options
 * @returns The validated host or null if invalid
 */
export function validateHost(
    host: string | null | undefined,
    options?: {
        allowedHosts?: string[];
        logSuspicious?: boolean;
    }
): { valid: boolean; host: string | null; reason?: string } {
    if (!host) {
        return { valid: false, host: null, reason: 'Host is empty' };
    }

    // Normalize the host: remove port, protocol, and trailing slashes
    const normalizedHost = host
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '')
        .split(':')[0]; // Remove port

    const allowedHosts = options?.allowedHosts ?? getAllowedHosts();

    // Check against allowlist (case-insensitive)
    const isAllowed = allowedHosts.some(allowed => {
        const normalizedAllowed = allowed.toLowerCase().trim();
        // Support wildcard subdomains (e.g., *.lolemenu.com)
        if (normalizedAllowed.startsWith('*.')) {
            const domain = normalizedAllowed.slice(2);
            return normalizedHost === domain || normalizedHost.endsWith('.' + domain);
        }
        return normalizedHost === normalizedAllowed;
    });

    if (isAllowed) {
        return { valid: true, host: normalizedHost };
    }

    // Log suspicious attempt if requested
    if (options?.logSuspicious !== false) {
        logSuspiciousHost(host, normalizedHost, allowedHosts);
    }

    return {
        valid: false,
        host: null,
        reason: `Host '${normalizedHost}' not in allowlist`,
    };
}

/**
 * Validate x-forwarded-host header specifically
 *
 * @param forwardedHost - The x-forwarded-host header value
 * @param request - Optional request object for additional context
 * @returns Validated host or null
 */
export function validateForwardedHost(
    forwardedHost: string | null | undefined,
    _request?: Request
): { valid: boolean; host: string | null } {
    // In development, we're more lenient
    if (process.env.NODE_ENV === 'development') {
        if (forwardedHost) {
            // Still validate but allow localhost variants
            const devAllowedHosts = ['localhost', '127.0.0.1', '[::1]', ...getAllowedHosts()];

            // Add ngrok/localtonet hosts for mobile testing
            if (
                forwardedHost.includes('ngrok.io') ||
                forwardedHost.includes('ngrok-free.app') ||
                forwardedHost.includes('ngrok.app') ||
                forwardedHost.includes('localtonet.com')
            ) {
                return { valid: true, host: forwardedHost.split(':')[0] };
            }

            const result = validateHost(forwardedHost, {
                allowedHosts: devAllowedHosts,
                logSuspicious: false,
            });

            return { valid: result.valid, host: result.host };
        }
        return { valid: false, host: null };
    }

    // In production, strict validation
    return validateHost(forwardedHost);
}

/**
 * Get a safe host value for URL construction
 * Falls back to the request's origin host if forwarded host is invalid
 *
 * @param request - The request object
 * @returns A safe host value for constructing URLs
 */
export function getSafeHost(request: Request): string {
    const forwardedHost = request.headers.get('x-forwarded-host');
    const requestHost = request.headers.get('host');

    // Try forwarded host first (with validation)
    if (forwardedHost) {
        const validation = validateForwardedHost(forwardedHost, request);
        if (validation.valid && validation.host) {
            return validation.host;
        }
    }

    // Fall back to request host
    if (requestHost) {
        const validation = validateHost(requestHost, { logSuspicious: false });
        if (validation.valid && validation.host) {
            return validation.host;
        }
    }

    // Last resort: use environment or default
    const productionUrl = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
    if (productionUrl) {
        return productionUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    }

    return 'localhost:3000';
}

/**
 * Build a safe URL with validated host
 *
 * @param request - The request object
 * @param path - The path to append to the URL
 * @returns A complete URL string with validated host
 */
export function buildSafeUrl(request: Request, path: string = ''): string {
    // On Vercel, prefer production URL for stability
    if (process.env.VERCEL === '1') {
        const productionUrl =
            process.env.VERCEL_PROJECT_PRODUCTION_URL ||
            process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
        if (productionUrl) {
            const cleanUrl = productionUrl
                .replace(/\r/g, '')
                .replace(/\n/g, '')
                .replace(/^["']+/, '')
                .replace(/["']+$/, '')
                .trim()
                .replace(/^https?:\/\//, '')
                .replace(/\/.*$/, '');
            return `https://${cleanUrl}${path}`;
        }
    }

    // Local development with ngrok support
    if (process.env.VERCEL !== '1') {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (appUrl && (appUrl.includes('ngrok') || appUrl.includes('localtonet'))) {
            return `${appUrl.replace(/\/$/, '')}${path}`;
        }
    }

    // Use validated host from request
    const safeHost = getSafeHost(request);
    const proto = request.headers.get('x-forwarded-proto') || 'https';

    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return `${proto}://${safeHost}${normalizedPath}`;
}

/**
 * Log suspicious host attempts for security monitoring
 */
function logSuspiciousHost(
    originalHost: string,
    normalizedHost: string,
    allowedHosts: string[]
): void {
    log.warn('Suspicious host header detected', {
        originalHost,
        normalizedHost,
        allowedHosts,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
    });
}

/**
 * Check if a host matches any pattern in the allowlist
 * Supports exact matches and wildcard subdomains
 */
export function isHostAllowed(host: string, allowedHosts: string[] = getAllowedHosts()): boolean {
    const result = validateHost(host, { allowedHosts, logSuspicious: false });
    return result.valid;
}
