/**
 * Custom Application Error Class
 * Consolidated with code-first pattern (see src/lib/api/errors.ts)
 *
 * @deprecated Import from '@/lib/api/errors' for new code.
 * This file is kept for backward compatibility.
 */
import type { ErrorCode as ApiErrorCode } from './api/errors';

export type ErrorCode =
    | ApiErrorCode
    | 'AUTHENTICATION_ERROR'
    | 'AUTHORIZATION_ERROR'
    | 'TENANT_ISOLATION_VIOLATION';

export class AppError extends Error {
    constructor(
        public statusCode: number,
        public userMessage: string,
        public internalMessage?: string,
        public code?: string
    ) {
        super(userMessage);
        this.name = 'AppError';
    }

    getDetails(): { internalMessage?: string; statusCode?: number } | undefined {
        if (this.internalMessage || this.statusCode) {
            return { internalMessage: this.internalMessage, statusCode: this.statusCode };
        }
        return undefined;
    }
}

export class ValidationError extends AppError {
    constructor(
        userMessage: string = 'Validation failed',
        public details?: Array<{ path: string; message: string }>
    ) {
        super(400, userMessage, undefined, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}

export class AuthenticationError extends AppError {
    constructor(userMessage: string = 'Authentication required') {
        super(401, userMessage, undefined, 'AUTHENTICATION_ERROR');
        this.name = 'AuthenticationError';
    }
}

export class AuthorizationError extends AppError {
    constructor(userMessage: string = 'Access denied') {
        super(403, userMessage, undefined, 'AUTHORIZATION_ERROR');
        this.name = 'AuthorizationError';
    }
}

export class NotFoundError extends AppError {
    constructor(userMessage: string = 'Resource not found') {
        super(404, userMessage, undefined, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}

export class RateLimitError extends AppError {
    constructor(userMessage: string = 'Too many requests') {
        super(429, userMessage, undefined, 'RATE_LIMIT');
        this.name = 'RateLimitError';
    }
}

export class TenantIsolationError extends AppError {
    constructor(userMessage: string = 'Access denied: resource belongs to a different restaurant') {
        super(403, userMessage, undefined, 'TENANT_ISOLATION_VIOLATION');
        this.name = 'TenantIsolationError';
    }
}

export class ConflictError extends AppError {
    constructor(userMessage: string = 'Resource already exists') {
        super(409, userMessage, undefined, 'CONFLICT');
        this.name = 'ConflictError';
    }
}

export class InternalError extends AppError {
    constructor(userMessage: string = 'An unexpected error occurred') {
        super(500, userMessage, undefined, 'INTERNAL_ERROR');
        this.name = 'InternalError';
    }
}

export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
    return error instanceof NotFoundError;
}

export function isValidationError(error: unknown): error is ValidationError {
    return error instanceof ValidationError;
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
    return error instanceof AuthenticationError;
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
    return error instanceof AuthorizationError;
}

export function isTenantIsolationError(error: unknown): error is TenantIsolationError {
    return error instanceof TenantIsolationError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
    return error instanceof RateLimitError;
}
