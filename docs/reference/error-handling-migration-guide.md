# ERR-STD-04: Error Handling Migration Guide

## Overview

This guide documents the standardized error handling pattern introduced in this codebase. It covers the AppError hierarchy, migration steps from legacy error handling, and best practices for consistent error management across API routes and GraphQL resolvers.

## Error Class Reference Table

| Class               | HTTP Status | Error Code         | Use Case                              |
| ------------------- | ----------- | ------------------ | ------------------------------------- |
| `AppError`          | -           | -                  | Base class for all application errors |
| `ValidationError`   | 400         | `VALIDATION_ERROR` | Input validation failures             |
| `UnauthorizedError` | 401         | `UNAUTHORIZED`     | Missing/invalid authentication        |
| `ForbiddenError`    | 403         | `FORBIDDEN`        | Insufficient permissions              |
| `NotFoundError`     | 404         | `NOT_FOUND`        | Resource not found                    |
| `ConflictError`     | 409         | `CONFLICT`         | Duplicate resources or invalid state  |
| `RateLimitError`    | 429         | `RATE_LIMITED`     | Rate limit exceeded                   |
| `InternalError`     | 500         | `INTERNAL_ERROR`   | Unexpected failures                   |

### Constructor Signatures

```typescript
// Base AppError
new AppError(code: ErrorCode, message: string, statusCode?: number, details?: unknown)

// ValidationError
new ValidationError(message: string, details?: unknown)

// UnauthorizedError
new UnauthorizedError(message?: string)

// ForbiddenError
new ForbiddenError(message?: string)

// NotFoundError
new NotFoundError(resource: string, identifier?: string)

// ConflictError
new ConflictError(message: string, details?: unknown)

// RateLimitError
new RateLimitError(message?: string, retryAfter?: number)

// InternalError
new InternalError(message?: string, details?: unknown)
```

## 1. AppError Hierarchy and Usage

### When to Use Each Error Type

| Error Type          | When to Use                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `ValidationError`   | User input fails validation (malformed email, missing required field, data type mismatch) |
| `UnauthorizedError` | User is not authenticated or session/token is invalid                                     |
| `ForbiddenError`    | User is authenticated but lacks permission for the action                                 |
| `NotFoundError`     | Requested resource does not exist                                                         |
| `ConflictError`     | Resource already exists or state conflict (duplicate email, foreign key violation)        |
| `RateLimitError`    | Rate limiting threshold exceeded                                                          |
| `InternalError`     | Unexpected system failures, database connection issues                                    |

### Example: Throwing AppErrors

```typescript
import { NotFoundError, ValidationError, UnauthorizedError, forbidden } from '@/lib/api/errors';

// In a service function
if (!user) {
    throw new UnauthorizedError('Session expired');
}

if (!order) {
    throw new NotFoundError('Order', orderId);
}

if (order.status !== 'open') {
    throw new ConflictError('Cannot modify a closed order');
}

if (!hasPermission(user, 'update', order)) {
    throw forbidden('update', 'order');
}

if (!isValidEmail(email)) {
    throw new ValidationError('Invalid email format', { field: 'email' });
}
```

## 2. Converting Existing Error Handling

### Before: Legacy Pattern (mixed approaches)

```typescript
// ❌ Legacy: Inconsistent error handling with status codes scattered
export async function GET(request: NextRequest) {
    try {
        const user = await getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const order = await getOrder(id);
        if (!order) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const data = await someOperation();
        return NextResponse.json({ data });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
```

### After: Standardized Pattern

```typescript
// ✅ Standardized: Throw AppErrors, catch at route level
import { handleApiError } from '@/lib/api/response';
import { notFound, UnauthorizedError } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
    try {
        const user = await getUser();
        if (!user) {
            throw new UnauthorizedError('Session expired');
        }

        const order = await getOrder(id);
        if (!order) {
            throw notFound('Order', id);
        }

        const data = await someOperation();
        return apiSuccess(data);
    } catch (error) {
        return handleApiError(error);
    }
}
```

### Migration Steps

1. **Identify error handling patterns** in your file:
    - Look for `NextResponse.json({ error: ... }, { status: ... })` calls
    - Find `try/catch` blocks that re-throw or convert errors

2. **Replace inline error responses** with `throw new AppError(...)`:

    ```typescript
    // Before
    if (!resource) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // After
    if (!resource) {
        throw notFound('Resource', id);
    }
    ```

3. **Use `handleApiError` in the catch block**:

    ```typescript
    } catch (error) {
      return handleApiError(error);
    }
    ```

4. **Replace success responses** with `apiSuccess`:

    ```typescript
    // Before
    return NextResponse.json({ data: result });

    // After
    return apiSuccess(result);
    ```

## 3. Using handleApiError in API Routes

### Basic Usage

```typescript
import { handleApiError, apiSuccess } from '@/lib/api/response';
import { notFound, validationError } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            throw validationError('ID parameter is required');
        }

        const item = await getItemById(id);
        if (!item) {
            throw notFound('Item', id);
        }

        return apiSuccess(item);
    } catch (error) {
        return handleApiError(error);
    }
}
```

### With Context for Logging

```typescript
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const result = await createItem(body);
        return apiSuccess(result, 201);
    } catch (error) {
        return handleApiError(error, {
            operation: 'createItem',
            userId: user?.id,
            restaurantId: user?.restaurantId,
        });
    }
}
```

### Error Response Format

All errors return a standardized format:

```json
{
    "error": {
        "code": "NOT_FOUND",
        "message": "Order not found: 123",
        "requestId": "550e8400-e29b-41d4-a716-446655440000",
        "details": {
            "field": "email",
            "reasons": ["required", "invalid format"]
        }
    }
}
```

## 4. Using toGraphQLError in GraphQL Resolvers

### Basic Resolver Pattern

```typescript
import {
    toGraphQLError,
    loleGraphQLError,
    createErrorResult,
    handleResolverError,
} from '@/lib/graphql/errors';
import { NotFoundError, UnauthorizedError } from '@/lib/api/errors';

const resolvers = {
    Query: {
        async order(_, { id }, ctx) {
            if (!ctx.user) {
                throw new UnauthorizedError('Authentication required');
            }

            const order = await getOrder(id);
            if (!order) {
                throw new NotFoundError('Order', id);
            }

            return order;
        },
    },

    Mutation: {
        async updateOrder(_, { input }, ctx) {
            try {
                // Business logic that may throw AppError
                return await updateOrder(input);
            } catch (error) {
                // Returns ErrorResult { success: false, error: { code, message } }
                return handleResolverError(error);
            }
        },
    },
};
```

### Converting AppError to GraphQL

```typescript
import { toGraphQLError, loleGraphQLError } from '@/lib/graphql/errors';
import { ValidationError } from '@/lib/api/errors';

try {
    await processOrder(orderData);
} catch (error) {
    // Convert AppError to loleGraphQLError
    if (isAppError(error)) {
        throw toGraphQLError(error);
    }
    // Or throw custom GraphQL error
    throw new loleGraphQLError('Processing failed', 'INTERNAL_ERROR', { orderId: orderData.id });
}
```

### Error Code Mapping

| AppError Code                | GraphQL Error Code           |
| ---------------------------- | ---------------------------- |
| `VALIDATION_ERROR`           | `VALIDATION_ERROR`           |
| `UNAUTHORIZED`               | `UNAUTHORIZED`               |
| `FORBIDDEN`                  | `FORBIDDEN`                  |
| `NOT_FOUND`                  | `NOT_FOUND`                  |
| `TENANT_ISOLATION_VIOLATION` | `TENANT_ISOLATION_VIOLATION` |
| `RATE_LIMITED`               | `BAD_USER_INPUT`             |

## 5. Before/After Code Patterns

### Pattern 1: Resource Not Found

```typescript
// ❌ Before
if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
}

// ✅ After
if (!order) {
    throw notFound('Order', orderId);
}
```

### Pattern 2: Validation Error

```typescript
// ❌ Before
if (!email || !email.includes('@')) {
    return apiError('Invalid email', 400, 'INVALID_EMAIL');
}

// ✅ After
if (!email || !email.includes('@')) {
    throw validationError('Invalid email format', { field: 'email' });
}
```

### Pattern 3: Authentication Check

```typescript
// ❌ Before
const {
    data: { user },
} = await supabase.auth.getUser();
if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// ✅ After
const {
    data: { user },
} = await supabase.auth.getUser();
if (!user) {
    throw new UnauthorizedError('Authentication required');
}
```

### Pattern 4: Permission/Authorization

```typescript
// ❌ Before
if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
}

// ✅ After
if (user.role !== 'admin') {
    throw forbidden('access', 'admin resource');
}
```

### Pattern 5: Zod Validation in API Route

```typescript
// ❌ Before
const parsed = schema.safeParse(body);
if (!parsed.success) {
    return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
    );
}

// ✅ After
const parsed = schema.safeParse(body);
if (!parsed.success) {
    throw validationErrorFromZod(parsed.error);
}
```

## 6. Testing Strategies for Error Handling

### Unit Testing AppErrors

```typescript
import { describe, it, expect } from 'vitest';
import { NotFoundError, ValidationError, forbidden } from '@/lib/api/errors';

describe('NotFoundError', () => {
    it('should create with resource name only', () => {
        const error = new NotFoundError('Order');

        expect(error.code).toBe('NOT_FOUND');
        expect(error.statusCode).toBe(404);
        expect(error.message).toBe('Order not found');
    });

    it('should create with identifier', () => {
        const error = new NotFoundError('Order', '123');

        expect(error.message).toBe('Order not found: 123');
    });
});

describe('forbidden', () => {
    it('should create ForbiddenError with action and resource', () => {
        const error = forbidden('delete', 'order');

        expect(error).toBeInstanceOf(ForbiddenError);
        expect(error.message).toBe('You do not have permission to delete this order');
    });
});
```

### Testing API Routes

```typescript
import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/orders/route';
import { notFound } from '@/lib/api/errors';

describe('GET /api/orders', () => {
    it('should return 404 when order not found', async () => {
        const request = new Request('http://localhost/api/orders?id=123');

        const response = await GET(request);

        expect(response.status).toBe(404);
        const body = await response.json();
        expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for validation error', async () => {
        const request = new Request('http://localhost/api/orders');

        const response = await GET(request);

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });
});
```

### Testing GraphQL Resolvers

```typescript
import { describe, it, expect } from 'vitest';
import { handleResolverError, toGraphQLError } from '@/lib/graphql/errors';
import { NotFoundError } from '@/lib/api/errors';

describe('handleResolverError', () => {
    it('should handle AppError', () => {
        const error = new NotFoundError('Order', '123');
        const result = handleResolverError(error);

        expect(result.success).toBe(false);
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toBe('Order not found: 123');
    });
});

describe('toGraphQLError', () => {
    it('should convert AppError to loleGraphQLError', () => {
        const error = new ValidationError('Invalid input');
        const graphqlError = toGraphQLError(error);

        expect(graphqlError.code).toBe('VALIDATION_ERROR');
        expect(graphqlError.message).toBe('Invalid input');
    });
});
```

## Best Practices

### 1. Error Messages

- Use user-friendly messages for `userMessage` (shown to clients)
- Include technical details in `details` when helpful for debugging
- Never expose sensitive information (stack traces, internal IDs, database errors)

### 2. Error Codes

- Use consistent codes across the codebase
- Map error codes to UI actions where possible
- Include request ID in every error response for tracing

### 3. Logging

- Log full error details server-side including stack traces
- Sanitize error messages before sending to clients
- Include context (userId, restaurantId) in logs

### 4. Type Guards

Use type guards for conditional error handling:

```typescript
import { isNotFoundError, isValidationError } from '@/lib/api/errors';

try {
    await operation();
} catch (error) {
    if (isNotFoundError(error)) {
        // Handle 404 specifically
    }
    if (isValidationError(error)) {
        // Handle validation errors with details
        console.log(error.details);
    }
    throw error; // Re-throw if not handled
}
```

### 5. Factory Functions

Prefer factory functions for common errors:

```typescript
// Instead of new NotFoundError()
throw notFound('Order', orderId);

// Instead of new ValidationError()
throw validationError('Invalid email', { field: 'email' });

// Instead of new ForbiddenError()
throw forbidden('delete', 'order');

// Instead of new ConflictError()
throw conflict('Order', orderId);

// Instead of new RateLimitError()
throw rateLimited(30); // retry after 30 seconds
```

## Migration Checklist

- [ ] Identify all API routes that need migration
- [ ] Replace inline error responses with `throw AppError`
- [ ] Add `handleApiError` in catch blocks
- [ ] Replace success responses with `apiSuccess`
- [ ] Update GraphQL resolvers to use `handleResolverError` or `toGraphQLError`
- [ ] Add unit tests for error scenarios
- [ ] Verify error response format is consistent
- [ ] Remove any legacy error handling utilities
