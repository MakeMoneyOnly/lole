/**
 * Liveness Probe Endpoint
 *
 * Kubernetes liveness probe for determining if the service
 * needs to be restarted.
 *
 * This is a lightweight check that only verifies:
 * - Server is responding
 * - Basic HTTP capability
 *
 * This should be extremely fast (< 100ms) and not depend
 * on external services.
 *
 * Returns:
 * - 200: Service is alive
 * - 503: Service needs restart
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Time when the server started
 * Note: In serverless, this resets per cold start
 */
const startTime = Date.now();

/**
 * GET /api/health/live
 * Liveness probe endpoint
 *
 * Kubernetes configuration:
 * livenessProbe:
 *   httpGet:
 *     path: /api/health/live
 *     port: 3000
 *   initialDelaySeconds: 30
 *   periodSeconds: 30
 *   timeoutSeconds: 5
 *   failureThreshold: 3
 *
 * This endpoint is intentionally lightweight:
 * - No database checks (might be slow during startup)
 * - No Redis checks
 * - No external service calls
 * - Just confirms the server process is running
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
    const responseTime = Date.now() - startTime;

    const response = {
        alive: true,
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
        response_time_ms: responseTime,
    };

    // Always return 200 for liveness - if the server is responding,
    // it's alive. External dependency issues are handled by readiness.
    return NextResponse.json(response, {
        status: 200,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Alive-Status': 'alive',
            'X-Response-Time': `${responseTime}ms`,
        },
    });
}

/**
 * HEAD /api/health/live
 * Alternative liveness check for load balancers that prefer HEAD
 */
export async function HEAD(): Promise<Response> {
    return new Response(null, {
        status: 200,
        headers: {
            'X-Alive-Status': 'alive',
        },
    });
}
