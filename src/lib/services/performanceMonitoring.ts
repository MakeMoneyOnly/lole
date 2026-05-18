/**
 * Performance Monitoring Service
 *
 * Addresses PLATFORM_AUDIT finding DEVOPS-4: Missing performance monitoring
 *
 * This service provides:
 * - Custom performance metrics tracking
 * - Web Vitals reporting
 * - Integration with Vercel Analytics
 * - Custom APM-like functionality
 */

import { logger } from '@/lib/logger';

const log = logger.child('Performance');

/**
 * Web Vitals metric type
 * Based on the web-vitals library interface
 */
interface Metric {
    /** The name of the metric */
    name: string;
    /** The current value of the metric */
    value: number;
    /** The rating of the metric value */
    rating: 'good' | 'needs-improvement' | 'poor';
    /** A unique ID for the metric */
    id: string;
}

/**
 * Performance metric data
 */
interface PerformanceMetric {
    name: string;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    timestamp: number;
    id: string;
    navigationType?: string;
}

/**
 * Custom performance event
 */
interface PerformanceEvent {
    name: string;
    duration: number;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

/**
 * Performance thresholds based on Web Vitals
 */
const THRESHOLDS: Record<string, { good: number; poor: number }> = {
    LCP: { good: 2500, poor: 4000 },
    FID: { good: 100, poor: 300 },
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 },
    INP: { good: 200, poor: 500 },
};

/**
 * Performance Monitor Service
 */
class PerformanceMonitorService {
    private metrics: PerformanceMetric[] = [];
    private events: PerformanceEvent[] = [];
    private isEnabled: boolean;
    private isDevelopment: boolean;
    private reportingEndpoint?: string;

    constructor() {
        this.isEnabled = typeof window !== 'undefined';
        this.isDevelopment = process.env.NODE_ENV === 'development';
        this.reportingEndpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
    }

    /**
     * Record a Web Vital metric
     */
    recordMetric(metric: Metric): void {
        const performanceMetric: PerformanceMetric = {
            name: metric.name,
            value: metric.value,
            rating: metric.rating as 'good' | 'needs-improvement' | 'poor',
            timestamp: Date.now(),
            id: metric.id,
            navigationType: (metric as unknown as Record<string, unknown>).navigationType as
                | string
                | undefined,
        };

        this.metrics.push(performanceMetric);
        this.logMetric(performanceMetric);
        this.reportMetric(performanceMetric);
    }

    /**
     * Start a custom performance timer
     *
     * @param name - Name of the operation being timed
     * @returns Function to stop the timer and record the duration
     *
     * @example
     * ```ts
     * const stopTimer = performanceMonitor.startTimer('api_call');
     * await fetchData();
     * stopTimer({ endpoint: '/api/v1/merchant/operations/orders' });
     * ```
     */
    startTimer(name: string): (metadata?: Record<string, unknown>) => number {
        const startTime = performance.now();

        return (metadata?: Record<string, unknown>) => {
            const duration = performance.now() - startTime;
            this.recordEvent(name, duration, metadata);
            return duration;
        };
    }

    /**
     * Record a custom performance event
     */
    recordEvent(name: string, duration: number, metadata?: Record<string, unknown>): void {
        const event: PerformanceEvent = {
            name,
            duration,
            timestamp: Date.now(),
            metadata,
        };

        this.events.push(event);

        if (this.isDevelopment) {
            log.warn(`${name}: ${duration.toFixed(2)}ms`, metadata);
        }

        // Report to analytics
        this.reportEvent(event);
    }

    /**
     * Mark a performance mark using the Performance API
     */
    mark(name: string): void {
        if (!this.isEnabled) return;
        performance.mark(name);
    }

    /**
     * Measure between two marks
     */
    measure(name: string, startMark: string, endMark?: string): number | null {
        if (!this.isEnabled) return null;

        try {
            const end = endMark ?? `${name}-end`;
            if (!endMark) {
                performance.mark(end);
            }

            performance.measure(name, startMark, end);
            const entries = performance.getEntriesByName(name, 'measure');
            const duration = entries[entries.length - 1]?.duration;

            if (duration !== undefined) {
                this.recordEvent(name, duration);
            }

            return duration ?? null;
} catch (error) {
                log.warn('Measure failed', { error });
                return null;
            }
    }

    /**
     * Get all recorded metrics
     */
    getMetrics(): PerformanceMetric[] {
        return [...this.metrics];
    }

    /**
     * Get all recorded events
     */
    getEvents(): PerformanceEvent[] {
        return [...this.events];
    }

    /**
     * Get summary statistics
     */
    getSummary(): {
        metrics: Record<string, { count: number; avg: number; min: number; max: number }>;
        events: Record<string, { count: number; avg: number; min: number; max: number }>;
    } {
        const metricsSummary: Record<
            string,
            { count: number; avg: number; min: number; max: number }
        > = {};
        const eventsSummary: Record<
            string,
            { count: number; avg: number; min: number; max: number }
        > = {};

        // Aggregate metrics
        for (const metric of this.metrics) {
            if (!metricsSummary[metric.name]) {
                metricsSummary[metric.name] = { count: 0, avg: 0, min: Infinity, max: 0 };
            }
            const summary = metricsSummary[metric.name];
            summary.count++;
            summary.avg = (summary.avg * (summary.count - 1) + metric.value) / summary.count;
            summary.min = Math.min(summary.min, metric.value);
            summary.max = Math.max(summary.max, metric.value);
        }

        // Aggregate events
        for (const event of this.events) {
            if (!eventsSummary[event.name]) {
                eventsSummary[event.name] = { count: 0, avg: 0, min: Infinity, max: 0 };
            }
            const summary = eventsSummary[event.name];
            summary.count++;
            summary.avg = (summary.avg * (summary.count - 1) + event.duration) / summary.count;
            summary.min = Math.min(summary.min, event.duration);
            summary.max = Math.max(summary.max, event.duration);
        }

        return { metrics: metricsSummary, events: eventsSummary };
    }

    /**
     * Clear all recorded data
     */
    clear(): void {
        this.metrics = [];
        this.events = [];
    }

    /**
     * Log metric to console in development
     */
    private logMetric(metric: PerformanceMetric): void {
        if (!this.isDevelopment) return;

        const emoji = metric.rating === 'good' ? '✅' : metric.rating === 'poor' ? '❌' : '⚠️';
        log.warn(`${emoji} ${metric.name}: ${metric.value.toFixed(2)}ms (${metric.rating})`);
    }

    /**
     * Report metric to analytics endpoint
     */
    private reportMetric(metric: PerformanceMetric): void {
        if (!this.reportingEndpoint) return;

        // Use sendBeacon for reliable delivery
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            const blob = new Blob(
                [
                    JSON.stringify({
                        type: 'web-vital',
                        ...metric,
                    }),
                ],
                { type: 'application/json' }
            );
            navigator.sendBeacon(this.reportingEndpoint, blob);
        }
    }

    /**
     * Report event to analytics endpoint
     */
    private reportEvent(event: PerformanceEvent): void {
        if (!this.reportingEndpoint) return;

        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            const blob = new Blob(
                [
                    JSON.stringify({
                        type: 'performance-event',
                        ...event,
                    }),
                ],
                { type: 'application/json' }
            );
            navigator.sendBeacon(this.reportingEndpoint, blob);
        }
    }
}

// Singleton instance
let performanceMonitorInstance: PerformanceMonitorService | null = null;

/**
 * Get the performance monitor singleton
 */
export function getPerformanceMonitor(): PerformanceMonitorService {
    if (!performanceMonitorInstance) {
        performanceMonitorInstance = new PerformanceMonitorService();
    }
    return performanceMonitorInstance;
}

/**
 * Track a Web Vital metric
 */
export function trackWebVital(metric: Metric): void {
    const monitor = getPerformanceMonitor();
    monitor.recordMetric(metric);
}

/**
 * Time an async operation
 *
 * @param name - Name of the operation
 * @param fn - Async function to time
 * @returns The result of the function
 *
 * @example
 * ```ts
 * const data = await timeAsync('fetch_orders', () => fetchOrders());
 * ```
 */
export async function timeAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const monitor = getPerformanceMonitor();
    const stopTimer = monitor.startTimer(name);

    try {
        const result = await fn();
        stopTimer();
        return result;
    } catch (error) {
        stopTimer({ error: true });
        throw error;
    }
}

/**
 * Time a sync operation
 *
 * @param name - Name of the operation
 * @param fn - Function to time
 * @returns The result of the function
 */
export function timeSync<T>(name: string, fn: () => T): T {
    const monitor = getPerformanceMonitor();
    const stopTimer = monitor.startTimer(name);

    try {
        const result = fn();
        stopTimer();
        return result;
    } catch (error) {
        stopTimer({ error: true });
        throw error;
    }
}

/**
 * Hook to track component render time
 *
 * @param componentName - Name of the component
 * @returns Object with start and end functions
 */
export function usePerformanceTracking(componentName: string) {
    const monitor = getPerformanceMonitor();

    const trackRender = (): React.JSX.Element => {
        const stopTimer = monitor.startTimer(`render_${componentName}`);
        return stopTimer;
    };

    const trackEffect = (effectName: string): React.JSX.Element => {
        return monitor.startTimer(`effect_${componentName}_${effectName}`);
    };

    return { trackRender, trackEffect };
}

// Export types and class
export type { PerformanceMetric, PerformanceEvent };
export { PerformanceMonitorService, THRESHOLDS };
