# PostgreSQL/Supabase Stage Execution Log (2026-03-03)

## Baseline Snapshot (Live)

- Captured on: `2026-03-03`
- RLS-enabled public tables: `44`
- FORCE RLS public tables: `20`
- Not-forced public tables: `24`
- FK-protected zero-scan indexes (keep): `34`
- Public/anon mutating policies (`INSERT`/`UPDATE`/`DELETE`/`ALL`): `3`
- `SECURITY DEFINER` functions in `public`: `9` (`5` currently `search_path=public`)

## Stage 0: Leaked Password Protection

- Status: `deferred_until_paid_plan`
- Constraint: Supabase Free plan in development; enablement deferred until deployment on paid plan.
- Action on deploy day: enable leaked password protection in Supabase Auth settings.
- Verification after enablement: rerun advisors and confirm `auth_leaked_password_protection` is cleared.
- Evidence placeholder:
    - Operator:
    - Timestamp:
    - Advisor recheck timestamp:

## Stage 1: FK Protected Keep Governance

- Status: `completed`
- Artifacts:
    - `docs/implementation/fk-protected-keep-list-2026-03-03.md`
    - `supabase/sql/fk_protected_keep_verification.sql`
- Verification:
    - Expected count: `34`
    - Query file: `supabase/sql/fk_protected_keep_verification.sql`

## Stage 2: FORCE RLS Rollout

- Batch 1 status: `completed`
- Migration:
    - `supabase/migrations/20260303190000_force_rls_stage2_batch1_low_risk.sql`
- Tables in batch 1:
    - `public.agency_users`
    - `public.alert_events`
    - `public.alert_rules`
    - `public.delivery_partners`
    - `public.inventory_items`
    - `public.purchase_orders`
    - `public.recipe_ingredients`
    - `public.recipes`
    - `public.shifts`
    - `public.stock_movements`
    - `public.supplier_invoices`
    - `public.support_tickets`
- Post-apply verification SQL:

```sql
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'agency_users','alert_events','alert_rules','delivery_partners',
    'inventory_items','purchase_orders','recipe_ingredients','recipes',
    'shifts','stock_movements','supplier_invoices','support_tickets'
  )
order by c.relname;
```

## Stage 3: Public/Anon Mutating Policy Tightening

- Batch 1 status: `completed`
- Migration:
    - `supabase/migrations/20260303193000_policy_scope_tightening_stage3_batch1.sql`
- Batch 2 status: `completed`
- Migration:
    - `supabase/migrations/20260303194500_policy_hardening_stage3_batch2_guest_flows.sql`
- Current count: `3`
- Remaining intentional guest-facing policies:
    - `orders` -> `Guests can create orders`
    - `rate_limit_logs` -> `Anyone can insert rate_limit_logs`
    - `service_requests` -> `Guest can create service requests with valid tenant data`
- Batch 2 controls added:
    - `orders`: requires idempotency key, bounded payload shape, and guest fingerprint rate cap (`<5` per 10 minutes per fingerprint/restaurant).
    - `service_requests`: stricter tenant/table/request validation and duplicate-spam cap (`<3` per 2 minutes per table/request type).
    - `rate_limit_logs`: expanded allowed action set for current middleware keys, bounded field lengths/metadata shape, and insert spam cap (`<240` per minute per fingerprint/action).
- Next action: monitor rejection rates/errors in API logs for one release cycle.

## Stage 4: SECURITY DEFINER Hardening

- Status: `completed`
- Migration:
    - `supabase/migrations/20260303195500_security_definer_hardening_stage4.sql`
- Hardened functions:
    - `public.bootstrap_merchant_for_auth_user()`
    - `public.check_merchant_item_updates()`
    - `public.get_my_staff_role(uuid)`
    - `public.is_agency_admin()`
    - `public.validate_item_update()`
- Result:
    - all 5 now use `search_path=pg_catalog, public`
    - table references in modified bodies are schema-qualified

## Stage 5: Evidence-Based Index Revisit

- Status: `in_progress`
- SQL bundle:
    - `supabase/sql/stage5_evidence_window_00_init_and_reset.sql`
    - `supabase/sql/stage5_evidence_window_01_capture_snapshot.sql`
    - `supabase/sql/stage5_evidence_window_02_analysis_queries.sql`
- Executed:
    - `stage5_evidence_window_init_and_reset` applied on `2026-03-03 18:56:52+00`
    - first snapshot captured on `2026-03-03 18:57:10+00`
- Runtime notes:
    - `extensions.pg_stat_statements_reset()` succeeded
    - `pg_catalog.pg_stat_reset()` skipped due to insufficient privilege (expected in hosted environments)
- Initial snapshot counts:
    - index snapshots: `165`
    - query-stat snapshots: `19`
- Runbook:
    - `docs/implementation/stage5-evidence-window-sql-bundle-2026-03-03.md`
- Automation configured:
    - `.github/workflows/stage5-daily-snapshot.yml`
    - `.github/workflows/stage5-end-window-analysis.yml`
- Next action:
    - set `SUPABASE_DB_URL` in GitHub Actions secrets
    - monitor daily workflow runs for 2-4 weeks
    - review analysis artifact after end-window workflow execution
