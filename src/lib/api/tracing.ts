/**
 * Request Tracing Utilities
 *
 * MED-026: Implements request ID propagation for distributed tracing.
 * Provides middleware and utilities for tracking requests across services.
 *
 * @module lib/api/tracing
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { recordHttpRequest } from '@/lib/monitoring/prometheus';

/**
 * Header names for tracing
 */
export const TRACING_HEADERS = {
    /** Request ID header */
    requestId: 'x-request-id',
    /** Trace ID header (for distributed tracing) */
    traceId: 'x-trace-id',
    /** Span ID header */
    spanId: 'x-span-id',
    /** Parent span ID header */
    parentSpanId: 'x-parent-span-id',
    /** Baggage header for context propagation */
    baggage: 'x-baggage',
    /** Origin service header */
    origin: 'x-origin-service',
} as const;

/**
 * Trace context interface
 */
export interface TraceContext {
    /** Unique request ID */
    requestId: string;
    /** Distributed trace ID (shared across services) */
    traceId: string;
    /** Current span ID */
    spanId: string;
    /** Parent span ID (if this is a child span) */
    parentSpanId?: string;
    /** Origin service name */
    origin?: string;
    /** Baggage items (key-value pairs for context propagation) */
    baggage?: Record<string, string>;
    /** Start time of the request */
    startTime: number;
}

/**
 * Generate a unique ID for tracing
 */
function generateTraceId(): string {
    // Generate a 32-character hex string (16 bytes)
    return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Generate a span ID
 */
function generateSpanId(): string {
    // Generate a 16-character hex string (8 bytes)
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

/**
 * Normalize path for metrics cardinality
 * Replaces dynamic segments with placeholders to reduce label explosion
 *
 * @example
 * normalizePath('/api/orders/123') // '/api/orders/:id'
 * normalizePath('/api/restaurants/abc-123/menu') // '/api/restaurants/:id/menu'
 */
function normalizePath(path: string): string {
    return (
        path
            // Replace UUIDs
            .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':uuid')
            // Replace numeric IDs
            .replace(/\/\d+(?=\/|$)/g, '/:id')
            // Replace alphanumeric IDs (but not common static paths)
            .replace(/\/[a-zA-Z0-9_-]{20,}(?=\/|$)/g, '/:id')
            // Replace remaining dynamic segments that look like IDs
            .replace(/\/[a-f0-9]{16,}(?=\/|$)/gi, '/:id')
    );
}

/**
 * Parse baggage header
 */
function parseBaggage(header: string | null): Record<string, string> {
    if (!header) return {};

    const baggage: Record<string, string> = {};
    const items = header.split(',');

    for (const item of items) {
        const [key, value] = item.trim().split('=');
        if (key && value) {
            baggage[decodeURIComponent(key)] = decodeURIComponent(value);
        }
    }

    return baggage;
}

/**
 * Format baggage for header
 */
export function formatBaggage(baggage: Record<string, string>): string {
    return Object.entries(baggage)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join(',');
}

/**
 * Extract trace context from request headers
 */
export function extractTraceContext(request: NextRequest): TraceContext {
    const requestId = request.headers.get(TRACING_HEADERS.requestId) || crypto.randomUUID();
    const traceId = request.headers.get(TRACING_HEADERS.traceId) || generateTraceId();
    const spanId = generateSpanId();
    const parentSpanId = request.headers.get(TRACING_HEADERS.spanId) || undefined;
    const origin = request.headers.get(TRACING_HEADERS.origin) || undefined;
    const baggage = parseBaggage(request.headers.get(TRACING_HEADERS.baggage));

    return {
        requestId,
        traceId,
        spanId,
        parentSpanId,
        origin,
        baggage: Object.keys(baggage).length > 0 ? baggage : undefined,
        startTime: Date.now(),
    };
}

/**
 * Create trace headers for outgoing requests
 */
export function createTraceHeaders(context: TraceContext): Record<string, string> {
    const headers: Record<string, string> = {
        [TRACING_HEADERS.requestId]: context.requestId,
        [TRACING_HEADERS.traceId]: context.traceId,
        [TRACING_HEADERS.spanId]: generateSpanId(), // New span ID for outgoing request
        [TRACING_HEADERS.parentSpanId]: context.spanId, // Current span becomes parent
    };

    if (context.origin) {
        headers[TRACING_HEADERS.origin] = context.origin;
    }

    if (context.baggage) {
        headers[TRACING_HEADERS.baggage] = formatBaggage(context.baggage);
    }

    return headers;
}

/**
 * Add trace headers to a response
 */
export function addTraceHeaders(response: NextResponse, context: TraceContext): void {
    response.headers.set(TRACING_HEADERS.requestId, context.requestId);
    response.headers.set(TRACING_HEADERS.traceId, context.traceId);
    response.headers.set(TRACING_HEADERS.spanId, context.spanId);
}

/**
 * Trace context storage - Edge Runtime compatible
 * Note: AsyncLocalStorage is not available in Edge Runtime,
 * so we use a simple module-level variable for middleware context.
 */
let currentTraceContext: TraceContext | undefined;

/**
 * Get the current trace context
 */
export function getCurrentTraceContext(): TraceContext | undefined {
    return currentTraceContext;
}

/**
 * Run a function within a trace context
 */
export function withTraceContext<T>(context: TraceContext, fn: () => T): T {
    const previousContext = currentTraceContext;
    currentTraceContext = context;
    try {
        return fn();
    } finally {
        currentTraceContext = previousContext;
    }
}

/**
 * Create a child span for a sub-operation
 */
export function createChildSpan(_operationName: string): TraceContext {
    const parent = getCurrentTraceContext();

    if (parent) {
        return {
            requestId: parent.requestId,
            traceId: parent.traceId,
            spanId: generateSpanId(),
            parentSpanId: parent.spanId,
            origin: parent.origin,
            baggage: parent.baggage,
            startTime: Date.now(),
        };
    }

    // No parent context, create a new one
    return {
        requestId: crypto.randomUUID(),
        traceId: generateTraceId(),
        spanId: generateSpanId(),
        startTime: Date.now(),
    };
}

/**
 * Log with trace context
 */
export function logWithContext(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>
): void {
    const traceContext = getCurrentTraceContext();
    const logContext = {
        ...context,
        ...(traceContext && {
            requestId: traceContext.requestId,
            traceId: traceContext.traceId,
            spanId: traceContext.spanId,
        }),
    };

    switch (level) {
        case 'debug':
            logger.debug(message, logContext);
            break;
        case 'info':
            logger.info(message, logContext);
            break;
        case 'warn':
            logger.warn(message, logContext);
            break;
        case 'error':
            logger.error(message, undefined, logContext);
            break;
    }
}

/**
 * Trace middleware for Next.js
 * Extracts or creates trace context and adds to response headers
 */
export function tracingMiddleware(request: NextRequest): {
    context: TraceContext;
    addHeaders: (response: NextResponse) => void;
} {
    const context = extractTraceContext(request);

    // Log incoming request with trace context
    logger.info(`Incoming request: ${request.method} ${request.nextUrl.pathname}`, {
        requestId: context.requestId,
        traceId: context.traceId,
        method: request.method,
        path: request.nextUrl.pathname,
        origin: context.origin,
    });

    return {
        context,
        addHeaders: (response: NextResponse) => {
            addTraceHeaders(response, context);

            // Add timing header
            const duration = Date.now() - context.startTime;
            response.headers.set('x-response-time', `${duration}ms`);

            // Record Prometheus metrics for request duration and count
            try {
                const method = request.method;
                const path = request.nextUrl.pathname;
                const statusCode = response.status;

                // Normalize path for metrics (replace dynamic segments with placeholders)
                const normalizedPath = normalizePath(path);

                recordHttpRequest(method, normalizedPath, statusCode, duration);
            } catch {
                // Silently ignore Prometheus recording errors to not affect response
            }
        },
    };
}

/**
 * Span timing utility for performance tracking
 */
export class SpanTimer {
    private startTime: number;
    private context: TraceContext;
    private operationName: string;

    constructor(operationName: string, context?: TraceContext) {
        this.operationName = operationName;
        this.context = context ||
            getCurrentTraceContext() || {
                requestId: crypto.randomUUID(),
                traceId: generateTraceId(),
                spanId: generateSpanId(),
                startTime: Date.now(),
            };
        this.startTime = Date.now();
    }

    /**
     * End the span and log the duration
     */
    end(metadata?: Record<string, unknown>): number {
        const duration = Date.now() - this.startTime;

        logger.debug(`Span completed: ${this.operationName}`, {
            requestId: this.context.requestId,
            traceId: this.context.traceId,
            spanId: this.context.spanId,
            operation: this.operationName,
            durationMs: duration,
            ...metadata,
        });

        return duration;
    }

    /**
     * Get current duration without ending
     */
    getDuration(): number {
        return Date.now() - this.startTime;
    }

    /**
     * Get the trace context
     */
    getContext(): TraceContext {
        return this.context;
    }
}

/**
 * Decorator for tracing async functions
 */
export function traced<T extends (...args: unknown[]) => Promise<unknown>>(
    operationName: string
): (
    target: unknown,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
) => TypedPropertyDescriptor<T> {
    return function (
        target: unknown,
        propertyKey: string,
        descriptor: TypedPropertyDescriptor<T>
    ): TypedPropertyDescriptor<T> {
        const originalMethod = descriptor.value;

        if (!originalMethod) {
            return descriptor;
        }

        descriptor.value = async function (this: unknown, ...args: Parameters<T>) {
            const timer = new SpanTimer(operationName);
            try {
                const result = await originalMethod.apply(this, args);
                timer.end({ status: 'success' });
                return result;
            } catch (error) {
                timer.end({
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
                throw error;
            }
        } as T;

        return descriptor;
    };
}

/**
 * Fetch wrapper with automatic trace propagation
 */
export async function tracedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const context = getCurrentTraceContext();
    const traceHeaders = context ? createTraceHeaders(context) : {};

    const timer = new SpanTimer(`fetch:${new URL(url).pathname}`);

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                ...traceHeaders,
            },
        });

        timer.end({
            status: response.ok ? 'success' : 'error',
            statusCode: response.status,
        });

        return response;
    } catch (error) {
        timer.end({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
