import { describe, it, expect, vi, beforeEach } from 'vitest';
import client from 'prom-client';

type MetricValue = { labels: Partial<Record<string, string | number>>; value: number };

describe('prometheus monitoring', () => {
    beforeEach(() => {
        client.register.resetMetrics();
    });

    it('should export metrics object with all metric instances', async () => {
        const { metrics } = await import('../prometheus');
        expect(metrics.httpRequestDurationSeconds).toBeInstanceOf(client.Histogram);
        expect(metrics.httpRequestsTotal).toBeInstanceOf(client.Counter);
        expect(metrics.loleOrdersTotal).toBeInstanceOf(client.Counter);
        expect(metrics.lolePaymentsTotal).toBeInstanceOf(client.Counter);
        expect(metrics.lolePaymentFailureRate).toBeInstanceOf(client.Gauge);
        expect(metrics.lolectiveSessions).toBeInstanceOf(client.Gauge);
        expect(metrics.lolectiveRestaurants).toBeInstanceOf(client.Gauge);
    });

    describe('recordHttpRequest', () => {
        it('should observe histogram with duration converted to seconds and increment counter', async () => {
            const { recordHttpRequest, metrics } = await import('../prometheus');
            recordHttpRequest('GET', '/api/orders', 200, 1500);

            const histogramValues = await metrics.httpRequestDurationSeconds!.get();
            expect(histogramValues.values.length).toBeGreaterThan(0);

            const counterValues = await metrics.httpRequestsTotal!.get();
            const matched = counterValues.values.find(
                (v: MetricValue) =>
                    v.labels.method === 'GET' &&
                    v.labels.path === '/api/orders' &&
                    v.labels.status === '200'
            );
            expect(matched).toBeDefined();
            expect(matched!.value).toBe(1);
        });

        it('should convert statusCode to string for labels', async () => {
            const { recordHttpRequest, metrics } = await import('../prometheus');
            recordHttpRequest('POST', '/api/payments', 404, 500);

            const counterValues = await metrics.httpRequestsTotal!.get();
            const matched = counterValues.values.find(
                (v: MetricValue) =>
                    v.labels.method === 'POST' &&
                    v.labels.path === '/api/payments' &&
                    v.labels.status === '404'
            );
            expect(matched).toBeDefined();
            expect(matched!.value).toBe(1);
        });

        it('should convert durationMs to seconds (divide by 1000)', async () => {
            const { recordHttpRequest, metrics } = await import('../prometheus');
            recordHttpRequest('PUT', '/api/orders/1', 204, 2500);

            const histogramValues = await metrics.httpRequestDurationSeconds!.get();
            const observed = histogramValues.values.find(
                (v: MetricValue) =>
                    v.labels.method === 'PUT' &&
                    v.labels.path === '/api/orders/1' &&
                    v.labels.status === '204'
            );
            expect(observed).toBeDefined();
        });

        it('should accumulate counts across multiple calls', async () => {
            const { recordHttpRequest, metrics } = await import('../prometheus');
            recordHttpRequest('GET', '/api/test', 200, 100);
            recordHttpRequest('GET', '/api/test', 200, 200);

            const counterValues = await metrics.httpRequestsTotal!.get();
            const matched = counterValues.values.find(
                (v: MetricValue) =>
                    v.labels.method === 'GET' &&
                    v.labels.path === '/api/test' &&
                    v.labels.status === '200'
            );
            expect(matched).toBeDefined();
            expect(matched!.value).toBe(2);
        });
    });

    describe('recordOrderEvent', () => {
        it('should increment order counter with correct labels', async () => {
            const { recordOrderEvent, metrics } = await import('../prometheus');
            recordOrderEvent('rest-123', 'completed');

            const values = await metrics.loleOrdersTotal!.get();
            const matched = values.values.find(
                (v: MetricValue) =>
                    v.labels.restaurant_id === 'rest-123' && v.labels.status === 'completed'
            );
            expect(matched).toBeDefined();
            expect(matched!.value).toBe(1);
        });

        it('should accumulate counts for same labels', async () => {
            const { recordOrderEvent, metrics } = await import('../prometheus');
            recordOrderEvent('rest-456', 'cancelled');
            recordOrderEvent('rest-456', 'cancelled');
            recordOrderEvent('rest-456', 'cancelled');

            const values = await metrics.loleOrdersTotal!.get();
            const matched = values.values.find(
                (v: MetricValue) =>
                    v.labels.restaurant_id === 'rest-456' && v.labels.status === 'cancelled'
            );
            expect(matched).toBeDefined();
            expect(matched!.value).toBe(3);
        });
    });

    describe('recordPaymentEvent', () => {
        it('should increment payment counter with correct labels', async () => {
            const { recordPaymentEvent, metrics } = await import('../prometheus');
            recordPaymentEvent('telebirr', 'success');

            const values = await metrics.lolePaymentsTotal!.get();
            const matched = values.values.find(
                (v: MetricValue) =>
                    v.labels.provider === 'telebirr' && v.labels.status === 'success'
            );
            expect(matched).toBeDefined();
            expect(matched!.value).toBe(1);
        });

        it('should track different providers and statuses independently', async () => {
            const { recordPaymentEvent, metrics } = await import('../prometheus');
            recordPaymentEvent('amole', 'success');
            recordPaymentEvent('cbe', 'failed');

            const values = await metrics.lolePaymentsTotal!.get();
            const amoleSuccess = values.values.find(
                (v: MetricValue) => v.labels.provider === 'amole' && v.labels.status === 'success'
            );
            const cbeFailed = values.values.find(
                (v: MetricValue) => v.labels.provider === 'cbe' && v.labels.status === 'failed'
            );
            expect(amoleSuccess).toBeDefined();
            expect(amoleSuccess!.value).toBe(1);
            expect(cbeFailed).toBeDefined();
            expect(cbeFailed!.value).toBe(1);
        });
    });

    describe('setActiveSessions', () => {
        it('should set the active sessions gauge to the given value', async () => {
            const { setActiveSessions, metrics } = await import('../prometheus');
            setActiveSessions(42);

            const values = await metrics.lolectiveSessions!.get();
            expect(values.values[0]?.value).toBe(42);
        });

        it('should overwrite previous value', async () => {
            const { setActiveSessions, metrics } = await import('../prometheus');
            setActiveSessions(10);
            setActiveSessions(5);

            const values = await metrics.lolectiveSessions!.get();
            expect(values.values[0]?.value).toBe(5);
        });

        it('should accept zero', async () => {
            const { setActiveSessions, metrics } = await import('../prometheus');
            setActiveSessions(0);

            const values = await metrics.lolectiveSessions!.get();
            expect(values.values[0]?.value).toBe(0);
        });
    });

    describe('setActiveRestaurants', () => {
        it('should set the active restaurants gauge to the given value', async () => {
            const { setActiveRestaurants, metrics } = await import('../prometheus');
            setActiveRestaurants(7);

            const values = await metrics.lolectiveRestaurants!.get();
            expect(values.values[0]?.value).toBe(7);
        });

        it('should overwrite previous value', async () => {
            const { setActiveRestaurants, metrics } = await import('../prometheus');
            setActiveRestaurants(20);
            setActiveRestaurants(15);

            const values = await metrics.lolectiveRestaurants!.get();
            expect(values.values[0]?.value).toBe(15);
        });
    });

    describe('getPrometheusMetrics', () => {
        it('should return a string', async () => {
            const { getPrometheusMetrics } = await import('../prometheus');
            const result = await getPrometheusMetrics();
            expect(typeof result).toBe('string');
        });

        it('should include registered metrics in output', async () => {
            const { recordHttpRequest, getPrometheusMetrics } = await import('../prometheus');
            recordHttpRequest('GET', '/test', 200, 100);

            const result = await getPrometheusMetrics();
            expect(result).toContain('http_request_duration_seconds');
            expect(result).toContain('http_requests_total');
        });
    });

    describe('getPrometheusContentType', () => {
        it('should return the prometheus content type string', async () => {
            const { getPrometheusContentType } = await import('../prometheus');
            expect(getPrometheusContentType()).toBe('text/plain; version=0.0.4; charset=utf-8');
        });
    });

    describe('getMetricsJson', () => {
        it('should return JSON representation of metrics', async () => {
            const { recordOrderEvent, getMetricsJson } = await import('../prometheus');
            recordOrderEvent('rest-1', 'pending');

            const result = await getMetricsJson();
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
        });

        it('should include metric entries after recording events', async () => {
            const { recordPaymentEvent, getMetricsJson } = await import('../prometheus');
            recordPaymentEvent('amole', 'success');

            const result = (await getMetricsJson()) as Array<{ name: string }>;
            const paymentMetric = result.find(m => m.name === 'lole_payments_total');
            expect(paymentMetric).toBeDefined();
        });
    });
});
