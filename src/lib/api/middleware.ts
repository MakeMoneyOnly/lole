/**
 * API Middleware - Unified Request Processing
 *
 * API-REF-01/02/03/04: Consolidated middleware for:
 * - Standardized error handling (apiSuccess, apiError, handleApiError)
 * - Input validation using Zod schemas
 * - Rate limiting with Redis-backed store
 */

import { type NextRequest, NextResponse } from 'next/server';
import { ZodSchema } from 'zod';
import { apiError, handleApiError, type ApiErrorResponse } from './response';
import { checkRateLimit, type RateLimitConfig } from '@/lib/rate-limit';

// =============================================================================
// Validation Middleware
// =============================================================================

/**
 * Result of parsing request body
 */
type ParseResult<T> =
    | { success: true; data: T }
    | { success: false; response: ReturnType<typeof apiError> };

/**
 * Parse and validate JSON body with Zod schema
 */
export async function parseJsonBody<T>(
    request: NextRequest,
    schema: ZodSchema<T>
): Promise<ParseResult<T>> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return {
            success: false,
            response: apiError('Invalid JSON body', 400, 'INVALID_JSON'),
        };
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return {
            success: false,
            response: apiError(
                'Invalid request payload',
                400,
                'VALIDATION_ERROR',
                parsed.error.flatten()
            ),
        };
    }

    return { success: true, data: parsed.data };
}

/**
 * Parse and validate query parameters with Zod schema
 */
export function parseQueryParams<T>(request: NextRequest, schema: ZodSchema<T>): ParseResult<T> {
    const query: Record<string, unknown> = {};

    // Convert URLSearchParams to plain object
    request.nextUrl.searchParams.forEach((value, key) => {
        query[key] = value;
    });

    const parsed = schema.safeParse(query);
    if (!parsed.success) {
        return {
            success: false,
            response: apiError(
                'Invalid query parameters',
                400,
                'INVALID_QUERY',
                parsed.error.flatten()
            ),
        };
    }

    return { success: true, data: parsed.data };
}

/**
 * Parse and validate path parameters with Zod schema
 */
export function parsePathParams<T>(
    params: Record<string, string | string[]>,
    schema: ZodSchema<T>
): ParseResult<T> {
    const parsed = schema.safeParse(params);
    if (!parsed.success) {
        return {
            success: false,
            response: apiError(
                'Invalid path parameters',
                400,
                'INVALID_PARAMS',
                parsed.error.flatten()
            ),
        };
    }

    return { success: true, data: parsed.data };
}

// =============================================================================
// Rate Limiting Middleware
// =============================================================================

/**
 * Check rate limit and return error response if exceeded
 */
export async function checkRateLimitMiddleware(
    request: NextRequest,
    config: RateLimitConfig,
    _keyPrefix?: string
): Promise<NextResponse | null> {
    const result = await checkRateLimit(request, config);

    if (!result.success) {
        const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        return apiError('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED', {
            remaining: result.remaining,
            reset: result.reset,
            clientIp,
        });
    }

    // Add rate limit headers to response (to be merged by handler)
    return null;
}

// =============================================================================
// Combined Middleware Factory
// =============================================================================

/**
 * Handler type for API routes
 */
type ApiHandler<T = unknown> = (
    request: NextRequest,
    context: { body?: T; query?: unknown; params?: string }
) => Promise<NextResponse>;

/**
 * Options for withValidation middleware
 */
interface ValidationOptions<TBody = unknown, TQuery = unknown, TParams = unknown> {
    bodySchema?: ZodSchema<TBody>;
    querySchema?: ZodSchema<TQuery>;
    paramsSchema?: ZodSchema<TParams>;
    rateLimit?: RateLimitConfig;
}

/**
 * Wrap API handler with standardized patterns
 * - Zod validation for body/query/params
 * - Rate limiting
 * - Error handling with handleApiError
 */
export function withValidation<TBody = unknown, TQuery = unknown, TParams = unknown>(
    handler: ApiHandler<TBody>,
    options: ValidationOptions<TBody, TQuery, TParams> = {}
): (request: NextRequest) => Promise<NextResponse> {
    return async (request: NextRequest) => {
        try {
            // Apply rate limiting first
            if (options.rateLimit) {
                const rateLimitResponse = await checkRateLimitMiddleware(
                    request,
                    options.rateLimit
                );
                if (rateLimitResponse) {
                    return rateLimitResponse;
                }
            }

            // Parse and validate body
            let body: TBody | undefined;
            if (options.bodySchema) {
                const bodyResult = await parseJsonBody(request, options.bodySchema);
                if (!bodyResult.success) {
                    return bodyResult.response;
                }
                body = bodyResult.data;
            }

            // Parse and validate query
            let query: TQuery | undefined;
            if (options.querySchema) {
                const queryResult = parseQueryParams(request, options.querySchema);
                if (!queryResult.success) {
                    return queryResult.response;
                }
                query = queryResult.data;
            }

            // Parse path parameters (if handler follows Next.js App Router pattern)
            const params = (
                request as NextRequest & { nextUrl?: { pathname: string } }
            )?.nextUrl?.pathname
                .split('/')
                .pop();

            return await handler(request, { body, query, params });
        } catch (error) {
            return handleApiError(error, { operation: request.nextUrl.pathname });
        }
    };
}

// =============================================================================
// Legacy Error Handling (for routes not yet converted)
// =============================================================================

/**
 * Wrap handler with standardized error handling
 * Use this for existing routes during migration
 */
export function withErrorHandler<T>(
    handler: (request: NextRequest) => Promise<NextResponse<T>>
): (request: NextRequest) => Promise<NextResponse<T | ApiErrorResponse>> {
    return async (request: NextRequest) => {
        try {
            return await handler(request);
        } catch (error) {
            return handleApiError(error, {
                operation: request.nextUrl?.pathname ?? 'unknown',
            });
        }
    };
}

// =============================================================================
// Response Helpers (re-exported for convenience)
// =============================================================================

export { apiSuccess, apiError, handleApiError } from './response';
export {
    AppError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    InternalError,
    ERROR_STATUS_MAP,
    type ErrorCode,
} from './errors';
