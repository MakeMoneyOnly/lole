import { NextResponse } from 'next/server';
import { AppError as NewAppError } from './api/errors';
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
 * Uses the newer AppError from @/lib/api/errors when available,
 * falls back to legacy AppError from @/lib/errors for backward compatibility.
 */
export function handleApiError(error: unknown, context: string): NextResponse {
    const requestId = generateRequestId();

    // Handle newer AppError from @/lib/api/errors
    if (error instanceof NewAppError) {
        logger.error(`[${requestId}] ${context}`, error, {
            statusCode: error.statusCode,
            code: error.code,
            details: error.details,
        });

        return NextResponse.json(
            {
                error: error.message,
                requestId,
                code: error.code,
                ...(error.details !== undefined && { details: error.details }),
            },
            { status: error.statusCode }
        );
    }

    // Handle legacy AppError from @/lib/errors for backward compatibility
    if (error instanceof Error && 'userMessage' in error && 'statusCode' in error) {
        const legacyError = error as unknown as {
            statusCode: number;
            userMessage: string;
            internalMessage?: string;
            code?: string;
        };

        logger.error(`[${requestId}] ${context}`, error, {
            statusCode: legacyError.statusCode,
            userMessage: legacyError.userMessage,
            internalMessage: legacyError.internalMessage,
            code: legacyError.code,
        });

        return NextResponse.json(
            {
                error: legacyError.userMessage,
                requestId,
                code: legacyError.code,
            },
            { status: legacyError.statusCode }
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
