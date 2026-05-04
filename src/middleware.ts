import { updateSession } from '@/lib/supabase/middleware';
import { rateLimitMiddleware } from '@/lib/rate-limit';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    // BKND-033: Apply global rate limiting to all API mutation endpoints.
    // rateLimitMiddleware only applies to mutation methods (POST/PATCH/PUT/DELETE).
    // If rate limited, return 429 immediately — don't proceed to auth/session.
    if (request.nextUrl.pathname.startsWith('/api/')) {
        const rateLimitResponse = await rateLimitMiddleware(request);
        if (rateLimitResponse) {
            return rateLimitResponse;
        }
    }

    return await updateSession(request);
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico, manifest.json (static metadata)
         * - @powersync (PowerSync worker assets)
         * - api/webhooks (external webhook calls)
         */
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|@powersync|api/webhooks).*)',
    ],
};
