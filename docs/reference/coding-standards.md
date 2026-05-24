# lole - Coding Standards

**Version:** 1.3.0  
**Last Updated:** 2026-05-23

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

## 3. Feature-Slice Architecture

### 3.1 Feature-First Placement

Organize code by feature first, then by layer. This colocates related functionality and reduces cognitive load when navigating the codebase.

```typescript
// ❌ By type (traditional layers)
src/
  components/
  services/
  hooks/
  utils/

// ✅ By feature (feature-slice)
src/
  features/
    orders/
    menu/
    tables/
    staff/
```

### 3.2 Directory Structure Conventions

```
features/[feature]/
├── api/           # API route handlers
├── services/      # Feature orchestration logic
├── domain/        # Re-exports from src/domains/
├── contracts/     # Zod schemas for validation
├── events/        # Event types and handlers
├── hooks/         # React hooks
└── tests/         # Feature tests
```

#### Layer Responsibilities

- **api/** - API route handlers following Next.js App Router conventions
- **services/** - Business logic orchestration, feature-specific operations
- **domain/** - Re-exports shared domain types (see Cross-Feature Communication)
- **contracts/** - Zod schemas for input validation and type inference
- **events/** - Domain events and event handlers for inter-feature communication
- **hooks/** - React hooks for feature UI state and data fetching
- **tests/** - Unit and integration tests specific to the feature

### 3.3 Shared Layer Usage

The `src/domains/` layer contains shared types and business rules:

- Types used across multiple features
- Core domain logic not owned by a single feature
- Utilities and helpers used by multiple features

Features should import from `domains/` for shared concerns, not from other features.

### 3.4 Cross-Feature Dependencies

```typescript
// ❌ Direct feature import (creates tight coupling)
import { useOrders } from '@/features/orders';

// ✅ Use shared types from domains layer
import type { OrderSummary } from '@/domains/orders/types';

// ✅ Use event-based communication for cross-feature actions
import { publishEvent } from '@/lib/events';
```

#### Dependency Rules

1. Features can import from:
    - `src/domains/*` for shared types
    - `src/shared/*` for utilities
    - `src/lib/*` for infrastructure

2. Features should NOT import from:
    - Other feature directories (breaks encapsulation)
    - Direct feature hooks in non-related code

3. Use dependency injection for shared services:

```typescript
// ✅ Inject shared dependencies
const orderService = createOrderService(supabaseClient, eventBus);

// Pass to feature services
const useOrders = createUseOrders(orderService);
```

### 3.5 Creating New Features

#### Directory Creation

```bash
# Create feature directory structure
mkdir -p src/features/{feature}/{api,services,domain,contracts,events,hooks,tests}
```

#### Barrel Exports Pattern

Each feature directory should have an `index.ts` that exports the public API:

```typescript
// features/orders/index.ts
export { OrderCard } from './components/OrderCard';
export { useOrders } from './hooks/useOrders';
export { getOrders } from './services/orderService';
export { OrderSchema } from './contracts/schemas';
export type { Order, OrderStatus } from './domain/types';
```

#### Integration with Domains Layer

1. Define core types in `src/domains/[domain]/types.ts`
2. Re-export from feature's `domain/` directory
3. Features consume domain types through the domains layer

```typescript
// src/domains/orders/types.ts (shared)
export interface Order {
    id: string;
    status: OrderStatus;
    items: OrderItem[];
}

// features/orders/domain/types.ts (re-export)
export type { Order, OrderStatus } from '@/domains/orders/types';
```

---

## 4. React Standards

### 4.1 Component Structure

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

### 4.2 Hooks Rules

- Always call hooks at the top level
- Only call hooks from React functions
- Use `useCallback` for handlers passed to children
- Use `useMemo` for expensive computations

### 4.3 Component Organization

```
OrderCard/
├── OrderCard.tsx       # Main component
├── OrderCard.test.tsx  # Tests
├── OrderCardSkeleton.tsx
├── index.ts            # Export
└── types.ts            # Local types
```

---

## 5. Next.js Standards

### 5.1 Server vs Client Components

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

### 5.2 Server Actions

```typescript
// ✅ Server Actions for mutations
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

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
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: 'UNAUTHORIZED' };
    }

    // Zod v4: Use parseAsync for async contexts (handles async refinements)
    try {
        const validated = await CreateOrderSchema.parseAsync(input);
        // Create order logic with user context
        const order = await createOrderInDB(validated, user.id);

        revalidatePath('/orders');
        return { data: order };
    } catch (error) {
        if (error instanceof z.ZodError) {
            // .flatten() still works for structured error output
            return { error: 'VALIDATION_ERROR', details: error.flatten() };
        }
        return { error: 'INTERNAL_ERROR' };
    }
}
```

### 5.3 API Routes

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

        // Zod v4: Use parseAsync in async contexts (recommended)
        // Note: .email() is stricter by default in v4 (RFC 5322 compliant)
        const validated = await CreateOrderSchema.parseAsync(body);

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

### 5.4 Zod v4 Best Practices

```typescript
// ✅ Use parseAsync() for async contexts
// Handles async refinements, transforms, and provides better error behavior
const validated = await Schema.parseAsync(data);

// ✅ .email() requires RFC 5322 compliant emails by default
const EmailSchema = z.object({
    email: z.email(), // Stricter validation in v4
});

// ✅ safeParse still works, but parseAsync is preferred for async code
const result = Schema.safeParse(data); // Still valid for sync contexts
const asyncResult = await Schema.parseAsync(data); // Preferred for async

// ✅ Error handling with z.ZodError and .flatten()
try {
    await Schema.parseAsync(data);
} catch (error) {
    if (error instanceof z.ZodError) {
        const { fieldErrors } = error.flatten();
        // Use structured errors in response
    }
}
```

---

## 6. Error Handling

### 6.1 Error Types

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

### 6.2 Error Responses

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

### 6.3 User-Facing Errors

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

## 7. Naming Conventions

### 7.1 Files

| Type      | Convention     | Example              |
| --------- | -------------- | -------------------- |
| Component | PascalCase.tsx | `OrderCard.tsx`      |
| Utility   | camelCase.ts   | `formatCurrency.ts`  |
| Hook      | useFeature.ts  | `useCart.ts`         |
| Type      | camelCase.ts   | `models.ts`          |
| API Route | route.ts       | `route.ts`           |
| Test      | \*.test.ts(x)  | `OrderCard.test.tsx` |

### 7.2 Code

| Type      | Convention           | Example                 |
| --------- | -------------------- | ----------------------- |
| Component | PascalCase           | `OrderCard`             |
| Function  | camelCase            | `calculateTotal`        |
| Variable  | camelCase            | `orderCount`            |
| Constant  | SCREAMING_SNAKE_CASE | `MAX_ORDERS_PER_MINUTE` |
| Interface | PascalCase           | `Order`, `User`         |
| Type      | PascalCase           | `OrderStatus`           |
| Enum      | PascalCase           | `OrderStatus`           |

### 7.3 Database

| Type     | Convention              | Example                        |
| -------- | ----------------------- | ------------------------------ |
| Table    | snake_case, plural      | `orders`, `menu_items`         |
| Column   | snake_case              | `restaurant_id`, `created_at`  |
| Index    | `idx_{table}_{columns}` | `idx_orders_restaurant_status` |
| Function | snake_case              | `resolve_user_role()`          |

---

## 8. Git Standards

### 8.1 Commit Messages

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

### 8.2 Branch Names

- Feature: `feat/description`
- Fix: `fix/description`
- Release: `release/v1.0.0`
- Hotfix: `hotfix/description`

---

## 9. Logging

### 9.1 Structured Logging

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

### 9.2 Logging Guidelines

- **Import**: Always `import { logger } from '@/lib/logger'`
- **Child loggers**: Use `const log = logger.child('[source]')` for context
- **Methods**: `log.debug()`, `log.info()`, `log.warn()`, `log.error(message, error, context)`
- **Context**: Include relevant context as the third argument: `log.error('Failed to process', error, { orderId })`

---

## 10. Testing Standards

### 10.1 Unit Tests

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

### 10.2 Coverage Requirements

| Metric     | Target |
| ---------- | ------ |
| Lines      | 80%    |
| Functions  | 80%    |
| Statements | 80%    |
| Branches   | 70%    |

---

## 11. Security Checklist

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
**Next Review:** June 2026
