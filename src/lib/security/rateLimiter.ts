/**
 * Rate Limiting Middleware
 *
 * Addresses COMPREHENSIVE_CODEBASE_AUDIT_REPORT Section 3.2
 * Implements rate limiting to prevent brute-force attacks and API abuse
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import { logger } from '@/lib/logger';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
    /** Time window in seconds */
    windowSec: number;
    /** Maximum requests allowed in the window */
    maxRequests: number;
    /** Key prefix for identification */
    keyPrefix: string;
    /** Whether to skip successful requests from count */
    skipSuccessfulRequests?: boolean;
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMIT_CONFIGS = {
    // Authentication endpoints - stricter limits
    auth: {
        windowSec: 60 * 15, // 15 minutes
        maxRequests: 5,
        keyPrefix: 'rl:auth',
    },
    // Order creation - prevent spam
    orderCreate: {
        windowSec: 60, // 1 minute
        maxRequests: 10,
        keyPrefix: 'rl:order',
    },
    // Service requests - prevent spam
    serviceRequest: {
        windowSec: 60, // 1 minute
        maxRequests: 5,
        keyPrefix: 'rl:service',
    },
    // General API - moderate limits
    api: {
        windowSec: 60, // 1 minute
        maxRequests: 100,
        keyPrefix: 'rl:api',
    },
    // Guest endpoints - moderate limits
    guest: {
        windowSec: 60, // 1 minute
        maxRequests: 60,
        keyPrefix: 'rl:guest',
    },
} as const satisfies Record<string, RateLimitConfig>;

/**
 * Extract client identifier from request
 * Uses fingerprint if available, falls back to IP + User-Agent
 */
export function getClientIdentifier(request: NextRequest): {
    fingerprint: string;
    ipAddress: string;
    userAgent: string;
} {
    // Try to get fingerprint from header (set by client)
    const fingerprint =
        request.headers.get('x-fingerprint') || request.headers.get('x-device-id') || '';

    // Get IP address
    const ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';

    // Get user agent
    const userAgent = request.headers.get('user-agent') || 'unknown';

    return {
        fingerprint: fingerprint || `${ipAddress}:${userAgent.slice(0, 50)}`,
        ipAddress,
        userAgent,
    };
}

/**
 * Check rate limit using database
 */
export async function checkRateLimit(
    fingerprint: string,
    action: string,
    config: RateLimitConfig,

    _restaurantId?: string
): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    retryAfter?: number;
}> {
    const supabase = await createClient();
    const now = new Date();
    const windowStart = new Date(now.getTime() - config.windowSec * 1000);

    // Count requests in the current window
    const { count, error } = await supabase
        .from('rate_limit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('fingerprint', fingerprint)
        .eq('action', action)
        .gte('created_at', windowStart.toISOString());

    if (error) {
        logger.error('Rate limit check error:', error);
        // SECURITY: Fail closed - deny request on error to prevent bypass
        // This ensures that if the rate limiting system fails, attackers cannot exploit it
        return {
            allowed: false,
            remaining: 0,
            resetAt: new Date(now.getTime() + config.windowSec * 1000),
            retryAfter: config.windowSec,
        };
    }

    const currentCount = count || 0;
    const remaining = Math.max(0, config.maxRequests - currentCount);
    const resetAt = new Date(now.getTime() + config.windowSec * 1000);

    return {
        allowed: currentCount < config.maxRequests,
        remaining,
        resetAt,
        retryAfter: currentCount >= config.maxRequests ? config.windowSec : undefined,
    };
}

/**
 * Log a rate-limited request
 */
export async function logRateLimitedRequest(
    fingerprint: string,
    action: string,
    ipAddress: string,
    userAgent: string,
    restaurantId?: string,
    metadata?: Record<string, unknown>
): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.from('rate_limit_logs').insert({
        fingerprint,
        action,
        ip_address: ipAddress,
        user_agent: userAgent,
        restaurant_id: restaurantId,
        metadata: (metadata || null) as Json,
    });

    if (error) {
        logger.error('Failed to log rate limit entry:', error);
    }
}

/**
 * Clean up old rate limit logs
 * Should be called periodically via cron or scheduled function
 */
export async function cleanupRateLimitLogs(olderThanHours: number = 24): Promise<number> {
    const supabase = await createClient();
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    const { error, count } = await supabase
        .from('rate_limit_logs')
        .delete()
        .lt('created_at', cutoff.toISOString());

    if (error) {
        logger.error('Failed to cleanup rate limit logs:', error);
        return 0;
    }

    return count || 0;
}

/**
 * Create rate limit middleware for API routes
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
    return async function rateLimitMiddleware(
        request: NextRequest,
        context?: { params?: Record<string, string> }
    ): Promise<NextResponse | null> {
        const { fingerprint, ipAddress, userAgent } = getClientIdentifier(request);

        // Check rate limit
        const result = await checkRateLimit(fingerprint, config.keyPrefix, config);

        // Log the request
        await logRateLimitedRequest(
            fingerprint,
            config.keyPrefix,
            ipAddress,
            userAgent,
            context?.params?.restaurantId
        );

        if (!result.allowed) {
            return NextResponse.json(
                {
                    error: 'Too many requests',
                    code: 'RATE_LIMITED',
                    retryAfter: result.retryAfter,
                },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': config.maxRequests.toString(),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': result.resetAt.toISOString(),
                        'Retry-After': result.retryAfter?.toString() || '60',
                    },
                }
            );
        }

        // Request allowed, proceed
        return null;
    };
}

/**
 * Higher-order function to wrap API route handlers with rate limiting
 */
export function withRateLimit<T extends unknown[]>(
    handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
    config: RateLimitConfig
) {
    return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
        const { fingerprint, ipAddress, userAgent } = getClientIdentifier(request);

        // Check rate limit
        const result = await checkRateLimit(fingerprint, config.keyPrefix, config);

        // Log the request
        await logRateLimitedRequest(fingerprint, config.keyPrefix, ipAddress, userAgent);

        if (!result.allowed) {
            return NextResponse.json(
                {
                    error: 'Too many requests',
                    code: 'RATE_LIMITED',
                    retryAfter: result.retryAfter,
                },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': config.maxRequests.toString(),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': result.resetAt.toISOString(),
                        'Retry-After': result.retryAfter?.toString() || '60',
                    },
                }
            );
        }

        // Execute handler
        const response = await handler(request, ...args);

        // Add rate limit headers to response
        response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
        response.headers.set('X-RateLimit-Reset', result.resetAt.toISOString());

        return response;
    };
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
    auth: createRateLimitMiddleware(RATE_LIMIT_CONFIGS.auth),
    orderCreate: createRateLimitMiddleware(RATE_LIMIT_CONFIGS.orderCreate),
    serviceRequest: createRateLimitMiddleware(RATE_LIMIT_CONFIGS.serviceRequest),
    api: createRateLimitMiddleware(RATE_LIMIT_CONFIGS.api),
    guest: createRateLimitMiddleware(RATE_LIMIT_CONFIGS.guest),
};

export default rateLimiters;
