/**
 * Rate Limiting Utility
 *
 * Provides Redis-backed rate limiting with in-memory fallback for graceful degradation.
 * Implements sliding window algorithm for accurate rate limiting across distributed systems.
 *
 * P0 Security Requirement: Rate limiting on all mutation endpoints
 */

import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';
import { incrementCounter } from './monitoring/metrics';
import { logSecurityEvent } from './security/securityEvents';

// Rate limit configuration types
export interface RateLimitConfig {
    limit: number;
    windowSeconds: number;
    keyPrefix?: string;
}

export interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp when the window resets
}

// Default rate limits as per P0 security requirements
export const RATE_LIMITS = {
    // Mutation endpoints: 10 requests per 60 seconds
    mutations: {
        limit: 10,
        windowSeconds: 60,
        keyPrefix: 'rl:mut',
    } as RateLimitConfig,

    // Auth endpoints: 5 requests per 60 seconds (stricter for security)
    auth: {
        limit: 5,
        windowSeconds: 60,
        keyPrefix: 'rl:auth',
    } as RateLimitConfig,

    // Read endpoints: 60 requests per 60 seconds (generous for queries)
    reads: {
        limit: 60,
        windowSeconds: 60,
        keyPrefix: 'rl:read',
    } as RateLimitConfig,
};

// Endpoint category mappings
const ENDPOINT_CATEGORIES: { pattern: RegExp; config: RateLimitConfig }[] = [
    // Auth endpoints
    { pattern: /^\/api\/auth\//, config: RATE_LIMITS.auth },
    { pattern: /^\/api\/staff\/verify-pin/, config: RATE_LIMITS.auth },
    { pattern: /^\/api\/staff\/add-pin/, config: RATE_LIMITS.auth },
    { pattern: /^\/api\/staff\/invite/, config: RATE_LIMITS.auth },

    // Orders - mutation endpoints
    { pattern: /^\/api\/orders(\/|$)/, config: RATE_LIMITS.mutations },

    // Payments - mutation endpoints (critical for financial transactions)
    { pattern: /^\/api\/payments(\/|$)/, config: RATE_LIMITS.mutations },

    // Table sessions - mutation endpoints
    { pattern: /^\/api\/table-sessions(\/|$)/, config: RATE_LIMITS.mutations },

    // Waitlist - mutation endpoints
    { pattern: /^\/api\/waitlist(\/|$)/, config: RATE_LIMITS.mutations },

    // Staff management - mutations
    { pattern: /^\/api\/staff(\/|$)/, config: RATE_LIMITS.mutations },

    // KDS actions - mutations
    { pattern: /^\/api\/kds\/items\/.*\/action/, config: RATE_LIMITS.mutations },

    // Service requests - mutations
    { pattern: /^\/api\/service-requests(\/|$)/, config: RATE_LIMITS.mutations },

    // Settings mutations
    { pattern: /^\/api\/settings(\/|$)/, config: RATE_LIMITS.mutations },

    // Onboarding - mutations
    { pattern: /^\/api\/onboarding(\/|$)/, config: RATE_LIMITS.mutations },

    // Webhooks - mutations (but need to be accessible)
    { pattern: /^\/api\/webhooks(\/|$)/, config: RATE_LIMITS.mutations },

    // Finance mutations
    { pattern: /^\/api\/finance(\/|$)/, config: RATE_LIMITS.mutations },

    // Gift cards - mutations
    { pattern: /^\/api\/gift-cards(\/|$)/, config: RATE_LIMITS.mutations },

    // Discounts - mutations
    { pattern: /^\/api\/discounts(\/|$)/, config: RATE_LIMITS.mutations },

    // Tip pools - mutations
    { pattern: /^\/api\/tip-pools(\/|$)/, config: RATE_LIMITS.mutations },

    // Jobs - mutations
    { pattern: /^\/api\/jobs(\/|$)/, config: RATE_LIMITS.mutations },

    // Support tickets - mutations
    { pattern: /^\/api\/support\/tickets(\/|$)/, config: RATE_LIMITS.mutations },

    // Menu mutations
    { pattern: /^\/api\/menu(\/|$)/, config: RATE_LIMITS.mutations },

    // Loyalty programs - mutations
    { pattern: /^\/api\/loyalty\/programs(\/|$)/, config: RATE_LIMITS.mutations },

    // Notifications - mutations
    { pattern: /^\/api\/notifications(\/|$)/, config: RATE_LIMITS.mutations },

    // Restaurants - mutations
    { pattern: /^\/api\/restaurants(\/|$)/, config: RATE_LIMITS.mutations },

    // Tables - mutations
    { pattern: /^\/api\/tables(\/|$)/, config: RATE_LIMITS.mutations },

    // Analytics - typically read, but some mutations
    { pattern: /^\/api\/analytics(\/|$)/, config: RATE_LIMITS.reads },

    // Metrics - read only
    { pattern: /^\/api\/metrics(\/|$)/, config: RATE_LIMITS.reads },

    // Subgraphs - read only (GraphQL queries)
    { pattern: /^\/api\/subgraphs(\/|$)/, config: RATE_LIMITS.reads },

    // Docs - read only
    { pattern: /^\/api\/docs(\/|$)/, config: RATE_LIMITS.reads },
];

// =============================================================================
// Redis-backed rate limiting with in-memory fallback
// =============================================================================

/**
 * Singleton Redis client using Upstash
 * Uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables
 */
let redisClient: Redis | null = null;
let redisInitializationAttempted = false;

/**
 * Get or create Redis client
 * Returns null if Redis is not configured (graceful degradation)
 */
function getOrCreateRedisClient(): Redis | null {
    if (redisClient) {
        return redisClient;
    }

    // Prevent repeated initialization attempts
    if (redisInitializationAttempted) {
        return null;
    }
    redisInitializationAttempted = true;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        logger.warn(
            '[RateLimit] Redis not configured (UPSTASH_REDIS_REST_URL/TOKEN missing), using in-memory fallback'
        );
        return null;
    }

    try {
        redisClient = new Redis({
            url,
            token,
        });
        logger.info('[RateLimit] Redis client initialized for distributed rate limiting');
        return redisClient;
    } catch (error) {
        logger.error('[RateLimit] Failed to create Redis client', error);
        return null;
    }
}

/**
 * In-memory rate limit store for fallback
 * Key format: `${keyPrefix}:${identifier}`
 * Value: { count: number, windowStart: number }
 *
 * This is used when Redis is unavailable for graceful degradation
 */
class InMemoryRateLimitStore {
    private store: Map<string, { count: number; windowStart: number }> = new Map();
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Schedule cleanup every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60 * 1000);
    }

    /**
     * Increment the rate limit counter for a given key
     */
    async increment(key: string, windowSeconds: number): Promise<{ count: number; reset: number }> {
        const now = Date.now();
        const windowStart = Math.floor(now / (windowSeconds * 1000)) * (windowSeconds * 1000);
        const fullKey = `${key}:${windowStart}`;

        const entry = this.store.get(fullKey);
        const currentCount = entry ? entry.count : 0;
        const newCount = currentCount + 1;

        // Update or create entry
        this.store.set(fullKey, {
            count: newCount,
            windowStart,
        });

        return {
            count: newCount,
            reset: Math.ceil((windowStart + windowSeconds * 1000) / 1000),
        };
    }

    /**
     * Get current count for a key without incrementing
     */
    get(key: string, windowSeconds: number): number {
        const now = Date.now();
        const windowStart = Math.floor(now / (windowSeconds * 1000)) * (windowSeconds * 1000);
        const fullKey = `${key}:${windowStart}`;

        const entry = this.store.get(fullKey);
        return entry ? entry.count : 0;
    }

    /**
     * Clean up expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        const threshold = now - 60 * 60 * 1000; // Keep 1 hour of history

        // Use Array.from to avoid for-of iteration issues
        const entries = Array.from(this.store.entries());
        for (const [key, entry] of entries) {
            if (entry.windowStart < threshold) {
                this.store.delete(key);
            }
        }
    }

    /**
     * Destroy the store and cleanup interval
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.store.clear();
    }
}

// Singleton instance for in-memory fallback
let memoryStore: InMemoryRateLimitStore | null = null;

function getMemoryStore(): InMemoryRateLimitStore {
    if (!memoryStore) {
        memoryStore = new InMemoryRateLimitStore();
    }
    return memoryStore;
}

/**
 * Check rate limit using Redis with sliding window algorithm
 * Falls back to in-memory store if Redis is unavailable
 */
async function checkRedisRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
    endpoint?: string
): Promise<RateLimitResult> {
    const redis = getOrCreateRedisClient();
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // If Redis is not available, fall back to in-memory
    if (!redis) {
        logger.warn('Rate limiter falling back to in-memory store', {
            action: 'rate_limit:redis_fallback',
            endpoint: endpoint ?? key,
            reason: 'redis_not_configured',
        });

        const store = getMemoryStore();
        const currentCount = store.get(key, windowSeconds);

        if (currentCount >= limit) {
            const windowStartTs = Math.floor(now / (windowSeconds * 1000)) * (windowSeconds * 1000);
            return {
                success: false,
                limit,
                remaining: 0,
                reset: Math.ceil((windowStartTs + windowSeconds * 1000) / 1000),
            };
        }

        const result = await store.increment(key, windowSeconds);
        return {
            success: true,
            limit,
            remaining: Math.max(0, limit - result.count),
            reset: result.reset,
        };
    }

    try {
        // Use Redis pipeline for atomic operations
        const pipeline = redis.pipeline();

        // 1. Remove old entries outside the window
        pipeline.zremrangebyscore(key, 0, windowStart);

        // 2. Count current requests in window
        pipeline.zcard(key);

        // 3. Execute pipeline
        const results = await pipeline.exec();
        const currentCount = (results?.[1] as number) ?? 0;

        // Check if limit exceeded
        if (currentCount >= limit) {
            return {
                success: false,
                limit,
                remaining: 0,
                reset: Math.ceil((now + windowSeconds * 1000) / 1000),
            };
        }

        // 4. Add new entry for this request
        const requestId = `${now}:${Math.random().toString(36).slice(2, 11)}`;
        await redis.zadd(key, {
            score: now,
            member: requestId,
        });

        // 5. Set expiry on the key (window + buffer)
        await redis.expire(key, windowSeconds + 1);

        return {
            success: true,
            limit,
            remaining: Math.max(0, limit - currentCount - 1),
            reset: Math.ceil((now + windowSeconds * 1000) / 1000),
        };
    } catch (error) {
        // Log error and fall back to in-memory on Redis failure
        logger.error('[RateLimit] Redis error, falling back to in-memory', error);

        logger.warn('Rate limiter falling back to in-memory store', {
            action: 'rate_limit:redis_fallback',
            endpoint: endpoint ?? key,
            reason: 'redis_error',
        });

        const store = getMemoryStore();
        const currentCount = store.get(key, windowSeconds);

        if (currentCount >= limit) {
            const windowStartTs = Math.floor(now / (windowSeconds * 1000)) * (windowSeconds * 1000);
            return {
                success: false,
                limit,
                remaining: 0,
                reset: Math.ceil((windowStartTs + windowSeconds * 1000) / 1000),
            };
        }

        const result = await store.increment(key, windowSeconds);
        return {
            success: true,
            limit,
            remaining: Math.max(0, limit - result.count),
            reset: result.reset,
        };
    }
}

/**
 * Get client IP from request
 */
async function getClientIP(request: NextRequest): Promise<string> {
    // Check for forwarded headers (when behind proxy/load balancer)
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        // Take the first IP in the chain
        return forwarded.split(',')[0].trim();
    }

    // Check for real IP header
    const realIP = request.headers.get('x-real-ip');
    if (realIP) {
        return realIP;
    }

    // Fallback: generate a fingerprint from user-agent and accept-language
    // using Web Crypto API (Edge Runtime compatible)
    const userAgent = request.headers.get('user-agent') || '';
    const acceptLang = request.headers.get('accept-language') || '';
    const data = new TextEncoder().encode(`${userAgent}:${acceptLang}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fingerprint = hashArray
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .substring(0, 16);
    return `fp-${fingerprint}`;
}

function getAbuseThreshold(): number {
    const envValue = process.env.RATE_LIMIT_ABUSE_THRESHOLD;
    if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) return parsed;
    }
    return 5;
}

function getAbuseWindowSeconds(): number {
    const envValue = process.env.RATE_LIMIT_ABUSE_WINDOW_SECONDS;
    if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (!isNaN(parsed) && parsed >= 60 && parsed <= 3600) return parsed;
    }
    return 300;
}

function getEndpointAbuseThreshold(endpoint: string): number {
    const base = getAbuseThreshold();
    if (endpoint.includes('/api/auth/')) return Math.max(2, Math.floor(base / 2));
    if (endpoint.includes('/api/payments/')) return Math.max(2, Math.floor(base / 2));
    if (endpoint.includes('/api/orders/')) return base;
    return base;
}

export async function checkRateLimitAbuse(ip: string, endpoint: string): Promise<boolean> {
    const threshold = getEndpointAbuseThreshold(endpoint);
    const windowSeconds = getAbuseWindowSeconds();
    const redis = getOrCreateRedisClient();

    if (redis) {
        try {
            const abuseKey = `rl:abuse:${ip}`;
            const count = await redis.incr(abuseKey);

            if (count === 1) {
                await redis.expire(abuseKey, windowSeconds);
            }

            if (count > threshold) {
                logger.warn('Rate limit abuse detected', {
                    action: 'rate_limit:abuse_detected',
                    clientIp: ip,
                    endpoint,
                    abuseCount: count,
                    windowSeconds,
                });

                void logSecurityEvent({
                    type: 'brute_force_detected',
                    severity: 'high',
                    ipAddress: ip,
                    userAgent: 'unknown',
                    metadata: {
                        abuse_type: 'rate_limit_abuse',
                        endpoint,
                        abuse_count: count,
                        window_seconds: windowSeconds,
                        threshold,
                    },
                    timestamp: new Date(),
                });

                incrementCounter('rate_limit.abuse_detected', 1, {
                    endpoint,
                });

                return true;
            }
        } catch (error) {
            logger.error('[RateLimit] Failed to check abuse pattern', error);
        }
    } else {
        const store = getMemoryStore();
        const abuseKey = `rl:abuse:${ip}:${endpoint}`;
        const currentCount = store.get(abuseKey, windowSeconds);

        if (currentCount + 1 > threshold) {
            logger.warn('Rate limit abuse detected (in-memory)', {
                action: 'rate_limit:abuse_detected',
                clientIp: ip,
                endpoint,
                abuseCount: currentCount + 1,
                windowSeconds,
            });

            void logSecurityEvent({
                type: 'brute_force_detected',
                severity: 'high',
                ipAddress: ip,
                userAgent: 'unknown',
                metadata: {
                    abuse_type: 'rate_limit_abuse',
                    endpoint,
                    abuse_count: currentCount + 1,
                    window_seconds: windowSeconds,
                    threshold,
                    store: 'in_memory',
                },
                timestamp: new Date(),
            });

            incrementCounter('rate_limit.abuse_detected', 1, {
                endpoint,
            });

            return true;
        }

        await store.increment(abuseKey, windowSeconds);
    }

    return false;
}

/**
 * Get rate limit configuration for a given path and method
 */
function getRateLimitConfig(path: string, method: string): RateLimitConfig | null {
    // Only apply rate limiting to mutation methods
    const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase());

    if (!isMutation) {
        // For now, don't rate limit read operations at middleware level
        // They can be added later if needed
        return null;
    }

    // Find matching endpoint category
    for (const { pattern, config } of ENDPOINT_CATEGORIES) {
        if (pattern.test(path)) {
            return config;
        }
    }

    // Default to mutations if path matches API but no specific config
    if (path.startsWith('/api/')) {
        return RATE_LIMITS.mutations;
    }

    return null;
}

/**
 * Check rate limit for a request
 * Returns rate limit result with the configured limit and remaining requests
 * Uses Redis when available, falls back to in-memory store
 */
export async function checkRateLimit(
    request: NextRequest,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const clientIP = await getClientIP(request);
    const path = request.nextUrl.pathname;

    const key = `${config.keyPrefix || 'rl'}:${clientIP}:${path}`;

    const result = await checkRedisRateLimit(key, config.limit, config.windowSeconds, path);

    const category = config.keyPrefix?.replace('rl:', '') ?? 'unknown';
    const status = result.success ? 'allowed' : 'rejected';

    incrementCounter('rate_limit.check', 1, {
        category,
        result: status,
        endpoint: path,
    });

    if (!result.success) {
        incrementCounter('rate_limit.rejected', 1, {
            category,
            endpoint: path,
        });
    }

    return result;
}

/**
 * Rate limit middleware handler
 * Returns NextResponse with rate limit headers if rate limited, otherwise null
 */
export async function rateLimitMiddleware(request: NextRequest): Promise<NextResponse | null> {
    const path = request.nextUrl.pathname;
    const method = request.method;

    // Get rate limit config for this endpoint
    const config = getRateLimitConfig(path, method);

    if (!config) {
        // No rate limiting needed for this endpoint
        return null;
    }

    // Check rate limit
    const result = await checkRateLimit(request, config);

    // Create response (will be modified by caller)
    const response = NextResponse.next();

    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.reset.toString());

    // If rate limited, return 429
    if (!result.success) {
        const clientIp = await getClientIP(request);

        logger.warn('Rate limit exceeded', {
            action: 'rate_limit:exceeded',
            clientIp,
            endpoint: path,
            limit: config.limit,
            windowSeconds: config.windowSeconds,
        });

        void logSecurityEvent({
            type: 'rate_limit_exceeded',
            severity: 'medium',
            ipAddress: clientIp,
            userAgent: request.headers.get('user-agent') || 'unknown',
            metadata: {
                endpoint: path,
                limit: config.limit,
                windowSeconds: config.windowSeconds,
            },
            timestamp: new Date(),
        });

        void checkRateLimitAbuse(clientIp, path);

        return NextResponse.json(
            {
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many requests. Please try again later.',
                    retryAfter: result.reset - Math.floor(Date.now() / 1000),
                },
            },
            {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': result.limit.toString(),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': result.reset.toString(),
                    'Retry-After': (result.reset - Math.floor(Date.now() / 1000)).toString(),
                },
            }
        );
    }

    return null;
}

/**
 * Apply rate limiting to an API route handler
 * This can be used in individual route.ts files for more granular control
 */
export function withRateLimit<T extends (...args: unknown[]) => unknown>(
    handler: T,
    config: RateLimitConfig
): T {
    return (async (request: NextRequest, ...args: unknown[]) => {
        const result = await checkRateLimit(request, config);

        if (!result.success) {
            const clientIp = await getClientIP(request);

            logger.warn('Rate limit exceeded', {
                action: 'rate_limit:exceeded',
                clientIp,
                endpoint: request.nextUrl.pathname,
                limit: config.limit,
                windowSeconds: config.windowSeconds,
            });

            void logSecurityEvent({
                type: 'rate_limit_exceeded',
                severity: 'medium',
                ipAddress: clientIp,
                userAgent: request.headers.get('user-agent') || 'unknown',
                metadata: {
                    endpoint: request.nextUrl.pathname,
                    limit: config.limit,
                    windowSeconds: config.windowSeconds,
                },
                timestamp: new Date(),
            });

            void checkRateLimitAbuse(clientIp, request.nextUrl.pathname);

            return NextResponse.json(
                {
                    error: {
                        code: 'RATE_LIMIT_EXCEEDED',
                        message: 'Too many requests. Please try again later.',
                        retryAfter: result.reset - Math.floor(Date.now() / 1000),
                    },
                },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': result.limit.toString(),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': result.reset.toString(),
                        'Retry-After': (result.reset - Math.floor(Date.now() / 1000)).toString(),
                    },
                }
            );
        }

        // Add rate limit headers to successful response
        const response = (await handler(request, ...args)) as NextResponse | Response | undefined;
        if (response && typeof response === 'object' && 'headers' in response) {
            const headersObj = response.headers as Headers;
            headersObj.set('X-RateLimit-Limit', result.limit.toString());
            headersObj.set('X-RateLimit-Remaining', result.remaining.toString());
            headersObj.set('X-RateLimit-Reset', result.reset.toString());
        }

        return response;
    }) as T;
}

/**
 * Get Redis client for external use
 * Returns the Redis client instance or null if not configured
 * @deprecated Use the internal Redis-backed rate limiting instead
 */
export function getRedisClient(): Redis | null {
    return getOrCreateRedisClient();
}
