# Adding Auth Middleware

**Version 1.0 · May 2026 · How-to Guide**

## Overview

This guide covers adding authentication middleware to protect API routes.

## Steps

### 1. Create Middleware File

Create `middleware.ts` at project root:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
    const token = request.headers.get('authorization')?.split(' ')[1];

    if (!token && request.nextUrl.pathname.startsWith('/api/protected')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.next();
}
```

### 2. Configure Matcher

```typescript
export const config = {
    matcher: ['/api/protected/:path*'],
};
```

### 3. Add Role-Based Access

```typescript
import { getUserRole } from '@/lib/auth';

export async function middleware(request: NextRequest) {
    const role = await getUserRole(token);

    if (request.nextUrl.pathname.startsWith('/api/admin') && role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
}
```
