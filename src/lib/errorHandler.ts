import { NextResponse } from 'next/server';
import { AppError } from './errors';
import { z } from 'zod';
import { logger } from './logger';

/**
 * Generate a unique request ID for tracking errors
 */
export function generateRequestId(): string {
    return crypto.randomUUID();
}

/**
 * Handle API errors in a standardized way
 * Logs full error details server-side but returns sanitized response to client
 */
export function handleApiError(error: unknown, context: string): NextResponse {
    const requestId = generateRequestId();

    // Log full error server-side for debugging
    if (error instanceof AppError) {
        logger.error(`[${requestId}] ${context}`, error, {
            statusCode: error.statusCode,
            userMessage: error.userMessage,
            internalMessage: error.internalMessage,
            code: error.code,
        });

        return NextResponse.json(
            {
                error: error.userMessage,
                requestId,
                code: error.code,
            },
            { status: error.statusCode }
        );
    }

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
        const zodError = error as z.ZodError;
        const validationDetails = zodError.issues.map((issue: z.ZodIssue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));

        logger.error(`[${requestId}] ${context} - Validation Error`, validationDetails);

        return NextResponse.json(
            {
                error: 'Validation failed',
                details: validationDetails,
                requestId,
                code: 'VALIDATION_ERROR',
            },
            { status: 400 }
        );
    }

    // Handle standard Error objects
    if (error instanceof Error) {
        logger.error(`[${requestId}] ${context}`, error);

        return NextResponse.json(
            {
                error: 'An unexpected error occurred',
                requestId,
                code: 'INTERNAL_ERROR',
            },
            { status: 500 }
        );
    }

    // Handle unknown errors
    logger.error(`[${requestId}] ${context} - Unknown error`, error);

    return NextResponse.json(
        {
            error: 'An unexpected error occurred',
            requestId,
            code: 'UNKNOWN_ERROR',
        },
        { status: 500 }
    );
}

/**
 * Safely parse JSON request body with error handling
 */
export async function safeParseJson(request: Request): Promise<unknown | NextResponse> {
    try {
        return await request.json();
    } catch (error) {
        logger.error('Failed to parse JSON body', error);
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
}
