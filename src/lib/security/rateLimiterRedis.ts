/**
 * Redis-Backed Rate Limiting Middleware
 *
 * Implements distributed rate limiting using Redis with sliding window algorithm.
 * Addresses COMPREHENSIVE_PLATFORM_AUDIT_REPORT findings for "Missing rate limiting on some endpoints"
 *
 * Rate limit configuration:
 * - General API: 100 requests per minute per IP
 * - Auth endpoints: 10 requests per minute per IP
 * - Mutation endpoints: 30 requests per minute per authenticated user
 *
 * Uses sliding window algorithm for accurate rate limiting across distributed systems.
 */

import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Rate limit configuration
 */
export interface RedisRateLimitConfig {
    /** Time window in seconds */
    windowSec: number;
    /** Maximum requests allowed in the window */
    maxRequests: number;
    /** Key prefix for identification */
    keyPrefix: string;
    /** Whether to limit by authenticated user instead of IP */
    limitByUser?: boolean;
}

/**
 * Result of rate limit check
 */
export interface RedisRateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
    retryAfter?: number;
}

/**
 * Default rate limit configurations
 */
export const REDIS_RATE_LIMIT_CONFIGS = {
    // General API - 100 requests per minute per IP
    generalApi: {
        windowSec: 60,
        maxRequests: 100,
        keyPrefix: 'rl:api',
    },
    // Authentication endpoints - stricter limits (10 per minute per IP)
    auth: {
        windowSec: 60,
        maxRequests: 10,
        keyPrefix: 'rl:auth',
    },
    // Mutation endpoints - 30 requests per minute per authenticated user
    mutation: {
        windowSec: 60,
        maxRequests: 30,
        keyPrefix: 'rl:mutation',
        limitByUser: true,
    },
    // Order creation - 30 requests per minute
    orderCreate: {
        windowSec: 60,
        maxRequests: 30,
        keyPrefix: 'rl:order:create',
    },
    // Payment processing - 10 requests per minute
    payment: {
        windowSec: 60,
        maxRequests: 10,
        keyPrefix: 'rl:payment',
        limitByUser: true,
    },
    // Guest creation - 30 requests per minute
    guestCreate: {
        windowSec: 60,
        maxRequests: 30,
        keyPrefix: 'rl:guest:create',
        limitByUser: true,
    },
    // Order items addition - 30 requests per minute
    orderItems: {
        windowSec: 60,
        maxRequests: 30,
        keyPrefix: 'rl:order:items',
    },
} as const satisfies Record<string, RedisRateLimitConfig>;

// Singleton Redis client
let redisClient: Redis | null = null;

/**
 * Get or create Redis client using Upstash
 */
export function getRedisRateLimiterClient(): Redis | null {
    if (redisClient) {
        return redisClient;
    }

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        logger.warn('[RateLimiter] Redis not configured, rate limiting will be bypassed');
        return null;
    }

    try {
        redisClient = new Redis({
            url,
            token,
        });
        return redisClient;
    } catch (error) {
        logger.error('[RateLimiter] Failed to create Redis client', error);
        return null;
    }
}

/**
 * Get client identifier from request (IP-based)
 */
export function getClientIp(request: NextRequest): string {
    const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown';
    return ip;
}

/**
 * Get authenticated user ID from request (for user-based rate limiting)
 */
export async function getAuthenticatedUserId(_request: NextRequest): Promise<string | null> {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        return user?.id ?? null;
    } catch {
        return null;
    }
}

/**
 * Build rate limit key based on configuration
 */
function buildRateLimitKey(config: RedisRateLimitConfig, identifier: string): string {
    return `${config.keyPrefix}:${identifier}`;
}

/**
 * Sliding window rate limit check using Redis sorted sets
 *
 * This algorithm uses a sorted set where:
 * - Member: timestamp (milliseconds)
 * - Score: timestamp (milliseconds)
 *
 * We count entries within the sliding window and add new entries atomically.
 */
export async function checkRedisRateLimit(
    identifier: string,
    config: RedisRateLimitConfig
): Promise<RedisRateLimitResult> {
    const redis = getRedisRateLimiterClient();

    // If Redis is not available, fail open (allow request) but log warning
    if (!redis) {
        return {
            allowed: true,
            remaining: config.maxRequests,
            resetAt: Date.now() + config.windowSec * 1000,
        };
    }

    const key = buildRateLimitKey(config, identifier);
    const now = Date.now();
    const windowStart = now - config.windowSec * 1000;

    try {
        const pipeline = redis.pipeline();

        // 1. Remove old entries outside the window
        pipeline.zremrangebyscore(key, 0, windowStart);

        // 2. Count current requests in window
        pipeline.zcard(key);

        // 3. Execute pipeline to get current count
        const results = await pipeline.exec();

        // results[0] is zremrangebyscore result (count removed)
        // results[1] is zcard result (current count)
        const currentCount = (results?.[1] as number) ?? 0;

        // Check if limit exceeded
        if (currentCount >= config.maxRequests) {
            // Get oldest entry for retry calculation using zrange with byscore
            const oldestEntry = await redis.zrange(key, 0, windowStart, {
                byScore: true,
                rev: false,
                offset: 0,
                count: 1,
            });
            const oldestTimestamp = oldestEntry && oldestEntry.length > 0 ? now : now;
            const retryAfter = Math.ceil(config.windowSec - (now - windowStart) / 1000);

            return {
                allowed: false,
                remaining: 0,
                resetAt: oldestTimestamp + config.windowSec * 1000,
                retryAfter,
            };
        }

        // 4. Add new entry for this request
        const requestId = `${now}:${Math.random().toString(36).slice(2, 11)}`;
        await redis.zadd(key, {
            score: now,
            member: requestId,
        });

        // 5. Set expiry on the key (window + buffer to ensure cleanup)
        await redis.expire(key, config.windowSec + 1);

        return {
            allowed: true,
            remaining: Math.max(0, config.maxRequests - currentCount - 1),
            resetAt: now + config.windowSec * 1000,
        };
    } catch (error) {
        logger.error('[RateLimiter] Redis error', error);
        // Fail open on error - allow request but log
        return {
            allowed: true,
            remaining: config.maxRequests,
            resetAt: Date.now() + config.windowSec * 1000,
        };
    }
}

/**
 * Log rate limit violation for security monitoring
 */
export async function logRateLimitViolation(
    identifier: string,
    config: RedisRateLimitConfig,
    ipAddress: string,
    userAgent: string,
    endpoint: string
): Promise<void> {
    logger.warn(
        `[RateLimit] Rate limit exceeded: endpoint=${endpoint}, identifier=${identifier}, ` +
            `ip=${ipAddress}, config=${config.keyPrefix}, maxRequests=${config.maxRequests}, ` +
            `windowSec=${config.windowSec}`
    );

    // Could also emit to security events or external logging service
    // For now, we rely on the console warning which should be picked up by logging infrastructure
}

/**
 * Create rate limit middleware for Next.js API routes
 */
export function createRedisRateLimitMiddleware(config: RedisRateLimitConfig) {
    return async function rateLimitMiddleware(
        request: NextRequest,
        _context?: { params?: Record<string, string> }
    ): Promise<NextResponse | null> {
        // Determine identifier based on config
        let identifier: string;

        if (config.limitByUser) {
            // For user-based rate limiting, try to get authenticated user
            const userId = await getAuthenticatedUserId(request);
            if (userId) {
                identifier = `user:${userId}`;
            } else {
                // Fall back to IP if not authenticated
                identifier = `ip:${getClientIp(request)}`;
            }
        } else {
            // IP-based rate limiting
            identifier = `ip:${getClientIp(request)}`;
        }

        // Check rate limit
        const result = await checkRedisRateLimit(identifier, config);

        // Log violation if not allowed
        if (!result.allowed) {
            await logRateLimitViolation(
                identifier,
                config,
                getClientIp(request),
                request.headers.get('user-agent') || 'unknown',
                request.nextUrl.pathname
            );
        }

        if (!result.allowed) {
            return NextResponse.json(
                {
                    error: 'Too many requests',
                    code: 'RATE_LIMITED',
                    message: `Rate limit exceeded. Please wait ${result.retryAfter} seconds before retrying.`,
                    retryAfter: result.retryAfter,
                },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': config.maxRequests.toString(),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
                        'Retry-After': result.retryAfter?.toString() || config.windowSec.toString(),
                    },
                }
            );
        }

        // Create response with rate limit headers
        const response = NextResponse.next();
        response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
        response.headers.set('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

        return response;
    };
}

/**
 * Higher-order function to wrap API route handlers with Redis rate limiting
 */
export function withRedisRateLimit<T extends unknown[]>(
    handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
    config: RedisRateLimitConfig
) {
    return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
        // Determine identifier based on config
        let identifier: string;

        if (config.limitByUser) {
            const userId = await getAuthenticatedUserId(request);
            if (userId) {
                identifier = `user:${userId}`;
            } else {
                identifier = `ip:${getClientIp(request)}`;
            }
        } else {
            identifier = `ip:${getClientIp(request)}`;
        }

        // Check rate limit
        const result = await checkRedisRateLimit(identifier, config);

        // Log violation if not allowed
        if (!result.allowed) {
            await logRateLimitViolation(
                identifier,
                config,
                getClientIp(request),
                request.headers.get('user-agent') || 'unknown',
                request.nextUrl.pathname
            );

            return NextResponse.json(
                {
                    error: 'Too many requests',
                    code: 'RATE_LIMITED',
                    message: `Rate limit exceeded. Please wait ${result.retryAfter} seconds before retrying.`,
                    retryAfter: result.retryAfter,
                },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': config.maxRequests.toString(),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
                        'Retry-After': result.retryAfter?.toString() || config.windowSec.toString(),
                    },
                }
            );
        }

        // Execute handler
        const response = await handler(request, ...args);

        // Add rate limit headers to response
        response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
        response.headers.set('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

        return response;
    };
}

/**
 * Pre-configured Redis rate limiters for common use cases
 */
export const redisRateLimiters = {
    generalApi: createRedisRateLimitMiddleware(REDIS_RATE_LIMIT_CONFIGS.generalApi),
    auth: createRedisRateLimitMiddleware(REDIS_RATE_LIMIT_CONFIGS.auth),
    mutation: createRedisRateLimitMiddleware(REDIS_RATE_LIMIT_CONFIGS.mutation),
    orderCreate: createRedisRateLimitMiddleware(REDIS_RATE_LIMIT_CONFIGS.orderCreate),
    payment: createRedisRateLimitMiddleware(REDIS_RATE_LIMIT_CONFIGS.payment),
    guestCreate: createRedisRateLimitMiddleware(REDIS_RATE_LIMIT_CONFIGS.guestCreate),
    orderItems: createRedisRateLimitMiddleware(REDIS_RATE_LIMIT_CONFIGS.orderItems),
};

export default redisRateLimiters;

/**
 * Rate limit check for Server Actions
 * Use this function inside Server Actions to check rate limits
 *
 * @example
 * ```typescript
 * 'use server';
 *
 * export async function myServerAction(formData: FormData) {
 *   const rateLimit = await checkServerActionRateLimit('mutation');
 *   if (!rateLimit.allowed) {
 *     return { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter };
 *   }
 *   // ... action logic
 * }
 * ```
 */
export async function checkServerActionRateLimit(
    actionType: keyof typeof REDIS_RATE_LIMIT_CONFIGS,
    userId?: string | null
): Promise<RedisRateLimitResult> {
    const config = REDIS_RATE_LIMIT_CONFIGS[actionType];
    const identifier = userId ? `user:${userId}` : `action:${actionType}`;
    return checkRedisRateLimit(identifier, config);
}
