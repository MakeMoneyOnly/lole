# Operations Namespace Restructuring Plan

**Status:** Proposed  
**Date:** 2026-05-23  
**Author:** Engineering

## Executive Summary

The `src/app/api/v1/merchant/operations/` namespace contains 33 API routes spanning 8 functional domains. This plan proposes a migration to feature-slice architecture under `src/features/operations/` for improved code organization, reduced duplication, and better maintainability.

---

## Current State Analysis

### Route Inventory (33 routes)

| Domain               | Routes | Files               | Key Features                                                     |
| -------------------- | ------ | ------------------- | ---------------------------------------------------------------- |
| **Orders**           | 11     | `orders/`           | CRUD, status updates, splitting, item overrides, bulk operations |
| **KDS**              | 7      | `kds/`              | Queue, telemetry, order actions, print, handoff                  |
| **Waitlist**         | 3      | `waitlist/`         | CRUD, notifications                                              |
| **Table Sessions**   | 3      | `table-sessions/`   | Open, close, transfer                                            |
| **Service Requests** | 2      | `service-requests/` | CRUD                                                             |
| **Tip Pools**        | 2      | `tip-pools/`        | CRUD with shares                                                 |
| **Payments**         | 1      | `payments/`         | Session management                                               |
| **Delivery**         | 2      | `delivery/`         | Aggregator orders, fee calc                                      |

### Duplication Patterns Identified

1. **Authentication/Authorization Boilerplate** (25 routes affected)
    - All routes use `getAuthenticatedUser()`, `getAuthorizedRestaurantContext()`, or `resolveRestaurantIdForUser()`
    - Pattern: 5-10 lines of identical setup code per route

2. **Response Handling** (33 routes affected)
    - All use `apiSuccess()` / `apiError()` from `@/lib/api/response`
    - Some routes mix `apiError` directly with `NextResponse.json()`

3. **Audit Logging** (15 routes affected)
    - `writeAuditLog()` called with similar metadata patterns
    - Status transition logic duplicated in service-requests and orders

4. **Pilot Access Enforcement** (5 routes affected)
    - `enforcePilotAccess()` called inconsistently - only in orders routes

5. **Rate Limiting** (8 routes affected)
    - Both `checkRateLimit()` and `redisRateLimiters` used
    - Inconsistent application

### Code Quality Issues

- **Mixed Patterns:** Orders routes use older `supabase.auth.getUser()` + `resolveRestaurantIdForUser()`, while KDS/waitlist use newer `getAuthenticatedUser()` + `getAuthorizedRestaurantContext()`
- **Inconsistent Imports:** Mix of `NextRequest` vs `Request`, `NextResponse` vs return `Response`
- **Large Files:** `orders/route.ts` (537 lines), `kds/queue/route.ts` (787 lines) exceed recommended size

---

## Proposed Structure

```
src/
├── features/
│   ├── operations/
│   │   ├── orders/
│   │   │   ├── api/
│   │   │   │   ├── list-orders.ts
│   │   │   │   ├── create-order.ts
│   │   │   │   ├── get-order.ts
│   │   │   │   ├── update-status.ts
│   │   │   │   ├── calculate-fire-times.ts
│   │   │   │   ├── split-order.ts
│   │   │   │   ├── bulk-status.ts
│   │   │   │   └── notify-status.ts
│   │   │   ├── services/
│   │   │   │   ├── order-lifecycle.ts
│   │   │   │   └── fire-time-calculator.ts
│   │   │   ├── contracts/
│   │   │   │   └── schemas.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── kds/
│   │   │   ├── api/
│   │   │   │   ├── get-queue.ts
│   │   │   │   ├── telemetry.ts
│   │   │   │   └── handoff.ts
│   │   │   ├── services/
│   │   │   │   ├── queue-builder.ts
│   │   │   │   └── auto-archive.ts
│   │   │   ├── contracts/
│   │   │   │   └── schemas.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── waitlist/
│   │   │   ├── api/
│   │   │   │   ├── list-waitlist.ts
│   │   │   │   ├── create-entry.ts
│   │   │   │   └── notify-entry.ts
│   │   │   ├── services/
│   │   │   │   └── waitlist-service.ts
│   │   │   ├── contracts/
│   │   │   │   └── schemas.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── table-sessions/
│   │   │   ├── api/
│   │   │   │   ├── open-session.ts
│   │   │   │   ├── close-session.ts
│   │   │   │   └── transfer-session.ts
│   │   │   ├── services/
│   │   │   │   └── session-service.ts
│   │   │   ├── contracts/
│   │   │   │   └── schemas.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── service-requests/
│   │   │   ├── api/
│   │   │   │   ├── list-requests.ts
│   │   │   │   └── update-request.ts
│   │   │   ├── services/
│   │   │   │   └── request-service.ts
│   │   │   ├── contracts/
│   │   │   │   └── schemas.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── tip-pools/
│   │   │   ├── api/
│   │   │   │   ├── list-pools.ts
│   │   │   │   └── allocate-pools.ts
│   │   │   ├── services/
│   │   │   │   └── pool-service.ts
│   │   │   ├── contracts/
│   │   │   │   └── schemas.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── payments/
│   │   │   ├── api/
│   │   │   │   └── create-session.ts
│   │   │   ├── services/
│   │   │   │   └── payment-service.ts
│   │   │   ├── contracts/
│   │   │   │   └── schemas.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── delivery/
│   │   │   ├── api/
│   │   │   │   ├── aggregator-orders.ts
│   │   │   │   └── calculate-fee.ts
│   │   │   ├── services/
│   │   │   │   └── aggregator-service.ts
│   │   │   ├── contracts/
│   │   │   │   └── schemas.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── shared/
│   │   │   ├── auth-middleware.ts    # Unified auth pattern
│   │   │   ├── response-utils.ts     # Standardized responses
│   │   │   ├── audit-helpers.ts      # Audit logging utilities
│   │   │   └── pilot-gate.ts         # Consistent pilot checks
│   │   │
│   │   └── index.ts                   # Barrel export
│   │
│   └── README.md
```

### Shared Utilities Design

**`shared/auth-middleware.ts`**

```typescript
export async function requireMerchantAuth(
    request: Request,
    options?: { requirePilot?: boolean }
): Promise<
    | { ok: false; response: Response }
    | { ok: true; supabase: SupabaseClient; restaurantId: string; user: User }
>;
```

**`shared/response-utils.ts`**

```typescript
export function withStandardResponse<T>(
    handler: (supabase: SupabaseClient, restaurantId: string, user: User) => Promise<T>
): (request: Request) => Promise<Response>;
```

---

## Migration Phases

### Phase 0: Foundation (Week 1)

- [ ] Create `src/features/operations/shared/` with auth middleware
- [ ] Create contracts/schemas for each domain
- [ ] Establish CI/CD checks for new structure
- [ ] Document migration patterns in ADR-001

### Phase 1: Orders (Week 2-3)

- [ ] Extract auth/response boilerplate to shared utils
- [ ] Create `features/operations/orders/api/` handlers
- [ ] Write adapter routes in `app/api/` that delegate to feature handlers
- [ ] Run parallel tests, maintain backward compatibility

### Phase 2: KDS (Week 3-4)

- [ ] Migrate KDS queue logic with proper separation
- [ ] Extract queue-builder service
- [ ] Consolidate telemetry endpoints

### Phase 3: Waitlist, Table Sessions, Service Requests (Week 4-5)

- [ ] Parallel migration of simpler domains
- [ ] Implement shared audit helpers

### Phase 4: Tip Pools, Payments, Delivery (Week 5-6)

- [ ] Handle specialized integrations
- [ ] Update aggregator service dependencies

### Phase 5: Cleanup (Week 6)

- [ ] Remove old route files
- [ ] Update imports across codebase
- [ ] Archive old patterns documentation

---

## API Compatibility Layer

### Strategy: Adapter Pattern

Old routes delegate to new feature handlers:

```typescript
// src/app/api/v1/merchant/operations/orders/route.ts
import { listOrders } from '@/features/operations/orders/api/list-orders';
import { createOrder } from '@/features/operations/orders/api/create-order';

export const GET = listOrders;
export const POST = createOrder;
```

### Backward Compatibility Matrix

| Route                               | Compatibility          | Notes                                                  |
| ----------------------------------- | ---------------------- | ------------------------------------------------------ |
| `/orders`                           | ✅ Full                | Same request/response shape                            |
| `/orders/[orderId]`                 | ✅ Full                | JSON structure unchanged                               |
| `/orders/[orderId]/status`          | ✅ Full                | Status enum preserved                                  |
| `/kds/queue`                        | ✅ Full                | Same filtering params                                  |
| `/waitlist`                         | ✅ Full                | List/create format stable                              |
| `/table-sessions/[sessionId]/close` | ✅ Full                | Response format unchanged                              |
| All routes                          | ⚠️ Deprecation headers | `Warning: 299 - "API version deprecated, use /api/v2"` |

### Deprecation Headers

During transition (Phase 1-5):

```typescript
response.headers.set(
    'Warning',
    '299 - "This API version is deprecated. See /docs/migration-guide"'
);
```

---

## Shared Utilities Opportunities

### 1. Auth Middleware (25 routes)

**Before:**

```typescript
const supabase = await createClient();
const {
    data: { user },
    error: userError,
} = await supabase.auth.getUser();
if (userError || !user) return apiError('Unauthorized', 401, 'UNAUTHORIZED');
const { restaurantId, error: restaurantError } = await resolveRestaurantIdForUser(user.id);
```

**After:**

```typescript
const auth = await requireMerchantAuth(request);
if (!auth.ok) return auth.response;
// auth.supabase, auth.restaurantId, auth.user available
```

### 2. Response Handling (33 routes)

**Before:** Mixed `apiSuccess`, `apiError`, `NextResponse.json`

**After:** Standardize on `apiSuccess`/`apiError` from shared layer

### 3. Audit Logging (15 routes)

**Before:** Duplicated `writeAuditLog` calls with manual `metadata`

**After:**

```typescript
await auditOrderAction(supabase, restaurantId, {
    action: 'order_status_updated',
    entityId: orderId,
    userId: user.id,
    changes: { from: oldStatus, to: newStatus },
});
```

---

## Timeline

| Week | Phase                      | Deliverables                     |
| ---- | -------------------------- | -------------------------------- |
| 1    | Foundation                 | Shared utilities, contracts      |
| 2-3  | Orders                     | Feature handlers, adapter routes |
| 3-4  | KDS                        | Queue service extraction         |
| 4-5  | Waitlist/Sessions/Requests | Parallel migration               |
| 5-6  | TipPools/Payments/Delivery | Final domains, cleanup           |
| 7    | Verification               | Tests pass, remove old code      |

---

## Risks & Mitigations

| Risk                          | Likelihood | Impact | Mitigation                            |
| ----------------------------- | ---------- | ------ | ------------------------------------- |
| Breaking changes in migration | Medium     | High   | Adapter pattern with parallel testing |
| Performance regression        | Low        | Medium | Benchmark before/after each phase     |
| Missing edge cases            | Medium     | Medium | Comprehensive test coverage           |
| Team adoption resistance      | Low        | Medium | Documentation and training sessions   |

---

## Success Metrics

- [ ] All 33 routes migrated to feature handlers
- [ ] ~60% reduction in boilerplate code
- [ ] Consistent authentication pattern across all routes
- [ ] All tests pass (current + new)
- [ ] No performance regression (<10ms added per request)
- [ ] Documentation updated

---

## Next Steps

1. Create ADR-001 documenting feature-slice architecture decision
2. Create `src/features/operations/shared/` with auth middleware prototype
3. Begin Phase 1: Orders migration with single route as proof of concept
