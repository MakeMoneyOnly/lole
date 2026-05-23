import { Counter, Gauge, Histogram, Registry } from 'prom-client';

export interface QueryMetrics {
    queryName: string;
    durationMs: number;
    success: boolean;
    rowCount?: number;
    timestamp: number;
}

export interface QueryPerformanceConfig {
    collectDefaultMetrics?: boolean;
    maxAgeSeconds?: number;
    timeoutMs?: number;
}

export interface TrackedQuery {
    name: string;
    startTime: number;
    success: boolean;
    rowCount?: number;
}

const registry = new Registry();

const queryDuration = new Histogram({
    name: 'query_duration_ms',
    help: 'Query execution duration in milliseconds',
    labelNames: ['query_name', 'success'] as const,
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [registry],
});

const queryTotal = new Counter({
    name: 'query_total',
    help: 'Total number of queries executed',
    labelNames: ['query_name', 'success'] as const,
    registers: [registry],
});

const queryErrors = new Counter({
    name: 'query_errors_total',
    help: 'Total number of query errors',
    labelNames: ['query_name', 'error_type'] as const,
    registers: [registry],
});

const activeQueries = new Gauge({
    name: 'active_queries',
    help: 'Number of currently active queries',
    labelNames: ['query_name'] as const,
    registers: [registry],
});

const queryTracking: Map<string, TrackedQuery> = new Map();

export function trackQueryStart(name: string): string {
    const id = `${name}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    queryTracking.set(id, {
        name,
        startTime: performance.now(),
        success: true,
    });
    activeQueries.inc({ query_name: name });
    return id;
}

export function trackQueryEnd(
    id: string,
    options?: { success?: boolean; rowCount?: number; error?: Error }
): QueryMetrics {
    const tracked = queryTracking.get(id);
    if (!tracked) {
        throw new Error(`Query tracking not found for id: ${id}`);
    }

    const endTime = performance.now();
    const durationMs = endTime - tracked.startTime;
    const success = options?.success ?? true;

    queryDuration.observe({ query_name: tracked.name, success: String(success) }, durationMs);
    queryTotal.inc({ query_name: tracked.name, success: String(success) });

    if (!success) {
        queryErrors.inc({
            query_name: tracked.name,
            error_type: options?.error?.constructor.name ?? 'UnknownError',
        });
    }

    activeQueries.dec({ query_name: tracked.name });

    const metrics: QueryMetrics = {
        queryName: tracked.name,
        durationMs,
        success,
        rowCount: options?.rowCount,
        timestamp: Date.now(),
    };

    queryTracking.delete(id);
    return metrics;
}

export function trackQuery<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const id = trackQueryStart(name);
    return fn()
        .then(result => {
            trackQueryEnd(id, { success: true });
            return result;
        })
        .catch(error => {
            trackQueryEnd(id, { success: false, error });
            throw error;
        });
}

export function getQueryMetrics(): QueryMetrics[] {
    return Array.from(queryTracking.values()).map(tracked => ({
        queryName: tracked.name,
        durationMs: performance.now() - tracked.startTime,
        success: tracked.success,
        timestamp: Date.now(),
    }));
}

export function clearQueryTracking(): void {
    queryTracking.clear();
}

export function getRegistry(): Registry {
    return registry;
}

export function getMetrics(): Promise<string> {
    return registry.metrics();
}

export const QueryPerformance = {
    trackQueryStart,
    trackQueryEnd,
    trackQuery,
    getQueryMetrics,
    clearQueryTracking,
    getRegistry,
    getMetrics,
};

export default QueryPerformance;
