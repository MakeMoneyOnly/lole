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

import type { Histogram, Counter, Gauge } from 'prom-client';

type PromClient = typeof import('prom-client');

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

// Check if we are in the edge runtime
const isEdge = process.env.NEXT_RUNTIME === 'edge';

let client: PromClient | null = null;

export let metrics: Metrics = {
    httpRequestDurationSeconds: null,
    httpRequestsTotal: null,
    loleOrdersTotal: null,
    lolePaymentsTotal: null,
    lolePaymentFailureRate: null,
    lolectiveSessions: null,
    lolectiveRestaurants: null,
};

if (!isEdge) {
    try {
        // Only import prom-client in Node.js runtime — not Edge safe
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        client = require('prom-client') as PromClient;

        // Clear registry on hot reload in development
        if (process.env.NODE_ENV !== 'production') {
            client.register.clear();
        }

        metrics = {
            httpRequestDurationSeconds: new client.Histogram({
                name: 'http_request_duration_seconds',
                help: 'Duration of HTTP requests in seconds',
                labelNames: ['method', 'path', 'status'],
                buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
            }),
            httpRequestsTotal: new client.Counter({
                name: 'http_requests_total',
                help: 'Total number of HTTP requests',
                labelNames: ['method', 'path', 'status'],
            }),
            loleOrdersTotal: new client.Counter({
                name: 'lole_orders_total',
                help: 'Total orders processed',
                labelNames: ['restaurant_id', 'status'],
            }),
            lolePaymentsTotal: new client.Counter({
                name: 'lole_payments_total',
                help: 'Total payments processed',
                labelNames: ['provider', 'status'],
            }),
            lolePaymentFailureRate: new client.Gauge({
                name: 'lole_payment_failure_rate',
                help: 'Payment failure rate percentage',
                labelNames: ['provider'],
            }),
            lolectiveSessions: new client.Gauge({
                name: 'lole_active_sessions',
                help: 'Currently active table sessions',
            }),
            lolectiveRestaurants: new client.Gauge({
                name: 'lole_active_restaurants',
                help: 'Number of restaurants with activity in the last hour',
            }),
        };
    } catch (error) {
        console.error('[Prometheus] Failed to initialize prom-client:', error);
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
    } catch (_err) {
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
    } catch (_err) {}
}

/**
 * Record payment event
 */
export function recordPaymentEvent(provider: string, status: string): void {
    if (!metrics.lolePaymentsTotal) return;
    try {
        metrics.lolePaymentsTotal.labels(provider, status).inc();
    } catch (_err) {}
}

/**
 * Set active sessions count
 */
export function setActiveSessions(count: number): void {
    if (!metrics.lolectiveSessions) return;
    try {
        metrics.lolectiveSessions.set(count);
    } catch (_err) {}
}

/**
 * Set active restaurants count
 */
export function setActiveRestaurants(count: number): void {
    if (!metrics.lolectiveRestaurants) return;
    try {
        metrics.lolectiveRestaurants.set(count);
    } catch (_err) {}
}

/**
 * Get Prometheus metrics in text format
 */
export async function getPrometheusMetrics(): Promise<string> {
    if (!client) return '';
    return client.register.metrics();
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
    if (!client) return {};
    return client.register.getMetricsAsJSON();
}

export default metrics;
