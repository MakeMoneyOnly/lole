/**
 * Tests for Rate Limiting Utility
 *
 * Tests Redis-backed rate limiting with in-memory fallback.
 * Covers sliding window algorithm, fallback behavior, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
    RATE_LIMITS,
    checkRateLimit,
    rateLimitMiddleware,
    withRateLimit,
    type RateLimitConfig,
    type RateLimitResult as _RateLimitResult,
} from '../rate-limit';

// Mock the logger
vi.mock('../logger', () => ({
    logger: {
        warn: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../security/securityEvents', () => ({
    logSecurityEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock Redis to test fallback behavior
const mockRedis = {
    pipeline: vi.fn(() => ({
        zremrangebyscore: vi.fn().mockReturnThis(),
        zcard: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([null, 0]),
    })),
    zadd: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
};

vi.mock('@upstash/redis', () => ({
    Redis: vi.fn(() => mockRedis),
}));

describe('Rate Limiting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset environment for each test
        process.env.UPSTASH_REDIS_REST_URL = '';
        process.env.UPSTASH_REDIS_REST_TOKEN = '';
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('RATE_LIMITS configuration', () => {
        it('should have correct mutation limits', () => {
            expect(RATE_LIMITS.mutations.limit).toBe(10);
            expect(RATE_LIMITS.mutations.windowSeconds).toBe(60);
            expect(RATE_LIMITS.mutations.keyPrefix).toBe('rl:mut');
        });

        it('should have correct auth limits (stricter)', () => {
            expect(RATE_LIMITS.auth.limit).toBe(5);
            expect(RATE_LIMITS.auth.windowSeconds).toBe(60);
            expect(RATE_LIMITS.auth.keyPrefix).toBe('rl:auth');
        });

        it('should have correct read limits (more generous)', () => {
            expect(RATE_LIMITS.reads.limit).toBe(60);
            expect(RATE_LIMITS.reads.windowSeconds).toBe(60);
            expect(RATE_LIMITS.reads.keyPrefix).toBe('rl:read');
        });
    });

    describe('checkRateLimit', () => {
        it('should return success when under limit', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/v1/merchant/operations/orders',
                {
                    method: 'POST',
                    headers: {
                        'x-forwarded-for': '192.168.1.1',
                    },
                }
            );

            const config: RateLimitConfig = {
                limit: 5,
                windowSeconds: 60,
                keyPrefix: 'test',
            };

            const result = await checkRateLimit(request, config);

            expect(result.success).toBe(true);
            expect(result.limit).toBe(5);
            expect(result.remaining).toBeGreaterThanOrEqual(0);
            expect(result.reset).toBeGreaterThan(0);
        });

        it('should use x-real-ip header when x-forwarded-for is not present', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/v1/merchant/operations/orders',
                {
                    method: 'POST',
                    headers: {
                        'x-real-ip': '10.0.0.1',
                    },
                }
            );

            const config: RateLimitConfig = {
                limit: 5,
                windowSeconds: 60,
                keyPrefix: 'test',
            };

            const result = await checkRateLimit(request, config);

            expect(result.success).toBe(true);
        });

        it('should fallback to 127.0.0.1 when no IP headers are present', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/v1/merchant/operations/orders',
                {}
            );

            const config: RateLimitConfig = {
                limit: 5,
                windowSeconds: 60,
                keyPrefix: 'test',
            };

            const result = await checkRateLimit(request, config);

            expect(result.success).toBe(true);
        });

        it('should handle multiple requests and track count', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/v1/merchant/operations/orders',
                {
                    method: 'POST',
                    headers: {
                        'x-forwarded-for': '192.168.1.2',
                    },
                }
            );

            const config: RateLimitConfig = {
                limit: 3,
                windowSeconds: 60,
                keyPrefix: 'test-multi',
            };

            // First request
            const result1 = await checkRateLimit(request, config);
            expect(result1.success).toBe(true);
            expect(result1.remaining).toBe(2);

            // Second request
            const result2 = await checkRateLimit(request, config);
            expect(result2.success).toBe(true);
            expect(result2.remaining).toBe(1);

            // Third request
            const result3 = await checkRateLimit(request, config);
            expect(result3.success).toBe(true);
            expect(result3.remaining).toBe(0);

            // Fourth request should be rate limited
            const result4 = await checkRateLimit(request, config);
            expect(result4.success).toBe(false);
            expect(result4.remaining).toBe(0);
        });
    });

    describe('rateLimitMiddleware', () => {
        it('should return null for GET requests (no rate limiting)', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/v1/merchant/operations/orders',
                {
                    method: 'GET',
                    headers: {
                        'x-forwarded-for': '192.168.1.3',
                    },
                }
            );

            const result = await rateLimitMiddleware(request);

            expect(result).toBeNull();
        });

        it('should return null for non-API paths', async () => {
            const request = new NextRequest('http://localhost:3000/orders', {
                method: 'POST',
                headers: {
                    'x-forwarded-for': '192.168.1.4',
                },
            });

            const result = await rateLimitMiddleware(request);

            expect(result).toBeNull();
        });

        it('should apply rate limiting to POST requests to API endpoints', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/v1/merchant/operations/orders',
                {
                    method: 'POST',
                    headers: {
                        'x-forwarded-for': '192.168.1.5',
                    },
                }
            );

            const result = await rateLimitMiddleware(request);

            // Should return null (continue) for first request
            expect(result).toBeNull();
        });

        it('should return 429 response when rate limit exceeded', async () => {
            const ip = '192.168.1.6';
            const request = new NextRequest(
                'http://localhost:3000/api/v1/merchant/operations/orders',
                {
                    method: 'POST',
                    headers: {
                        'x-forwarded-for': ip,
                    },
                }
            );

            // Make multiple requests to exceed the limit
            // Default mutation limit is 10, so we need 11 requests
            for (let i = 0; i < 11; i++) {
                const result = await rateLimitMiddleware(request);

                if (i < 10) {
                    expect(result).toBeNull();
                } else {
                    expect(result).not.toBeNull();
                    expect(result?.status).toBe(429);

                    const body = await result?.json();
                    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
                    expect(result?.headers.get('X-RateLimit-Limit')).toBe('10');
                    expect(result?.headers.get('X-RateLimit-Remaining')).toBe('0');
                    expect(result?.headers.get('Retry-After')).toBeDefined();
                }
            }
        });

        it('should apply stricter rate limiting to auth endpoints', async () => {
            const ip = '192.168.1.7';
            const request = new NextRequest(
                'http://localhost:3000/api/v1/merchant/core/auth/login',
                {
                    method: 'POST',
                    headers: {
                        'x-forwarded-for': ip,
                    },
                }
            );

            // Auth limit is 5, so 6th request should be rate limited
            for (let i = 0; i < 6; i++) {
                const result = await rateLimitMiddleware(request);

                if (i < 5) {
                    expect(result).toBeNull();
                } else {
                    expect(result).not.toBeNull();
                    expect(result?.status).toBe(429);
                }
            }
        });
    });

    describe('withRateLimit HOC', () => {
        it('should wrap handler and add rate limit headers', async () => {
            const mockHandler = vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ success: true }), {
                    status: 200,
                    headers: new Headers(),
                })
            );

            const wrappedHandler = withRateLimit(mockHandler, {
                limit: 5,
                windowSeconds: 60,
                keyPrefix: 'test-hoc',
            });

            const request = new NextRequest('http://localhost:3000/api/v1/system/test', {
                method: 'POST',
                headers: {
                    'x-forwarded-for': '192.168.1.8',
                },
            });

            const response = await wrappedHandler(request);

            expect(response).toBeInstanceOf(Response);
            expect(mockHandler).toHaveBeenCalled();
        });

        it('should return 429 when rate limit exceeded in HOC', async () => {
            const mockHandler = vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ success: true }), {
                    status: 200,
                })
            );

            const config: RateLimitConfig = {
                limit: 2,
                windowSeconds: 60,
                keyPrefix: 'test-hoc-limit',
            };

            const wrappedHandler = withRateLimit(mockHandler, config);

            const request = new NextRequest('http://localhost:3000/api/v1/system/test', {
                method: 'POST',
                headers: {
                    'x-forwarded-for': '192.168.1.9',
                },
            });

            // First two requests should succeed
            await wrappedHandler(request);
            await wrappedHandler(request);

            // Third request should be rate limited
            const response = await wrappedHandler(request);

            expect(response.status).toBe(429);
            expect(mockHandler).toHaveBeenCalledTimes(2); // Handler not called for rate limited request
        });
    });

    describe('Fallback behavior', () => {
        it('should use in-memory fallback when Redis is not configured', async () => {
            // Ensure Redis is not configured
            delete process.env.UPSTASH_REDIS_REST_URL;
            delete process.env.UPSTASH_REDIS_REST_TOKEN;

            const request = new NextRequest(
                'http://localhost:3000/api/v1/merchant/operations/orders',
                {
                    method: 'POST',
                    headers: {
                        'x-forwarded-for': '192.168.1.10',
                    },
                }
            );

            const config: RateLimitConfig = {
                limit: 3,
                windowSeconds: 60,
                keyPrefix: 'test-fallback',
            };

            // Should still work with in-memory fallback
            const result = await checkRateLimit(request, config);

            expect(result.success).toBe(true);
        });

        it('should handle Redis errors gracefully', async () => {
            // Mock Redis to throw an error
            mockRedis.pipeline.mockImplementationOnce(() => ({
                zremrangebyscore: vi.fn().mockReturnThis(),
                zcard: vi.fn().mockReturnThis(),
                exec: vi.fn().mockRejectedValue(new Error('Redis connection error')),
            }));

            // Set Redis env vars to trigger Redis usage
            process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
            process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

            const request = new NextRequest(
                'http://localhost:3000/api/v1/merchant/operations/orders',
                {
                    method: 'POST',
                    headers: {
                        'x-forwarded-for': '192.168.1.11',
                    },
                }
            );

            const config: RateLimitConfig = {
                limit: 5,
                windowSeconds: 60,
                keyPrefix: 'test-error',
            };

            // Should fallback to in-memory on error
            const result = await checkRateLimit(request, config);

            expect(result.success).toBe(true);
        });
    });

    describe('Edge cases', () => {
        it('should handle IPv6 addresses', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/v1/merchant/operations/orders',
                {
                    method: 'POST',
                    headers: {
                        'x-forwarded-for': '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
                    },
                }
            );

            const config: RateLimitConfig = {
                limit: 5,
                windowSeconds: 60,
                keyPrefix: 'test-ipv6',
            };

            const result = await checkRateLimit(request, config);

            expect(result.success).toBe(true);
        });

        it('should handle multiple IPs in x-forwarded-for (use first)', async () => {
            const request = new NextRequest(
                'http://localhost:3000/api/v1/merchant/operations/orders',
                {
                    method: 'POST',
                    headers: {
                        'x-forwarded-for': '192.168.1.12, 10.0.0.1, 172.16.0.1',
                    },
                }
            );

            const config: RateLimitConfig = {
                limit: 5,
                windowSeconds: 60,
                keyPrefix: 'test-multi-ip',
            };

            const result = await checkRateLimit(request, config);

            expect(result.success).toBe(true);
        });

        it('should handle different paths separately', async () => {
            const config: RateLimitConfig = {
                limit: 2,
                windowSeconds: 60,
                keyPrefix: 'test-paths',
            };

            // Request to /api/v1/merchant/operations/orders
            const request1 = new NextRequest(
                'http://localhost:3000/api/v1/merchant/operations/orders',
                {
                    method: 'POST',
                    headers: {
                        'x-forwarded-for': '192.168.1.13',
                    },
                }
            );

            // Request to /api/payments
            const request2 = new NextRequest(
                'http://localhost:3000/api/v1/merchant/operations/payments',
                {
                    method: 'POST',
                    headers: {
                        'x-forwarded-for': '192.168.1.13',
                    },
                }
            );

            // Both should succeed as they're different paths
            const result1 = await checkRateLimit(request1, config);
            const result2 = await checkRateLimit(request2, config);

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(true);
        });

        it('should handle concurrent requests correctly', async () => {
            const config: RateLimitConfig = {
                limit: 5,
                windowSeconds: 60,
                keyPrefix: 'test-concurrent',
            };

            const request = new NextRequest(
                'http://localhost:3000/api/v1/merchant/operations/orders',
                {
                    method: 'POST',
                    headers: {
                        'x-forwarded-for': '192.168.1.14',
                    },
                }
            );

            // Make 5 concurrent requests
            const results = await Promise.all([
                checkRateLimit(request, config),
                checkRateLimit(request, config),
                checkRateLimit(request, config),
                checkRateLimit(request, config),
                checkRateLimit(request, config),
            ]);

            // All should succeed (within limit)
            results.forEach(result => {
                expect(result.success).toBe(true);
            });

            // 6th request should fail
            const result = await checkRateLimit(request, config);
            expect(result.success).toBe(false);
        });
    });
});
