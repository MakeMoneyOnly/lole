import { NextResponse } from 'next/server';
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/lib/supabase/server';
import { validateForwardedHost } from '@/lib/security/host-validation';

/**
 * Validates redirect path to prevent open redirect attacks (CRIT-002)
 * Only allows relative paths starting with / and validates against allowlist
 */
function validateRedirectPath(path: string): string {
    if (path.startsWith('/') && !path.startsWith('//')) {
        const allowedPrefixes = ['/auth/', '/merchant/', '/kds/', '/app/'];
        if (allowedPrefixes.some(prefix => path.startsWith(prefix))) {
            return path;
        }
    }
    return '/auth/post-login';
}

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    // if "next" is in param, use it as the redirect URL
    // Validate the redirect path to prevent open redirect attacks (CRIT-002)
    const rawNext = searchParams.get('next') ?? '/auth/post-login';
    const next = validateRedirectPath(rawNext);

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            // HIGH-008: Validate x-forwarded-host using centralized validation
            const forwardedHost = request.headers.get('x-forwarded-host');
            const validation = validateForwardedHost(forwardedHost, request);

            // Determine the safe host to use
            if (validation.valid && validation.host) {
                // Use validated forwarded host
                return NextResponse.redirect(`https://${validation.host}${next}`);
            } else {
                // Fall back to origin (uses request's validated host)
                return NextResponse.redirect(`${origin}${next}`);
            }
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
