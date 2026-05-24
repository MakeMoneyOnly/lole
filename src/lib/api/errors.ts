/**
 * Standardized Application Error Classes
 * MED-021: Provides consistent error handling across the codebase
 *
 * Usage:
 * - Throw these errors in services and API routes
 * - Use handleApiError() in response.ts to convert to API responses
 * - Use error factory functions for common cases
 */

import { ZodError } from 'zod';

/**
 * Standard error codes aligned with HTTP status codes
 */
export type ErrorCode =
    | 'VALIDATION_ERROR' // 400
    | 'UNAUTHORIZED' // 401
    | 'FORBIDDEN' // 403
    | 'NOT_FOUND' // 404
    | 'CONFLICT' // 409
    | 'RATE_LIMITED' // 429
    | 'INTERNAL_ERROR'; // 500

/**
 * Map error codes to HTTP status codes
 */
export const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
    VALIDATION_ERROR: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500,
};

/**
 * Base application error class for all domain errors
 * Provides consistent structure for error handling across the codebase
 */
export class AppError extends Error {
    constructor(
        public readonly code: ErrorCode,
        message: string,
        public readonly statusCode: number = ERROR_STATUS_MAP[code],
        public readonly details?: unknown
    ) {
        super(message);
        this.name = 'AppError';
        // Maintains proper stack trace for where error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }

    /**
     * Convert to JSON for API responses
     */
    toJSON(): { code: ErrorCode; message: string; details?: unknown } {
        return {
            code: this.code,
            message: this.message,
            ...(this.details !== undefined && { details: this.details }),
        };
    }
}

/**
 * Validation error for invalid input data
 */
export class ValidationError extends AppError {
    constructor(message: string, details?: unknown) {
        super('VALIDATION_ERROR', message, 400, details);
        this.name = 'ValidationError';
    }
}

/**
 * Authentication error for missing/invalid credentials
 */
export class UnauthorizedError extends AppError {
    constructor(message: string = 'Authentication required') {
        super('UNAUTHORIZED', message, 401);
        this.name = 'UnauthorizedError';
    }
}

/**
 * Authorization error for insufficient permissions
 */
export class ForbiddenError extends AppError {
    constructor(message: string = 'Access denied') {
        super('FORBIDDEN', message, 403);
        this.name = 'ForbiddenError';
    }
}

/**
 * Resource not found error
 */
export class NotFoundError extends AppError {
    constructor(resource: string, identifier?: string) {
        const message = identifier
            ? `${resource} not found: ${identifier}`
            : `${resource} not found`;
        super('NOT_FOUND', message, 404);
        this.name = 'NotFoundError';
    }
}

/**
 * Conflict error for duplicate resources or invalid state
 */
export class ConflictError extends AppError {
    constructor(message: string, details?: unknown) {
        super('CONFLICT', message, 409, details);
        this.name = 'ConflictError';
    }
}

/**
 * Rate limit error for too many requests
 */
export class RateLimitError extends AppError {
    constructor(
        message: string = 'Too many requests',
        public readonly retryAfter?: number
    ) {
        super('RATE_LIMITED', message, 429, { retryAfter });
        this.name = 'RateLimitError';
    }
}

/**
 * Internal error for unexpected failures
 */
export class InternalError extends AppError {
    constructor(message: string = 'An unexpected error occurred', details?: unknown) {
        super('INTERNAL_ERROR', message, 500, details);
        this.name = 'InternalError';
    }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Create a NotFoundError for a resource
 * @param resource - Name of the resource type (e.g., 'Order', 'Guest')
 * @param id - Optional identifier of the resource
 */
export function notFound(resource: string, id?: string): NotFoundError {
    return new NotFoundError(resource, id);
}

/**
 * Create a ValidationError from a Zod validation failure
 * @param zodError - The ZodError from validation
 */
export function validationErrorFromZod(zodError: ZodError): ValidationError {
    return new ValidationError(
        'Validation failed',
        zodError.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
        }))
    );
}

/**
 * Create a ValidationError with custom details
 * @param message - Error message
 * @param details - Additional details about the validation failure
 */
export function validationError(message: string, details?: unknown): ValidationError {
    return new ValidationError(message, details);
}

/**
 * Create an UnauthorizedError
 * @param message - Optional custom message
 */
export function unauthorized(message?: string): UnauthorizedError {
    return new UnauthorizedError(message);
}

/**
 * Create a ForbiddenError for an action on a resource
 * @param action - The action that was attempted (e.g., 'update', 'delete')
 * @param resource - The resource type (e.g., 'Order', 'Guest')
 */
export function forbidden(action: string, resource: string): ForbiddenError {
    return new ForbiddenError(`You do not have permission to ${action} this ${resource}`);
}

/**
 * Create a ConflictError for duplicate resources
 * @param resource - Name of the resource
 * @param identifier - Optional identifier
 */
export function conflict(resource: string, identifier?: string): ConflictError {
    const message = identifier
        ? `${resource} already exists: ${identifier}`
        : `${resource} already exists`;
    return new ConflictError(message);
}

/**
 * Create a RateLimitError
 * @param retryAfter - Seconds until retry is allowed
 */
export function rateLimited(retryAfter?: number): RateLimitError {
    return new RateLimitError(undefined, retryAfter);
}

/**
 * Create an InternalError for unexpected failures
 * @param message - Error message
 * @param details - Additional context (will be sanitized in response)
 */
export function internalError(message?: string, details?: unknown): InternalError {
    return new InternalError(message, details);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

/**
 * Check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
    return error instanceof ValidationError;
}

/**
 * Check if an error is an UnauthorizedError
 */
export function isUnauthorizedError(error: unknown): error is UnauthorizedError {
    return error instanceof UnauthorizedError;
}

/**
 * Check if an error is a ForbiddenError
 */
export function isForbiddenError(error: unknown): error is ForbiddenError {
    return error instanceof ForbiddenError;
}

/**
 * Check if an error is a NotFoundError
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
    return error instanceof NotFoundError;
}

/**
 * Check if an error is a ConflictError
 */
export function isConflictError(error: unknown): error is ConflictError {
    return error instanceof ConflictError;
}

/**
 * Check if an error is a RateLimitError
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
    return error instanceof RateLimitError;
}

// ============================================================================
// Error Conversion Utilities
// ============================================================================

/**
 * Convert an unknown error to an AppError
 * Useful for catch blocks where the error type is unknown
 */
export function toAppError(error: unknown): AppError {
    if (isAppError(error)) {
        return error;
    }

    if (error instanceof ZodError) {
        return validationErrorFromZod(error);
    }

    if (error instanceof Error) {
        // Check for PostgreSQL error codes
        const pgError = error as Error & { code?: string };
        if (pgError.code === '23505') {
            return conflict('Resource');
        }
        if (pgError.code === '23503') {
            return validationError('Referenced resource does not exist');
        }
        if (pgError.code === '23502') {
            return validationError('Required field is missing');
        }

        return internalError(error.message);
    }

    return internalError('An unexpected error occurred');
}
