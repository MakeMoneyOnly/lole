import { GraphQLError } from 'graphql';
import { logger } from '@/lib/logger';
import type { AppError as ApiAppError } from '@/lib/api/errors';
import { isAppError as isApiAppError } from '@/lib/api/errors';
import type { AppError as LegacyAppError } from '@/lib/errors';

const log = logger.child('[graphql/errors]');

/**
 * Standardized error codes for GraphQL resolvers
 */
export type ErrorCode =
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'TENANT_ISOLATION_VIOLATION'
    | 'INTERNAL_ERROR'
    | 'NOT_IMPLEMENTED'
    | 'BAD_USER_INPUT';

/**
 * Mapping from AppError codes to GraphQL error codes
 * Supports both legacy (userMessage/internalMessage) and new (code/message) patterns
 */
const APP_ERROR_TO_GRAPHQL_CODE: Record<string, ErrorCode> = {
    // Legacy error codes from @/lib/errors
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'UNAUTHORIZED',
    AUTHORIZATION_ERROR: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    TENANT_ISOLATION_VIOLATION: 'TENANT_ISOLATION_VIOLATION',
    RATE_LIMIT: 'BAD_USER_INPUT',
    // New API error codes from @/lib/api/errors
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    CONFLICT: 'BAD_USER_INPUT',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    RATE_LIMITED: 'BAD_USER_INPUT',
};

/**
 * Custom GraphQL error class with structured error codes and details
 */
export class loleGraphQLError extends GraphQLError {
    constructor(
        message: string,
        public code: ErrorCode,
        public details?: Record<string, unknown>
    ) {
        super(message, {
            extensions: {
                code,
                ...details,
            },
        });
    }
}

/**
 * Bridge function to convert AppError to loleGraphQLError
 * Used in resolvers to maintain consistent error handling
 * Supports both legacy and new error patterns
 */
export function toGraphQLError(error: LegacyAppError | ApiAppError): loleGraphQLError {
    // Handle legacy error pattern (has userMessage property)
    if (
        'userMessage' in error &&
        typeof (error as { userMessage: unknown }).userMessage === 'string'
    ) {
        const legacyError = error as LegacyAppError;
        const code = APP_ERROR_TO_GRAPHQL_CODE[legacyError.code ?? ''] ?? 'INTERNAL_ERROR';
        return new loleGraphQLError(legacyError.userMessage, code, {
            internalMessage: legacyError.internalMessage,
            statusCode: legacyError.statusCode,
        });
    }

    // Handle new API error pattern (code is the first param, message is the second)
    const code = APP_ERROR_TO_GRAPHQL_CODE[(error as ApiAppError).code] ?? 'INTERNAL_ERROR';
    return new loleGraphQLError(error.message, code, {
        statusCode: (error as ApiAppError).statusCode,
    });
}

/**
 * Standard error result shape for mutation responses
 */
export interface ErrorResult {
    success: false;
    error: {
        code: ErrorCode;
        message: string;
        messageAm?: string;
        internalMessage?: string;
        statusCode?: number;
    };
}

/**
 * Creates a standardized error result for mutation responses
 */
export function createErrorResult(
    code: ErrorCode,
    message: string,
    messageAm?: string,
    internalMessage?: string,
    statusCode?: number
): ErrorResult {
    return {
        success: false,
        error: {
            code,
            message,
            messageAm,
            internalMessage,
            statusCode,
        },
    };
}

/**
 * Helper to convert unknown errors to ErrorResult
 * Logs unexpected errors and returns a safe internal error message
 * Handles both AppError and standard Error types
 */
export function handleResolverError(error: unknown): ErrorResult {
    // Handle loleGraphQLError first (already formatted)
    if (error instanceof loleGraphQLError) {
        return createErrorResult(error.code, error.message);
    }

    // Handle API AppError (new pattern from @/lib/api/errors)
    if (isApiAppError(error)) {
        const graphqlCode = APP_ERROR_TO_GRAPHQL_CODE[error.code] ?? 'INTERNAL_ERROR';
        log.error('Resolver AppError (API pattern)', {
            code: error.code,
            message: error.message,
        });
        return createErrorResult(
            graphqlCode,
            error.message,
            undefined,
            undefined,
            error.statusCode
        );
    }

    // Handle legacy AppError pattern (has userMessage property)
    if (
        error instanceof Error &&
        'code' in error &&
        'userMessage' in error &&
        typeof (error as LegacyAppError).userMessage === 'string'
    ) {
        const legacyError = error as LegacyAppError;
        const graphqlCode = APP_ERROR_TO_GRAPHQL_CODE[legacyError.code ?? ''] ?? 'INTERNAL_ERROR';
        log.error('Resolver AppError (legacy pattern)', {
            code: legacyError.code,
            message: legacyError.internalMessage || legacyError.userMessage,
        });
        return createErrorResult(
            graphqlCode,
            legacyError.userMessage,
            undefined,
            legacyError.internalMessage,
            legacyError.statusCode
        );
    }

    // Handle standard Error
    if (error instanceof Error) {
        log.error('Resolver error', error);
        return createErrorResult('INTERNAL_ERROR', 'An unexpected error occurred');
    }

    return createErrorResult('INTERNAL_ERROR', 'An unexpected error occurred');
}

/**
 * Pre-defined error results for common cases
 */
export const NOT_IMPLEMENTED_ERROR = createErrorResult(
    'NOT_IMPLEMENTED',
    'This feature is not yet implemented'
);

export const UNAUTHORIZED_ERROR = createErrorResult('UNAUTHORIZED', 'Authentication required');

export const FORBIDDEN_ERROR = createErrorResult(
    'FORBIDDEN',
    'You do not have permission to perform this action'
);

export const NOT_FOUND_ERROR = createErrorResult('NOT_FOUND', 'Resource not found');

export const TENANT_ISOLATION_ERROR = createErrorResult(
    'TENANT_ISOLATION_VIOLATION',
    'Access denied: resource belongs to a different restaurant'
);

export const VALIDATION_ERROR = createErrorResult('VALIDATION_ERROR', 'Invalid input provided');

export const INTERNAL_ERROR = createErrorResult('INTERNAL_ERROR', 'An unexpected error occurred');
