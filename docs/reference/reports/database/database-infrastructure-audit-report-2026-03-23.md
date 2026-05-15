# Database & Infrastructure Audit Report

**Date:** 2026-03-23  
**Scope:** Pre-Production Readiness Audit  
**Platform:** lole Restaurant OS - Multi-tenant SaaS

---

## Executive Summary

This audit covers database migrations, indexing strategy, query patterns, data integrity, and Supabase-specific configurations. The codebase demonstrates mature migration practices with recent security hardening efforts. However, several issues require attention before production deployment.

### Overall Risk Assessment: **MEDIUM**

| Category        | Critical | High  | Medium | Low    |
| --------------- | -------- | ----- | ------ | ------ |
| Migrations      | 0        | 2     | 3      | 4      |
| Indexing        | 0        | 1     | 2      | 3      |
| Query Patterns  | 0        | 2     | 4      | 2      |
| Data Integrity  | 0        | 1     | 2      | 1      |
| Supabase Config | 1        | 1     | 1      | 1      |
| **Total**       | **1**    | **7** | **12** | **11** |

---

## Critical Findings

### CRIT-01: Exposed auth.users in Public View

**Severity:** Critical  
**File:** [`supabase/migrations/20260219_restaurant_staff_with_users_view.sql:10-24`](supabase/migrations/20260219_restaurant_staff_with_users_view.sql:10)  
**Status:** Unresolved

**Issue:**  
The view `restaurant_staff_with_users` directly joins with `auth.users` in the public schema:

```sql
CREATE OR REPLACE VIEW public.restaurant_staff_with_users AS
SELECT
    rs.id,
    rs.user_id,
    ...
    u.email,
    u.raw_user_meta_data->>'full_name' AS full_name,
    ...
FROM public.restaurant_staff rs
LEFT JOIN auth.users u ON rs.user_id = u.id;
```

**Impact:**

- Exposes sensitive auth data through public schema
- View is `SECURITY DEFINER` by default, potentially leaking user data
- Supabase advisor will flag this as a security vulnerability

**Remediation:**

1. Add `security_invoker=on` to the view:
    ```sql
    ALTER VIEW public.restaurant_staff_with_users SET (security_invoker = on);
    ```
2. Add RLS policy to restrict access to authenticated users with restaurant association
3. Consider using a Postgres 15+ security invoker view pattern

---

## High Severity Findings

### HIGH-01: Permissive RLS Policies Still Present

**Severity:** High  
**Files:** Multiple migration files  
**Status:** Partially Fixed

**Issue:**  
Several tables still have `USING (true)` or `WITH CHECK (true)` policies:

| File                                                                                                                             | Table                    | Policy                     |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------- |
| [`20260317_crit11_push_notification_support.sql:213-216`](supabase/migrations/20260317_crit11_push_notification_support.sql:213) | `device_tokens`          | `service_role` full access |
| [`20260317_crit11_push_notification_support.sql:262-265`](supabase/migrations/20260317_crit11_push_notification_support.sql:262) | `guest_push_preferences` | `service_role` full access |
| [`20260316110000_device_sync_status.sql:75-78`](supabase/migrations/20260316110000_device_sync_status.sql:75)                    | `device_sync_status`     | `service_role` full access |
| [`20260321000000_p0_price_overrides.sql:83-86`](supabase/migrations/20260321000000_p0_price_overrides.sql:83)                    | `price_overrides`        | `service_role` full access |

**Impact:**

- Service role bypasses RLS by default, but explicit `USING (true)` policies are redundant and indicate incomplete security hardening
- If service role key is compromised, full data access is exposed

**Remediation:**

1. Remove redundant `service_role` policies since service role bypasses RLS
2. For tables requiring service_role audit, use explicit audit logging instead of permissive policies

---

### HIGH-02: Missing Pagination in Active Order Queries

**Severity:** High  
**File:** [`src/domains/orders/repository.ts:67-75`](src/domains/orders/repository.ts:67)  
**Status:** Unresolved

**Issue:**  
The `findActiveByRestaurant` method lacks pagination:

```typescript
async findActiveByRestaurant(restaurantId: string): Promise<OrderRow[]> {
    const { data } = await getSupabaseClient()
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
        .order('created_at', { ascending: false });
    return data ?? [];
}
```

**Impact:**

- Unbounded result sets during peak hours
- Memory pressure on API servers
- Potential timeout for restaurants with many active orders

**Remediation:**  
Add pagination parameters with sensible defaults:

```typescript
async findActiveByRestaurant(
    restaurantId: string,
    options: { limit?: number; offset?: number } = {}
): Promise<OrderRow[]> {
    const limit = options.limit ?? 50;
    return getSupabaseClient()
        .from('orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
        .order('created_at', { ascending: false })
        .range(options.offset ?? 0, limit - 1);
}
```

---

### HIGH-03: N+1 Query Pattern in KDS Station Query

**Severity:** High  
**File:** [`src/domains/orders/repository.ts:77-87`](src/domains/orders/repository.ts:77)  
**Status:** Unresolved

**Issue:**  
In-memory filtering after fetching all orders:

```typescript
async findByKDSStation(restaurantId: string, station: string): Promise<OrderRow[]> {
    const { data } = await getSupabaseClient()
        .from('orders')
        .select('*, order_items(*)')
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
        .order('created_at', { ascending: false });
    return (data ?? []).filter(order =>
        order.order_items?.some(item => item.station === station)
    );
}
```

**Impact:**

- Fetches all orders and items into memory
- Filters in JavaScript instead of database
- Performance degrades with order volume

**Remediation:**  
Use a proper database query with JOIN or EXISTS:

```sql
SELECT DISTINCT o.*
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.restaurant_id = $1
  AND o.status IN ('pending', 'confirmed', 'preparing', 'ready')
  AND oi.station = $2
ORDER BY o.created_at DESC
```

---

### HIGH-04: Index Drop Without Immediate Restore

**Severity:** High  
**File:** [`supabase/migrations/20260309114500_fix_performance_advisor_warnings.sql:5-39`](supabase/migrations/20260309114500_fix_performance_advisor_warnings.sql:5)  
**Status:** Partially Fixed

**Issue:**  
Migration drops 34 indexes in a single transaction, then restores them in a separate migration ([`20260309120500_restore_fk_covering_indexes.sql`](supabase/migrations/20260309120500_restore_fk_covering_indexes.sql:1)):

```sql
-- Drops FK-covering indexes
DROP INDEX IF EXISTS public.idx_alert_events_rule_id;
DROP INDEX IF EXISTS public.idx_categories_restaurant_order;
-- ... 32 more drops
```

**Impact:**

- Window where FK constraints have no covering indexes
- Potential performance degradation during deployment
- If restore migration fails, indexes remain dropped

**Remediation:**

1. Combine drop and restore in single migration file
2. Use `DROP IF EXISTS` followed by `CREATE IF NOT EXISTS` in same transaction
3. Follow the FK-protected keep list from [`fk-protected-keep-list-2026-03-03.md`](docs/08-reports/database/fk-protected-keep-list-2026-03-03.md)

---

### HIGH-05: Missing security_invoker on Views

**Severity:** High  
**Files:** Multiple view definitions  
**Status:** Unresolved

**Issue:**  
Views created without `security_invoker` setting:

| View                            | File                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `active_menu_items`             | [`20260219_soft_delete_columns.sql:206`](supabase/migrations/20260219_soft_delete_columns.sql:206)                             |
| `active_restaurants`            | [`20260219_soft_delete_columns.sql:211`](supabase/migrations/20260219_soft_delete_columns.sql:211)                             |
| `active_tables`                 | [`20260219_soft_delete_columns.sql:216`](supabase/migrations/20260219_soft_delete_columns.sql:216)                             |
| `active_restaurant_staff`       | [`20260219_soft_delete_columns.sql:221`](supabase/migrations/20260219_soft_delete_columns.sql:221)                             |
| `delivery_partner_integrations` | [`20260224150000_omnichannel_schema_alignment.sql:13`](supabase/migrations/20260224150000_omnichannel_schema_alignment.sql:13) |

**Impact:**

- Views are `SECURITY DEFINER` by default
- RLS policies on base tables may be bypassed
- Data leakage potential for tenant-scoped tables

**Remediation:**  
Apply security_invoker to all views:

```sql
ALTER VIEW public.active_menu_items SET (security_invoker = on);
ALTER VIEW public.active_restaurants SET (security_invoker = on);
-- etc.
```

---

### HIGH-06: Missing Migrations in Version Control

**Severity:** High  
**File:** [`missing_migrations.json`](missing_migrations.json:1)  
**Status:** Unresolved

**Issue:**  
19 migrations are tracked as missing from local version control:

```json
[
    "20260204_initial_schema.sql",
    "20260216_zz_p0_migration_baseline_reconciliation.sql",
    "20260218_p2_campaign_deliveries.sql"
    // ... 16 more
]
```

**Impact:**

- Schema drift between environments
- Potential deployment failures
- Incomplete audit trail

**Remediation:**

1. Reconcile migrations from remote Supabase project
2. Ensure all migrations are committed to version control
3. Implement CI check for migration sync

---

### HIGH-07: SELECT \* Queries Throughout Codebase

**Severity:** High  
**Files:** 167 instances across codebase  
**Status:** Unresolved

**Issue:**  
Extensive use of `select('*')` patterns found in:

- [`src/domains/orders/repository.ts`](src/domains/orders/repository.ts:34)
- [`src/domains/menu/repository.ts`](src/domains/menu/repository.ts:24)
- [`src/lib/supabase/queries.ts`](src/lib/supabase/queries.ts:27)
- API routes throughout `src/app/api/`

**Impact:**

- Over-fetching data, especially JSONB columns
- Increased network transfer
- Schema changes automatically exposed to clients
- Performance impact on large tables

**Remediation:**

1. Define explicit column lists for hot queries
2. Use TypeScript types to enforce column selection
3. Create database views for common projections

---

## Medium Severity Findings

### MED-01: Inconsistent Idempotency in Migrations

**Severity:** Medium  
**Files:** Multiple migrations  
**Status:** Partial

**Issue:**  
Some migrations lack `IF EXISTS`/`IF NOT EXISTS` guards:

- [`20260204_initial_schema.sql`](supabase/migrations/20260204_initial_schema.sql:117) - RLS policies created without `DROP POLICY IF EXISTS`
- [`20260214_phase1_foundation.sql`](supabase/migrations/20260214_phase1_foundation.sql:123) - Mixed idempotency patterns

**Impact:**

- Migration failures on re-run
- Difficult rollback and recovery

**Remediation:**  
Standardize migration template with idempotency guards:

```sql
-- Policy pattern
DROP POLICY IF EXISTS "policy_name" ON table_name;
CREATE POLICY "policy_name" ON table_name ...;

-- Index pattern
CREATE INDEX IF NOT EXISTS idx_name ON table_name(column);

-- Column pattern
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name type;
```

---

### MED-02: Missing Indexes for RLS Predicates

**Severity:** Medium  
**Status:** Requires Verification

**Issue:**  
RLS policies frequently query `restaurant_staff` for tenant isolation:

```sql
EXISTS (
    SELECT 1 FROM public.restaurant_staff rs
    WHERE rs.user_id = auth.uid()
    AND rs.restaurant_id = orders.restaurant_id
    AND COALESCE(rs.is_active, true) = true
)
```

**Impact:**

- Sequential scans on `restaurant_staff` for every RLS check
- Performance degradation at scale

**Remediation:**  
Verify indexes exist:

```sql
-- Should exist
CREATE INDEX IF NOT EXISTS idx_restaurant_staff_user_restaurant
    ON restaurant_staff(user_id, restaurant_id, is_active);
```

---

### MED-03: CASCADE DROP on Critical Tables

**Severity:** Medium  
**Files:** Multiple migrations  
**Status:** By Design

**Issue:**  
Extensive use of `ON DELETE CASCADE` on tenant-scoped tables:

```sql
restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE
```

**Impact:**

- Restaurant deletion cascades to all related data
- Risk of accidental data loss
- Audit trail deletion

**Remediation:**

1. Consider `ON DELETE RESTRICT` for audit tables
2. Implement soft-delete for restaurants
3. Add deletion safeguards in application layer

---

### MED-04: Missing Default Values for Required Columns

**Severity:** Medium  
**File:** [`supabase/migrations/20260312180000_crit06_multitenant_schema_hardening.sql:31-54`](supabase/migrations/20260312180000_crit06_multitenant_schema_hardening.sql:31)  
**Status:** Resolved

**Issue:**  
Backfill pattern for `restaurant_id` on `order_items`:

```sql
ALTER TABLE public.order_items
    ALTER COLUMN restaurant_id SET DEFAULT (
        SELECT id FROM public.restaurants LIMIT 1
    );
```

**Impact:**

- Dangerous default using arbitrary restaurant
- Could cause data contamination

**Remediation:**  
✅ Resolved - Migration sets NOT NULL only after backfill verification

---

### MED-05: Trigger Function Without Search Path

**Severity:** Medium  
**File:** [`supabase/migrations/20260220_realtime_and_table_status.sql:20-43`](supabase/migrations/20260220_realtime_and_table_status.sql:20)  
**Status:** Unresolved

**Issue:**  
Trigger function `update_table_status_on_order` is `SECURITY DEFINER` without explicit `search_path`:

```sql
CREATE OR REPLACE FUNCTION public.update_table_status_on_order()
RETURNS trigger AS $$
BEGIN
    -- function body
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Impact:**

- Potential search path injection
- Function could reference wrong objects

**Remediation:**  
Add explicit search path:

```sql
CREATE OR REPLACE FUNCTION public.update_table_status_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$ ... $$;
```

---

### MED-06: Unbounded Query in Notification Queue

**Severity:** Medium  
**File:** [`src/lib/notifications/queue.ts:243-245`](src/lib/notifications/queue.ts:243)  
**Status:** Unresolved

**Issue:**  
Query fetches all pending notifications without limit:

```typescript
.from('notification_queue')
.select('*')
.eq('status', 'pending')
```

**Impact:**

- Memory pressure with large notification queues
- Potential timeout during high-volume periods

**Remediation:**  
Add batch processing with limit:

```typescript
.from('notification_queue')
.select('*')
.eq('status', 'pending')
.limit(100)
```

---

### MED-07: Missing Foreign Key Indexes

**Severity:** Medium  
**Status:** Requires Verification

**Issue:**  
Based on FK-protected keep list, 34 indexes were identified as FK-covering with zero scans. Need verification that all FK columns have proper indexes.

**Key Tables to Verify:**

- `order_items.order_id`
- `order_items.item_id`
- `payments.order_id`
- `kds_order_items.order_id`

**Remediation:**  
Run index audit query:

```sql
SELECT
    tc.table_name,
    kcu.column_name,
    i.indexname
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN pg_indexes i
    ON i.tablename = tc.table_name
    AND i.indexdef LIKE '%' || kcu.column_name || '%'
WHERE tc.constraint_type = 'FOREIGN KEY'
AND i.indexname IS NULL;
```

---

### MED-08: Missing Realtime Configuration

**Severity:** Medium  
**File:** [`supabase/migrations/20260220_realtime_and_table_status.sql`](supabase/migrations/20260220_realtime_and_table_status.sql:1)  
**Status:** Partial

**Issue:**  
Only `orders` and `tables` are added to realtime publication. KDS and other critical tables may need realtime:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE tables;
```

**Impact:**

- Limited realtime updates for KDS workflows
- Manual refresh required for order status changes

**Remediation:**  
Evaluate and add tables requiring realtime:

- `kds_order_items`
- `order_items` (status changes)
- `table_sessions`

---

### MED-09: Inconsistent Column Naming

**Severity:** Medium  
**Files:** Multiple migrations  
**Status:** By Design

**Issue:**  
Mixed naming conventions:

- `total_price` vs `total_amount` in orders
- `item_id` vs `menu_item_id` in order_items

**Impact:**

- Developer confusion
- Potential for wrong column usage

**Remediation:**  
Document naming conventions and add migration to standardize if needed.

---

### MED-10: Missing Composite Indexes for Common Queries

**Severity:** Medium  
**Status:** Requires Analysis

**Issue:**  
Common query patterns may benefit from composite indexes:

```sql
-- Orders by restaurant + status (common filter)
SELECT * FROM orders WHERE restaurant_id = ? AND status IN (...)

-- Order items by order (common join)
SELECT * FROM order_items WHERE order_id = ?
```

**Remediation:**  
Analyze query patterns and add covering indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status
    ON orders(restaurant_id, status) INCLUDE (created_at, total_price);

CREATE INDEX IF NOT EXISTS idx_order_items_order_include
    ON order_items(order_id) INCLUDE (status, station, quantity);
```

---

### MED-11: JSONB Columns Without GIN Indexes

**Severity:** Medium  
**Status:** Requires Analysis

**Issue:**  
Tables with JSONB columns that may be queried:

- `orders.items`
- `menu_items.dietary_tags`
- `restaurants.settings`

**Impact:**

- Full table scan for JSONB queries
- Performance degradation for filter operations

**Remediation:**  
Add GIN indexes for frequently queried JSONB:

```sql
CREATE INDEX IF NOT EXISTS idx_menu_items_dietary_tags
    ON menu_items USING GIN (dietary_tags);

CREATE INDEX IF NOT EXISTS idx_restaurants_settings
    ON restaurants USING GIN (settings);
```

---

### MED-12: Missing Connection Pooling Configuration

**Severity:** Medium  
**Status:** Requires Verification

**Issue:**  
No explicit connection pooling configuration found in codebase review.

**Impact:**

- Potential connection exhaustion under load
- Transaction conflicts during peak hours

**Remediation:**

1. Verify Supabase connection pooling is enabled
2. Configure PgBouncer settings appropriately
3. Use transaction mode for serverless functions

---

## Low Severity Findings

### LOW-01: Missing Migration Comments

**Severity:** Low  
**Files:** Multiple migrations  
**Status:** Documentation

**Issue:**  
Some migrations lack descriptive comments explaining purpose and impact.

**Remediation:**  
Add header comments to all migrations:

```sql
-- Migration: 20260323_example_migration.sql
-- Purpose: Add index for order status queries
-- Impact: Improves dashboard query performance
-- Rollback: DROP INDEX IF EXISTS idx_orders_status;
```

---

### LOW-02: Inconsistent Index Naming

**Severity:** Low  
**Files:** Multiple migrations  
**Status:** Style

**Issue:**  
Mixed index naming conventions:

- `idx_orders_restaurant_status` (good)
- `idx_orders_tenant` (ambiguous)
- `orders_order_number_idx` (different pattern)

**Remediation:**  
Standardize to `idx_{table}_{columns}` pattern.

---

### LOW-03: Missing NOT NULL Constraints on Required Fields

**Severity:** Low  
**Files:** Multiple migrations  
**Status:** Requires Audit

**Issue:**  
Some columns that should be required lack NOT NULL:

- `orders.table_number` (nullable but required for dine-in)
- `menu_items.name` (JSONB, should have validation)

**Remediation:**  
Audit and add constraints where appropriate.

---

### LOW-04: Unused Index Cleanup

**Severity:** Low  
**File:** [`docs/08-reports/database/advisor-unused-index-batching-2026-03-03.md`](docs/08-reports/database/advisor-unused-index-batching-2026-03-03.md)  
**Status:** In Progress

**Issue:**  
Advisor reports 34 unused indexes, but these are FK-protected.

**Remediation:**  
Follow the staged cleanup process from the remediation plan.

---

### LOW-05: Missing Database Documentation

**Severity:** Low  
**Status:** Documentation

**Issue:**  
No comprehensive ERD or schema documentation found.

**Remediation:**  
Generate schema documentation and ERD from current state.

---

## Positive Findings

### Well-Implemented Patterns

1. **Security Hardening in Progress**
    - Recent migrations ([`20260320_fix_permissive_rls_policies.sql`](supabase/migrations/20260320_fix_permissive_rls_policies.sql), [`20260320_security_fix_rls_policies.sql`](supabase/migrations/20260320_security_fix_rls_policies.sql)) address permissive RLS policies
    - `FORCE ROW LEVEL SECURITY` applied to sensitive tables

2. **Proper Tenant Isolation**
    - All tables have `restaurant_id` for multi-tenancy
    - RLS policies consistently check `restaurant_staff` membership

3. **Idempotent Migration Patterns**
    - Most migrations use `IF EXISTS`/`IF NOT EXISTS`
    - DO blocks for conditional logic

4. **CHECK Constraints for Data Validation**
    - Extensive use of CHECK constraints for status fields
    - Numeric validation for prices and quantities

5. **Proper Cascade Behavior**
    - `ON DELETE CASCADE` for tenant-scoped data
    - `ON DELETE SET NULL` for audit trails

6. **Security Definer Functions Hardened**
    - [`20260303195500_security_definer_hardening_stage4.sql`](supabase/migrations/20260303195500_security_definer_hardening_stage4.sql) adds explicit `search_path`

7. **FK-Covering Index Protection**
    - [`fk-protected-keep-list-2026-03-03.md`](docs/08-reports/database/fk-protected-keep-list-2026-03-03.md) documents protected indexes

---

## Remediation Priority

### Immediate (Pre-Production Blockers)

1. **CRIT-01:** Fix exposed `auth.users` in view
2. **HIGH-06:** Reconcile missing migrations
3. **HIGH-05:** Add `security_invoker` to views

### Short-Term (First Sprint)

1. **HIGH-02:** Add pagination to active order queries
2. **HIGH-03:** Fix N+1 query in KDS station query
3. **HIGH-07:** Implement explicit column selection for hot queries
4. **MED-05:** Add search_path to trigger functions

### Medium-Term (Second Sprint)

1. **HIGH-01:** Complete RLS policy hardening
2. **MED-01:** Standardize migration idempotency
3. **MED-02:** Verify RLS predicate indexes
4. **MED-06:** Add batch processing to notification queue

### Long-Term (Ongoing)

1. **MED-07:** Complete FK index audit
2. **MED-10:** Add composite indexes based on query analysis
3. **LOW-01:** Add migration documentation
4. **LOW-02:** Standardize index naming

---

## Verification Checklist

Before production deployment, verify:

- [ ] All migrations applied successfully
- [ ] RLS policies tested with different user roles
- [ ] Performance benchmarks for critical queries
- [ ] Connection pooling configured
- [ ] Realtime publications configured
- [ ] Backup and restore tested
- [ ] Index usage verified with `EXPLAIN ANALYZE`
- [ ] Security advisor warnings resolved

---

## Appendix: Key Files Reviewed

| Category        | Files                              |
| --------------- | ---------------------------------- |
| Migrations      | 89 files in `supabase/migrations/` |
| Repositories    | `src/domains/*/repository.ts`      |
| Supabase Config | `src/lib/supabase/*.ts`            |
| Reports         | `docs/08-reports/database/*.md`    |
| Tracking        | `missing_migrations.json`          |

---

**Audit Completed By:** Architect Mode  
**Next Review:** Post-remediation verification recommended
