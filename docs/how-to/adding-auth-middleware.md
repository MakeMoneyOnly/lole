# Adding Auth Middleware

**Version 1.0 · May 2026 · How-to Guide**

## Overview

This guide covers adding authentication middleware using Supabase SSR patterns with `createServerClient`. The middleware handles session refresh, protected routes, and security headers.

## Prerequisites

- Supabase project configured with `@supabase/ssr` package installed
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Patterns

### 1. Core Middleware Structure

Create `src/middleware.ts` at project root:

```typescript
import { updateSession } from '@/lib/supabase/middleware';
import { rateLimitMiddleware } from '@/lib/rate-limit';
import type { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest): Promise<NextResponse> {
    // Apply global rate limiting to API mutation endpoints
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
```

### 2. Supabase Server Client Factory

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

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

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;
    const protectedPrefixes = ['/app', '/merchant', '/kds', '/staff', '/pos'];
    const isProtectedPath = protectedPrefixes.some(prefix => pathname.startsWith(prefix));

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

    return supabaseResponse;
}
```

### 3. Session Timeout Enforcement (Optional Security Enhancement)

Add session timeout checks in the middleware:

```typescript
// Inside updateSession after getting user
if (user && isProtectedPath) {
    const now = Date.now();
    const sessionTimeoutMinutes = Math.max(
        5,
        Math.min(480, parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30', 10))
    );

    const sessionStartCookie = request.cookies.get('geb_session_start');
    const lastActiveCookie = request.cookies.get('geb_last_active');

    let shouldTimeout = false;

    if (sessionStartCookie) {
        const sessionStart = parseInt(sessionStartCookie.value, 10);
        if (!isNaN(sessionStart)) {
            const sessionAgeHours = (now - sessionStart) / (60 * 60 * 1000);
            if (sessionAgeHours > 8) {
                // max session lifetime
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
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('reason', 'session_expired');
        return NextResponse.redirect(url);
    }

    // Update activity timestamp
    supabaseResponse.cookies.set('geb_last_active', now.toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    });
}
```

## Rate Limiting Integration

The `rateLimitMiddleware` applies security headers and rate limiting to API mutation endpoints:

```typescript
// src/lib/rate-limit.ts
import type { NextRequest, NextResponse } from 'next/server';

export async function rateLimitMiddleware(request: NextRequest): Promise<NextResponse | null> {
    const { method } = request;
    const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

    if (!mutationMethods.includes(method)) {
        return null; // Only rate limit mutations
    }

    // Check rate limit (implementation depends on your storage)
    // Returns null if allowed, NextResponse with 429 if rate limited
    return null;
}
```

## Testing

1. Visit a protected route without auth - should redirect to `/login`
2. Sign in and revisit - should allow access
3. Check session timeout enforcement with expired sessions
4. Verify rate limiting on API mutation endpoints
