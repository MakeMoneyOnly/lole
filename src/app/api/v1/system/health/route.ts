/**
 * Health Check API Endpoint
 *
 * Addresses CRIT-08 from ENTERPRISE_MASTER_BLUEPRINT Section 13
 * Provides comprehensive health status for monitoring and observability.
 *
 * Monitors:
 * - Database connectivity (Supabase)
 * - Redis connectivity (Upstash)
 * - QStash availability (job queue)
 * - Environment configuration
 * - Payment providers (Chapa, Telebirr)
 * - Circuit breaker status
 * - Performance metrics
 *
 * Used by Better Uptime for monitoring with Telegram alerting on non-200.
 *
 * @see docs/1. Engineering Foundation/0. ENTERPRISE_MASTER_BLUEPRINT.md - Sprint 1.7
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPoolConfig } from '@/lib/supabase/pool';
import { circuitBreakerRegistry } from '@/lib/api/circuit-breaker';
import {
    performanceMetricsStore as _performanceMetricsStore,
    getPerformanceSummary,
} from '@/lib/monitoring/performance';
import { gracefulServiceRegistry as _gracefulServiceRegistry } from '@/lib/api/graceful-degradation';

/**
 * Payment provider health check result
 */
interface PaymentProviderHealth {
    name: string;
    status: 'pass' | 'fail' | 'not_configured';
    latency_ms?: number;
    message?: string;
}

/**
 * Circuit breaker health status
 */
interface CircuitBreakerHealth {
    name: string;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failureCount: number;
}

/**
 * Performance health summary
 */
interface PerformanceHealth {
    totalOperations: number;
    slowOperations: number;
    criticalOperations: number;
    alerts: Array<{ type: string; message: string; severity: string }>;
}

/**
 * Health check response interface
 * MED-025: Enhanced with payment providers, circuit breakers, and performance metrics
 */
interface HealthStatus {
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: string;
    uptime: number;
    version: string;
    commit?: string;
    checks: {
        database: {
            status: 'pass' | 'fail';
            latency_ms?: number;
            message?: string;
        };
        redis: {
            status: 'pass' | 'fail' | 'not_configured';
            latency_ms?: number;
            message?: string;
        };
        supabase: {
            status: 'pass' | 'fail';
            latency_ms?: number;
            message?: string;
            pool_enabled?: boolean;
            pool_mode?: string;
            pool_size?: number;
        };
        qstash: {
            status: 'pass' | 'fail' | 'not_configured';
            latency_ms?: number;
            message?: string;
        };
        memory: {
            status: 'pass' | 'fail';
            used_mb?: number;
            limit_mb?: number;
            message?: string;
        };
        environment: {
            status: 'pass' | 'fail';
            configured: string[];
            missing: string[];
        };
        /** MED-025: Payment providers health */
        payments?: PaymentProviderHealth[];
        /** MED-025: Circuit breaker status */
        circuitBreakers?: CircuitBreakerHealth[];
        /** MED-025: Performance metrics */
        performance?: PerformanceHealth;
    };
    region?: string;
}

/**
 * Time when the server started
 * Note: In serverless, this resets per cold start
 */
const startTime = Date.now();

/**
 * Required environment variables for critical functionality
 */
const REQUIRED_ENV_VARS = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SECRET_KEY',
];

/**
 * Optional environment variables for enhanced features
 */
const OPTIONAL_ENV_VARS = [
    'DATABASE_URL',
    'DATABASE_DIRECT_URL',
    'SUPABASE_POOLER_URL',
    'SUPABASE_DB_URL',
    'POWERSYNC_DATABASE_URL',
    'REDIS_URL',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'QSTASH_TOKEN',
    'QSTASH_CURRENT_SIGNING_KEY',
    'CHAPA_SECRET_KEY',
    'CHAPA_WEBHOOK_SECRET',
    'SENTRY_AUTH_TOKEN',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_ALERT_CHAT_ID',
    // Connection lane metadata
    'SUPABASE_POOL_MODE',
    'SUPABASE_POOL_SIZE',
    'SUPABASE_POOL_MAX_CLIENTS',
    'SUPABASE_POOL_CONNECTION_TIMEOUT',
    'SUPABASE_POOL_IDLE_TIMEOUT',
];

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<{
    status: 'pass' | 'fail';
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
            // PGRST116 = no rows found, which is fine
            return {
                status: 'fail',
                latency_ms,
                message: error.message,
            };
        }

        return {
            status: 'pass',
            latency_ms,
            message: 'Database connected',
        };
    } catch (error) {
        return {
            status: 'fail',
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Check Supabase connectivity (alias for database check)
 * This is a separate check as per requirements
 */
async function checkSupabase(): Promise<{
    status: 'pass' | 'fail';
    latency_ms?: number;
    message?: string;
    pool_enabled?: boolean;
    pool_mode?: string;
    pool_size?: number;
}> {
    // Supabase uses the same connection as database
    const dbCheck = await checkDatabase();

    // Get pool configuration
    const poolConfig = getPoolConfig();

    return {
        status: dbCheck.status,
        latency_ms: dbCheck.latency_ms,
        message: dbCheck.message,
        pool_enabled: poolConfig.enabled,
        pool_mode: poolConfig.mode,
        pool_size: poolConfig.poolSize,
    };
}
async function checkRedis(): Promise<{
    status: 'pass' | 'fail' | 'not_configured';
    latency_ms?: number;
    message?: string;
}> {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
        // Fallback to legacy Redis URL
        const legacyRedisUrl = process.env.REDIS_URL;
        if (!legacyRedisUrl) {
            return { status: 'not_configured', message: 'Redis not configured' };
        }
        // Legacy Redis doesn't support HTTP ping, just check URL exists
        return { status: 'pass', message: 'Redis configured (legacy URL)' };
    }

    try {
        const start = Date.now();

        // Use Upstash REST API to ping Redis
        // @see https://upstash.com/docs/redis/features/restapi
        const response = await fetch(`${redisUrl}/ping`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${redisToken}`,
            },
        });

        const latency_ms = Date.now() - start;

        if (!response.ok) {
            const errorText = await response.text();
            return {
                status: 'fail',
                latency_ms,
                message: `Redis ping failed: ${response.status} ${errorText}`,
            };
        }

        const result = await response.text();
        if (result !== 'PONG' && result !== '"PONG"' && !result.includes('PONG')) {
            return {
                status: 'fail',
                latency_ms,
                message: `Unexpected Redis response: ${result}`,
            };
        }

        return {
            status: 'pass',
            latency_ms,
            message: 'Redis connected',
        };
    } catch (error) {
        return {
            status: 'fail',
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Check QStash availability
 * QStash is critical for background jobs: payment retries, ERCA submissions, EOD reports
 */
async function checkQStash(): Promise<{
    status: 'pass' | 'fail' | 'not_configured';
    latency_ms?: number;
    message?: string;
}> {
    const qstashToken = process.env.QSTASH_TOKEN;

    if (!qstashToken) {
        return { status: 'not_configured', message: 'QStash not configured' };
    }

    try {
        const start = Date.now();

        // Query QStash API to check queue status
        // @see https://upstash.com/docs/qstash/api/overview
        const response = await fetch('https://qstash.upstash.io/v2/messages', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${qstashToken}`,
            },
        });

        const latency_ms = Date.now() - start;

        if (!response.ok) {
            const errorText = await response.text();
            // 401 = invalid token
            // 403 = token doesn't have access
            // 5xx = QStash service issue
            return {
                status: 'fail',
                latency_ms,
                message: `QStash check failed: ${response.status} ${errorText}`,
            };
        }

        // Response is OK, QStash is available
        return {
            status: 'pass',
            latency_ms,
            message: 'QStash connected',
        };
    } catch (error) {
        return {
            status: 'fail',
            message: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Check environment variables configuration
 */
function checkEnvironment(): {
    status: 'pass' | 'fail';
    configured: string[];
    missing: string[];
} {
    const configured: string[] = [];
    const missing: string[] = [];

    // Check required variables
    for (const varName of REQUIRED_ENV_VARS) {
        if (process.env[varName]) {
            configured.push(varName);
        } else {
            missing.push(varName);
        }
    }

    // Check optional variables
    for (const varName of OPTIONAL_ENV_VARS) {
        if (process.env[varName]) {
            configured.push(varName);
        }
    }

    return {
        status: missing.length > 0 ? 'fail' : 'pass',
        configured,
        missing,
    };
}

/**
 * Check memory usage
 * In serverless environments, memory usage is per-request
 * but we can still check the process memory footprint
 */
function checkMemory(): {
    status: 'pass' | 'fail';
    used_mb?: number;
    limit_mb?: number;
    message?: string;
} {
    // In Node.js/Next.js serverless, we can check memory usage
    // Note: In serverless, memory limit is set at deployment time
    const memoryUsage = process.memoryUsage();

    // Convert bytes to MB
    const used_mb = Math.round(memoryUsage.heapUsed / (1024 * 1024));
    const limit_mb = process.env.VERCEL_MEMORY_LIMIT
        ? parseInt(process.env.VERCEL_MEMORY_LIMIT, 10) / (1024 * 1024)
        : Math.round(memoryUsage.heapTotal / (1024 * 1024));

    // Default limit for Vercel is 1024MB (1GB) for Pro
    const defaultLimit = 1024;
    const effectiveLimit = limit_mb || defaultLimit;

    // Check if memory usage is within acceptable limits (80% threshold)
    const usagePercent = (used_mb / effectiveLimit) * 100;

    if (usagePercent > 90) {
        return {
            status: 'fail',
            used_mb,
            limit_mb: effectiveLimit,
            message: `Memory usage critical: ${usagePercent.toFixed(1)}%`,
        };
    }

    if (usagePercent > 80) {
        return {
            status: 'pass',
            used_mb,
            limit_mb: effectiveLimit,
            message: `Memory usage high: ${usagePercent.toFixed(1)}%`,
        };
    }

    return {
        status: 'pass',
        used_mb,
        limit_mb: effectiveLimit,
        message: `Memory usage normal: ${usagePercent.toFixed(1)}%`,
    };
}

/**
 * Check payment providers health
 * MED-025: Added payment provider health checks
 */
async function checkPaymentProviders(): Promise<PaymentProviderHealth[]> {
    const providers: PaymentProviderHealth[] = [];

    // Check Chapa
    if (process.env.CHAPA_SECRET_KEY) {
        try {
            const start = Date.now();
            // Chapa doesn't have a dedicated health endpoint, so we check if the key is configured
            // In production, you might want to make a lightweight API call
            providers.push({
                name: 'chapa',
                status: 'pass',
                latency_ms: Date.now() - start,
                message: 'Chapa API key configured',
            });
        } catch (error) {
            providers.push({
                name: 'chapa',
                status: 'fail',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    } else {
        providers.push({
            name: 'chapa',
            status: 'not_configured',
            message: 'CHAPA_SECRET_KEY not set',
        });
    }

    // Check Telebirr
    if (process.env.TELEBIRR_APP_ID && process.env.TELEBIRR_APP_KEY) {
        try {
            const start = Date.now();
            // Telebirr configuration check
            providers.push({
                name: 'telebirr',
                status: 'pass',
                latency_ms: Date.now() - start,
                message: 'Telebirr credentials configured',
            });
        } catch (error) {
            providers.push({
                name: 'telebirr',
                status: 'fail',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    } else {
        providers.push({
            name: 'telebirr',
            status: 'not_configured',
            message: 'TELEBIRR_APP_ID or TELEBIRR_APP_KEY not set',
        });
    }

    return providers;
}

/**
 * Get circuit breaker health status
 * MED-025: Added circuit breaker status aggregation
 */
function getCircuitBreakerHealth(): CircuitBreakerHealth[] {
    const breakers = circuitBreakerRegistry.getAllBreakers();
    const health: CircuitBreakerHealth[] = [];

    for (const [name, breaker] of breakers) {
        const stats = breaker.getStats();
        health.push({
            name,
            state: stats.state,
            failureCount: stats.failureCount,
        });
    }

    return health;
}

/**
 * Get performance health status
 * MED-025: Added performance metrics aggregation
 */
function getPerformanceHealth(): PerformanceHealth {
    const summary = getPerformanceSummary();
    const alerts =
        summary.criticalOperations > 0
            ? [
                  {
                      type: 'critical',
                      message: `${summary.criticalOperations} critical performance issues`,
                      severity: 'critical',
                  },
              ]
            : summary.slowOperations > 0
              ? [
                    {
                        type: 'warning',
                        message: `${summary.slowOperations} slow operations detected`,
                        severity: 'warning',
                    },
                ]
              : [];

    return {
        totalOperations: summary.totalOperations,
        slowOperations: summary.slowOperations,
        criticalOperations: summary.criticalOperations,
        alerts,
    };
}

/**
 * GET /api/health
 * Returns comprehensive health status
 *
 * @returns {HealthStatus} Health check response with 200 or 503 status
 *
 * Better Uptime configuration:
 * - Poll this endpoint every 60 seconds
 * - Alert via Telegram on non-200 response
 * - Set timeout to 30 seconds
 *
 * Status codes:
 * - 200: Healthy or Degraded (service is running)
 * - 503: Unhealthy (critical dependency down)
 */
export async function GET(_request: NextRequest): Promise<NextResponse<HealthStatus>> {
    // Run checks in parallel for efficiency
    const [databaseCheck, redisCheck, qstashCheck, supabaseCheck, paymentChecks] =
        await Promise.all([
            checkDatabase(),
            checkRedis(),
            checkQStash(),
            checkSupabase(),
            checkPaymentProviders(),
        ]);

    const environmentCheck = checkEnvironment();
    const memoryCheck = checkMemory();
    const circuitBreakerHealth = getCircuitBreakerHealth();
    const performanceHealth = getPerformanceHealth();

    // Determine overall status
    // Unhealthy: Database is down (critical dependency)
    // Degraded: Non-critical services (Redis, QStash) are down but database is up
    // Healthy: All services up
    let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    if (databaseCheck.status === 'fail' || environmentCheck.status === 'fail') {
        status = 'unhealthy';
    } else if (memoryCheck.status === 'fail') {
        status = 'unhealthy';
    } else if (
        redisCheck.status === 'fail' ||
        qstashCheck.status === 'fail' ||
        redisCheck.status === 'not_configured' ||
        qstashCheck.status === 'not_configured'
    ) {
        // Degraded if non-critical services are down or not configured
        // In production, we expect these to be configured
        const isProduction = process.env.NODE_ENV === 'production';
        if (
            isProduction &&
            (redisCheck.status === 'not_configured' || qstashCheck.status === 'not_configured')
        ) {
            status = 'unhealthy'; // Production must have all services
        } else {
            status = 'degraded';
        }
    }

    const healthStatus: HealthStatus = {
        status,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '0.1.0',
        commit: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        checks: {
            database: databaseCheck,
            redis: redisCheck,
            supabase: supabaseCheck,
            qstash: qstashCheck,
            memory: memoryCheck,
            environment: environmentCheck,
            // MED-025: Added payment providers, circuit breakers, and performance
            payments: paymentChecks,
            circuitBreakers: circuitBreakerHealth,
            performance: performanceHealth,
        },
        region: process.env.VERCEL_REGION || process.env.AWS_REGION,
    };

    // Return appropriate status code
    // Better Uptime expects non-200 for unhealthy states
    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;

    return NextResponse.json(healthStatus, {
        status: statusCode,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Health-Status': status,
            'X-Response-Time': `${Date.now() - startTime}ms`,
        },
    });
}

/**
 * HEAD /api/health
 * Simple health check without detailed response
 * Useful for load balancers and simple uptime checks
 */
export async function HEAD(): Promise<Response> {
    const dbCheck = await checkDatabase();

    if (dbCheck.status === 'pass') {
        return new Response(null, { status: 200 });
    }

    return new Response(null, { status: 503 });
}

/**
 * OPTIONS /api/health
 * Liveness probe endpoint
 * Simple check to confirm the server is responding
 */
export async function OPTIONS(): Promise<Response> {
    return new Response(null, {
        status: 200,
        headers: {
            'X-Server-Status': 'alive',
        },
    });
}
