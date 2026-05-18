/**
 * Query Performance Monitoring Service
 *
 * Addresses PLATFORM_AUDIT finding DB-2: No query performance monitoring
 *
 * This service provides:
 * - Query timing logs for performance tracking
 * - Slow query detection and alerting
 * - Query statistics aggregation
 * - Integration with audit logging
 */

import { logger } from '@/lib/logger';
const log = logger.child('QueryMonitor');

/**
 * Configuration for query monitoring
 */
interface QueryMonitorConfig {
    /** Threshold in ms to log slow queries (default: 1000ms) */
    slowQueryThresholdMs: number;
    /** Whether to log all queries or only slow ones */
    logAllQueries: boolean;
    /** Whether to send alerts for slow queries */
    enableAlerts: boolean;
    /** Sample rate for logging (0-1, where 1 = 100%) */
    sampleRate: number;
}

/**
 * Statistics for a query pattern
 */
interface QueryStats {
    queryName: string;
    totalCalls: number;
    totalTimeMs: number;
    avgTimeMs: number;
    maxTimeMs: number;
    minTimeMs: number;
    slowCalls: number;
    lastExecutedAt: Date;
}

/**
 * Result of a monitored query
 */
interface MonitoredQueryResult<T> {
    data: T;
    durationMs: number;
    isSlowQuery: boolean;
    queryName: string;
}

const DEFAULT_CONFIG: QueryMonitorConfig = {
    slowQueryThresholdMs: 1000,
    logAllQueries: false,
    enableAlerts: true,
    sampleRate: 1.0,
};

/**
 * Query Monitor Service
 *
 * Wraps database queries with performance monitoring and logging.
 */
class QueryMonitorService {
    private config: QueryMonitorConfig;
    private stats: Map<string, QueryStats> = new Map();

    constructor(config: Partial<QueryMonitorConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<QueryMonitorConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Execute a query with monitoring
     *
     * @param queryName - Human-readable name for the query
     * @param queryFn - Function that executes the query
     * @param metadata - Optional metadata for logging
     * @returns Query result with timing information
     *
     * @example
     * ```ts
     * const result = await monitor.executeMonitored(
     *   'fetch_restaurant_menu',
     *   () => supabase.from('menu_items').select('id, name, price').eq('restaurant_id', id),
     *   { restaurantId: id }
     * );
     * ```
     */
    async executeMonitored<T>(
        queryName: string,
        queryFn: () => Promise<T>,
        metadata?: Record<string, unknown>
    ): Promise<MonitoredQueryResult<T>> {
        // Check sampling
        if (Math.random() > this.config.sampleRate) {
            const data = await queryFn();
            return {
                data,
                durationMs: 0,
                isSlowQuery: false,
                queryName,
            };
        }

        const startTime = performance.now();
        let error: Error | null = null;

        try {
            const data = await queryFn();
            const durationMs = performance.now() - startTime;
            const isSlowQuery = durationMs > this.config.slowQueryThresholdMs;

            this.recordStats(queryName, durationMs, isSlowQuery);

            if (this.shouldLog(durationMs)) {
                this.logQuery(queryName, durationMs, metadata, isSlowQuery);
            }

            if (isSlowQuery && this.config.enableAlerts) {
                this.alertSlowQuery(queryName, durationMs, metadata);
            }

            return { data, durationMs, isSlowQuery, queryName };
        } catch (err) {
            const durationMs = performance.now() - startTime;
            error = err instanceof Error ? err : new Error(String(err));

            this.logQuery(queryName, durationMs, metadata, false, error);
            throw error;
        }
    }

    /**
     * Get statistics for all tracked queries
     */
    getStats(): QueryStats[] {
        return Array.from(this.stats.values());
    }

    /**
     * Get statistics for a specific query
     */
    getQueryStats(queryName: string): QueryStats | undefined {
        return this.stats.get(queryName);
    }

    /**
     * Get slow queries (queries with avg time above threshold)
     */
    getSlowQueries(): QueryStats[] {
        return this.getStats().filter(stat => stat.avgTimeMs > this.config.slowQueryThresholdMs);
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.stats.clear();
    }

    /**
     * Get current configuration
     */
    getConfig(): QueryMonitorConfig {
        return { ...this.config };
    }

    /**
     * Record query statistics
     */
    private recordStats(queryName: string, durationMs: number, isSlow: boolean): void {
        const existing = this.stats.get(queryName);

        if (existing) {
            existing.totalCalls++;
            existing.totalTimeMs += durationMs;
            existing.avgTimeMs = existing.totalTimeMs / existing.totalCalls;
            existing.maxTimeMs = Math.max(existing.maxTimeMs, durationMs);
            existing.minTimeMs = Math.min(existing.minTimeMs, durationMs);
            if (isSlow) existing.slowCalls++;
            existing.lastExecutedAt = new Date();
        } else {
            this.stats.set(queryName, {
                queryName,
                totalCalls: 1,
                totalTimeMs: durationMs,
                avgTimeMs: durationMs,
                maxTimeMs: durationMs,
                minTimeMs: durationMs,
                slowCalls: isSlow ? 1 : 0,
                lastExecutedAt: new Date(),
            });
        }
    }

    /**
     * Determine if query should be logged
     */
    private shouldLog(durationMs: number): boolean {
        if (this.config.logAllQueries) return true;
        return durationMs > this.config.slowQueryThresholdMs;
    }

    /**
     * Log query execution
     */
    private logQuery(
        queryName: string,
        durationMs: number,
        metadata?: Record<string, unknown>,
        isSlow = false,
        error?: Error | null
    ): void {
        const logLevel = error ? 'error' : isSlow ? 'warn' : 'info';
        const logData = {
            query: queryName,
            durationMs: Math.round(durationMs * 100) / 100,
            isSlow,
            ...metadata,
            ...(error && { error: error.message }),
        };

        if (error) {
            log.error(`Query failed: ${queryName}`, error, logData);
        } else if (isSlow) {
            log.warn(`Slow query: ${queryName}`, logData);
        } else {
            log.info(`Query executed: ${queryName}`, logData);
        }
    }

    /**
     * Alert on slow query
     */
    private alertSlowQuery(
        queryName: string,
        durationMs: number,
        metadata?: Record<string, unknown>
    ): void {
        log.warn(`SLOW QUERY ALERT: ${queryName} took ${durationMs.toFixed(2)}ms`, metadata);

        // In production, this could:
        // 1. Send to Sentry
        // 2. Write to audit_logs table
        // 3. Send to monitoring service

        // Example: Track in audit_logs (would be called from API route)
        // auditLogger.log({
        //     action: 'slow_query_detected',
        //     entityType: 'query',
        //     entityId: queryName,
        //     metadata: { durationMs, ...metadata },
        // });
    }
}

// Singleton instance
let monitorInstance: QueryMonitorService | null = null;

/**
 * Get the query monitor singleton
 */
export function getQueryMonitor(config?: Partial<QueryMonitorConfig>): QueryMonitorService {
    if (!monitorInstance) {
        monitorInstance = new QueryMonitorService(config);
    } else if (config) {
        monitorInstance.updateConfig(config);
    }
    return monitorInstance;
}

/**
 * Execute a monitored query (convenience function)
 *
 * @param queryName - Human-readable name for the query
 * @param queryFn - Function that executes the query
 * @param metadata - Optional metadata for logging
 * @returns The query result data
 *
 * @example
 * ```ts
 * const menuItems = await monitoredQuery(
 *   'fetch_menu_items',
 *   () => supabase.from('menu_items').select('id, name, price'),
 *   { restaurantId: '123' }
 * );
 * ```
 */
export async function monitoredQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    metadata?: Record<string, unknown>
): Promise<T> {
    const monitor = getQueryMonitor();
    const result = await monitor.executeMonitored(queryName, queryFn, metadata);
    return result.data;
}

/**
 * Time an async operation and return the duration
 *
 * @param name - Name for the timer
 * @param fn - Async function to time
 * @returns Object with result and duration
 */
export async function timeAsync<T>(
    name: string,
    fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
    const start = performance.now();
    const result = await fn();
    const durationMs = performance.now() - start;
    return { result, durationMs };
}

// Export types and class
export type { QueryMonitorConfig, QueryStats, MonitoredQueryResult };
export { QueryMonitorService };
