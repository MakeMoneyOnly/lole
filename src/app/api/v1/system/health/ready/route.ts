/**
 * Readiness Probe Endpoint
 *
 * Kubernetes liveness/readiness probe for determining if the service
 * is ready to receive traffic.
 *
 * Readiness checks:
 * - Database connectivity (Supabase)
 * - Redis connectivity (for rate limiting)
 *
 * Returns:
 * - 200: Service is ready to receive traffic
 * - 503: Service is not ready (dependencies unavailable)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Check database connectivity for readiness
 */
async function checkDatabaseReadiness(): Promise<{
    ready: boolean;
    latency_ms?: number;
    message?: string;
}> {
    try {
        const start = Date.now();
        const supabase = await createClient();

        // Simple query to check connectivity
        const { error } = await supabase.from('restaurants').select('id').limit(1);
        const latency_ms = Date.now() - start;

        if (error && error.code !== 'PGRST116') {
            return {
                ready: false,
                latency_ms,
                message: error.message,
            };
        }

        return {
            ready: true,
            latency_ms,
            message: 'Database connected',
        };
    } catch (error) {
        return {
            ready: false,
            message: error instanceof Error ? error.message : 'Unknown database error',
        };
    }
}

/**
 * Check Redis connectivity for readiness
 */
async function checkRedisReadiness(): Promise<{
    ready: boolean;
    latency_ms?: number;
    message?: string;
}> {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
        // Fallback to legacy Redis URL
        const legacyRedisUrl = process.env.REDIS_URL;
        if (!legacyRedisUrl) {
            // Redis is optional for readiness - don't fail
            return {
                ready: true,
                message: 'Redis not configured (optional)',
            };
        }
        return {
            ready: true,
            message: 'Redis configured (legacy)',
        };
    }

    try {
        const start = Date.now();

        const response = await fetch(`${redisUrl}/ping`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${redisToken}`,
            },
            // 3 second timeout for health check
            signal: AbortSignal.timeout(3000),
        });

        const latency_ms = Date.now() - start;

        if (!response.ok) {
            return {
                ready: false,
                latency_ms,
                message: `Redis ping failed: ${response.status}`,
            };
        }

        return {
            ready: true,
            latency_ms,
            message: 'Redis connected',
        };
    } catch (error) {
        return {
            ready: false,
            message: error instanceof Error ? error.message : 'Unknown Redis error',
        };
    }
}

/**
 * GET /api/health/ready
 * Readiness probe endpoint
 *
 * Kubernetes configuration:
 * readinessProbe:
 *   httpGet:
 *     path: /api/health/ready
 *     port: 3000
 *   initialDelaySeconds: 10
 *   periodSeconds: 10
 *   timeoutSeconds: 5
 *   failureThreshold: 3
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
    const startTime = Date.now();

    // Run checks in parallel
    const [dbCheck, redisCheck] = await Promise.all([
        checkDatabaseReadiness(),
        checkRedisReadiness(),
    ]);

    const responseTime = Date.now() - startTime;

    // Determine readiness
    // Service is ready if database is up (critical)
    // Redis is optional for readiness
    const isReady = dbCheck.ready;

    const response = {
        ready: isReady,
        timestamp: new Date().toISOString(),
        checks: {
            database: {
                status: dbCheck.ready ? 'pass' : 'fail',
                latency_ms: dbCheck.latency_ms,
                message: dbCheck.message,
            },
            redis: {
                status: redisCheck.ready ? 'pass' : 'fail',
                latency_ms: redisCheck.latency_ms,
                message: redisCheck.message,
            },
        },
        response_time_ms: responseTime,
    };

    const statusCode = isReady ? 200 : 503;

    return NextResponse.json(response, {
        status: statusCode,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Ready-Status': isReady ? 'ready' : 'not_ready',
            'X-Response-Time': `${responseTime}ms`,
        },
    });
}
