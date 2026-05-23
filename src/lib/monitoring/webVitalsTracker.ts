export type WebVitalName = 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP';

export interface WebVitalMetric {
    name: WebVitalName;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    delta: number;
    entries: PerformanceEntry[];
    id: string;
    timestamp: number;
}

export interface WebVitalsThresholds {
    LCP: { good: number; poor: number };
    FID: { good: number; poor: number };
    CLS: { good: number; poor: number };
    FCP: { good: number; poor: number };
    TTFB: { good: number; poor: number };
    INP: { good: number; poor: number };
}

export const WEB_VITALS_THRESHOLDS: WebVitalsThresholds = {
    LCP: { good: 2500, poor: 4000 },
    FID: { good: 100, poor: 300 },
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 },
    INP: { good: 200, poor: 500 },
};

export function getRating(
    name: WebVitalName,
    value: number
): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = WEB_VITALS_THRESHOLDS[name];
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.poor) return 'needs-improvement';
    return 'poor';
}

export function formatVitalValue(name: WebVitalName, value: number): string {
    switch (name) {
        case 'CLS':
            return value.toFixed(3);
        case 'LCP':
        case 'FID':
        case 'FCP':
        case 'TTFB':
        case 'INP':
        default:
            return `${Math.round(value)}ms`;
    }
}

export function getVitalColor(rating: 'good' | 'needs-improvement' | 'poor'): string {
    switch (rating) {
        case 'good':
            return 'text-green-600';
        case 'needs-improvement':
            return 'text-amber-600';
        case 'poor':
            return 'text-red-600';
    }
}

export function getVitalBgColor(rating: 'good' | 'needs-improvement' | 'poor'): string {
    switch (rating) {
        case 'good':
            return 'bg-green-50 border-green-200';
        case 'needs-improvement':
            return 'bg-amber-50 border-amber-200';
        case 'poor':
            return 'bg-red-50 border-red-200';
    }
}

export function getVitalBadgeColor(rating: 'good' | 'needs-improvement' | 'poor'): string {
    switch (rating) {
        case 'good':
            return 'bg-green-100 text-green-800';
        case 'needs-improvement':
            return 'bg-amber-100 text-amber-800';
        case 'poor':
            return 'bg-red-100 text-red-800';
    }
}

export function getVitalChartDataColor(rating: 'good' | 'needs-improvement' | 'poor'): string {
    switch (rating) {
        case 'good':
            return '#22c55e';
        case 'needs-improvement':
            return '#f59e0b';
        case 'poor':
            return '#ef4444';
    }
}

const observers: Map<string, PerformanceObserver> = new Map();
const metricHistory: Map<string, WebVitalMetric[]> = new Map();
const MAX_HISTORY_SIZE = 100;

function getEntryValue(entry: PerformanceEntry, name: WebVitalName): number {
    switch (name) {
        case 'CLS':
            return (entry as { value?: number }).value ?? entry.startTime ?? 0;
        case 'FID':
            return (entry as PerformanceEventTiming).duration ?? entry.startTime ?? 0;
        case 'LCP':
        case 'FCP':
        case 'TTFB':
        case 'INP':
            return entry.startTime ?? 0;
        default:
            return entry.startTime ?? 0;
    }
}

export function observeWebVitals(
    callback: (metric: WebVitalMetric) => void
): PerformanceObserver[] {
    const metrics: WebVitalName[] = ['LCP', 'FID', 'CLS', 'FCP', 'TTFB', 'INP'];
    const observersList: PerformanceObserver[] = [];

    metrics.forEach(name => {
        try {
            const observer = new PerformanceObserver(list => {
                list.getEntries().forEach(entry => {
                    const value = getEntryValue(entry, name);
                    const metric: WebVitalMetric = {
                        name,
                        value,
                        rating: getRating(name, value),
                        delta: 0,
                        entries: [entry],
                        id: `${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        timestamp: Date.now(),
                    };

                    addToHistory(name, metric);
                    callback(metric);
                });
            });

            const entryType = name.toLowerCase();
            observer.observe({
                type: entryType as
                    | 'largest-contentful-paint'
                    | 'first-input'
                    | 'layout-shift'
                    | 'first-contentful-paint'
                    | 'navigation'
                    | 'longtask'
                    | 'paint',
                buffered: true,
            });
            observers.set(name, observer);
            observersList.push(observer);
        } catch {
            // Metric not supported in this browser
        }
    });

    return observersList;
}

function addToHistory(name: WebVitalName, metric: WebVitalMetric): void {
    const history = metricHistory.get(name) || [];
    history.push(metric);

    if (history.length > MAX_HISTORY_SIZE) {
        history.shift();
    }

    metricHistory.set(name, history);
}

export function getMetricHistory(name: WebVitalName): WebVitalMetric[] {
    return metricHistory.get(name) || [];
}

export function getAllMetricHistory(): Record<WebVitalName, WebVitalMetric[]> {
    const result: Record<string, WebVitalMetric[]> = {};
    ['LCP', 'FID', 'CLS', 'FCP', 'TTFB', 'INP'].forEach(name => {
        result[name] = metricHistory.get(name as WebVitalName) || [];
    });
    return result as Record<WebVitalName, WebVitalMetric[]>;
}

export function clearMetricHistory(): void {
    metricHistory.clear();
}

export function reportWebVital(
    metric: { name: WebVitalName; value: number; delta: number; id: string },
    endpoint?: string
): Promise<Response | undefined> {
    const data = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: getRating(metric.name, metric.value),
        delta: metric.delta,
        id: metric.id,
        timestamp: Date.now(),
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    });

    if (endpoint && typeof fetch !== 'undefined') {
        return fetch(endpoint, {
            method: 'POST',
            body: data,
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return Promise.resolve(undefined);
}

export function initWebVitalsReporting(endpoint?: string): PerformanceObserver[] {
    return observeWebVitals(metric => {
        if (endpoint) {
            reportWebVital(
                {
                    name: metric.name,
                    value: metric.value,
                    delta: metric.delta,
                    id: metric.id,
                },
                endpoint
            );
        }
    });
}

export function disconnectObservers(): void {
    observers.forEach(observer => observer.disconnect());
    observers.clear();
}

export function calculateWebVitalsScore(
    metrics: Record<WebVitalName, WebVitalMetric | null>
): number {
    const coreVitals: WebVitalName[] = ['LCP', 'FID', 'CLS'];

    const score = coreVitals.reduce((acc, name) => {
        const vital = metrics[name];
        if (!vital) return acc;
        if (vital.rating === 'good') return acc + 3.33;
        if (vital.rating === 'needs-improvement') return acc + 1.67;
        return acc;
    }, 0);

    return Math.round(score * 10) / 10;
}

export function getCoreWebVitalsStatus(
    metrics: Record<WebVitalName, WebVitalMetric | null>
): 'pass' | 'needs-improvement' | 'fail' {
    const coreVitals: WebVitalName[] = ['LCP', 'FID', 'CLS'];

    const hasPoor = coreVitals.some(name => metrics[name]?.rating === 'poor');
    const hasNeedsImprovement = coreVitals.some(
        name => metrics[name]?.rating === 'needs-improvement'
    );

    if (hasPoor) return 'fail';
    if (hasNeedsImprovement) return 'needs-improvement';
    return 'pass';
}

export interface ChartDataPoint {
    timestamp: number;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
}

export function getChartData(name: WebVitalName): ChartDataPoint[] {
    const history = getMetricHistory(name);
    return history.map(m => ({
        timestamp: m.timestamp,
        value: m.value,
        rating: m.rating,
    }));
}

export interface AggregateStats {
    avg: number;
    min: number;
    max: number;
    p75: number;
    count: number;
}

export function getAggregateStats(name: WebVitalName): AggregateStats | null {
    const history = getMetricHistory(name);

    if (history.length === 0) return null;

    const values = history.map(m => m.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);

    return {
        avg: Math.round(sum / values.length),
        min: Math.round(values[0]),
        max: Math.round(values[values.length - 1]),
        p75: Math.round(values[Math.floor(values.length * 0.75)] || values[values.length - 1]),
        count: values.length,
    };
}
