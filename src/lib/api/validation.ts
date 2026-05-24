import { z } from 'zod';
import { apiError } from '@/lib/api/response';

export async function parseJsonBody<T>(
    request: Request,
    schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: ReturnType<typeof apiError> }> {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return {
            success: false,
            response: apiError('Invalid JSON body', 400, 'INVALID_JSON'),
        };
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return {
            success: false,
            response: apiError(
                'Invalid request payload',
                400,
                'INVALID_PAYLOAD',
                parsed.error.flatten()
            ),
        };
    }

    return { success: true, data: parsed.data };
}

export function parseQuery<T>(
    query: Record<string, unknown>,
    schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; response: ReturnType<typeof apiError> } {
    const parsed = schema.safeParse(query);
    if (!parsed.success) {
        return {
            success: false,
            response: apiError(
                'Invalid query params',
                400,
                'INVALID_QUERY',
                parsed.error.flatten()
            ),
        };
    }

    return { success: true, data: parsed.data };
}
