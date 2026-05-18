import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
    isE2EBypassAllowed,
    isValidE2EBypassSecret,
    logE2ESecurityEvent,
} from '@/lib/security/e2e-validation';
import { logger } from '@/lib/logger';

const log = logger.child('middleware');

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    // =========================================================
    // CRIT-003: Secure E2E Test Bypass
    // =========================================================
    // E2E test bypass: allows Playwright specs to exercise protected routes with mocked APIs.
    //
    // Security requirements for E2E bypass (ALL must be true):
    // 1. NODE_ENV must NOT be 'production' (prevents bypass in real deployments)
    // 2. E2E_TEST_MODE must be 'true' (explicit opt-in)
    // 3. E2E_BYPASS_SECRET must be configured and match the request
    //
    // The bypass can be activated via:
    // - Headers: x-e2e-bypass-auth=1 and x-e2e-bypass-secret={secret}
    // - Cookie: sb-access-token=e2e-mock-access-token:{secret}
    // =========================================================

    // SECURITY: Check if E2E bypass is allowed in current environment
    // This is the FIRST check - if not allowed, skip all bypass logic
    if (!isE2EBypassAllowed()) {
        // In production, log any bypass attempts for security monitoring
        const e2eBypassAuth = request.headers.get('x-e2e-bypass-auth');
        const e2eBypassSecret = request.headers.get('x-e2e-bypass-secret');
        const cookieToken = request.cookies.get('sb-access-token')?.value;

        if (e2eBypassAuth === '1' || e2eBypassSecret || cookieToken?.startsWith('e2e-mock-')) {
            logE2ESecurityEvent('bypass_attempt', {
                source: 'middleware',
                hasHeaderAuth: !!e2eBypassAuth,
                hasHeaderSecret: !!e2eBypassSecret,
                hasCookieToken: !!cookieToken,
                path: request.nextUrl.pathname,
            });
        }
        // Continue to normal auth flow - E2E bypass is NOT available
    } else {
        // E2E bypass is allowed in this environment (non-production with E2E_TEST_MODE=true)
        const e2eBypassAuth = request.headers.get('x-e2e-bypass-auth');
        const e2eBypassSecret = request.headers.get('x-e2e-bypass-secret');
        const configuredSecret = process.env.E2E_BYPASS_SECRET;

        // SECURITY: Require configured secret - NO default fallback
        if (!configuredSecret || configuredSecret === '') {
            logE2ESecurityEvent('config_warning', {
                source: 'middleware',
                reason: 'E2E_BYPASS_SECRET not configured',
            });
            // Continue to normal auth flow
        } else {
            // Check for secure E2E cookie token
            const cookieToken = request.cookies.get('sb-access-token')?.value;
            const expectedCookieToken = `e2e-mock-access-token:${configuredSecret}`;
            const hasValidE2ECookie =
                cookieToken !== undefined && cookieToken === expectedCookieToken;

            // Check for valid header-based bypass with timing-safe comparison
            const hasValidHeaderBypass =
                e2eBypassAuth === '1' && isValidE2EBypassSecret(e2eBypassSecret ?? undefined);

            // E2E bypass is active when request has valid cookie OR header bypass credentials
            const isE2EBypassActive = hasValidE2ECookie || hasValidHeaderBypass;

            if (isE2EBypassActive) {
                logE2ESecurityEvent('bypass_success', {
                    source: 'middleware',
                    method: hasValidHeaderBypass ? 'header' : 'cookie',
                    path: request.nextUrl.pathname,
                });

                // Set secure mock auth cookies for E2E tests (refresh on each request)
                // Token includes the secret for validation on subsequent requests
                supabaseResponse.cookies.set(
                    'sb-access-token',
                    `e2e-mock-access-token:${configuredSecret}`,
                    {
                        httpOnly: true,
                        path: '/',
                        sameSite: 'lax',
                        maxAge: 3600,
                    }
                );
                supabaseResponse.cookies.set('sb-refresh-token', 'e2e-mock-refresh-token', {
                    httpOnly: true,
                    path: '/',
                    sameSite: 'lax',
                    maxAge: 86400,
                });
                return supabaseResponse;
            }
        }
    }

    // Get and clean environment variables
    // Vercel can store values with extra quotes and \r\n when set via CLI/API
    const cleanEnvVar = (val: string | undefined): string => {
        if (!val) return '';
        return val
            .replace(/\r/g, '')
            .replace(/\n/g, '')
            .replace(/^["']+/, '')
            .replace(/["']+$/, '')
            .trim();
    };

    const supabaseUrl = cleanEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseKey = cleanEnvVar(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

    // Check for placeholder values (used in E2E/testing scenarios)
    const isPlaceholderUrl = supabaseUrl?.includes('placeholder') || !supabaseUrl;
    const isPlaceholderKey = supabaseKey === 'placeholder-key' || !supabaseKey;
    const hasRealCredentials = !isPlaceholderUrl && !isPlaceholderKey;

    // If no real credentials, we can't initialize Supabase - but still need to
    // pass cookies through for subsequent requests that might have valid session
    if (!hasRealCredentials) {
        log.warn('Supabase credentials not available - passing through request without auth');
        // Pass cookies through without Supabase auth check
        return supabaseResponse;
    }

    // Validate URL format before passing to Supabase
    try {
        new URL(supabaseUrl);
    } catch {
        log.error('Invalid SUPABASE_URL format', undefined, { url: supabaseUrl });
        return supabaseResponse;
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                supabaseResponse = NextResponse.next({
                    request,
                });
                cookiesToSet.forEach(({ name, value, options }) =>
                    supabaseResponse.cookies.set(name, value, options)
                );
            },
        },
    });

    // IMPORTANT: Do not run code between createServerClient and supabase.auth.getUser()
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;
    const protectedPrefixes = ['/app', '/merchant', '/kds', '/staff', '/pos'];
    const isProtectedPath = protectedPrefixes.some(prefix => pathname.startsWith(prefix));

    // SEC-006: Session timeout enforcement
    // Checks idle timeout (SESSION_TIMEOUT_MINUTES) and max session lifetime
    // (SESSION_MAX_LIFETIME_HOURS). Expired sessions clear all auth cookies
    // and redirect to login.
    if (user && isProtectedPath) {
        const now = Date.now();
        const sessionTimeoutMinutes = Math.max(
            5,
            Math.min(480, parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30', 10))
        );
        const maxLifetimeHours = Math.max(
            1,
            Math.min(24, parseInt(process.env.SESSION_MAX_LIFETIME_HOURS || '8', 10))
        );

        const sessionStartCookie = request.cookies.get('geb_session_start');
        const lastActiveCookie = request.cookies.get('geb_last_active');

        let shouldTimeout = false;

        if (sessionStartCookie) {
            const sessionStart = parseInt(sessionStartCookie.value, 10);
            if (!isNaN(sessionStart)) {
                const sessionAgeHours = (now - sessionStart) / (60 * 60 * 1000);
                if (sessionAgeHours > maxLifetimeHours) {
                    shouldTimeout = true;
                }
            }
        }

        if (!shouldTimeout && lastActiveCookie) {
            const lastActive = parseInt(lastActiveCookie.value, 10);
            if (!isNaN(lastActive)) {
                const idleMinutes = (now - lastActive) / (60 * 1000);
                if (idleMinutes > sessionTimeoutMinutes) {
                    shouldTimeout = true;
                }
            }
        }

        if (shouldTimeout) {
            supabaseResponse.cookies.delete('sb-access-token');
            supabaseResponse.cookies.delete('sb-refresh-token');
            supabaseResponse.cookies.delete('geb_session_start');
            supabaseResponse.cookies.delete('geb_last_active');
            supabaseResponse.cookies.delete('geb_device_token');
            supabaseResponse.cookies.delete('geb_device_token_metadata');
            supabaseResponse.cookies.delete('geb_device_token_signature');

            const url = request.nextUrl.clone();
            url.pathname = '/login';
            url.searchParams.set('reason', 'session_expired');
            return NextResponse.redirect(url);
        }

        supabaseResponse.cookies.set('geb_last_active', now.toString(), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
        });

        if (!sessionStartCookie) {
            supabaseResponse.cookies.set('geb_session_start', now.toString(), {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
            });
        }
    }

    if (
        !user &&
        !pathname.startsWith('/auth') &&
        !pathname.startsWith('/login') &&
        isProtectedPath
    ) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // IMPORTANT: You must return the supabaseResponse object as it is.
    return supabaseResponse;
}
