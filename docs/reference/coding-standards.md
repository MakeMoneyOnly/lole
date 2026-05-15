# lole - Coding Standards

**Version:** 1.1.0  
**Last Updated:** May 15, 2026

---

## 1. General Principles

### 1.1 Core Values

- **Readability** - Code is read more than written
- **Consistency** - Follow established patterns
- **Simplicity** - Avoid unnecessary complexity
- **Testability** - Write testable code

### 1.2 SOLID Principles

- **S**ingle Responsibility - One purpose per module
- **O**pen/Closed - Open for extension, closed for modification
- **L**iskov Substitution - Subtypes must be substitutable
- **I**nterface Segregation - Many specific interfaces
- **D**ependency Inversion - Depend on abstractions

---

## 2. TypeScript Standards

### 2.1 Type Safety

```typescript
// ❌ NEVER use any
const data: any = fetchData();

// ✅ Use unknown with type guards
const data: unknown = fetchData();
if (is_valid_data(data)) {
    // data is now typed
}
```

### 2.2 Type Definitions

```typescript
// ✅ Use interface for object types
interface User {
    id: string;
    name: string;
    email: string;
}

// ✅ Use type for unions and intersections
type Status = 'pending' | 'active' | 'completed';
type UserWithRole = User & { role: Role };
```

### 2.3 Return Types

```typescript
// ✅ Always define return types
function calculateTotal(items: OrderItem[]): number {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
```

### 2.4 Const Assertions

```typescript
// ✅ Use const assertions for literal types
const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'served'] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];
```

---

## 3. React Standards

### 3.1 Component Structure

```typescript
// ✅ Function components only
interface OrderCardProps {
  order: Order
  onStatusChange: (id: string, status: OrderStatus) => void
}

export function OrderCard({ order, onStatusChange }: OrderCardProps) {
  // Hooks at the top
  const [isExpanded, setIsExpanded] = useState(false)

  // Memoized values
  const formattedTotal = useMemo(
    () => formatCurrency(order.total),
    [order.total]
  )

  // Event handlers with useCallback
  const handleStatusChange = useCallback(() => {
    onStatusChange(order.id, 'preparing')
  }, [order.id, onStatusChange])

  // Early returns for loading/error
  if (!order) return <OrderCardSkeleton />

  // Render
  return (
    <div className="p-4 border rounded-lg">
      {/* ... */}
    </div>
  )
}
```

### 3.2 Hooks Rules

- Always call hooks at the top level
- Only call hooks from React functions
- Use `useCallback` for handlers passed to children
- Use `useMemo` for expensive computations

### 3.3 Component Organization

```
OrderCard/
├── OrderCard.tsx       # Main component
├── OrderCard.test.tsx  # Tests
├── OrderCardSkeleton.tsx
├── index.ts            # Export
└── types.ts            # Local types
```

---

## 4. Next.js Standards

### 4.1 Server vs Client Components

```typescript
// ✅ Server Component (default)
// src/app/(dashboard)/orders/page.tsx
import { getOrders } from '@/lib/services/orders'

export default async function OrdersPage() {
  const orders = await getOrders()
  return <OrdersList orders={orders} />
}

// ✅ Client Component (when needed)
// src/components/OrdersList.tsx
'use client'

import { useState } from 'react'

export function OrdersList({ orders }: OrdersListProps) {
  const [filter, setFilter] = useState('all')
  // Interactive logic here
}
```

### 4.2 Server Actions

```typescript
// ✅ Server Actions for mutations
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';

const CreateOrderSchema = z.object({
    restaurantId: z.string().uuid(),
    items: z.array(
        z.object({
            menuItemId: z.string().uuid(),
            quantity: z.number().int().positive(),
        })
    ),
});

export async function createOrder(input: unknown) {
    const session = await auth();
    if (!session) {
        return { error: 'UNAUTHORIZED' };
    }

    const validated = CreateOrderSchema.safeParse(input);
    if (!validated.success) {
        return { error: 'VALIDATION_ERROR', details: validated.error.flatten() };
    }

    // Create order logic
    const order = await createOrderInDB(validated.data);

    revalidatePath('/orders');
    return { data: order };
}
```

### 4.3 API Routes

```typescript
// src/app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const log = logger.child('[api/orders]');

// Input validation
const CreateOrderSchema = z.object({
    restaurantId: z.string().uuid(),
    items: z.array(
        z.object({
            menuItemId: z.string().uuid(),
            quantity: z.number().int().positive(),
        })
    ),
});

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Validate input
        const validated = CreateOrderSchema.parse(body);

        // Process
        const order = await createOrder(validated);

        // Return success
        return NextResponse.json({ data: order }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: { code: 'VALIDATION_ERROR', details: error.flatten() } },
                { status: 400 }
            );
        }

        log.error('Create order error', error);
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
            { status: 500 }
        );
    }
}
```

---

## 5. Error Handling

### 5.1 Error Types

```typescript
// src/lib/errors.ts
export class AppError extends Error {
    constructor(
        public code: ErrorCode,
        message: string,
        public statusCode: number = 500,
        public details?: unknown
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export class ValidationError extends AppError {
    constructor(details: unknown) {
        super('VALIDATION_ERROR', 'Invalid input data', 400, details);
    }
}

export class UnauthorizedError extends AppError {
    constructor() {
        super('UNAUTHORIZED', 'Authentication required', 401);
    }
}

export class ForbiddenError extends AppError {
    constructor() {
        super('FORBIDDEN', 'Access denied', 403);
    }
}
```

### 5.2 Error Responses

```typescript
// ✅ Structured error response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid order items",
    "details": {
      "fieldErrors": {
        "items": ["At least one item is required"]
      }
    }
  }
}
```

### 5.3 User-Facing Errors

```typescript
// ✅ User-friendly messages
const ERROR_MESSAGES: Record<ErrorCode, string> = {
    VALIDATION_ERROR: 'Please check your input and try again.',
    UNAUTHORIZED: 'Please log in to continue.',
    FORBIDDEN: 'You do not have permission to perform this action.',
    NOT_FOUND: 'The requested item was not found.',
    INTERNAL_ERROR: 'Something went wrong. Please try again later.',
};
```

---

## 6. Naming Conventions

### 6.1 Files

| Type      | Convention     | Example              |
| --------- | -------------- | -------------------- |
| Component | PascalCase.tsx | `OrderCard.tsx`      |
| Utility   | camelCase.ts   | `formatCurrency.ts`  |
| Hook      | useFeature.ts  | `useCart.ts`         |
| Type      | camelCase.ts   | `models.ts`          |
| API Route | route.ts       | `route.ts`           |
| Test      | \*.test.ts(x)  | `OrderCard.test.tsx` |

### 6.2 Code

| Type      | Convention           | Example                 |
| --------- | -------------------- | ----------------------- |
| Component | PascalCase           | `OrderCard`             |
| Function  | camelCase            | `calculateTotal`        |
| Variable  | camelCase            | `orderCount`            |
| Constant  | SCREAMING_SNAKE_CASE | `MAX_ORDERS_PER_MINUTE` |
| Interface | PascalCase           | `Order`, `User`         |
| Type      | PascalCase           | `OrderStatus`           |
| Enum      | PascalCase           | `OrderStatus`           |

### 6.3 Database

| Type     | Convention              | Example                        |
| -------- | ----------------------- | ------------------------------ |
| Table    | snake_case, plural      | `orders`, `menu_items`         |
| Column   | snake_case              | `restaurant_id`, `created_at`  |
| Index    | `idx_{table}_{columns}` | `idx_orders_restaurant_status` |
| Function | snake_case              | `resolve_user_role()`          |

---

## 6.4 Git Standards

### 6.4.1 Commit Messages

```
type(scope): description

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- style: Formatting (no code change)
- refactor: Code refactoring
- test: Adding tests
- chore: Maintenance tasks

Scopes:
- api: API routes
- kds: Kitchen display system
- guest: Guest ordering
- merchant: Merchant dashboard
- auth: Authentication
- db: Database

Examples:
- feat(kds): add order acknowledgment feature
- fix(api): resolve rate limiting bypass issue
- docs(readme): update installation instructions
```

### 6.4.2 Branch Names

- Feature: `feat/description`
- Fix: `fix/description`
- Release: `release/v1.0.0`
- Hotfix: `hotfix/description`

---

## 6.5 Logging

### Structured Logging

Use the structured logger for all server-side logging:

```typescript
import { logger } from '@/lib/logger';

// Create a child logger with source context
const log = logger.child('[source]');

// Log methods
log.debug('Debug message', { orderId: '123' });
log.info('Operation completed', { duration: 150 });
log.warn('Rate limit approaching', { remaining: 10 });
log.error('Operation failed', error, { orderId: '123', attempt: 2 });
```

### Logging Guidelines

- **Import**: Always `import { logger } from '@/lib/logger'`
- **Child loggers**: Use `const log = logger.child('[source]')` for context
- **Methods**: `log.debug()`, `log.info()`, `log.warn()`, `log.error(message, error, context)`
- **Context**: Include relevant context as the third argument: `log.error('Failed to process', error, { orderId })`

---

## 7. Testing Standards

### 7.1 Unit Tests

```typescript
// OrderCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OrderCard } from './OrderCard'

describe('OrderCard', () => {
  const mockOrder: Order = {
    id: '1',
    status: 'pending',
    items: [],
    total: 100
  }

  it('renders order details correctly', () => {
    render(<OrderCard order={mockOrder} onStatusChange={vi.fn()} />)

    expect(screen.getByText('Order #1')).toBeInTheDocument()
    expect(screen.getByText('100 ETB')).toBeInTheDocument()
  })

  it('calls onStatusChange when button clicked', () => {
    const onStatusChange = vi.fn()
    render(<OrderCard order={mockOrder} onStatusChange={onStatusChange} />)

    fireEvent.click(screen.getByText('Start Preparing'))

    expect(onStatusChange).toHaveBeenCalledWith('1', 'preparing')
  })
})
```

### 7.2 Coverage Requirements

| Metric     | Target |
| ---------- | ------ |
| Lines      | 80%    |
| Functions  | 80%    |
| Statements | 80%    |
| Branches   | 70%    |

---

## 8. Security Checklist

Before merging any code:

- [ ] No hardcoded secrets or API keys
- [ ] Input validation with Zod schemas
- [ ] RLS policies tested for multi-tenancy
- [ ] Rate limiting applied to new endpoints
- [ ] Audit logging added for mutations
- [ ] Error messages don't expose internals
- [ ] Parameterized queries (no SQL injection)
- [ ] CSRF protection for Server Actions
- [ ] HMAC signing for guest sessions

---

**Document Owner:** Engineering Team  
**Review Cycle:** Quarterly  
**Next Review:** May 2026
