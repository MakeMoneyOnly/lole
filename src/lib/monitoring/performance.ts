/**
 * Performance Monitoring Hooks
 *
 * MED-029: Provides performance timing logs for critical paths:
 * - Orders: creation, status updates, bulk operations
 * - Payments: initiation, verification, webhooks
 * - KDS operations: item actions, order routing
 *
 * @module lib/monitoring/performance
 */

import { logger } from '@/lib/logger';

/**
 * Performance metric types
 */
export type PerformanceMetricType =
    | 'order_create'
    | 'order_update'
    | 'order_bulk_status'
    | 'payment_initiate'
    | 'payment_verify'
    | 'payment_webhook'
    | 'kds_action'
    | 'kds_routing'
    | 'kds_print'
    | 'guest_order'
    | 'menu_query'
    | 'table_session'
    | 'notification_send'
    | 'sync_operation';

/**
 * Performance threshold configuration (in milliseconds)
 */
export const PERFORMANCE_THRESHOLDS: Record<
    PerformanceMetricType,
    { warning: number; critical: number }
> = {
    order_create: { warning: 500, critical: 1000 },
    order_update: { warning: 300, critical: 500 },
    order_bulk_status: { warning: 1000, critical: 2000 },
    payment_initiate: { warning: 2000, critical: 5000 },
    payment_verify: { warning: 1000, critical: 3000 },
    payment_webhook: { warning: 500, critical: 1000 },
    kds_action: { warning: 200, critical: 500 },
    kds_routing: { warning: 300, critical: 500 },
    kds_print: { warning: 1000, critical: 2000 },
    guest_order: { warning: 500, critical: 1000 },
    menu_query: { warning: 200, critical: 500 },
    table_session: { warning: 300, critical: 500 },
    notification_send: { warning: 500, critical: 1000 },
    sync_operation: { warning: 1000, critical: 3000 },
};

/**
 * Performance metric record
 */
export interface PerformanceMetric {
    type: PerformanceMetricType;
    duration: number;
    timestamp: string;
    restaurantId?: string;
    orderId?: string;
    paymentId?: string;
    kdsItemId?: string;
    metadata?: Record<string, unknown>;
    threshold: 'ok' | 'warning' | 'critical';
}

/**
 * In-memory store for recent metrics (for real-time monitoring)
 */
class PerformanceMetricsStore {
    private metrics: PerformanceMetric[] = [];
    private maxSize = 1000; // Keep last 1000 metrics

    add(metric: PerformanceMetric): void {
        this.metrics.push(metric);
        if (this.metrics.length > this.maxSize) {
            this.metrics.shift();
        }
    }

    getRecent(count = 100): PerformanceMetric[] {
        return this.metrics.slice(-count);
    }

    getByType(type: PerformanceMetricType): PerformanceMetric[] {
        return this.metrics.filter(m => m.type === type);
    }

    getSlowOperations(threshold: 'warning' | 'critical'): PerformanceMetric[] {
        return this.metrics.filter(m => m.threshold === threshold);
    }

    getStats(type?: PerformanceMetricType): {
        count: number;
        avgDuration: number;
        maxDuration: number;
        p95Duration: number;
    } {
        const filtered = type ? this.metrics.filter(m => m.type === type) : this.metrics;

        if (filtered.length === 0) {
            return { count: 0, avgDuration: 0, maxDuration: 0, p95Duration: 0 };
        }

        const durations = filtered.map(m => m.duration).sort((a, b) => a - b);
        const sum = durations.reduce((a, b) => a + b, 0);

        return {
            count: filtered.length,
            avgDuration: Math.round(sum / durations.length),
            maxDuration: durations[durations.length - 1],
            p95Duration:
                durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1],
        };
    }

    clear(): void {
        this.metrics = [];
    }
}

// Singleton store
export const performanceMetricsStore = new PerformanceMetricsStore();

/**
 * Determine threshold level for a metric
 */
function getThresholdLevel(
    type: PerformanceMetricType,
    duration: number
): 'ok' | 'warning' | 'critical' {
    const thresholds = PERFORMANCE_THRESHOLDS[type];
    if (duration >= thresholds.critical) {
        return 'critical';
    }
    if (duration >= thresholds.warning) {
        return 'warning';
    }
    return 'ok';
}

/**
 * Log a performance metric
 */
export function logPerformanceMetric(
    type: PerformanceMetricType,
    duration: number,
    context?: {
        restaurantId?: string;
        orderId?: string;
        paymentId?: string;
        kdsItemId?: string;
        metadata?: Record<string, unknown>;
    }
): PerformanceMetric {
    const threshold = getThresholdLevel(type, duration);

    const metric: PerformanceMetric = {
        type,
        duration,
        timestamp: new Date().toISOString(),
        threshold,
        ...context,
    };

    // Store the metric
    performanceMetricsStore.add(metric);

    // Log based on threshold
    const logContext = {
        type,
        duration,
        threshold,
        restaurantId: context?.restaurantId,
        orderId: context?.orderId,
        paymentId: context?.paymentId,
        kdsItemId: context?.kdsItemId,
        ...context?.metadata,
    };

    if (threshold === 'critical') {
        logger.error(`Performance CRITICAL: ${type} took ${duration}ms`, undefined, logContext);
    } else if (threshold === 'warning') {
        logger.warn(`Performance WARNING: ${type} took ${duration}ms`, logContext);
    } else {
        logger.debug(`Performance OK: ${type} took ${duration}ms`, logContext);
    }

    return metric;
}

/**
 * Performance timer class for measuring operation duration
 */
export class PerformanceTimer {
    private startTime: number;
    private type: PerformanceMetricType;
    private context?: {
        restaurantId?: string;
        orderId?: string;
        paymentId?: string;
        kdsItemId?: string;
        metadata?: Record<string, unknown>;
    };

    constructor(
        type: PerformanceMetricType,
        context?: {
            restaurantId?: string;
            orderId?: string;
            paymentId?: string;
            kdsItemId?: string;
            metadata?: Record<string, unknown>;
        }
    ) {
        this.type = type;
        this.context = context;
        this.startTime = Date.now();
    }

    /**
     * End the timer and log the metric
     */
    end(additionalMetadata?: Record<string, unknown>): PerformanceMetric {
        const duration = Date.now() - this.startTime;
        return logPerformanceMetric(this.type, duration, {
            ...this.context,
            metadata: {
                ...this.context?.metadata,
                ...additionalMetadata,
            },
        });
    }

    /**
     * Get current duration without ending
     */
    getDuration(): number {
        return Date.now() - this.startTime;
    }
}

/**
 * Start a performance timer for order creation
 */
export function startOrderCreateTimer(restaurantId: string): PerformanceTimer {
    return new PerformanceTimer('order_create', { restaurantId });
}

/**
 * Start a performance timer for order update
 */
export function startOrderUpdateTimer(restaurantId: string, orderId: string): PerformanceTimer {
    return new PerformanceTimer('order_update', { restaurantId, orderId });
}

/**
 * Start a performance timer for payment initiation
 */
export function startPaymentInitiateTimer(restaurantId: string, orderId: string): PerformanceTimer {
    return new PerformanceTimer('payment_initiate', { restaurantId, orderId });
}

/**
 * Start a performance timer for payment verification
 */
export function startPaymentVerifyTimer(paymentId: string): PerformanceTimer {
    return new PerformanceTimer('payment_verify', { paymentId });
}

/**
 * Start a performance timer for KDS action
 */
export function startKDSActionTimer(restaurantId: string, kdsItemId: string): PerformanceTimer {
    return new PerformanceTimer('kds_action', { restaurantId, kdsItemId });
}

/**
 * Start a performance timer for guest order
 */
export function startGuestOrderTimer(restaurantId: string): PerformanceTimer {
    return new PerformanceTimer('guest_order', { restaurantId });
}

/**
 * Measure an async operation with performance logging
 */
export async function measurePerformance<T>(
    type: PerformanceMetricType,
    fn: () => Promise<T>,
    context?: {
        restaurantId?: string;
        orderId?: string;
        paymentId?: string;
        kdsItemId?: string;
        metadata?: Record<string, unknown>;
    }
): Promise<{ result: T; metric: PerformanceMetric }> {
    const timer = new PerformanceTimer(type, context);

    try {
        const result = await fn();
        const metric = timer.end({ status: 'success' });
        return { result, metric };
    } catch (error) {
        timer.end({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

/**
 * Measure a sync operation with performance logging
 */
export function measureSyncPerformance<T>(
    type: PerformanceMetricType,
    fn: () => T,
    context?: {
        restaurantId?: string;
        orderId?: string;
        paymentId?: string;
        kdsItemId?: string;
        metadata?: Record<string, unknown>;
    }
): { result: T; metric: PerformanceMetric } {
    const timer = new PerformanceTimer(type, context);

    try {
        const result = fn();
        const metric = timer.end({ status: 'success' });
        return { result, metric };
    } catch (error) {
        timer.end({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}

/**
 * Get performance summary for monitoring endpoints
 */
export function getPerformanceSummary(): {
    totalOperations: number;
    slowOperations: number;
    criticalOperations: number;
    byType: Record<PerformanceMetricType, ReturnType<typeof performanceMetricsStore.getStats>>;
} {
    const allMetrics = performanceMetricsStore.getRecent(1000);
    const slowOps = performanceMetricsStore.getSlowOperations('warning');
    const criticalOps = performanceMetricsStore.getSlowOperations('critical');

    const byType: Record<string, ReturnType<typeof performanceMetricsStore.getStats>> = {};

    // Get stats for each metric type
    const types: PerformanceMetricType[] = [
        'order_create',
        'order_update',
        'order_bulk_status',
        'payment_initiate',
        'payment_verify',
        'payment_webhook',
        'kds_action',
        'kds_routing',
        'kds_print',
        'guest_order',
        'menu_query',
        'table_session',
        'notification_send',
        'sync_operation',
    ];

    for (const type of types) {
        byType[type] = performanceMetricsStore.getStats(type);
    }

    return {
        totalOperations: allMetrics.length,
        slowOperations: slowOps.length,
        criticalOperations: criticalOps.length,
        byType: byType as Record<
            PerformanceMetricType,
            ReturnType<typeof performanceMetricsStore.getStats>
        >,
    };
}

/**
 * Performance alert thresholds for external monitoring
 */
export function checkPerformanceAlerts(): {
    hasAlerts: boolean;
    alerts: Array<{
        type: PerformanceMetricType;
        message: string;
        severity: 'warning' | 'critical';
    }>;
} {
    const alerts: Array<{
        type: PerformanceMetricType;
        message: string;
        severity: 'warning' | 'critical';
    }> = [];

    const stats = getPerformanceSummary();

    for (const [type, typeStats] of Object.entries(stats.byType)) {
        const metricType = type as PerformanceMetricType;
        const thresholds = PERFORMANCE_THRESHOLDS[metricType];

        if (typeStats.p95Duration >= thresholds.critical) {
            alerts.push({
                type: metricType,
                severity: 'critical',
                message: `P95 duration (${typeStats.p95Duration}ms) exceeds critical threshold (${thresholds.critical}ms)`,
            });
        } else if (typeStats.p95Duration >= thresholds.warning) {
            alerts.push({
                type: metricType,
                severity: 'warning',
                message: `P95 duration (${typeStats.p95Duration}ms) exceeds warning threshold (${thresholds.warning}ms)`,
            });
        }
    }

    return {
        hasAlerts: alerts.length > 0,
        alerts,
    };
}
