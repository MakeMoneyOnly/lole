import { describe, it, expect } from 'vitest';
import { handleApiError, generateRequestId, safeParseJson } from './errorHandler';
import { AppError as NewAppError, ValidationError, NotFoundError } from './api/errors';
import { AppError as LegacyAppError } from './errors';
import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Error Handler Tests
 *
 * Addresses PLATFORM_AUDIT_REPORT finding TEST-001: Error Handling Testing
 */

describe('generateRequestId', () => {
    it('should generate a unique request ID', () => {
        const id1 = generateRequestId();
        const id2 = generateRequestId();

        expect(id1).toBeDefined();
        expect(typeof id1).toBe('string');
        expect(id1).not.toBe(id2); // Should be unique
    });

    it('should generate valid UUID format', () => {
        const id = generateRequestId();
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        expect(uuidRegex.test(id)).toBe(true);
    });
});

describe('handleApiError', () => {
    it('should handle new AppError (API) correctly', () => {
        const appError = new NewAppError('NOT_FOUND', 'Resource not found', 404);

        const response = handleApiError(appError, 'Test Context');

        expect(response).toBeInstanceOf(NextResponse);
        expect(response.status).toBe(404);
    });

    it('should return sanitized error for new AppError with details', async () => {
        const appError = new NewAppError('INTERNAL_ERROR', 'Something went wrong', 500, {
            query: 'SELECT * FROM users',
        });

        const response = handleApiError(appError, 'Test Context');
        const data = await response.json();

        expect(data.error).toBe('Something went wrong');
        expect(data.code).toBe('INTERNAL_ERROR');
        expect(data.requestId).toBeDefined();
        expect(data.details).toEqual({ query: 'SELECT * FROM users' });
    });

    it('should handle ValidationError from API errors', async () => {
        const validationError = new ValidationError('Invalid input', [
            { path: 'email', message: 'Invalid email' },
        ]);

        const response = handleApiError(validationError, 'Test Context');
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid input');
        expect(data.code).toBe('VALIDATION_ERROR');
        expect(data.details).toEqual([{ path: 'email', message: 'Invalid email' }]);
    });

    it('should handle NotFoundError from API errors', () => {
        const notFoundError = new NotFoundError('User', '123');

        const response = handleApiError(notFoundError, 'Test Context');

        expect(response.status).toBe(404);
    });

    it('should handle Zod validation errors', async () => {
        const schema = z.object({
            name: z.string().min(1),
            age: z.number().positive(),
        });

        try {
            schema.parse({ name: '', age: -5 });
        } catch (error) {
            if (error instanceof z.ZodError) {
                const response = handleApiError(error, 'Validation Test');
                const data = await response.json();

                expect(response.status).toBe(400);
                expect(data.error).toBe('Validation failed');
                expect(data.code).toBe('VALIDATION_ERROR');
                expect(data.details).toBeDefined();
                expect(Array.isArray(data.details)).toBe(true);
            }
        }
    });

    it('should handle standard Error objects', async () => {
        const error = new Error('Something broke');

        const response = handleApiError(error, 'Standard Error Test');
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('An unexpected error occurred');
        expect(data.code).toBe('INTERNAL_ERROR');
        expect(data.requestId).toBeDefined();
    });

    it('should handle unknown errors', async () => {
        const unknownError = 'just a string error';

        const response = handleApiError(unknownError, 'Unknown Error Test');
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('An unexpected error occurred');
        expect(data.code).toBe('UNKNOWN_ERROR');
        expect(data.requestId).toBeDefined();
    });

    it('should include requestId in all error responses', async () => {
        const errors = [
            new NewAppError('VALIDATION_ERROR', 'Bad Request'),
            new Error('Generic error'),
            'string error',
            null,
            undefined,
        ];

        for (const error of errors) {
            const response = handleApiError(error, 'Test');
            const data = await response.json();
            expect(data.requestId).toBeDefined();
            expect(typeof data.requestId).toBe('string');
        }
    });

    it('should handle legacy AppError for backward compatibility', async () => {
        const legacyError = new LegacyAppError(
            403,
            'Access denied',
            'User lacks permission',
            'FORBIDDEN'
        );

        const response = handleApiError(legacyError, 'Legacy Test');
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe('Access denied');
        expect(data.code).toBe('FORBIDDEN');
        expect(data.requestId).toBeDefined();
    });
});

describe('safeParseJson', () => {
    it('should successfully parse valid JSON', async () => {
        const validJson = { name: 'Test', value: 123 };
        const request = new Request('http://localhost', {
            method: 'POST',
            body: JSON.stringify(validJson),
        });

        const result = await safeParseJson(request);
        expect(result).toEqual(validJson);
    });

    it('should return NextResponse for invalid JSON', async () => {
        const request = new Request('http://localhost', {
            method: 'POST',
            body: 'not valid json',
        });

        const result = await safeParseJson(request);
        expect(result).toBeInstanceOf(NextResponse);
        expect((result as NextResponse).status).toBe(400);
    });

    it('should return error message for invalid JSON', async () => {
        const request = new Request('http://localhost', {
            method: 'POST',
            body: 'not valid json',
        });

        const result = await safeParseJson(request);
        if (result instanceof NextResponse) {
            const data = await result.json();
            expect(data.error).toBe('Invalid JSON in request body');
        }
    });

    it('should handle empty body', async () => {
        const request = new Request('http://localhost', {
            method: 'POST',
            body: '',
        });

        const result = await safeParseJson(request);
        expect(result).toBeInstanceOf(NextResponse);
    });

    it('should handle nested JSON objects', async () => {
        const complexJson = {
            user: {
                name: 'John',
                settings: {
                    theme: 'dark',
                    notifications: true,
                },
            },
            items: [
                { id: 1, name: 'Item 1' },
                { id: 2, name: 'Item 2' },
            ],
        };

        const request = new Request('http://localhost', {
            method: 'POST',
            body: JSON.stringify(complexJson),
        });

        const result = await safeParseJson(request);
        expect(result).toEqual(complexJson);
    });
});
