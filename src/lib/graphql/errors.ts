import { GraphQLError } from 'graphql';
import { logger } from '@/lib/logger';

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
 * Standard error result shape for mutation responses
 */
export interface ErrorResult {
    success: false;
    error: {
        code: ErrorCode;
        message: string;
        messageAm?: string; // Amharic translation for localization
    };
}

/**
 * Creates a standardized error result for mutation responses
 */
export function createErrorResult(
    code: ErrorCode,
    message: string,
    messageAm?: string
): ErrorResult {
    return {
        success: false,
        error: {
            code,
            message,
            messageAm,
        },
    };
}

/**
 * Helper to convert unknown errors to ErrorResult
 * Logs unexpected errors and returns a safe internal error message
 */
export function handleResolverError(error: unknown): ErrorResult {
    if (error instanceof loleGraphQLError) {
        return createErrorResult(error.code, error.message);
    }

    if (error instanceof Error) {
        // Log unexpected errors
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
