# Technical Debt Audit

**Date:** 2026-05-19  
**Project:** lole Restaurant OS  
**Scope:** Multi-domain architectural analysis including Staff, Payments, Cart domains, Repository layer, Security, and Performance

---

## Executive Summary

This audit synthesizes findings from the architectural review, database infrastructure audit, and codebase analysis. The codebase demonstrates **strong foundational architecture** with well-implemented multi-tenancy patterns, comprehensive RLS policies, and a clean separation of concerns. However, several areas of technical debt require attention to maintain long-term sustainability and security.

### Overall Technical Debt Score: **MODERATE**

| Category | Debt Points | Severity |
|----------|-------------|----------|
| Architecture Patterns | 8 | Low-Medium |
| SOLID Violations | 5 | Medium |
| Anti-patterns | 7 | Medium-High |
| Security Posture | 3 | Low |
| Maintainability | 6 | Medium |

---

## 1. Architecture Patterns (Positive Findings)

### 1.1 Domain-Driven Design with Clear Separation of Concerns

**Staff Domain** (`src/domains/staff/`):
- **Service Layer** (`service.ts`): Business logic for PIN hashing, role validation, tenant isolation
- **Repository Layer** (`repository.ts`): Database access with explicit column selection, no business logic
- **Resolvers Layer** (`resolvers.ts`): GraphQL authorization and validation

**Payments Domain** (`src/domains/payments/`):
- **Service Layer** (`service.ts`): Payment state machine validation, idempotency handling
- **Repository Layer** (`repository.ts`): Supabase queries with tenant-scoped operations
- **Status Transition Logic**: Well-defined state machine with `isValidStatusTransition()`

**Cart Domain** (`src/domains/cart/`):
- Stateless service class with pure functions for cart operations
- Clear separation: no persistence concerns, just state transformation

### 1.2 Repository Base Pattern

**File:** `src/lib/db/repository-base.ts`

```typescript
// GOOD: Centralized client management with lazy initialization
export function getRepositoryClient(): SupabaseClient<Database> {
    if (!supabaseClient) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SECRET_KEY;
        // ...
    }
    return supabaseClient;
}
```

**Strengths:**
- Single point of configuration for database connections
- Lazy initialization prevents startup failures
- Testable with `resetRepositoryClient()`

### 1.3 Explicit Column Selection (MED-001 Pattern)

**File:** `src/lib/constants/query-columns.ts`

```typescript
// EXCELLENT: Explicit column selection prevents over-fetching
export const ORDER_LIST_COLUMNS = [
    'id',
    'restaurant_id',
    'table_number',
    'status',
    // ... specific columns only
] as const;
```

**Impact:**
- Reduces network transfer
- Prevents schema changes from exposing unexpected columns
- Improves query performance with covering indexes

### 1.4 Rate Limiting with Graceful Fallback

**File:** `src/lib/rate-limit.ts`

**Strengths:**
- Redis-backed with in-memory fallback
- Configurable limits per endpoint type (mutations/auth/reads)
- Sliding window algorithm prevents burst attacks
- Security event logging integration

### 1.5 RLS Hardening Migration

**File:** `supabase/migrations/20260215_p0_rls_hardening.sql`

- Forced RLS on critical tables
- Tenant-scoped policies with `restaurant_staff` verification
- Guest insertion with data validation
- Agency user multi-restaurant access pattern

---

## 2. Technical Debt Clusters

### 2.1 bcrypt PIN Hashing Implemented (Status: Resolved)

**Files:** `src/domains/staff/service.ts:94-97`, `src/domains/staff/service.ts:132-133`

**Status:** ✅ bcrypt PIN hashing implemented with dual verification (HMAC for compatibility during transition).

### 2.2 Payment Webhook Job Handler Verified (Status: Resolved)

**File:** `src/lib/payments/webhooks.ts:328-368`

**Status:** ✅ Payment webhook job handler verified - endpoint `/api/v1/system/jobs/payments/complete` exists and processes payment completions.

### 2.3 DataLoader Tenant Verification (Status: Implemented)

**File:** `src/lib/graphql/dataloaders.ts:144-161`

DataLoaders include tenant verification via the `verifyTenantOwnership` helper:

```typescript
const verifyTenantOwnership = <T extends { restaurant_id?: string }>(
    items: T[],
    ids: readonly string[],
    idExtractor: (item: T) => string
): (T | null)[] => {
    const itemMap = new Map(items.map(item => [idExtractor(item), item]));
    return ids.map(id => {
        const item = itemMap.get(id);
        if (!item) return null;
        if (item.restaurant_id && item.restaurant_id !== restaurantId) {
            log.warn('Tenant isolation violation', { id, restaurantId });
            return null;
        }
        return item;
    });
};
```

**Status:** ✅ Tenant verification is implemented. All DataLoaders use this helper for cross-tenant protection.

### 2.4 Sync Worker Fully Implemented (Previously CRIT-02)

**File:** `src/lib/sync/syncWorker.ts:227-343`

The sync worker implements actual API calls with batch sync fallback:

```typescript
// HIGH-013: Execute batch sync via unified /api/v1/system/sync endpoint
async function executeBatchSync(operations: SyncOperationRow[]): Promise<{
    succeeded: number;
    failed: number;
    results: Map<string, { success: boolean; error?: string }>;
}> {
    // ... transforms operations and calls actual API endpoint
    const response = await fetch(SYNC_API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: syncOperations, clientId }),
    });
    // Falls back to individual operations on batch failure
}

// HIGH-013: Fallback to individual endpoints
async function executeSyncOperation(op: SyncOperationRow): Promise<{...}> {
    const endpoint = SYNC_ENDPOINTS[op.table_name];
    const response = await fetch(url, { method, headers, body });
    // Actual HTTP calls to /api/v1/merchant/operations/*
}
```

**Status:** ✅ Functional with batch sync to `/api/v1/system/sync` endpoint and fallback to individual table endpoints.

### 2.5 PowerSync Packages Installed (Previously CRIT-01 - Removed)

**File:** `package.json:62-63`

```json
"@powersync/react": "^1.9.0",
"@powersync/web": "^1.36.0",
```

**Status:** ✅ PowerSync packages are installed. The comment in `powersync-config.ts` refers to types that mirror the actual PowerSync SDK types.

---

## 3. SOLID Violations

### 3.1 Single Responsibility Principle (SRP) Violations

**Violation 1: `staffService.verifyPin` mixing concerns**

**File:** `src/domains/staff/service.ts:162-185`

The `verifyPin` method handles both PIN verification AND tenant isolation logging. These are separate concerns:

```typescript
async verifyPin(staffId: string, pinCode: string, expectedRestaurantId?: string) {
    // Business logic: PIN verification
    const staff = await staffRepository.verifyPin(staffId, pinCode);
    
    // Cross-cutting concern: Tenant isolation logging
    if (staff && expectedRestaurantId && staff.restaurant_id !== expectedRestaurantId) {
        logger.error(`Tenant isolation violation...`);
        return null;
    }
    return staff;
}
```

**Recommendation:** Move tenant isolation checks to middleware or separate decorator.

### 3.2 Open/Closed Principle Violations

**Violation: Hardcoded Role Permissions**

**File:** `src/domains/staff/service.ts:189-218`

```typescript
const rolePermissions: Record<StaffRole, string[]> = {
    owner: ['all'],
    admin: ['staff:read', 'staff:write', /* ... */],
    // New roles require code modification
};
```

**Recommendation:** Externalize permissions to database configuration table.

### 3.3 Dependency Inversion Principle Violations

**Violation 1: Direct Repository Dependency**

All service classes directly instantiate repository instances:

```typescript
import { staffRepository } from './repository';
```

This makes unit testing difficult and creates tight coupling.

**Recommendation:** Use dependency injection pattern with interfaces.

### 3.4 Liskov Substitution Principle

**No violations found** - The codebase uses composition over inheritance appropriately.

### 3.5 Interface Segregation Principle

**Potential violation:** Large GraphQL response types

**File:** `src/domains/staff/resolvers.ts`

Mutations return `{ success, message, staffMember }` consistently, which is appropriate.

---

## 4. Anti-patterns

### 4.1 God Object Pattern

**Violation: `StaffService` growing too large**

The `StaffService` class at `src/domains/staff/service.ts` contains:
- PIN operations
- Role validation
- Permission checking
- CRUD operations
- Tenant isolation

**Recommendation:** Split into `PinService`, `RoleService`, `PermissionService`.

### 4.2 Magic Numbers/Strings

**Violation: Hardcoded status arrays**

**File:** `src/domains/payments/resolvers.ts:131-138`

```typescript
const validStatuses = [
    'pending', 'processing', 'captured', 'failed', 'refunded', 'cancelled'
];
```

**Recommendation:** Import from `repository.ts` where types are defined.

### 4.3 Inconsistent Error Handling

**Violation: Mixed error patterns**

```typescript
// Pattern 1: Throw Error
throw new Error(`Staff member ${id} not found or access denied`);

// Pattern 2: Return null
return null;

// Pattern 3: Return error object with success
return { success: false, payment: null, error: 'Amount must be greater than 0' };
```

**Recommendation:** Standardize on GraphQL error format for resolvers, exceptions for services.

### 4.4 security_invoker Pattern Applied (Status: Resolved)

**Status:** ✅ `security_invoker = on` applied to all views including `restaurant_staff_with_users`, `active_menu_items`, `active_restaurants`, `active_tables`, `active_restaurant_staff`, and `delivery_partner_integrations`.

---

## 5. Security Posture Assessment

### 5.1 Strengths

| Control | Status | Evidence |
|---------|--------|----------|
| RLS Enabled | ✅ | All tenant tables have RLS |
| FORCE RLS | ✅ | Applied via migration |
| No permissive policies | ✅ | No `USING (true)` found |
| HMAC guest verification | ✅ | `guestContext.ts` |
| Idempotency keys | ✅ | `idempotency.ts` |
| Audit logging | ✅ | `auditLogger.ts` |
| Input validation (Zod) | ✅ | Throughout API routes |
| Service role server-only | ✅ | Used in server components |

### 5.2 Security Posture (Status: Resolved)

| Issue | Severity | Recommendation | Status |
|-------|----------|--------------|--------|
| PIN hashing | HIGH | Implement bcrypt | ✅ Resolved |
| Views without security_invoker | HIGH | Apply to all views | ✅ Resolved |
| Exposed auth.users in view | CRITICAL | Add `security_invoker=on` | ✅ Resolved |
| Payment webhook job verification | HIGH | Verify `/api/v1/system/jobs/payments/complete` exists | ✅ Resolved |

---

## 6. Prioritized Remediation Backlog

### P0 - Critical (Block Production)

| ID | Issue | Effort | Files | Status |
|----|-------|--------|-------|--------|
| CRIT-03 | Exposed auth.users in view - security_invoker applied | Low | `supabase/migrations/20260219_restaurant_staff_with_users_view.sql` | ✅ Resolved |

### P1 - High (Address Before Production)

| ID | Issue | Effort | Files | Status |
|----|-------|--------|-------|--------|
| HIGH-01 | Payment webhook job handler verified | Low | `src/lib/payments/webhooks.ts` | ✅ Resolved |
| HIGH-02 | bcrypt PIN hashing implemented with dual verification | Low | `src/domains/staff/service.ts` | ✅ Resolved |
| HIGH-03 | security_invoker applied to all views | Low | Multiple migration files | ✅ Resolved |
| HIGH-04 | Retry logic for KDS realtime - already exists | Low | `src/hooks/useKDSRealtime.ts` | ✅ Resolved |
| HIGH-05 | Connection pooling via Supabase PgBouncer | Low | Supabase configuration | ✅ Resolved |
| HIGH-06 | DataLoaders comprehensive - already implemented | Medium | `src/lib/graphql/dataloaders.ts` | ✅ Resolved |
| HIGH-07 | Telebirr payment integration | High | `src/domains/payments/` | Pending |

### P2 - Medium (First Sprint Post-Launch)

| ID | Issue | Effort | Files | Status |
|----|-------|--------|-------|--------|
| MED-01 | Split StaffService responsibilities | High | `src/domains/staff/service.ts` | Pending |
| MED-02 | Externalize role permissions | Medium | `src/domains/staff/service.ts` | Pending |
| MED-03 | Standardize error handling | Medium | All resolver/service files | Pending |
| MED-04 | Add conflict resolution for sync | Medium | `src/lib/sync/` | Pending |
| MED-05 | Message deduplication for realtime - already implemented | Low | `src/hooks/useKDSRealtime.ts` | ✅ Resolved |
| MED-06 | Add dexie migration completion | Low | `src/lib/sync/migrate.ts` | Pending |

### P3 - Low (Ongoing Optimization)

| ID | Issue | Effort | Notes |
|----|-------|--------|-------|
| LOW-01 | Amharic translation coverage | Low | Audit UI strings |
| LOW-02 | Network speed detection | Medium | Adaptive loading |
| LOW-03 | Query performance monitoring | Low | Dashboards |
| LOW-04 | Bundle size budgets | Low | Monitor vs lighthouse |

---

## 7. Remediation Tracking

| Item | Status | Owner | Target | Completion Date |
|------|--------|-------|--------|-----------------|
| CRIT-03 | ✅ Resolved | @backend | 2026-06-01 | 2026-05-20 |
| HIGH-01 | ✅ Resolved | @backend | 2026-06-03 | 2026-05-20 |
| HIGH-02 | ✅ Resolved | @security | 2026-05-25 | 2026-05-20 |
| HIGH-03 | ✅ Resolved | @backend | 2026-06-01 | 2026-05-20 |
| HIGH-04 | ✅ Resolved | @backend | 2026-06-03 | 2026-05-20 |
| HIGH-05 | ✅ Resolved | @devops | 2026-06-01 | 2026-05-20 |
| HIGH-06 | ✅ Resolved | @backend | 2026-06-03 | 2026-05-20 |
| MED-05 | ✅ Resolved | @backend | 2026-06-15 | 2026-05-20 |

---

## 8. Appendix: File References

### Primary Audit Sources
- `docs/reference/reports/database/database-infrastructure-audit-report-2026-03-23.md`
- `docs/reference/reports/architecture/architecture-scalability-audit-report-2026-03-23.md`

### Codebase Locations
| Domain | Service | Repository | Resolvers |
|--------|---------|------------|-----------|
| Staff | `src/domains/staff/service.ts` | `src/domains/staff/repository.ts` | `src/domains/staff/resolvers.ts` |
| Payments | `src/domains/payments/service.ts` | `src/domains/payments/repository.ts` | `src/domains/payments/resolvers.ts` |
| Cart | `src/domains/cart/service.ts` | `src/domains/cart/repository.ts` | N/A |
| Shared | `src/lib/db/repository-base.ts` | `src/lib/constants/query-columns.ts` | `src/lib/graphql/dataloaders.ts` |

---

**Next Review:** 2026-06-01  
**Last Updated:** 2026-05-20