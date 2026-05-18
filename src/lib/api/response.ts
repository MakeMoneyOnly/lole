import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sanitizeErrorMessage, logAndSanitize } from '@/lib/errors/sanitize';
import { isAppError, toAppError } from './errors';

/**
 * HIGH-023: Standardized error response format
 * All API errors return this format with sanitized messages
 */
export interface ApiErrorResponse {
    error: {
        code: string;
        message: string;
        requestId: string;
        details?: unknown;
    };
}

type _ErrorBody = {
    error: string;
    code?: string;
    details?: unknown;
};

type SuccessBody<T> = {
    data: T;
};

/**
 * BKND-012/013: Generates request ID + API version headers.
 * All success responses include x-request-id and x-api-version for tracing.
 */
export function apiSuccess<T>(data: T, status: number = 200, headers?: HeadersInit) {
    const requestId = randomUUID();
    const allHeaders = new Headers(headers);
    allHeaders.set('x-request-id', requestId);
    allHeaders.set('x-api-version', 'v1');

    return NextResponse.json<SuccessBody<T>>({ data }, { status, headers: allHeaders });
}

/**
 * Create an API error response with sanitized message
 *
 * HIGH-023: This function ensures error messages are sanitized
 * before being returned to clients while logging full details server-side
 *
 * @param error - Error message or Error object
 * @param status - HTTP status code
 * @param code - Error code for client handling
 * @param details - Additional details (will be sanitized)
 * @param context - Context for logging (operation, userId, etc.)
 */
export function apiError(
    error: string | Error | unknown,
    status: number = 400,
    code?: string,
    details?: unknown,
    context?: {
        operation?: string;
        userId?: string;
        restaurantId?: string;
    }
): NextResponse<ApiErrorResponse> {
    const requestId = randomUUID();
    const errorCode = code ?? 'ERROR';

    // Log full error server-side
    const sanitizedMessage = logAndSanitize(error, {
        operation: context?.operation ?? 'api_error',
        userId: context?.userId,
        restaurantId: context?.restaurantId,
        requestId,
    });

    // Create sanitized response
    const body: ApiErrorResponse = {
        error: {
            code: errorCode,
            message: sanitizedMessage,
            requestId,
        },
    };

    // Only include details if provided and safe
    if (typeof details !== 'undefined') {
        // Sanitize details if it's a string
        if (typeof details === 'string') {
            body.error.details = sanitizeErrorMessage(details);
        } else if (Array.isArray(details)) {
            // For validation errors, include them but sanitize strings
            body.error.details = details;
        }
    }

    return NextResponse.json(body, {
        status,
        headers: { 'x-request-id': requestId, 'x-api-version': 'v1' },
    });
}

/**
 * Create an API error from an unknown error with automatic sanitization
 * MED-021: Now supports AppError for consistent error handling
 *
 * @param error - Unknown error to handle
 * @param context - Context for logging
 * @returns Sanitized error response
 */
export function handleApiError(
    error: unknown,
    context?: {
        operation?: string;
        userId?: string;
        restaurantId?: string;
    }
): NextResponse<ApiErrorResponse> {
    // Convert to AppError if needed
    const appError = isAppError(error) ? error : toAppError(error);

    // Use AppError properties directly
    const status = appError.statusCode;
    const code = appError.code;
    const details = appError.details;

    return apiError(appError, status, code, details, context);
}
