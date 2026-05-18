import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const {
    mockSpan,
    mockStartSpan,
    mockAddBreadcrumb,
    mockRecordOrderEvent,
    mockRecordPaymentEvent,
    sentryMetricsApiRef,
} = vi.hoisted(() => {
    const span = {
        setAttribute: vi.fn(),
        setStatus: vi.fn(),
    };
    const startSpan = vi.fn((_options: unknown, callback: (s: typeof span) => unknown) =>
        callback(span)
    );
    const addBreadcrumb = vi.fn();
    const recordOrderEvent = vi.fn();
    const recordPaymentEvent = vi.fn();
    const sentryMetricsApi: { current: Record<string, Mock> | null } = { current: null };
    return {
        mockSpan: span,
        mockStartSpan: startSpan,
        mockAddBreadcrumb: addBreadcrumb,
        mockRecordOrderEvent: recordOrderEvent,
        mockRecordPaymentEvent: recordPaymentEvent,
        sentryMetricsApiRef: sentryMetricsApi,
    };
});

vi.mock('@sentry/nextjs', () => ({
    startSpan: mockStartSpan,
    addBreadcrumb: mockAddBreadcrumb,
    get metrics() {
        return sentryMetricsApiRef.current;
    },
}));

vi.mock('../prometheus', () => ({
    recordOrderEvent: mockRecordOrderEvent,
    recordPaymentEvent: mockRecordPaymentEvent,
}));
function createMockSupabase(opts?: { error?: Error }): any {
    return {
        from: vi.fn().mockReturnValue({
            insert: vi
                .fn()
                .mockResolvedValue(
                    opts?.error ? { data: null, error: opts.error } : { data: null, error: null }
                ),
        }),
    };
}
function getInsertArg(supabase: any, callIndex = 0): { metadata: Record<string, unknown> } {
    const insertMock = supabase.from('audit_logs').insert;
    return insertMock.mock.calls[callIndex][0] as { metadata: Record<string, unknown> };
}

import {
    tracePerformance,
    tracePerformanceSync,
    trackApiMetric,
    trackOrderMetric,
    trackPaymentMetric,
    trackSessionMetric,
    trackDbMetric,
    incrementCounter,
    setGauge,
    recordDistribution,
} from '../metrics';

describe('metrics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sentryMetricsApiRef.current = null;
    });

    describe('tracePerformance', () => {
        it('should call operation and return result on success', async () => {
            const result = await tracePerformance('db:menu:fetch', async () => 'ok');
            expect(result).toBe('ok');
            expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 1 });
        });

        it('should set span status to error when operation throws', async () => {
            await expect(
                tracePerformance('db:menu:fetch', async () => {
                    throw new Error('fail');
                })
            ).rejects.toThrow('fail');
            expect(mockSpan.setStatus).toHaveBeenCalledWith({
                code: 2,
                message: 'Error: fail',
            });
        });

        it('should set tags as span attributes when options.tags provided', async () => {
            await tracePerformance('db:menu:fetch', async () => 'ok', {
                tags: { env: 'test', region: 'eu' },
            });
            expect(mockSpan.setAttribute).toHaveBeenCalledWith('env', 'test');
            expect(mockSpan.setAttribute).toHaveBeenCalledWith('region', 'eu');
        });

        it('should not set tag attributes when options.tags is undefined', async () => {
            await tracePerformance('db:menu:fetch', async () => 'ok', { description: 'desc' });
            const tagCalls = mockSpan.setAttribute.mock.calls.filter(
                (c: unknown[]) => c[0] !== 'description'
            );
            expect(tagCalls).toHaveLength(0);
        });

        it('should set description as span attribute when options.description provided', async () => {
            await tracePerformance('db:menu:fetch', async () => 'ok', {
                description: 'fetch menu items',
            });
            expect(mockSpan.setAttribute).toHaveBeenCalledWith('description', 'fetch menu items');
        });

        it('should not set description attribute when options not provided', async () => {
            await tracePerformance('db:menu:fetch', async () => 'ok');
            const descCalls = mockSpan.setAttribute.mock.calls.filter(
                (c: unknown[]) => c[0] === 'description'
            );
            expect(descCalls).toHaveLength(0);
        });

        it('should extract op from name before colon', async () => {
            await tracePerformance('db:menu:fetch', async () => 'ok');
            expect(mockStartSpan).toHaveBeenCalledWith(
                expect.objectContaining({ op: 'db' }),
                expect.any(Function)
            );
        });

        it('should fallback op to "operation" when name starts with colon', async () => {
            await tracePerformance(':menu:fetch', async () => 'ok');
            expect(mockStartSpan).toHaveBeenCalledWith(
                expect.objectContaining({ op: 'operation' }),
                expect.any(Function)
            );
        });

        it('should use entire name as op when no colon present', async () => {
            await tracePerformance('noColonName', async () => 'ok');
            expect(mockStartSpan).toHaveBeenCalledWith(
                expect.objectContaining({ op: 'noColonName' }),
                expect.any(Function)
            );
        });
    });

    describe('tracePerformanceSync', () => {
        it('should call operation and return result on success', () => {
            const result = tracePerformanceSync('db:menu:fetch', () => 'ok');
            expect(result).toBe('ok');
            expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 1 });
        });

        it('should set span status to error when operation throws', () => {
            expect(() =>
                tracePerformanceSync('db:menu:fetch', () => {
                    throw new Error('sync fail');
                })
            ).toThrow('sync fail');
            expect(mockSpan.setStatus).toHaveBeenCalledWith({
                code: 2,
                message: 'Error: sync fail',
            });
        });

        it('should set tags as span attributes when options.tags provided', () => {
            tracePerformanceSync('db:menu:fetch', () => 'ok', {
                tags: { key: 'val' },
            });
            expect(mockSpan.setAttribute).toHaveBeenCalledWith('key', 'val');
        });

        it('should not set tag attributes when options.tags is undefined', () => {
            tracePerformanceSync('db:menu:fetch', () => 'ok', { description: 'desc' });
            const tagCalls = mockSpan.setAttribute.mock.calls.filter(
                (c: unknown[]) => c[0] !== 'description'
            );
            expect(tagCalls).toHaveLength(0);
        });

        it('should set description as span attribute when options.description provided', () => {
            tracePerformanceSync('db:menu:fetch', () => 'ok', {
                description: 'sync desc',
            });
            expect(mockSpan.setAttribute).toHaveBeenCalledWith('description', 'sync desc');
        });

        it('should not set description attribute when options not provided', () => {
            tracePerformanceSync('db:menu:fetch', () => 'ok');
            const descCalls = mockSpan.setAttribute.mock.calls.filter(
                (c: unknown[]) => c[0] === 'description'
            );
            expect(descCalls).toHaveLength(0);
        });
    });

    describe('trackApiMetric', () => {
        it('should track successful API call (statusCode < 400)', async () => {
            const supabase = createMockSupabase();
            const result = await trackApiMetric(supabase, {
                endpoint: '/api/orders',
                method: 'GET',
                statusCode: 200,
                durationMs: 150,
            });
            expect(result.error).toBeNull();
            expect(mockSpan.setAttribute).toHaveBeenCalledWith('is_error', 'false');
        });

        it('should track error API call (statusCode >= 400)', async () => {
            const supabase = createMockSupabase();
            const result = await trackApiMetric(supabase, {
                endpoint: '/api/orders',
                method: 'POST',
                statusCode: 500,
                durationMs: 300,
            });
            expect(result.error).toBeNull();
            expect(mockSpan.setAttribute).toHaveBeenCalledWith('is_error', 'true');
        });

        it('should set restaurant_id attribute when restaurantId provided', async () => {
            const supabase = createMockSupabase();
            await trackApiMetric(supabase, {
                endpoint: '/api/orders',
                method: 'GET',
                statusCode: 200,
                durationMs: 100,
                restaurantId: 'rest-1',
            });
            expect(mockSpan.setAttribute).toHaveBeenCalledWith('restaurant_id', 'rest-1');
        });

        it('should not set restaurant_id attribute when restaurantId not provided', async () => {
            const supabase = createMockSupabase();
            await trackApiMetric(supabase, {
                endpoint: '/api/orders',
                method: 'GET',
                statusCode: 200,
                durationMs: 100,
            });
            const ridCalls = mockSpan.setAttribute.mock.calls.filter(
                (c: unknown[]) => c[0] === 'restaurant_id'
            );
            expect(ridCalls).toHaveLength(0);
        });

        it('should include error in metadata when error field provided', async () => {
            const supabase = createMockSupabase();
            await trackApiMetric(supabase, {
                endpoint: '/api/orders',
                method: 'GET',
                statusCode: 500,
                durationMs: 100,
                error: 'timeout',
            });
            const insertArg = getInsertArg(supabase, 0);
            expect(insertArg.metadata.error).toBe('timeout');
        });

        it('should not include error in metadata when error field not provided', async () => {
            const supabase = createMockSupabase();
            await trackApiMetric(supabase, {
                endpoint: '/api/orders',
                method: 'GET',
                statusCode: 200,
                durationMs: 100,
            });
            const insertArg = getInsertArg(supabase, 0);
            expect(insertArg.metadata.error).toBeUndefined();
        });

        it('should return error when supabase insert returns error', async () => {
            const insertError = new Error('db error');
            const supabase = createMockSupabase({ error: insertError });
            const result = await trackApiMetric(supabase, {
                endpoint: '/api/orders',
                method: 'GET',
                statusCode: 200,
                durationMs: 100,
            });
            expect(result.error).toBe(insertError);
            expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 2 });
        });

        it('should return error when supabase insert throws exception', async () => {
            const supabase = {
                from: vi.fn().mockReturnValue({
                    insert: vi.fn().mockRejectedValue(new Error('network failure')),
                }),
            } as unknown as SupabaseClient<Database>;
            const result = await trackApiMetric(supabase, {
                endpoint: '/api/orders',
                method: 'GET',
                statusCode: 200,
                durationMs: 100,
            });
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error?.message).toBe('network failure');
        });
    });

    describe('trackOrderMetric', () => {
        it('should track order with all optional fields', async () => {
            const supabase = createMockSupabase();
            const result = await trackOrderMetric(supabase, {
                restaurantId: 'rest-1',
                orderId: 'order-1',
                event: 'created',
                items: 5,
                total: 120.5,
                durationMs: 300,
            });
            expect(result.error).toBeNull();
            const insertArg = getInsertArg(supabase, 0);
            expect(insertArg.metadata.items).toBe(5);
            expect(insertArg.metadata.total).toBe(120.5);
            expect(insertArg.metadata.duration_ms).toBe(300);
        });

        it('should track order without optional fields', async () => {
            const supabase = createMockSupabase();
            const result = await trackOrderMetric(supabase, {
                restaurantId: 'rest-1',
                orderId: 'order-2',
                event: 'completed',
            });
            expect(result.error).toBeNull();
            const insertArg = getInsertArg(supabase, 0);
            expect(insertArg.metadata.items).toBeUndefined();
            expect(insertArg.metadata.total).toBeUndefined();
            expect(insertArg.metadata.duration_ms).toBeUndefined();
        });

        it('should call recordOrderEvent for Prometheus', async () => {
            const supabase = createMockSupabase();
            await trackOrderMetric(supabase, {
                restaurantId: 'rest-1',
                orderId: 'order-1',
                event: 'created',
            });
            expect(mockRecordOrderEvent).toHaveBeenCalledWith('rest-1', 'created');
        });

        it('should silently ignore Prometheus recording errors', async () => {
            const supabase = createMockSupabase();
            mockRecordOrderEvent.mockImplementation(() => {
                throw new Error('prometheus down');
            });
            const result = await trackOrderMetric(supabase, {
                restaurantId: 'rest-1',
                orderId: 'order-1',
                event: 'cancelled',
            });
            expect(result.error).toBeNull();
        });

        it('should return error when supabase insert returns error', async () => {
            const insertError = new Error('insert failed');
            const supabase = createMockSupabase({ error: insertError });
            const result = await trackOrderMetric(supabase, {
                restaurantId: 'rest-1',
                orderId: 'order-1',
                event: 'modified',
            });
            expect(result.error).toBe(insertError);
        });

        it('should return error when supabase insert throws exception', async () => {
            const supabase = {
                from: vi.fn().mockReturnValue({
                    insert: vi.fn().mockRejectedValue(new Error('conn refused')),
                }),
            } as unknown as SupabaseClient<Database>;
            const result = await trackOrderMetric(supabase, {
                restaurantId: 'rest-1',
                orderId: 'order-1',
                event: 'created',
            });
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error?.message).toBe('conn refused');
        });
    });

    describe('trackPaymentMetric', () => {
        it('should track payment with all optional fields', async () => {
            const supabase = createMockSupabase();
            const result = await trackPaymentMetric(supabase, {
                restaurantId: 'rest-1',
                paymentId: 'pay-1',
                provider: 'chapa',
                event: 'completed',
                amount: 250.0,
                durationMs: 500,
                error: 'card declined',
            });
            expect(result.error).toBeNull();
            const insertArg = getInsertArg(supabase, 0);
            expect(insertArg.metadata.amount).toBe(250.0);
            expect(insertArg.metadata.duration_ms).toBe(500);
            expect(insertArg.metadata.error).toBe('card declined');
        });

        it('should track payment without optional fields', async () => {
            const supabase = createMockSupabase();
            const result = await trackPaymentMetric(supabase, {
                restaurantId: 'rest-1',
                paymentId: 'pay-2',
                provider: 'cash',
                event: 'initiated',
            });
            expect(result.error).toBeNull();
            const insertArg = getInsertArg(supabase, 0);
            expect(insertArg.metadata.amount).toBeUndefined();
            expect(insertArg.metadata.duration_ms).toBeUndefined();
            expect(insertArg.metadata.error).toBeUndefined();
        });

        it('should call recordPaymentEvent for Prometheus', async () => {
            const supabase = createMockSupabase();
            await trackPaymentMetric(supabase, {
                restaurantId: 'rest-1',
                paymentId: 'pay-1',
                provider: 'chapa',
                event: 'failed',
            });
            expect(mockRecordPaymentEvent).toHaveBeenCalledWith('chapa', 'failed');
        });

        it('should silently ignore Prometheus recording errors', async () => {
            const supabase = createMockSupabase();
            mockRecordPaymentEvent.mockImplementation(() => {
                throw new Error('prometheus unavailable');
            });
            const result = await trackPaymentMetric(supabase, {
                restaurantId: 'rest-1',
                paymentId: 'pay-1',
                provider: 'cash',
                event: 'refunded',
            });
            expect(result.error).toBeNull();
        });

        it('should return error when supabase insert returns error', async () => {
            const insertError = new Error('insert fail');
            const supabase = createMockSupabase({ error: insertError });
            const result = await trackPaymentMetric(supabase, {
                restaurantId: 'rest-1',
                paymentId: 'pay-1',
                provider: 'chapa',
                event: 'completed',
            });
            expect(result.error).toBe(insertError);
        });

        it('should return error when supabase insert throws exception', async () => {
            const supabase = {
                from: vi.fn().mockReturnValue({
                    insert: vi.fn().mockRejectedValue(new Error('timeout')),
                }),
            } as unknown as SupabaseClient<Database>;
            const result = await trackPaymentMetric(supabase, {
                restaurantId: 'rest-1',
                paymentId: 'pay-1',
                provider: 'cash',
                event: 'initiated',
            });
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error?.message).toBe('timeout');
        });
    });

    describe('trackSessionMetric', () => {
        it('should track session with all optional fields', async () => {
            const supabase = createMockSupabase();
            const result = await trackSessionMetric(supabase, {
                restaurantId: 'rest-1',
                sessionId: 'sess-1',
                event: 'opened',
                tableNumber: 5,
                guestCount: 3,
                durationMs: 1200,
            });
            expect(result.error).toBeNull();
            const insertArg = getInsertArg(supabase, 0);
            expect(insertArg.metadata.table_number).toBe(5);
            expect(insertArg.metadata.guest_count).toBe(3);
            expect(insertArg.metadata.duration_ms).toBe(1200);
        });

        it('should track session without optional fields', async () => {
            const supabase = createMockSupabase();
            const result = await trackSessionMetric(supabase, {
                restaurantId: 'rest-1',
                sessionId: 'sess-2',
                event: 'active',
            });
            expect(result.error).toBeNull();
            const insertArg = getInsertArg(supabase, 0);
            expect(insertArg.metadata.table_number).toBeUndefined();
            expect(insertArg.metadata.guest_count).toBeUndefined();
            expect(insertArg.metadata.duration_ms).toBeUndefined();
        });

        it('should return error when supabase insert returns error', async () => {
            const insertError = new Error('db fail');
            const supabase = createMockSupabase({ error: insertError });
            const result = await trackSessionMetric(supabase, {
                restaurantId: 'rest-1',
                sessionId: 'sess-1',
                event: 'closed',
            });
            expect(result.error).toBe(insertError);
        });

        it('should return error when supabase insert throws exception', async () => {
            const supabase = {
                from: vi.fn().mockReturnValue({
                    insert: vi.fn().mockRejectedValue(new Error('connection lost')),
                }),
            } as unknown as SupabaseClient<Database>;
            const result = await trackSessionMetric(supabase, {
                restaurantId: 'rest-1',
                sessionId: 'sess-1',
                event: 'timed_out',
            });
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error?.message).toBe('connection lost');
        });
    });

    describe('trackDbMetric', () => {
        it('should track successful db metric without optional fields', () => {
            const result = trackDbMetric({
                query: 'SELECT * FROM orders',
                durationMs: 50,
            });
            expect(result.error).toBeNull();
            expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 1 });
        });

        it('should track db metric with restaurantId', () => {
            trackDbMetric({
                query: 'SELECT * FROM orders',
                durationMs: 50,
                restaurantId: 'rest-1',
            });
            expect(mockSpan.setAttribute).toHaveBeenCalledWith('restaurant_id', 'rest-1');
        });

        it('should track db metric without restaurantId', () => {
            trackDbMetric({
                query: 'SELECT * FROM orders',
                durationMs: 50,
            });
            const ridCalls = mockSpan.setAttribute.mock.calls.filter(
                (c: unknown[]) => c[0] === 'restaurant_id'
            );
            expect(ridCalls).toHaveLength(0);
        });

        it('should track db metric with rows', () => {
            trackDbMetric({
                query: 'SELECT * FROM orders',
                durationMs: 50,
                rows: 42,
            });
            expect(mockSpan.setAttribute).toHaveBeenCalledWith('rows', 42);
        });

        it('should track db metric without rows', () => {
            trackDbMetric({
                query: 'SELECT * FROM orders',
                durationMs: 50,
            });
            const rowCalls = mockSpan.setAttribute.mock.calls.filter(
                (c: unknown[]) => c[0] === 'rows'
            );
            expect(rowCalls).toHaveLength(0);
        });

        it('should set error status and return Error when error field provided', () => {
            const result = trackDbMetric({
                query: 'SELECT * FROM orders',
                durationMs: 50,
                error: 'relation not found',
            });
            expect(result.error).toBeInstanceOf(Error);
            expect(result.error?.message).toBe('relation not found');
            expect(mockSpan.setStatus).toHaveBeenCalledWith({
                code: 2,
                message: 'relation not found',
            });
        });

        it('should set ok status and return null error when no error field', () => {
            const result = trackDbMetric({
                query: 'SELECT * FROM orders',
                durationMs: 50,
            });
            expect(result.error).toBeNull();
            expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 1 });
        });

        it('should extract query type from query string', () => {
            trackDbMetric({
                query: 'INSERT INTO orders VALUES (...)',
                durationMs: 50,
            });
            expect(mockSpan.setAttribute).toHaveBeenCalledWith('query_type', 'insert');
        });
    });

    describe('incrementCounter', () => {
        it('should call Sentry metrics.increment when API is available', () => {
            const mockIncrement = vi.fn();
            sentryMetricsApiRef.current = { increment: mockIncrement };
            incrementCounter('orders_total', 5);
            expect(mockIncrement).toHaveBeenCalledWith('orders_total', 5);
        });

        it('should not throw when Sentry metrics API is not available', () => {
            sentryMetricsApiRef.current = null;
            expect(() => incrementCounter('orders_total', 1)).not.toThrow();
        });

        it('should add breadcrumb with counter info', () => {
            incrementCounter('orders_total', 3);
            expect(mockAddBreadcrumb).toHaveBeenCalledWith(
                expect.objectContaining({
                    category: 'metric.increment',
                    message: 'orders_total: +3',
                })
            );
        });

        it('should add breadcrumb with tags when provided', () => {
            incrementCounter('orders_total', 1, { restaurant: 'rest-1' });
            expect(mockAddBreadcrumb).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { restaurant: 'rest-1' },
                })
            );
        });

        it('should add breadcrumb without tags data when not provided', () => {
            incrementCounter('orders_total');
            expect(mockAddBreadcrumb).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: undefined,
                })
            );
        });

        it('should default value to 1', () => {
            incrementCounter('orders_total');
            expect(mockAddBreadcrumb).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'orders_total: +1',
                })
            );
        });

        it('should silently ignore when metrics.increment throws', () => {
            sentryMetricsApiRef.current = {
                increment: vi.fn(() => {
                    throw new Error('metrics unavailable');
                }),
            };
            expect(() => incrementCounter('orders_total', 1)).not.toThrow();
            expect(mockAddBreadcrumb).toHaveBeenCalled();
        });
    });

    describe('setGauge', () => {
        it('should call Sentry metrics.gauge when API is available', () => {
            const mockGauge = vi.fn();
            sentryMetricsApiRef.current = { gauge: mockGauge };
            setGauge('active_sessions', 42);
            expect(mockGauge).toHaveBeenCalledWith('active_sessions', 42);
        });

        it('should not throw when Sentry metrics API is not available', () => {
            sentryMetricsApiRef.current = null;
            expect(() => setGauge('active_sessions', 10)).not.toThrow();
        });

        it('should add breadcrumb with gauge info', () => {
            setGauge('active_sessions', 7);
            expect(mockAddBreadcrumb).toHaveBeenCalledWith(
                expect.objectContaining({
                    category: 'metric.gauge',
                    message: 'active_sessions: 7',
                })
            );
        });

        it('should add breadcrumb with tags when provided', () => {
            setGauge('active_sessions', 5, { region: 'eu' });
            expect(mockAddBreadcrumb).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { region: 'eu' },
                })
            );
        });

        it('should add breadcrumb without tags data when not provided', () => {
            setGauge('active_sessions', 3);
            expect(mockAddBreadcrumb).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: undefined,
                })
            );
        });

        it('should silently ignore when metrics.gauge throws', () => {
            sentryMetricsApiRef.current = {
                gauge: vi.fn(() => {
                    throw new Error('gauge error');
                }),
            };
            expect(() => setGauge('active_sessions', 1)).not.toThrow();
            expect(mockAddBreadcrumb).toHaveBeenCalled();
        });
    });

    describe('recordDistribution', () => {
        it('should call Sentry metrics.distribution when API is available', () => {
            const mockDistribution = vi.fn();
            sentryMetricsApiRef.current = { distribution: mockDistribution };
            recordDistribution('request_duration', 250);
            expect(mockDistribution).toHaveBeenCalledWith('request_duration', 250);
        });

        it('should not throw when Sentry metrics API is not available', () => {
            sentryMetricsApiRef.current = null;
            expect(() => recordDistribution('request_duration', 100)).not.toThrow();
        });

        it('should add breadcrumb with distribution info', () => {
            recordDistribution('request_duration', 500);
            expect(mockAddBreadcrumb).toHaveBeenCalledWith(
                expect.objectContaining({
                    category: 'metric.distribution',
                    message: 'request_duration: 500',
                })
            );
        });

        it('should add breadcrumb with tags when provided', () => {
            recordDistribution('request_duration', 100, { method: 'GET' });
            expect(mockAddBreadcrumb).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: { method: 'GET' },
                })
            );
        });

        it('should add breadcrumb without tags data when not provided', () => {
            recordDistribution('request_duration', 200);
            expect(mockAddBreadcrumb).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: undefined,
                })
            );
        });

        it('should silently ignore when metrics.distribution throws', () => {
            sentryMetricsApiRef.current = {
                distribution: vi.fn(() => {
                    throw new Error('dist error');
                }),
            };
            expect(() => recordDistribution('request_duration', 1)).not.toThrow();
            expect(mockAddBreadcrumb).toHaveBeenCalled();
        });
    });
});
