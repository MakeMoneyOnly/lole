import { describe, it, expect } from 'vitest';
import { handleApiError, generateRequestId, safeParseJson } from './errorHandler';
import { AppError } from './errors';
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
    it('should handle AppError correctly', () => {
        const appError = new AppError(
            404,
            'Resource not found',
            'The requested item does not exist in the database',
            'NOT_FOUND'
        );

        const response = handleApiError(appError, 'Test Context');

        expect(response).toBeInstanceOf(NextResponse);
        expect(response.status).toBe(404);
    });

    it('should return sanitized error for AppError', async () => {
        const appError = new AppError(
            500,
            'Something went wrong',
            'Internal database connection failed',
            'DB_ERROR'
        );

        const response = handleApiError(appError, 'Test Context');
        const data = await response.json();

        expect(data.error).toBe('Something went wrong');
        expect(data.code).toBe('DB_ERROR');
        expect(data.requestId).toBeDefined();
        expect(data.internalMessage).toBeUndefined(); // Should not leak internal details
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
            new AppError(400, 'Bad Request'),
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
