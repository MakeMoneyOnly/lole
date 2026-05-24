/**
 * API Error Handler Wrapper
 *
 * HIGH-023: Provides a wrapper for API routes to ensure all errors
 * are properly sanitized before being returned to clients
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, ApiErrorResponse } from './response';
import { randomUUID } from 'crypto';

/**
 * Request context for error handling
 */
export interface RequestContext {
    requestId: string;
    userId?: string;
    restaurantId?: string;
    operation: string;
}

/**
 * Extract request context from headers and auth
 */
export function extractRequestContext(request: NextRequest, operation: string): RequestContext {
    return {
        requestId: request.headers.get('x-request-id') ?? randomUUID(),
        userId: request.headers.get('x-user-id') ?? undefined,
        restaurantId: request.headers.get('x-restaurant-id') ?? undefined,
        operation,
    };
}

/**
 * Wrap an API route handler with error handling
 * Ensures all errors are sanitized before being returned to clients
 *
 * @param handler - The API route handler
 * @param operation - Name of the operation for logging
 * @returns Wrapped handler with error handling
 */
export function withErrorHandling<T>(
    handler: (request: NextRequest, context: RequestContext) => Promise<NextResponse<T>>,
    operation: string
): (request: NextRequest) => Promise<NextResponse<T | ApiErrorResponse>> {
    return async (request: NextRequest) => {
        const context = extractRequestContext(request, operation);

        try {
            return await handler(request, context);
        } catch (error) {
            // Log and return sanitized error
            return handleApiError(error, {
                operation: context.operation,
                userId: context.userId,
                restaurantId: context.restaurantId,
            });
        }
    };
}

/**
 * Higher-order function to wrap API route methods
 * Use this to wrap individual HTTP method handlers
 *
 * Example:
 * ```typescript
 * export const GET = withApiErrorHandler(async (request, context) => {
 *   // Your handler code
 *   return apiSuccess(data);
 * }, 'GET /api/orders');
 * ```
 */
export function withApiErrorHandler<T>(
    handler: (request: NextRequest, context: RequestContext) => Promise<NextResponse<T>>,
    operation: string
): (request: NextRequest) => Promise<NextResponse<T | ApiErrorResponse>> {
    return withErrorHandling(handler, operation);
}

/**
 * Create a standardized error response for validation errors
 */
export function validationError(
    message: string,
    details?: unknown,
    context?: RequestContext
): NextResponse<ApiErrorResponse> {
    return handleApiError(
        { name: 'ValidationError', message },
        {
            operation: context?.operation ?? 'validation',
            userId: context?.userId,
            restaurantId: context?.restaurantId,
        }
    );
}

/**
 * Create a standardized error response for authentication errors
 */
export function authenticationError(
    message: string = 'Authentication required',
    context?: RequestContext
): NextResponse<ApiErrorResponse> {
    return handleApiError(
        { name: 'AuthenticationError', message },
        {
            operation: context?.operation ?? 'authentication',
            userId: context?.userId,
            restaurantId: context?.restaurantId,
        }
    );
}

/**
 * Create a standardized error response for authorization errors
 */
export function authorizationError(
    message: string = 'Access denied',
    context?: RequestContext
): NextResponse<ApiErrorResponse> {
    return handleApiError(
        { name: 'AuthorizationError', message },
        {
            operation: context?.operation ?? 'authorization',
            userId: context?.userId,
            restaurantId: context?.restaurantId,
        }
    );
}

/**
 * Create a standardized error response for not found errors
 */
export function notFoundError(
    resource: string,
    context?: RequestContext
): NextResponse<ApiErrorResponse> {
    return handleApiError(
        { name: 'NotFoundError', message: `${resource} not found` },
        {
            operation: context?.operation ?? 'not_found',
            userId: context?.userId,
            restaurantId: context?.restaurantId,
        }
    );
}

/**
 * Create a standardized error response for rate limit errors
 */
export function rateLimitError(
    retryAfter: number = 60,
    context?: RequestContext
): NextResponse<ApiErrorResponse> {
    const response = handleApiError(
        { name: 'RateLimitError', message: 'Too many requests' },
        {
            operation: context?.operation ?? 'rate_limit',
            userId: context?.userId,
            restaurantId: context?.restaurantId,
        }
    );

    // Add Retry-After header
    response.headers.set('Retry-After', String(retryAfter));

    return response;
}
