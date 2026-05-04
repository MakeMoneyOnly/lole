# RLS Audit Report — BKND-032

**Date:** 2026-05-04
**Auditor:** lole Platform Engineering
**Source:** Reference schema (000001_base_schema_reference.sql) + 151 incremental migrations

**2026-05-04:** M1-M3 resolved. Migration `20260504100000_fix_rls_medium_findings` adds FORCE RLS to 4 operational tables, enables RLS on tenants, removes 5 redundant service_role policies.

## Summary

| Metric                                       | Value                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| Tables in public schema                      | ~85                                                                    |
| Tables with RLS enabled                      | 84                                                                     |
| Tables with FORCE RLS                        | 81                                                                     |
| Tables WITHOUT RLS                           | 1 (`restaurant_plan_info` — view, not a table)                         |
| Tables WITHOUT FORCE RLS                     | 2 (`failed_events`, `audit_logs_archive` — resolved by 20260504083000) |
| Permissive policies (deliberate anon/public) | 7                                                                      |
| Permissive policies (unscoped — needs fix)   | 0                                                                      |
| Security invoker views                       | 7 (all confirmed `security_invoker=on`)                                |
| Security definer functions                   | ~23 (all hardened with explicit search_path)                           |
| HIGH-risk findings                           | 0                                                                      |
| MEDIUM-risk findings                         | 0                                                                      |
| LOW-risk findings                            | 4                                                                      |
| **Verdict**                                  | **PASS — 0 HIGH, 0 MEDIUM, 4 LOW. All actionable findings resolved.**  |

**2026-05-04:** HIGH findings resolved. Migration `20260504083000_fix_rls_failed_events_audit_archive` adds `TO service_role` + `FORCE RLS` to `failed_events` and `audit_logs_archive`.

## Detailed Findings

### 1. RLS Coverage

**RLS enabled on 84 of ~85 tables.** One remaining entry in the public schema is a view (not a table):

| Table                         | Risk                 | Rationale                                                                                                                                    |
| ----------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `tenants`                     | ~~MEDIUM~~ **FIXED** | Multi-tenant root table. Contains `api_key`. RLS enabled + FORCE RLS via `20260504100000_fix_rls_medium_findings`. Service role-only policy. |
| `restaurant_plan_info` (view) | LOW                  | This is a view, not a table. RLS applies at base-table level. View has `security_invoker=on` so underlying RLS is enforced.                  |

### 2. Tables WITHOUT FORCE RLS

**All tables now have FORCE RLS.** The 4 operational tables below were fixed by `20260504100000_fix_rls_medium_findings` (M1). `failed_events` and `audit_logs_archive` were previously fixed by `20260504083000_fix_rls_failed_events_audit_archive`.

| Table                   | Risk               | Notes                                                                                                 |
| ----------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| `system_health`         | LOW                | ~~Monitoring table. Policy: `FOR SELECT TO authenticated USING (true)`.~~ **FIXED**: FORCE RLS added. |
| `system_health_monitor` | LOW                | **FIXED**: FORCE RLS added.                                                                           |
| `rate_limit_logs`       | LOW                | **FIXED**: FORCE RLS added.                                                                           |
| `workflow_audit_logs`   | LOW                | **FIXED**: FORCE RLS added.                                                                           |
| `failed_events`         | ~~HIGH~~ **FIXED** | DLQ for failed events. TO service_role + FORCE RLS added via 20260504083000.                          |
| `audit_logs_archive`    | ~~HIGH~~ **FIXED** | Historical audit data. TO service_role + FORCE RLS added via 20260504083000.                          |

### 3. Permissive Policies

#### 3.1 Deliberate Anon/Public Access (ACCEPTED)

These policies use `USING (true)` or `WITH CHECK (true)` intentionally for guest-facing flows:

| Table              | Policy                             | Scope                         | Rationale                        |
| ------------------ | ---------------------------------- | ----------------------------- | -------------------------------- |
| `tables`           | "Public tables are viewable"       | SELECT to all                 | Guests scan QR → need table info |
| `orders`           | "Anon Insert Orders"               | INSERT to anon, authenticated | Guest ordering flow              |
| `order_items`      | "Anon Insert Order Items"          | INSERT to anon, authenticated | Guest ordering flow              |
| `order_items`      | "Public can view order_items"      | SELECT to all                 | Guest views their order          |
| `payment_sessions` | "Anon can insert payment sessions" | INSERT to anon, authenticated | Guest initiates payment          |
| `service_requests` | "Anon can insert service_requests" | INSERT to anon, authenticated | Guest requests service           |
| `reviews`          | "Public can read reviews"          | SELECT to all                 | Public social proof              |

All above are intentional and scoped to `anon`/`authenticated` or public SELECT for their specific operations. Staff write operations on these tables use separate tenant-scoped policies.

#### 3.2 Service Role Redundant Policies (LOW — resolved)

Five Ethiopian compliance tables had explicit `FOR ALL TO service_role USING (true) WITH CHECK (true)` policies:

- `merchant_tax_config`
- `merchant_vat_ledger`
- `merchant_wht_receipts`
- `merchant_bank_accounts`
- `merchant_fiscal_days`

These were redundant — `service_role` bypasses RLS by default in Supabase. **FIXED**: Removed by `20260504100000_fix_rls_medium_findings` (M3). Migration `20260324000002_remove_redundant_service_role_policies.sql` removed similar policies from other tables; these were added later by `20260416180000` and have now been cleaned up.

#### 3.3 Unscoped Permissive Policies (HIGH — resolved)

| Table                | Policy                                       | Issue                                                                                                    |
| -------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `failed_events`      | "Service role can manage failed_events"      | **FIXED**: `TO service_role` added + FORCE RLS via `20260504083000_fix_rls_failed_events_audit_archive`. |
| `audit_logs_archive` | "Service role can manage audit_logs_archive" | **FIXED**: `TO service_role` added + FORCE RLS via `20260504083000_fix_rls_failed_events_audit_archive`. |

~~These policies were intended for service_role only but the `TO service_role` clause is missing, making them effectively `FOR ALL TO public`. Combined with no FORCE RLS, any authenticated user can read, insert, update, or delete from these operational tables.~~

#### 3.4 Loosely Scoped Monitoring Policies (LOW)

| Table                   | Policy                                        | Notes                                                                                               |
| ----------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `system_health`         | "Service role can view system_health"         | `FOR SELECT TO authenticated USING (true)` — any authenticated user can read. Low sensitivity data. |
| `system_health_monitor` | "Service role can view system_health_monitor" | Same pattern.                                                                                       |
| `rate_limit_logs`       | "Service role can view rate_limit_logs"       | Same pattern. Contains IP addresses. Could be tightened.                                            |
| `workflow_audit_logs`   | "Service role can view workflow_audit_logs"   | Same pattern. Internal infra data.                                                                  |

### 4. Security Invoker Views

All 7 public schema views have `security_invoker = on` confirmed:

| View                            | Last Hardened  |
| ------------------------------- | -------------- |
| `restaurant_staff_with_users`   | 20260408150000 |
| `delivery_partner_integrations` | 20260408150000 |
| `active_menu_items`             | 20260408150000 |
| `active_restaurants`            | 20260408150000 |
| `active_tables`                 | 20260408150000 |
| `active_restaurant_staff`       | 20260408150000 |
| `restaurant_plan_info`          | 20260408150000 |

No findings. The `restaurant_plan_info` view is not listed in the reference schema but is handled by migration.

### 5. Security Definer Functions

Approximately 23 SECURITY DEFINER functions identified across all migrations. All have been hardened with explicit `search_path` per migration `20260408120000_security_advisor_function_search_path.sql`:

**Hardening stages:**

1. Stage 4 (20260303195500): Hardened 5 functions (bootstrap_merchant_for_auth_user, check_merchant_item_updates, get_my_staff_role, is_agency_admin, validate_item_update)
2. Advisor fix (20260408120000): Hardened 18 additional functions by injecting `SET search_path = pg_catalog, public` via dynamic DDL
3. TimescaleDB fix (20260403150000): Fixed search_path for TimescaleDB-related SECURITY DEFINER functions
4. Late additions (20260503231000): `archive_old_audit_logs` uses `SET search_path = ''` (most secure — pg_catalog only)

**Verification:** Migration 20260408120000 includes a DO block that verifies all SECURITY DEFINER functions in the public schema have search_path set. No unhardened functions remain.

### 6. Anon/Authenticated Access Summary

Tables with anon-accessible policies (guest-facing):

- `orders` — anon INSERT
- `order_items` — anon INSERT, public SELECT
- `payment_sessions` — anon INSERT
- `service_requests` — anon INSERT
- `tables` — public SELECT
- `reviews` — public SELECT

All appropriately scoped to INSERT-only for write operations, with staff write operations on separate tenant-scoped policies.

Tables with authenticated-only policies: ~70 tables, all using `EXISTS (SELECT 1 FROM restaurant_staff rs WHERE rs.user_id = (select auth.uid()) AND rs.restaurant_id = <table>.restaurant_id)` tenant-scoping pattern.

## Recommendations

### HIGH Priority (resolved)

1. **Fix `failed_events` RLS** — **FIXED** by `20260504083000_fix_rls_failed_events_audit_archive`.

2. **Fix `audit_logs_archive` RLS** — **FIXED** by `20260504083000_fix_rls_failed_events_audit_archive`.

### MEDIUM Priority (resolved)

3. **Add FORCE RLS to operational tables**: `system_health`, `system_health_monitor`, `rate_limit_logs`, `workflow_audit_logs` — **FIXED** by `20260504100000_fix_rls_medium_findings` (M1).

4. **RLS for `tenants` table**: Contains `api_key`. **FIXED** by `20260504100000_fix_rls_medium_findings` (M2). RLS enabled + FORCE RLS + service_role-only policy.

5. **Clean up redundant service_role policies**: Remove the 5 explicit `FOR ALL TO service_role USING (true) WITH CHECK (true)` policies from Ethiopian compliance tables. **FIXED** by `20260504100000_fix_rls_medium_findings` (M3).

### LOW Priority (continuous improvement)

6. **Tighten monitoring table policies**: `system_health`, `system_health_monitor`, `rate_limit_logs`, `workflow_audit_logs` grant `FOR SELECT TO authenticated USING (true)`. Consider scoping to `service_role` only if these are purely operational/internal.

7. **Update reference schema**: `000001_base_schema_reference.sql` does not include tables from several migrations (marketing_campaigns, campaign_recipients, email_templates, guest_unsubscribes, guest_push_preferences, failed_events, audit_logs_archive). Regenerate for completeness.

## Audit Evidence

### Files Reviewed

- `supabase/sql/000001_base_schema_reference.sql` (3085 lines — full review)
- `supabase/migrations/20260408130000_security_advisor_fix_permissive_policies.sql`
- `supabase/migrations/20260320_fix_permissive_rls_policies.sql`
- `supabase/migrations/20260408110000_security_advisor_enable_rls_and_policies.sql`
- `supabase/migrations/20260403151000_force_rls_critical_tables.sql`
- `supabase/migrations/20260408120000_security_advisor_function_search_path.sql`
- `supabase/migrations/20260408150000_security_advisor_security_invoker_views.sql`
- `supabase/migrations/20260416180000_ethiopian_financial_compliance.sql`
- `supabase/migrations/20260503220000_p0_failed_events_dlq.sql`
- `supabase/migrations/20260503231000_p1_audit_log_retention.sql`
- Grep across all `supabase/sql/` and `supabase/migrations/` for RLS patterns

### Methodology

1. Full line-by-line review of reference schema for table definitions, RLS enable/force, policy definitions, views, triggers, and functions
2. Keyword grep for `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, `SECURITY DEFINER`, `security_invoker`, `USING (true)`, `WITH CHECK (true)` across all SQL files
3. Manual audit of each permissive policy for intentionality and scope
4. Verification that security invoker is set on all views
5. Verification that all SECURITY DEFINER functions have search_path
