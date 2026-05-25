/**
 * Prometheus Metrics Module
 *
 * Provides Prometheus-compatible metrics for Grafana integration.
 * Uses prom-client registry with standard naming conventions.
 *
 * Exposed Metrics:
 * - http_request_duration_seconds_bucket (histogram)
 * - http_requests_total (counter)
 * - lole_orders_total (counter)
 * - lole_payments_total (counter)
 * - lole_active_sessions (gauge)
 * - lole_active_restaurants (gauge)
 *
 * @see docs/05-infrastructure/monitoring/grafana-dashboard.json
 * @see docs/implementation/observability-setup.md
 */

import { logger } from '@/lib/logger';

// Inline type definitions to avoid importing prom-client types at build time
interface Histogram<_T extends string> {
    labels: (...args: string[]) => { observe: (value: number) => void };
    get: () => Promise<{ values: Array<{ labels: Record<string, string>; value: number }> }>;
}

interface Counter<_T extends string> {
    labels: (...args: string[]) => { inc: (value?: number) => void };
    get: () => Promise<{ values: Array<{ labels: Record<string, string>; value: number }> }>;
}

interface Gauge<_T extends string> {
    labels: (...args: string[]) => { set: (value: number) => void };
    set: (value: number) => void;
    get: () => Promise<{ values: Array<{ labels: Record<string, string>; value: number }> }>;
}

/**
 * Edge-safe metrics interface
 */
export interface Metrics {
    httpRequestDurationSeconds: Histogram<string> | null;
    httpRequestsTotal: Counter<string> | null;
    loleOrdersTotal: Counter<string> | null;
    lolePaymentsTotal: Counter<string> | null;
    lolePaymentFailureRate: Gauge<string> | null;
    lolectiveSessions: Gauge<string> | null;
    lolectiveRestaurants: Gauge<string> | null;
}

// Initialize with null values, will be populated if in Node or test environment
export let metrics: Metrics = {
    httpRequestDurationSeconds: null,
    httpRequestsTotal: null,
    loleOrdersTotal: null,
    lolePaymentsTotal: null,
    lolePaymentFailureRate: null,
    lolectiveSessions: null,
    lolectiveRestaurants: null,
};

// Check if we are in the edge runtime - must be checked before any prom-client code
const isEdge = process.env.NEXT_RUNTIME === 'edge';

// Check if we are in a browser/client environment (but not jsdom which is for tests)
// jsdom defines window but we still want to initialize prom-client for tests
// Vitest exposes 'vi' globally in test environment
const isBrowser = typeof window !== 'undefined';
const isJsDom = isBrowser && typeof (globalThis as { vi?: unknown }).vi !== 'undefined';

// Only initialize prom-client on the server-side (Node.js only) or in test environment (jsdom)
// Not Edge runtime as prom-client relies on Node.js APIs
if (!isEdge && (!isBrowser || isJsDom)) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const promClient = require('prom-client');

        // Clear registry on hot reload in development
        if (process.env.NODE_ENV !== 'production') {
            promClient.register.clear();
        }

        metrics = {
            httpRequestDurationSeconds: new promClient.Histogram({
                name: 'http_request_duration_seconds',
                help: 'Duration of HTTP requests in seconds',
                labelNames: ['method', 'path', 'status'],
                buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
            }),
            httpRequestsTotal: new promClient.Counter({
                name: 'http_requests_total',
                help: 'Total number of HTTP requests',
                labelNames: ['method', 'path', 'status'],
            }),
            loleOrdersTotal: new promClient.Counter({
                name: 'lole_orders_total',
                help: 'Total orders processed',
                labelNames: ['restaurant_id', 'status'],
            }),
            lolePaymentsTotal: new promClient.Counter({
                name: 'lole_payments_total',
                help: 'Total payments processed',
                labelNames: ['provider', 'status'],
            }),
            lolePaymentFailureRate: new promClient.Gauge({
                name: 'lole_payment_failure_rate',
                help: 'Payment failure rate percentage',
                labelNames: ['provider'],
            }),
            lolectiveSessions: new promClient.Gauge({
                name: 'lole_active_sessions',
                help: 'Currently active table sessions',
            }),
            lolectiveRestaurants: new promClient.Gauge({
                name: 'lole_active_restaurants',
                help: 'Number of restaurants with activity in the last hour',
            }),
        };
    } catch (error) {
        logger.error('[Prometheus] Failed to initialize prom-client:', error);
    }
}

/**
 * Record HTTP request duration
 */
export function recordHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number
): void {
    if (!metrics.httpRequestDurationSeconds || !metrics.httpRequestsTotal) return;

    const durationSeconds = durationMs / 1000;
    const status = String(statusCode);

    try {
        metrics.httpRequestDurationSeconds.labels(method, path, status).observe(durationSeconds);
        metrics.httpRequestsTotal.labels(method, path, status).inc();
    } catch {
        // Silently ignore recording errors
    }
}

/**
 * Record order event
 */
export function recordOrderEvent(restaurantId: string, status: string): void {
    if (!metrics.loleOrdersTotal) return;
    try {
        metrics.loleOrdersTotal.labels(restaurantId, status).inc();
    } catch {}
}

/**
 * Record payment event
 */
export function recordPaymentEvent(provider: string, status: string): void {
    if (!metrics.lolePaymentsTotal) return;
    try {
        metrics.lolePaymentsTotal.labels(provider, status).inc();
    } catch {}
}

/**
 * Set active sessions count
 */
export function setActiveSessions(count: number): void {
    if (!metrics.lolectiveSessions) return;
    try {
        metrics.lolectiveSessions.set(count);
    } catch {}
}

/**
 * Set active restaurants count
 */
export function setActiveRestaurants(count: number): void {
    if (!metrics.lolectiveRestaurants) return;
    try {
        metrics.lolectiveRestaurants.set(count);
    } catch {}
}

/**
 * Get Prometheus metrics in text format
 */
export async function getPrometheusMetrics(): Promise<string> {
    try {
        // Dynamic require to avoid bundling in Edge/Browser
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const promClient = require('prom-client');
        return promClient.register?.metrics?.() ?? '';
    } catch {
        return '';
    }
}

/**
 * Get content type for Prometheus response
 */
export function getPrometheusContentType(): string {
    return 'text/plain; version=0.0.4; charset=utf-8';
}

/**
 * Get metrics as JSON (for debugging)
 */
export async function getMetricsJson(): Promise<unknown> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const promClient = require('prom-client');
        return promClient.register?.getMetricsAsJSON?.() ?? {};
    } catch {
        return {};
    }
}

export default metrics;
