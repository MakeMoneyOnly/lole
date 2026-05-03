import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
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
