# PostgreSQL/Supabase Remediation Stages (2026-03-03)

## Purpose

Convert the latest database audit findings into an enterprise-grade, staged execution plan that is safe, testable, and reversible.

## Inputs and Scope

- Audit date: 2026-03-03
- Skills used: `postgres-schema-design`, `supabase-postgres-best-practices`
- Related docs:
    - `TOAST_FEATURE_AUDIT.md`
    - `docs/implementation/performance-slos.md`
    - `docs/implementation/p2-peak-flow-load-tests.md`
    - `docs/implementation/p0-release-readiness-and-rollback.md`
    - `docs/implementation/security-endpoint-checklist.md`

## Current Findings (Baseline)

- Unused index summary:
    - `total_zero_scan_non_unique = 34`
    - `non_hot_zero_scan_non_unique = 20`
    - `fk_only_covering_zero_scan = 34`
    - `non_fk_protected_zero_scan = 0`
- Security advisor: `auth_leaked_password_protection = WARN`
- RLS posture:
    - Public tables with RLS enabled: `44`
    - FORCE RLS enabled: `8`
    - Not forced: `36`
- Policy posture:
    - `12` mutating policies (`INSERT`/`UPDATE`/`DELETE`/`ALL`) assigned to `public`
- Function hardening:
    - `9` `SECURITY DEFINER` functions in `public`
    - `5` use `search_path=public`

## Non-Negotiable Decisions

- Freeze further index drops now.
- Classify all `34` FK-covering zero-scan indexes as `FK_PROTECTED_KEEP`.
- No FK-covering index change without same-stage alternate index migration and rollback SQL.

## Stage 0: Immediate Security Fix (Day 0)

## Goal

Remove highest-value low-effort auth risk immediately.

## Actions

- Enable Supabase Auth leaked password protection in project Auth settings.
- Capture screenshot/evidence and timestamp in release notes.

## Exit Criteria

- Supabase advisor no longer reports `auth_leaked_password_protection`.

## Rollback

- Not recommended. If temporarily disabled for incident mitigation, open Sev-tracked follow-up and re-enable within same release window.

## Stage 1: Index Exception Runbook (Days 0-2)

## Goal

Stop unsafe index churn and codify accepted exceptions.

## Actions

- Create and maintain a runbook table or markdown section listing all `34` indexes as `FK_PROTECTED_KEEP`.
- For each index, capture:
    - table
    - index definition
    - covered FK
    - current read/write profile
    - review owner
    - next review date
- Mark status as `accepted_exception` and require quarterly revalidation.

## Exit Criteria

- All `34` indexes documented and approved by DB owner.
- CI/review checklist updated to block dropping FK-only indexes without replacement plan.

## Rollback

- N/A (documentation and governance control).

## Stage 2: FORCE RLS Rollout (Weeks 1-2)

## Goal

Raise tenant isolation posture from RLS-enabled to enforced-RLS on sensitive tables.

## Rollout Order

1. Low-risk internal tables (read-heavy, low mutation).
2. Medium-risk operational tables.
3. High-risk tenant-critical tables (`orders`, `payments`, `table_sessions`, `kds_*`, related financial/audit tables).

## Actions Per Batch

- Add migration in `supabase/migrations/*.sql`:
    - `alter table ... force row level security;`
- Validate all table policies still permit required service/user paths.
- Ensure policy predicate columns are indexed.
- Run integration tests for tenant isolation and happy-path CRUD.
- Run targeted smoke tests for staff workflows on mobile-width surfaces.

## Exit Criteria

- `FORCE RLS` enabled on all target sensitive multi-tenant tables.
- No Sev1/Sev2 authz regression in changed scope.

## Rollback

- Revert specific table from `FORCE` to `ENABLE` only if production block occurs, with incident ticket and same-day hotfix plan.

## Stage 3: Public Mutating Policy Tightening (Weeks 2-3)

## Goal

Minimize anonymous mutation surface while preserving intentional guest flows.

## Actions

- Inventory the `12` public mutating policies table-by-table.
- For each policy, classify:
    - `required_guest_flow`
    - `replace_with_authenticated_or_service_path`
    - `remove`
- Apply controls for retained public mutating paths:
    - strict input validation
    - rate limits
    - abuse logging/audit trail
    - narrow predicates and least-privilege grants
- Remove or narrow non-essential public mutating policies via migration.

## Exit Criteria

- Every remaining public mutating policy has documented business justification and threat controls.
- Removed/replaced policies validated by regression tests and endpoint checklist.

## Rollback

- Reintroduce only the minimal policy needed to restore a broken critical flow, with explicit expiry and follow-up hardening task.

## Stage 4: SECURITY DEFINER Hardening (Weeks 3-4)

## Goal

Remove search-path and privilege-escalation footguns in definer functions.

## Actions

- For all `9` `SECURITY DEFINER` functions in `public`:
    - set explicit secure `search_path` (for example: `pg_catalog, public` or tighter schema list as needed)
    - fully schema-qualify object references
    - keep ownership/execute grants least-privilege
- Prioritize the `5` functions currently on `search_path=public`.
- Add migration scripts that are idempotent where practical.

## Exit Criteria

- No `SECURITY DEFINER` function in exposed schema depends on broad/unqualified search path.
- Advisor/security review confirms no regressions.

## Rollback

- Restore prior function definition only for service-impact incidents, with immediate follow-up patch adding safer qualification.

## Stage 5: Evidence-Based Index Revisit (Weeks 4-8)

## Goal

Reassess FK-protected exceptions only with production-like evidence.

## Actions

- Reset relevant DB stats at start of measurement window.
- Execute representative load tests from `docs/implementation/p2-peak-flow-load-tests.md`.
- Collect `pg_stat_statements` and index usage for 2-4 weeks.
- Reconsider any index only if:
    - alternate non-partial FK-leading index is proposed in same migration stage
    - EXPLAIN ANALYZE and SLO impact are validated before/after
    - rollback SQL is included

## Exit Criteria

- Decision log updated with keep/drop rationale and measured impact.
- No change merged without migration + rollback + benchmark evidence.

## Rollback

- Recreate dropped index immediately via pre-baked rollback SQL.

## Test and Release Gates (All Stages)

- Migration safety:
    - idempotent guards where practical
    - explicit rollback path
- Security:
    - authz and tenant-scope checks for changed paths
    - no secret/PII leakage in logs
- Performance:
    - no regression against `docs/implementation/performance-slos.md`
- Reliability:
    - feature flags/rollout controls for risky behavior changes
- Verification:
    - run Supabase advisors after each stage and triage findings immediately

## Ownership and Cadence

- DB/Security owner: approves policy/function/index changes.
- API owner: validates endpoint authz and rate-limit posture after policy changes.
- Release owner: enforces stage gates from `docs/implementation/release-cadence.md` and rollback readiness.

## Tracking Template (Use Per Stage)

- Stage:
- Scope/tables/functions:
- Migration file(s):
- Risk level:
- Tests executed:
- Advisor results (before/after):
- SLO check result:
- Rollback artifact verified:
- Approver(s):
- Completion date:
