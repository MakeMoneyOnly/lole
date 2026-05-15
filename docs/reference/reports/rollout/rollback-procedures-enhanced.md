# Enhanced Rollback Procedures

Last updated: 2026-04-10
Scope: All lole production systems (application, database, feature flags)

## Overview

This document provides comprehensive rollback procedures for lole's production environment, covering application deployments, database migrations, and feature flags. It extends the base rollback procedures in [rollback-procedures.md](./../../implementation/rollback-procedures.md) with database and feature-flag rollback strategies, a decision tree, verification checklists, and communication templates.

**Rollback mechanisms in priority order:**

1. Feature flag rollback — fastest, no redeploy needed
2. Deploy rollback — reverts application code
3. Database migration rollback — last resort, requires caution

---

## Deploy Rollback

Summarized from [rollback-procedures.md](./../../implementation/rollback-procedures.md). Refer to that document for full details.

### Vercel CLI Rollback

```bash
vercel rollback --token=$VERCEL_TOKEN
```

For targeted rollbacks:

```bash
vercel rollback dpl_xxxxx --token=$VERCEL_TOKEN
```

### GitHub Actions Workflow Rollback

1. Navigate to **Actions** → **Rollback** in the GitHub repository
2. Click **Run workflow**
3. Select rollback type: `previous`, `deployment_id`, or `versions_back`
4. Provide environment (`production` or `staging`) and reason
5. Execute

Via API:

```bash
gh api -X POST /repos/{owner}/{repo}/actions/workflows/rollback.yml/dispatches \
  -f ref=main \
  -f inputs='{"environment":"production","rollback_type":"previous","reason":"Critical bug fix"}'
```

### Local Script Rollback

```bash
./scripts/rollback.sh --environment production --type previous --reason "Payment processing failure"
```

Windows PowerShell:

```powershell
.\scripts\tools\rollback.ps1 -Environment production -Type previous -Reason "Payment processing failure"
```

**Time to effect:** 2–5 minutes depending on Vercel build propagation.

---

## Database Migration Rollback

### Reverting a Supabase Migration

Mark a migration as reverted so Supabase does not re-apply it on subsequent pushes:

```bash
supabase migration repair --status reverted <migration-id>
```

The `migration-id` corresponds to the timestamp-prefixed folder name in `supabase/migrations/` (e.g., `20260410120000`).

After marking the migration as reverted, write and apply a **reverse migration** that undoes the schema changes:

```bash
supabase migration new revert_<migration-id>
```

Edit the generated file to contain the inverse SQL (drop added columns/tables, restore renamed columns, etc.).

### Safe Phased Rollback

For non-emergency migration rollbacks, follow this sequence to avoid data inconsistency:

1. **Disable app writes** — Set `PILOT_BLOCK_MUTATIONS=true` or disable the affected feature flag to stop application code from writing to the affected tables.
2. **Drain in-flight requests** — Wait 30 seconds for ongoing queries to complete.
3. **Apply reverse migration** — Run the revert migration.
4. **Verify schema** — Confirm the database schema matches the expected state.
5. **Re-enable writes** — Remove the mutation block or re-enable the feature flag.

### When NOT to Rollback a Migration

Do **not** attempt a migration rollback if:

- The migration performed **destructive data changes** (e.g., `DROP COLUMN`, `DROP TABLE`, `DELETE` without backup). Reverting will not recover lost data.
- The migration has **dependent subsequent migrations** that rely on its schema. Rolling back the base migration will break all dependents.
- The migration added a **non-nullable column with a default** and production data has been written to it. Rolling back drops that column and its data.
- The migration changed **data types** in a way that truncated or transformed values irreversibly.

In these cases, prefer a **forward fix**: write a new migration that corrects the issue rather than reverting.

### Emergency: Disable Constraint Checks

If a migration rollback is blocked by foreign key or check constraints and the situation is Sev1, you can temporarily disable constraint enforcement:

```sql
ALTER TABLE affected_table DISABLE TRIGGER ALL;
-- Perform the rollback operations
ALTER TABLE affected_table ENABLE TRIGGER ALL;
```

**Warning:** This disables all triggers including RLS policies. Only use during active Sev1 incidents and re-enable immediately after the rollback is complete. Document the action in the incident record.

---

## Feature Flag Rollback

Feature flag rollbacks are the **fastest rollback mechanism** (< 2 minutes) because they require no redeploy.

### Environment Variable Flag Rollback (< 2 min)

Set the kill switch in the Vercel dashboard under **Settings → Environment Variables**:

```bash
# Kill a specific feature
FEATURE_KILL_TELEBIRR_PAYMENTS=true
FEATURE_KILL_CHAPA_PAYMENTS=true
FEATURE_KILL_ERCA_SUBMISSIONS=true

# Block all pilot mutations (emergency read-only mode)
PILOT_BLOCK_MUTATIONS=true
```

Trigger a redeploy for the change to take effect (Vercel environment variable changes propagate within 60 seconds after redeploy).

### Pilot Restaurant Allowlist Modification

Narrow or clear the pilot restaurant list to immediately limit feature exposure:

```bash
# Remove all pilot restaurants (disable feature for everyone)
# Set in Vercel environment variables:
PILOT_RESTAURANT_IDS=
```

To remove a specific restaurant from the pilot, update the comma-separated list excluding that restaurant's ID.

To restrict to a minimal safe subset:

```bash
PILOT_RESTAURANT_IDS=<founder-test-restaurant-id>
```

### Mutation Blocking Emergency Lever

Set `PILOT_BLOCK_MUTATIONS=true` to immediately put the platform into read-only mode. This:

- Blocks all write operations (order creation, payment processing, status updates)
- Preserves read access so staff can view existing orders and KDS state
- Returns `PILOT_MUTATION_BLOCK_ENABLED` response for blocked write attempts

Use this when the nature of the issue is unclear and you need to stop data corruption while investigating.

### Tier 2 Database Flags

For granular control over individual features per restaurant or globally:

```sql
-- Disable a feature globally
UPDATE feature_flags
SET enabled_globally = false, rollout_percent = 0
WHERE flag_key = 'discount_engine';

-- Disable a feature for a specific restaurant
UPDATE restaurant_feature_flags
SET enabled = false, notes = 'Rolled back — 2026-04-10 payment error'
WHERE restaurant_id = '{restaurant_id}' AND flag_key = 'discount_engine';
```

Reference: [Feature Flags & Release Strategy](./../../03-product/feature-flags.md)

---

## Rollback Decision Tree

Use this decision tree to determine which rollback mechanism to apply:

```
Issue detected in production
│
├─ Is the issue in application code (UI, API logic, routing)?
│  └─ YES → Deploy rollback
│     - Vercel CLI: vercel rollback
│     - GitHub Actions: Run rollback workflow
│     - Local script: ./scripts/rollback.sh
│
├─ Is the issue in database schema (migration broke a table, constraint, or index)?
│  └─ YES → Migration rollback (with caution)
│     - Can the migration be safely reversed without data loss?
│       - YES → Apply reverse migration (see Database Migration Rollback)
│       - NO → Write a forward-fix migration instead
│     - Is this a Sev1 emergency?
│       - YES → Consider DISABLE TRIGGER ALL if constraints block rollback
│
├─ Is the issue in feature flag logic (flag enabled too broadly, flag logic error)?
│  └─ YES → Flag rollback
│     - Env var kill switch (< 2 min)
│     - Pilot allowlist modification
│     - Database flag update (< 5 min)
│
├─ Is the issue across multiple systems (deploy + migration + flags)?
│  └─ YES → Coordinate all three
│     1. Feature flag rollback first (stop the bleeding)
│     2. Deploy rollback second (revert code)
│     3. Migration rollback last (if needed, with caution)
│     4. Verify all systems (see Post-Rollback Verification Checklist)
│
└─ Unclear root cause?
   └─ Start with PILOT_BLOCK_MUTATIONS=true (stop writes)
      Then investigate while platform is in safe read-only state
```

---

## Post-Rollback Verification Checklist

After executing any rollback, verify each system before declaring the incident mitigated:

- [ ] **Application serving traffic** — Verify `GET /api/health` returns 200. Confirm Vercel deployment is active and not in error state.
- [ ] **Database queries succeeding** — Run a representative query against each affected table. Confirm no constraint violations or missing column errors.
- [ ] **Real-time subscriptions active** — Verify Supabase realtime channels are connected. Confirm KDS and order status updates are propagating in real-time (P95 <= 2s).
- [ ] **Payment processing functional** — Submit a test payment via Telebirr or Chapa on the founder's test restaurant. Confirm webhook confirmation is received.
- [ ] **KDS receiving orders** — Create a test order and confirm it appears on the KDS station within the SLO (P95 <= 2s).
- [ ] **Error rates normal** — Confirm Sentry error rate is below 1% baseline. Check Vercel function error logs.
- [ ] **Latency within SLO** — Confirm P0 endpoints meet SLO targets:
    - `GET /api/merchant/command-center` P95 <= 500ms
    - `GET /api/orders` P95 <= 400ms
    - `PATCH /api/orders/:id/status` P95 <= 300ms
- [ ] **Feature flags in expected state** — Verify `isFeatureEnabled()` returns expected values for the rollback state. Confirm no unintended flag side-effects.

---

## Communication Templates

### Internal Communication (Telegram #engineering)

```
🔄 ROLLBACK INITIATED

**Reason:** [Brief description of what went wrong]
**Type:** [Deploy / Migration / Feature Flag]
**Environment:** [production / staging]
**ETA:** [Expected time for rollback to complete]
**IC:** @username

Rolling back deployment due to [reason]. ETA: [time]. CC: @engineering
```

### Internal Update (After Rollback Complete)

```
✅ ROLLBACK COMPLETE

**Duration:** [X minutes]
**Verification:** [All checks passed / Specific check failed]
**Current State:** [Production on previous stable deploy]
**Next Steps:** [Root cause investigation / Hotfix plan]

IC: @username
```

### External Communication (Merchant-Facing)

**English:**

```
We are investigating reports of [issue]. All systems will be restored shortly.
We apologize for any disruption to your service.
```

**Amharic:**

```
ስለ [ችግሩ] የተነሱ ሪፖርቶችን እያጣራን ነው። ሁሉም ስርዓቶች በቅርቡ ይመለሳሉ።
ለማስቸገራችሁ እንቃኙራለን።
```

---

## AGENTS.md Path Fix Note

The path referenced in `AGENTS.md` as `docs/implementation/p0-release-readiness-and-rollback.md` should be corrected to `docs/08-reports/rollout/p0-release-readiness-and-rollback.md`. The document lives under the rollout reports directory, not under `docs/implementation/`.

---

## Related Documentation

- [Rollback Procedures (Base)](./../../implementation/rollback-procedures.md)
- [P0 Release Readiness and Rollback](./p0-release-readiness-and-rollback.md)
- [Feature Flags & Release Strategy](./../../03-product/feature-flags.md)
- [Incident Triage Rubric](./../../09-runbooks/incident-triage-rubric.md)
- [Incident Response Plan](./../../09-runbooks/incident-response-plan.md)
