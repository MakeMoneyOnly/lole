import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { apiSuccess, apiError } from '@/lib/api/response';

export interface HandlerContext {
    supabase: SupabaseClient<Database>;
    restaurantId: string;
    user: User;
}

export type SuccessData<T> = T;

export async function withStandardResponse<T>(
    handler: (context: HandlerContext) => Promise<T>,
    request: Request
): Promise<Response> {
    const auth = await import('./auth-middleware').then(m => m.requireMerchantAuth(request));

    if (!auth.ok) {
        return auth.response;
    }

    const { supabase, restaurantId, user } = auth;

    try {
        const result = await handler({ supabase, restaurantId, user });
        return apiSuccess(result);
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'handler',
            userId: user.id,
            restaurantId,
        });
    }
}

export function createDeprecationWarning(originalResponse: Response): Response {
    const newResponse = new Response(originalResponse.body, {
        status: originalResponse.status,
        statusText: originalResponse.statusText,
        headers: new Headers(originalResponse.headers),
    });
    newResponse.headers.set(
        'Warning',
        '299 - "This API version is deprecated. See /docs/migration-guide"'
    );
    return newResponse;
}

export function createDeprecationWrapper(
    handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
    return async (request: Request) => {
        const response = await handler(request);
        return createDeprecationWarning(response);
    };
}
