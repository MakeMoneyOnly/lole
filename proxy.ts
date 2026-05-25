import { updateSession } from '@/lib/supabase/middleware';
import { rateLimitMiddleware } from '@/lib/rate-limit';
import { detectApiVersion, getVersionedHeaders } from '@/lib/api/versioning';
import { tracingMiddleware } from '@/lib/api/tracing';
import { CSPBuilder, generateNonce } from '@/lib/security/nonce';
import type { NextRequest } from 'next/server';

/**
 * Content-Security-Policy configuration for P0 security requirements.
 *
 * HIGH-022: CSP now uses nonce-based approach instead of unsafe-inline
 *
 * CSP Directives:
 * - default-src 'self': Restrict all resources to same origin by default
 * - script-src 'self' 'nonce-xxx' 'strict-dynamic': Allow scripts with valid nonce
 * - style-src 'self' 'nonce-xxx': Allow styles with valid nonce
 * - img-src 'self' data: blob: https: Allow images from same origin, data URLs, blobs, and HTTPS sources
 * - connect-src 'self' https://*.supabase.co wss://*.supabase.co: Allow Supabase connections
 * - font-src 'self' data: https://fonts.gstatic.com: Allow Google Fonts
 * - frame-ancestors 'none': Prevent embedding in frames
 * - base-uri 'self': Restrict base tag to same origin
 * - form-action 'self': Restrict form submissions to same origin
 * - worker-src 'self' blob: Allow web workers for offline support (PWA)
 *
 * Note: unsafe-inline is replaced with nonce-based CSP for better security
 * Scripts and styles must include the nonce attribute to be executed
 */
const buildCSP = (nonce: string, isProduction: boolean): string => {
    const builder = new CSPBuilder(nonce, isProduction);
    return builder.build();
};

export async function proxy(request: NextRequest) {
    // MED-026: Initialize request tracing for distributed tracing
    const { context: traceContext, addHeaders: addTraceHeaders } = tracingMiddleware(request);

    // First, update the Supabase session
    const supabaseResponse = await updateSession(request);

    // Apply rate limiting to mutation endpoints
    const rateLimitResponse = await rateLimitMiddleware(request);
    if (rateLimitResponse) {
        // Rate limit exceeded - return rate limit response with security headers
        const isProduction = process.env.NODE_ENV === 'production';
        // HIGH-022: Generate nonce for CSP
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

        // MED-026: Add trace headers to rate limit response
        rateLimitResponse.headers.set('x-request-id', traceContext.requestId);
        rateLimitResponse.headers.set('x-trace-id', traceContext.traceId);

        // Add API versioning headers for API routes even on rate-limited responses
        if (request.nextUrl.pathname.startsWith('/api/')) {
            const version = detectApiVersion(request);
            const versionHeaders = getVersionedHeaders(version);
            for (const [key, value] of Object.entries(versionHeaders)) {
                rateLimitResponse.headers.set(key, value);
            }
        }

        return rateLimitResponse;
    }

    // Determine if we're in production mode
    const isProduction = process.env.NODE_ENV === 'production';

    // HIGH-022: Generate nonce for CSP (unique per request)
    const nonce = generateNonce();

    // Build CSP header with nonce
    const csp = buildCSP(nonce, isProduction);

    // Add security headers
    supabaseResponse.headers.set('Content-Security-Policy', csp);
    // HIGH-022: Expose nonce via header for Server Components to use
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

    // MED-026: Add trace headers to response
    addTraceHeaders(supabaseResponse);

    // Add API versioning headers for API routes
    const requestPath = request.nextUrl.pathname;
    if (requestPath.startsWith('/api/')) {
        const version = detectApiVersion(request);
        const versionHeaders = getVersionedHeaders(version);

        // Add version headers to all API responses
        for (const [key, value] of Object.entries(versionHeaders)) {
            supabaseResponse.headers.set(key, value);
        }

        // Add Content-Type based on Accept header or default to v1
        const acceptHeader = request.headers.get('accept');
        if (acceptHeader?.includes('application/vnd.lole')) {
            supabaseResponse.headers.set('Content-Type', acceptHeader);
        }
    }

    return supabaseResponse;
}

// Configure which routes the middleware runs on
export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         * - static files
         */
        '/((?!_next/static|_next/image|favicon.ico|public/|.*\\..*).*)',
    ],
};
