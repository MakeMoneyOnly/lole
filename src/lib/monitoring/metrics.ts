/**
 * Custom Metrics Tracking Module
 *
 * Provides comprehensive metrics collection for:
 * - API performance tracking
 * - Business metrics (orders, payments, sessions)
 * - Database performance monitoring
 * - Custom application metrics
 * - Prometheus-compatible metrics for Grafana
 *
 * @see docs/implementation/observability-setup.md
 */

import * as Sentry from '@sentry/nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import { recordOrderEvent, recordPaymentEvent } from './prometheus';

// Metric action types
export const METRIC_ACTIONS = {
    API: 'api_metric_recorded',
    ORDER: 'order_metric_recorded',
    PAYMENT: 'payment_metric_recorded',
    SESSION: 'session_metric_recorded',
    DB: 'db_metric_recorded',
} as const;

export type MetricAction = (typeof METRIC_ACTIONS)[keyof typeof METRIC_ACTIONS];

// Sentry span status codes (from OpenTelemetry)
const SPAN_STATUS_OK = 1;
const SPAN_STATUS_ERROR = 2;

/**
 * Performance monitoring wrapper with automatic Sentry span creation
 *
 * @example
 * const result = await tracePerformance('db:menu:fetch', async () => {
 *   return await fetchMenuItems(restaurantId);
 * });
 */
export async function tracePerformance<T>(
    name: string,
    operation: () => Promise<T>,
    options?: {
        tags?: Record<string, string>;
        description?: string;
    }
): Promise<T> {
    return Sentry.startSpan(
        {
            name,
            op: name.split(':')[0] || 'operation',
        },
        async span => {
            if (options?.tags) {
                for (const [key, value] of Object.entries(options.tags)) {
                    span.setAttribute(key, value);
                }
            }
            if (options?.description) {
                span.setAttribute('description', options.description);
            }

            try {
                const result = await operation();
                span.setStatus({ code: SPAN_STATUS_OK });
                return result;
            } catch (error) {
                span.setStatus({ code: SPAN_STATUS_ERROR, message: String(error) });
                throw error;
            }
        }
    );
}

/**
 * Trace synchronous performance
 */
export function tracePerformanceSync<T>(
    name: string,
    operation: () => T,
    options?: {
        tags?: Record<string, string>;
        description?: string;
    }
): T {
    return Sentry.startSpan(
        {
            name,
            op: name.split(':')[0] || 'operation',
        },
        span => {
            if (options?.tags) {
                for (const [key, value] of Object.entries(options.tags)) {
                    span.setAttribute(key, value);
                }
            }
            if (options?.description) {
                span.setAttribute('description', options.description);
            }

            try {
                const result = operation();
                span.setStatus({ code: SPAN_STATUS_OK });
                return result;
            } catch (error) {
                span.setStatus({ code: SPAN_STATUS_ERROR, message: String(error) });
                throw error;
            }
        }
    );
}

/**
 * Track API performance metrics
 */
export interface ApiMetricParams {
    endpoint: string;
    method: string;
    statusCode: number;
    durationMs: number;
    restaurantId?: string | null;
    userId?: string;
    error?: string;
}

export async function trackApiMetric(
    supabase: SupabaseClient<Database>,
    params: ApiMetricParams
): Promise<{ error: Error | null }> {
    const isError = params.statusCode >= 400;

    return Sentry.startSpan(
        {
            name: `metric:api:${params.method}:${params.endpoint}`,
            op: 'metric',
        },
        async span => {
            span.setAttribute('endpoint', params.endpoint);
            span.setAttribute('method', params.method);
            span.setAttribute('status_code', String(params.statusCode));
            span.setAttribute('is_error', String(isError));
            if (params.restaurantId) {
                span.setAttribute('restaurant_id', params.restaurantId);
            }

            const metadata: Json = {
                endpoint: params.endpoint,
                method: params.method.toUpperCase(),
                status_code: params.statusCode,
                duration_ms: params.durationMs,
                is_error: isError,
                source: 'custom_metrics',
            };

            if (params.error) {
                metadata.error = params.error;
            }

            try {
                const { error } = await supabase.from('audit_logs').insert({
                    restaurant_id: params.restaurantId ?? null,
                    action: METRIC_ACTIONS.API,
                    entity_type: 'api_endpoint',
                    metadata,
                    new_value: {
                        endpoint: params.endpoint,
                        status_code: params.statusCode,
                        duration_ms: params.durationMs,
                        is_error: isError,
                    } as Json,
                });

                span.setStatus({ code: error ? SPAN_STATUS_ERROR : SPAN_STATUS_OK });
                return { error };
            } catch (e) {
                span.setStatus({ code: SPAN_STATUS_ERROR, message: String(e) });
                return { error: e as Error };
            }
        }
    );
}

/**
 * Track order-related metrics
 */
export interface OrderMetricParams {
    restaurantId: string;
    orderId: string;
    event: 'created' | 'completed' | 'cancelled' | 'modified';
    items?: number;
    total?: number;
    durationMs?: number;
}

export async function trackOrderMetric(
    supabase: SupabaseClient<Database>,
    params: OrderMetricParams
): Promise<{ error: Error | null }> {
    return Sentry.startSpan(
        {
            name: `metric:order:${params.event}`,
            op: 'metric',
        },
        async span => {
            span.setAttribute('restaurant_id', params.restaurantId);
            span.setAttribute('event', params.event);

            const metadata: Json = {
                order_id: params.orderId,
                event: params.event,
                source: 'custom_metrics',
            };

            if (params.items !== undefined) metadata.items = params.items;
            if (params.total !== undefined) metadata.total = params.total;
            if (params.durationMs !== undefined) metadata.duration_ms = params.durationMs;

            try {
                const { error } = await supabase.from('audit_logs').insert({
                    restaurant_id: params.restaurantId,
                    action: METRIC_ACTIONS.ORDER,
                    entity_type: 'order',
                    metadata,
                    new_value: {
                        order_id: params.orderId,
                        event: params.event,
                        items: params.items,
                        total: params.total,
                    } as Json,
                });

                // Record to Prometheus metrics (non-blocking)
                try {
                    recordOrderEvent(params.restaurantId, params.event);
                } catch {
                    // Silently ignore Prometheus recording errors
                }

                span.setStatus({ code: error ? SPAN_STATUS_ERROR : SPAN_STATUS_OK });
                return { error };
            } catch (e) {
                span.setStatus({ code: SPAN_STATUS_ERROR, message: String(e) });
                return { error: e as Error };
            }
        }
    );
}

/**
 * Track payment-related metrics
 */
export interface PaymentMetricParams {
    restaurantId: string;
    paymentId: string;
    provider: 'chapa' | 'cash';
    event: 'initiated' | 'completed' | 'failed' | 'refunded';
    amount?: number;
    durationMs?: number;
    error?: string;
}

export async function trackPaymentMetric(
    supabase: SupabaseClient<Database>,
    params: PaymentMetricParams
): Promise<{ error: Error | null }> {
    return Sentry.startSpan(
        {
            name: `metric:payment:${params.event}`,
            op: 'metric',
        },
        async span => {
            span.setAttribute('restaurant_id', params.restaurantId);
            span.setAttribute('provider', params.provider);
            span.setAttribute('event', params.event);

            const metadata: Json = {
                payment_id: params.paymentId,
                provider: params.provider,
                event: params.event,
                source: 'custom_metrics',
            };

            if (params.amount !== undefined) metadata.amount = params.amount;
            if (params.durationMs !== undefined) metadata.duration_ms = params.durationMs;
            if (params.error) metadata.error = params.error;

            try {
                const { error } = await supabase.from('audit_logs').insert({
                    restaurant_id: params.restaurantId,
                    action: METRIC_ACTIONS.PAYMENT,
                    entity_type: 'payment',
                    metadata,
                    new_value: {
                        payment_id: params.paymentId,
                        provider: params.provider,
                        event: params.event,
                        amount: params.amount,
                    } as Json,
                });

                // Record to Prometheus metrics (non-blocking)
                try {
                    recordPaymentEvent(params.provider, params.event);
                } catch {
                    // Silently ignore Prometheus recording errors
                }

                span.setStatus({ code: error ? SPAN_STATUS_ERROR : SPAN_STATUS_OK });
                return { error };
            } catch (e) {
                span.setStatus({ code: SPAN_STATUS_ERROR, message: String(e) });
                return { error: e as Error };
            }
        }
    );
}

/**
 * Track session metrics (active table sessions)
 */
export interface SessionMetricParams {
    restaurantId: string;
    sessionId: string;
    event: 'opened' | 'active' | 'closed' | 'timed_out';
    tableNumber?: number;
    guestCount?: number;
    durationMs?: number;
}

export async function trackSessionMetric(
    supabase: SupabaseClient<Database>,
    params: SessionMetricParams
): Promise<{ error: Error | null }> {
    return Sentry.startSpan(
        {
            name: `metric:session:${params.event}`,
            op: 'metric',
        },
        async span => {
            span.setAttribute('restaurant_id', params.restaurantId);
            span.setAttribute('event', params.event);

            const metadata: Json = {
                session_id: params.sessionId,
                event: params.event,
                source: 'custom_metrics',
            };

            if (params.tableNumber !== undefined) metadata.table_number = params.tableNumber;
            if (params.guestCount !== undefined) metadata.guest_count = params.guestCount;
            if (params.durationMs !== undefined) metadata.duration_ms = params.durationMs;

            try {
                const { error } = await supabase.from('audit_logs').insert({
                    restaurant_id: params.restaurantId,
                    action: METRIC_ACTIONS.SESSION,
                    entity_type: 'session',
                    metadata,
                    new_value: {
                        session_id: params.sessionId,
                        event: params.event,
                        table_number: params.tableNumber,
                        guest_count: params.guestCount,
                    } as Json,
                });

                span.setStatus({ code: error ? SPAN_STATUS_ERROR : SPAN_STATUS_OK });
                return { error };
            } catch (e) {
                span.setStatus({ code: SPAN_STATUS_ERROR, message: String(e) });
                return { error: e as Error };
            }
        }
    );
}

/**
 * Track database query performance
 */
export interface DbMetricParams {
    restaurantId?: string;
    query: string;
    durationMs: number;
    rows?: number;
    error?: string;
}

export function trackDbMetric(params: DbMetricParams): { error: Error | null } {
    Sentry.startSpan(
        {
            name: `metric:db:${params.query.substring(0, 50)}`,
            op: 'db',
        },
        span => {
            span.setAttribute('query_type', params.query.split(' ')[0]?.toLowerCase() || 'unknown');
            if (params.restaurantId) {
                span.setAttribute('restaurant_id', params.restaurantId);
            }
            span.setAttribute('duration_ms', params.durationMs);
            if (params.rows !== undefined) {
                span.setAttribute('rows', params.rows);
            }

            if (params.error) {
                span.setStatus({ code: SPAN_STATUS_ERROR, message: params.error });
            } else {
                span.setStatus({ code: SPAN_STATUS_OK });
            }
        }
    );

    return { error: params.error ? new Error(params.error) : null };
}

/**
 * Increment a counter metric (for simple counts)
 * Uses Sentry custom event tracking for metrics aggregation
 */
export function incrementCounter(
    name: string,
    value: number = 1,
    tags?: Record<string, string>
): void {
    // Use Sentry.addEventProcessor to track metrics via events
    // For Sentry SDK v10+, we use the metrics API if available
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sentryWithMetrics = Sentry as any;
        if (sentryWithMetrics.metrics?.increment) {
            sentryWithMetrics.metrics.increment(name, value);
        }
    } catch {
        // Metrics API not available, silently continue
    }

    // Also add as a breadcrumb for context
    Sentry.addBreadcrumb({
        category: 'metric.increment',
        message: `${name}: +${value}`,
        data: tags,
        level: 'info',
    });
}

/**
 * Set a gauge metric (for current values)
 */
export function setGauge(name: string, value: number, tags?: Record<string, string>): void {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sentryWithMetrics = Sentry as any;
        if (sentryWithMetrics.metrics?.gauge) {
            sentryWithMetrics.metrics.gauge(name, value);
        }
    } catch {
        // Metrics API not available, silently continue
    }

    Sentry.addBreadcrumb({
        category: 'metric.gauge',
        message: `${name}: ${value}`,
        data: tags,
        level: 'info',
    });
}

/**
 * Record a distribution metric (for values to aggregate)
 */
export function recordDistribution(
    name: string,
    value: number,
    tags?: Record<string, string>
): void {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sentryWithMetrics = Sentry as any;
        if (sentryWithMetrics.metrics?.distribution) {
            sentryWithMetrics.metrics.distribution(name, value);
        }
    } catch {
        // Metrics API not available, silently continue
    }

    Sentry.addBreadcrumb({
        category: 'metric.distribution',
        message: `${name}: ${value}`,
        data: tags,
        level: 'info',
    });
}
