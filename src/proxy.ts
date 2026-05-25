import { updateSession } from '@/lib/supabase/middleware';
import { proxyRateLimitMiddleware } from '@/lib/proxy-rate-limit';
import { detectApiVersion, getVersionedHeaders } from '@/lib/api/versioning';
import { tracingMiddleware } from '@/lib/api/tracing';
import { CSPBuilder, generateNonce } from '@/lib/security/nonce';
import type { NextRequest } from 'next/server';

const buildCSP = (nonce: string, isProduction: boolean): string => {
    const builder = new CSPBuilder(nonce, isProduction);
    return builder.build();
};

export async function proxy(request: NextRequest) {
    const { context: traceContext, addHeaders: addTraceHeaders } = tracingMiddleware(request);

    const supabaseResponse = await updateSession(request);

    const rateLimitResponse = await proxyRateLimitMiddleware(request);
    if (rateLimitResponse) {
        const isProduction = process.env.NODE_ENV === 'production';
        const nonce = generateNonce();
        const csp = buildCSP(nonce, isProduction);

        rateLimitResponse.headers.set('Content-Security-Policy', csp);
        rateLimitResponse.headers.set('X-Content-Type-Options', 'nosniff');
        rateLimitResponse.headers.set('X-Frame-Options', 'DENY');
        rateLimitResponse.headers.set('X-XSS-Protection', '1; mode=block');
        rateLimitResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        rateLimitResponse.headers.set('X-DNS-Prefetch-Control', 'on');
        rateLimitResponse.headers.set(
            'Strict-Transport-Security',
            'max-age=63072000; includeSubDomains; preload'
        );
        rateLimitResponse.headers.set('x-request-id', traceContext.requestId);
        rateLimitResponse.headers.set('x-trace-id', traceContext.traceId);

        if (request.nextUrl.pathname.startsWith('/api/')) {
            const version = detectApiVersion(request);
            const versionHeaders = getVersionedHeaders(version);
            for (const [key, value] of Object.entries(versionHeaders)) {
                rateLimitResponse.headers.set(key, value);
            }
        }

        return rateLimitResponse;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const nonce = generateNonce();
    const csp = buildCSP(nonce, isProduction);

    supabaseResponse.headers.set('Content-Security-Policy', csp);
    supabaseResponse.headers.set('x-csp-nonce', nonce);
    supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
    supabaseResponse.headers.set('X-Frame-Options', 'DENY');
    supabaseResponse.headers.set('X-XSS-Protection', '1; mode=block');
    supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    supabaseResponse.headers.set(
        'Permissions-Policy',
        'accelerometer=(), camera=(), microphone=(), geolocation=()'
    );
    supabaseResponse.headers.set('X-DNS-Prefetch-Control', 'on');
    supabaseResponse.headers.set(
        'Strict-Transport-Security',
        'max-age=63072000; includeSubDomains; preload'
    );

    addTraceHeaders(supabaseResponse);

    const requestPath = request.nextUrl.pathname;
    if (requestPath.startsWith('/api/')) {
        const version = detectApiVersion(request);
        const versionHeaders = getVersionedHeaders(version);

        for (const [key, value] of Object.entries(versionHeaders)) {
            supabaseResponse.headers.set(key, value);
        }

        const acceptHeader = request.headers.get('accept');
        if (acceptHeader?.includes('application/vnd.lole')) {
            supabaseResponse.headers.set('Content-Type', acceptHeader);
        }
    }

    return supabaseResponse;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|public/|.*\\..*).*)'],
};
