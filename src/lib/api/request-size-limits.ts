/**
 * Request Size Limits
 *
 * LOW-010: Add request size limits to prevent abuse
 * Limits request body size for API routes to prevent DoS attacks
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Default size limits for different content types (in bytes)
 */
export const DEFAULT_SIZE_LIMITS = {
    // Default limit for JSON requests (100KB)
    json: 100 * 1024,
    // Default limit for form data (10MB - for file uploads)
    formData: 10 * 1024 * 1024,
    // Default limit for text/plain (1MB)
    text: 1024 * 1024,
    // Default limit for unknown content types (10KB)
    default: 10 * 1024,
};

/**
 * Size limits configuration per route pattern
 */
export const ROUTE_SIZE_LIMITS: Record<string, Partial<typeof DEFAULT_SIZE_LIMITS>> = {
    // Menu items with images can be larger
    '/api/v1/merchant/core/menu': {
        json: 500 * 1024, // 500KB
        formData: 20 * 1024 * 1024, // 20MB
    },
    // Orders should be smaller
    '/api/v1/merchant/operations/orders': {
        json: 50 * 1024, // 50KB
    },
    // Payments should be minimal
    '/api/v1/merchant/operations/payments': {
        json: 10 * 1024, // 10KB
    },
    // Webhooks can vary
    '/api/v1/system/webhooks': {
        json: 500 * 1024, // 500KB
    },
    // Guest portal requests
    '/api/v1/guest-portal': {
        json: 50 * 1024, // 50KB
    },
    // Delivery aggregator orders
    '/api/v1/merchant/operations/delivery': {
        json: 100 * 1024, // 100KB
    },
};

/**
 * Get the size limit for a request
 */
export function getSizeLimit(pathname: string, contentType: string): number {
    // Find matching route pattern
    let routeLimits: Partial<typeof DEFAULT_SIZE_LIMITS> = {};

    for (const [pattern, limits] of Object.entries(ROUTE_SIZE_LIMITS)) {
        if (pathname.startsWith(pattern)) {
            routeLimits = limits;
            break;
        }
    }

    // Determine content type category
    if (contentType.includes('application/json')) {
        return routeLimits.json ?? DEFAULT_SIZE_LIMITS.json;
    }

    if (contentType.includes('multipart/form-data')) {
        return routeLimits.formData ?? DEFAULT_SIZE_LIMITS.formData;
    }

    if (contentType.includes('text/plain')) {
        return routeLimits.text ?? DEFAULT_SIZE_LIMITS.text;
    }

    return routeLimits.default ?? DEFAULT_SIZE_LIMITS.default;
}

/**
 * Check if request body exceeds size limit
 *
 * @param request - The Next.js request object
 * @param customLimit - Optional custom limit in bytes
 * @returns Object with isValid flag and error message if invalid
 */
export async function checkRequestSize(
    request: NextRequest,
    customLimit?: number
): Promise<{ isValid: boolean; error?: string; size?: number }> {
    const contentType = request.headers.get('content-type') || '';
    const contentLength = request.headers.get('content-length');

    // If Content-Length header is present, check it first
    if (contentLength) {
        const size = parseInt(contentLength, 10);
        const limit = customLimit ?? getSizeLimit(request.nextUrl.pathname, contentType);

        if (size > limit) {
            return {
                isValid: false,
                error: `Request body too large. Maximum allowed: ${formatBytes(limit)}`,
                size,
            };
        }

        return { isValid: true, size };
    }

    // For chunked transfer encoding, we need to read the body
    // This is more expensive but necessary for streaming requests
    try {
        const clone = request.clone();
        const body = await clone.text();
        const size = Buffer.byteLength(body, 'utf8');
        const limit = customLimit ?? getSizeLimit(request.nextUrl.pathname, contentType);

        if (size > limit) {
            return {
                isValid: false,
                error: `Request body too large. Maximum allowed: ${formatBytes(limit)}`,
                size,
            };
        }

        return { isValid: true, size };
    } catch (_error) {
        // If we can't read the body, allow the request to proceed
        // The route handler will handle any actual issues
        return { isValid: true };
    }
}

/**
 * Middleware to enforce request size limits
 *
 * @param request - The Next.js request object
 * @param options - Configuration options
 * @returns NextResponse if request should be rejected, null otherwise
 */
export async function requestSizeMiddleware(
    request: NextRequest,
    options?: {
        customLimits?: Partial<typeof DEFAULT_SIZE_LIMITS>;
        routes?: Record<string, Partial<typeof DEFAULT_SIZE_LIMITS>>;
    }
): Promise<NextResponse | null> {
    // Only check requests with a body
    const method = request.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
        return null;
    }

    const contentType = request.headers.get('content-type') || '';

    // Determine limit
    let limit: number;
    if (options?.customLimits) {
        const mergedLimits = { ...DEFAULT_SIZE_LIMITS, ...options.customLimits };
        if (contentType.includes('application/json')) {
            limit = mergedLimits.json;
        } else if (contentType.includes('multipart/form-data')) {
            limit = mergedLimits.formData;
        } else if (contentType.includes('text/plain')) {
            limit = mergedLimits.text;
        } else {
            limit = mergedLimits.default;
        }
    } else {
        limit = getSizeLimit(request.nextUrl.pathname, contentType);
    }

    // Check route-specific limits
    if (options?.routes) {
        for (const [pattern, routeLimits] of Object.entries(options.routes)) {
            if (request.nextUrl.pathname.startsWith(pattern)) {
                if (contentType.includes('application/json') && routeLimits.json) {
                    limit = routeLimits.json;
                } else if (contentType.includes('multipart/form-data') && routeLimits.formData) {
                    limit = routeLimits.formData;
                }
                break;
            }
        }
    }

    const result = await checkRequestSize(request, limit);

    if (!result.isValid) {
        return NextResponse.json(
            {
                error: {
                    code: 'REQUEST_TOO_LARGE',
                    message: result.error,
                },
            },
            { status: 413 }
        );
    }

    return null;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} bytes`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Higher-order function to wrap API handlers with size limits
 *
 * @param handler - The original API route handler
 * @param options - Size limit options
 * @returns Wrapped handler with size checking
 */
export function withRequestSizeLimit(
    handler: (request: NextRequest, context: unknown) => Promise<NextResponse>,
    options?: {
        limit?: number;
        limits?: Partial<typeof DEFAULT_SIZE_LIMITS>;
    }
): (request: NextRequest, context: unknown) => Promise<NextResponse> {
    return async (request: NextRequest, context: unknown) => {
        const method = request.method.toUpperCase();

        if (['POST', 'PUT', 'PATCH'].includes(method)) {
            const contentType = request.headers.get('content-type') || '';
            let limit = options?.limit;

            if (!limit && options?.limits) {
                if (contentType.includes('application/json')) {
                    limit = options.limits.json ?? DEFAULT_SIZE_LIMITS.json;
                } else if (contentType.includes('multipart/form-data')) {
                    limit = options.limits.formData ?? DEFAULT_SIZE_LIMITS.formData;
                } else if (contentType.includes('text/plain')) {
                    limit = options.limits.text ?? DEFAULT_SIZE_LIMITS.text;
                } else {
                    limit = options.limits.default ?? DEFAULT_SIZE_LIMITS.default;
                }
            }

            const result = await checkRequestSize(request, limit);

            if (!result.isValid) {
                return NextResponse.json(
                    {
                        error: {
                            code: 'REQUEST_TOO_LARGE',
                            message: result.error,
                        },
                    },
                    { status: 413 }
                );
            }
        }

        return handler(request, context);
    };
}

/**
 * Export types for external use
 */
export type SizeLimits = typeof DEFAULT_SIZE_LIMITS;
