import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    loleGraphQLError,
    createErrorResult,
    handleResolverError,
    toGraphQLError,
    NOT_IMPLEMENTED_ERROR,
    UNAUTHORIZED_ERROR,
    FORBIDDEN_ERROR,
    NOT_FOUND_ERROR,
    TENANT_ISOLATION_ERROR,
    VALIDATION_ERROR,
    INTERNAL_ERROR,
    ErrorCode,
    ErrorResult,
} from '../errors';
import {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    TenantIsolationError,
    RateLimitError,
} from '@/lib/errors';

describe('GraphQL Errors', () => {
    describe('loleGraphQLError', () => {
        it('should create error with code and message', () => {
            const error = new loleGraphQLError('Test error', 'NOT_FOUND');

            expect(error).toBeInstanceOf(loleGraphQLError);
            expect(error.message).toBe('Test error');
            expect(error.code).toBe('NOT_FOUND');
        });

        it('should create error with details', () => {
            const details = { resourceId: '123', resourceType: 'Order' };
            const error = new loleGraphQLError('Resource not found', 'NOT_FOUND', details);

            expect(error.details).toEqual(details);
            expect(error.extensions?.resourceId).toBe('123');
            expect(error.extensions?.resourceType).toBe('Order');
        });

        it('should include code in extensions', () => {
            const error = new loleGraphQLError('Unauthorized access', 'UNAUTHORIZED');

            expect(error.extensions?.code).toBe('UNAUTHORIZED');
        });

        it('should support all error codes', () => {
            const codes: ErrorCode[] = [
                'UNAUTHORIZED',
                'FORBIDDEN',
                'NOT_FOUND',
                'VALIDATION_ERROR',
                'TENANT_ISOLATION_VIOLATION',
                'INTERNAL_ERROR',
                'NOT_IMPLEMENTED',
                'BAD_USER_INPUT',
            ];

            codes.forEach(code => {
                const error = new loleGraphQLError(`Error for ${code}`, code);
                expect(error.code).toBe(code);
            });
        });
    });

    describe('createErrorResult', () => {
        it('should create error result with code and message', () => {
            const result = createErrorResult('VALIDATION_ERROR', 'Invalid input');

            expect(result.success).toBe(false);
            expect(result.error.code).toBe('VALIDATION_ERROR');
            expect(result.error.message).toBe('Invalid input');
        });

        it('should create error result with Amharic message', () => {
            const result = createErrorResult('NOT_FOUND', 'Resource not found', 'ግብዓት አልተገኘም');

            expect(result.success).toBe(false);
            expect(result.error.messageAm).toBe('ግብዓት አልተገኘም');
        });

        it('should always return success: false', () => {
            const codes: ErrorCode[] = [
                'UNAUTHORIZED',
                'FORBIDDEN',
                'NOT_FOUND',
                'VALIDATION_ERROR',
                'INTERNAL_ERROR',
            ];

            codes.forEach(code => {
                const result = createErrorResult(code, `Error for ${code}`);
                expect(result.success).toBe(false);
            });
        });
    });

    describe('handleResolverError', () => {
        let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it('should handle loleGraphQLError', () => {
            const error = new loleGraphQLError('Test error', 'NOT_FOUND');
            const result = handleResolverError(error);

            expect(result.error.code).toBe('NOT_FOUND');
            expect(result.error.message).toBe('Test error');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('should handle loleGraphQLError with details', () => {
            const error = new loleGraphQLError('Validation failed', 'VALIDATION_ERROR', {
                field: 'email',
            });
            const result = handleResolverError(error);

            expect(result.error.code).toBe('VALIDATION_ERROR');
            expect(result.error.message).toBe('Validation failed');
        });

        it('should handle generic Error', () => {
            const error = new Error('Generic error');
            const result = handleResolverError(error);

            expect(result.error.code).toBe('INTERNAL_ERROR');
            expect(result.error.message).toBe('An unexpected error occurred');
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('should handle non-Error objects', () => {
            const result = handleResolverError('string error');

            expect(result.error.code).toBe('INTERNAL_ERROR');
            expect(result.error.message).toBe('An unexpected error occurred');
        });

        it('should handle null error', () => {
            const result = handleResolverError(null);

            expect(result.error.code).toBe('INTERNAL_ERROR');
            expect(result.error.message).toBe('An unexpected error occurred');
        });

        it('should handle undefined error', () => {
            const result = handleResolverError(undefined);

            expect(result.error.code).toBe('INTERNAL_ERROR');
            expect(result.error.message).toBe('An unexpected error occurred');
        });

        it('should handle object errors', () => {
            const objectError = { message: 'Some error', code: 500 };
            const result = handleResolverError(objectError);

            expect(result.error.code).toBe('INTERNAL_ERROR');
            expect(result.error.message).toBe('An unexpected error occurred');
        });
    });

    describe('toGraphQLError', () => {
        it('should convert ValidationError to GraphQL error', () => {
            const error = new ValidationError('Invalid input');
            const graphqlError = toGraphQLError(error);

            expect(graphqlError).toBeInstanceOf(loleGraphQLError);
            expect(graphqlError.code).toBe('VALIDATION_ERROR');
            expect(graphqlError.message).toBe('Invalid input');
        });

        it('should convert AuthenticationError to UNAUTHORIZED', () => {
            const error = new AuthenticationError('Invalid credentials');
            const graphqlError = toGraphQLError(error);

            expect(graphqlError.code).toBe('UNAUTHORIZED');
        });

        it('should convert AuthorizationError to FORBIDDEN', () => {
            const error = new AuthorizationError('No permission');
            const graphqlError = toGraphQLError(error);

            expect(graphqlError.code).toBe('FORBIDDEN');
        });

        it('should convert NotFoundError to NOT_FOUND', () => {
            const error = new NotFoundError('User not found');
            const graphqlError = toGraphQLError(error);

            expect(graphqlError.code).toBe('NOT_FOUND');
        });

        it('should convert TenantIsolationError to TENANT_ISOLATION_VIOLATION', () => {
            const error = new TenantIsolationError('Cross-tenant access denied');
            const graphqlError = toGraphQLError(error);

            expect(graphqlError.code).toBe('TENANT_ISOLATION_VIOLATION');
        });

        it('should convert RateLimitError to BAD_USER_INPUT', () => {
            const error = new RateLimitError('Too many requests');
            const graphqlError = toGraphQLError(error);

            expect(graphqlError.code).toBe('BAD_USER_INPUT');
        });

        it('should map unknown error code to INTERNAL_ERROR', () => {
            const error = new AppError(500, 'Unknown', 'Internal', 'UNKNOWN_CODE');
            const graphqlError = toGraphQLError(error);

            expect(graphqlError.code).toBe('INTERNAL_ERROR');
        });

        it('should include internalMessage in details', () => {
            const error = new AppError(500, 'User msg', 'Internal msg', 'VALIDATION_ERROR');
            const graphqlError = toGraphQLError(error);

            expect(graphqlError.details?.internalMessage).toBe('Internal msg');
        });
    });

    describe('handleResolverError with AppError', () => {
        let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it('should handle ValidationError', () => {
            const error = new ValidationError('Invalid email');
            const result = handleResolverError(error);

            expect(result.error.code).toBe('VALIDATION_ERROR');
            expect(result.error.message).toBe('Invalid email');
        });

        it('should handle AuthenticationError', () => {
            const error = new AuthenticationError('Not authenticated');
            const result = handleResolverError(error);

            expect(result.error.code).toBe('UNAUTHORIZED');
        });

        it('should handle AuthorizationError', () => {
            const error = new AuthorizationError('Forbidden');
            const result = handleResolverError(error);

            expect(result.error.code).toBe('FORBIDDEN');
        });

        it('should handle NotFoundError', () => {
            const error = new NotFoundError('Item missing');
            const result = handleResolverError(error);

            expect(result.error.code).toBe('NOT_FOUND');
        });

        it('should handle TenantIsolationError', () => {
            const error = new TenantIsolationError('Cross-tenant');
            const result = handleResolverError(error);

            expect(result.error.code).toBe('TENANT_ISOLATION_VIOLATION');
        });

        it('should handle generic AppError with unknown code', () => {
            const error = new AppError(500, 'Generic error', 'Details', 'UNKNOWN');
            const result = handleResolverError(error);

            expect(result.error.code).toBe('INTERNAL_ERROR');
            expect(result.error.message).toBe('Generic error');
        });
    });

    describe('Pre-defined error results', () => {
        it('NOT_IMPLEMENTED_ERROR should have correct shape', () => {
            expect(NOT_IMPLEMENTED_ERROR.success).toBe(false);
            expect(NOT_IMPLEMENTED_ERROR.error.code).toBe('NOT_IMPLEMENTED');
            expect(NOT_IMPLEMENTED_ERROR.error.message).toBe('This feature is not yet implemented');
        });

        it('UNAUTHORIZED_ERROR should have correct shape', () => {
            expect(UNAUTHORIZED_ERROR.success).toBe(false);
            expect(UNAUTHORIZED_ERROR.error.code).toBe('UNAUTHORIZED');
            expect(UNAUTHORIZED_ERROR.error.message).toBe('Authentication required');
        });

        it('FORBIDDEN_ERROR should have correct shape', () => {
            expect(FORBIDDEN_ERROR.success).toBe(false);
            expect(FORBIDDEN_ERROR.error.code).toBe('FORBIDDEN');
            expect(FORBIDDEN_ERROR.error.message).toBe(
                'You do not have permission to perform this action'
            );
        });

        it('NOT_FOUND_ERROR should have correct shape', () => {
            expect(NOT_FOUND_ERROR.success).toBe(false);
            expect(NOT_FOUND_ERROR.error.code).toBe('NOT_FOUND');
            expect(NOT_FOUND_ERROR.error.message).toBe('Resource not found');
        });

        it('TENANT_ISOLATION_ERROR should have correct shape', () => {
            expect(TENANT_ISOLATION_ERROR.success).toBe(false);
            expect(TENANT_ISOLATION_ERROR.error.code).toBe('TENANT_ISOLATION_VIOLATION');
            expect(TENANT_ISOLATION_ERROR.error.message).toBe(
                'Access denied: resource belongs to a different restaurant'
            );
        });

        it('VALIDATION_ERROR should have correct shape', () => {
            expect(VALIDATION_ERROR.success).toBe(false);
            expect(VALIDATION_ERROR.error.code).toBe('VALIDATION_ERROR');
            expect(VALIDATION_ERROR.error.message).toBe('Invalid input provided');
        });

        it('INTERNAL_ERROR should have correct shape', () => {
            expect(INTERNAL_ERROR.success).toBe(false);
            expect(INTERNAL_ERROR.error.code).toBe('INTERNAL_ERROR');
            expect(INTERNAL_ERROR.error.message).toBe('An unexpected error occurred');
        });
    });

    describe('ErrorResult type', () => {
        it('should be usable as return type for mutations', () => {
            function mockMutation(): ErrorResult | { success: true; data: unknown } {
                return createErrorResult('NOT_FOUND', 'Order not found');
            }

            const result = mockMutation();
            if (!result.success) {
                expect(result.error.code).toBeDefined();
                expect(result.error.message).toBeDefined();
            }
        });
    });

    describe('Error handling patterns', () => {
        it('should include internalMessage when provided', () => {
            const result = createErrorResult(
                'VALIDATION_ERROR',
                'Invalid input',
                undefined,
                'Field "email" must be a valid email address'
            );

            expect(result.success).toBe(false);
            expect(result.error.internalMessage).toBe(
                'Field "email" must be a valid email address'
            );
        });

        it('should include statusCode when provided', () => {
            const result = createErrorResult(
                'NOT_FOUND',
                'Resource not found',
                undefined,
                undefined,
                404
            );

            expect(result.error.statusCode).toBe(404);
        });

        it('should handle AppError with all properties', () => {
            const error = new AppError(
                403,
                'Access denied',
                'User does not have required role',
                'AUTHORIZATION_ERROR'
            );
            const result = handleResolverError(error);

            expect(result.error.code).toBe('FORBIDDEN');
            expect(result.error.message).toBe('Access denied');
            expect(result.error.internalMessage).toBe('User does not have required role');
            expect(result.error.statusCode).toBe(403);
        });

        it('should handle TenantIsolationError with proper code mapping', () => {
            const error = new TenantIsolationError('Cross-tenant access');
            const result = handleResolverError(error);

            expect(result.error.code).toBe('TENANT_ISOLATION_VIOLATION');
            expect(result.error.message).toBe('Cross-tenant access');
        });

        it('should handle AppError with unknown code as INTERNAL_ERROR', () => {
            const error = new AppError(500, 'Custom error', 'Internal', 'CUSTOM_CODE');
            const result = handleResolverError(error);

            expect(result.error.code).toBe('INTERNAL_ERROR');
            expect(result.error.message).toBe('Custom error');
            expect(result.error.internalMessage).toBe('Internal');
            expect(result.error.statusCode).toBe(500);
        });

        it('should sanitize error responses for non-AppError types', () => {
            const result = handleResolverError(new Error('Database connection failed'));

            expect(result.error.code).toBe('INTERNAL_ERROR');
            expect(result.error.message).toBe('An unexpected error occurred');
            expect(result.error.internalMessage).toBeUndefined();
        });
    });
});
