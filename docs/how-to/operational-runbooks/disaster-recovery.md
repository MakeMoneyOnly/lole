# lole — Disaster Recovery & Business Continuity Plan

**Version 1.0 · March 2026 · Confidential — Engineering & Operations**

> This document answers one question: when something catastrophic happens to lole's infrastructure, what exactly do we do, in what order, and how do we know when we are recovered? It is written to be executed at 2am by someone who is stressed and has not slept. Every step is explicit. Nothing is left to memory.

---

## Recovery Objectives

| Metric                             | Definition                                     | Target                                          |
| ---------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| **RTO** — Recovery Time Objective  | Maximum time from incident to service restored | < 30 min (P0) · < 2 hours (P1)                  |
| **RPO** — Recovery Point Objective | Maximum data loss acceptable                   | **Zero** — no completed orders or payments lost |
| **MTTR** — Mean Time to Recover    | Average measured recovery time                 | < 20 minutes target                             |

**Why zero RPO:** Completed orders and captured payments are a restaurant's revenue record. Losing them means reconciliation failures, ERCA submission gaps, and permanent trust damage. Our target state is Supabase WAL durability plus local-first store persistence. Important current dev caveat: PowerSync client bootstrap is wired, but end-to-end Supabase replication is still blocked until direct logical replication and the `powersync` publication are live. See `docs/01-foundation/powersync-supabase-dev-status.md`.

---

## Dependency Map

| Service           | Provider        | What fails if down                       | Restaurants operate without it?                                                            | Fallback          |
| ----------------- | --------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------- |
| PostgreSQL        | Supabase        | All data reads/writes, new orders        | **Target: Yes — 24h offline (local-first + PowerSync replay once unblocked)**              | Local-first state |
| Supabase Realtime | Supabase        | KDS live updates, guest tracker          | Yes — manual poll on reconnect                                                             | Polling           |
| Supabase Auth     | Supabase        | Staff login, JWT validation              | New logins fail. Existing sessions last ~1h.                                               | Cached JWT        |
| Redis + event bus | Upstash         | Menu cache, event fan-out, rate limiting | Yes — requests hit DB directly (slower)                                                    | Direct DB         |
| QStash job queue  | Upstash         | ERCA, loyalty awards, EOD reports        | Yes — jobs queue, no data loss                                                             | Backlog replay    |
| Apollo Router     | Railway         | GraphQL API                              | Yes — fallback to Next.js direct subgraph                                                  | Direct subgraph   |
| Vercel (app host) | Vercel          | Dashboard, PWA serving, API routes       | **Installed PWA continues offline**                                                        | PWA cache         |
| Cloudflare        | Cloudflare      | DNS, WAF, edge cache                     | Installed PWA still works                                                                  | Direct Vercel IP  |
| PowerSync         | PowerSync Cloud | Offline CRDT sync                        | Local device state continues; cloud convergence remains blocked in current dev environment | Local state       |
| Telebirr          | EthioTelecom    | Telebirr payment initiation              | Yes — cash + Chapa work                                                                    | Cash              |
| Chapa             | Chapa Ethiopia  | Card payment initiation                  | Yes — cash + Telebirr work                                                                 | Cash              |
| ERCA API          | ERCA            | VAT e-invoice submission                 | Yes — QStash queues and retries                                                            | Backlog           |
| Cloudflare R2     | Cloudflare      | Menu photos, receipt PDFs                | Yes — menus show without images                                                            | Text fallback     |

**The only single points of total failure:**

1. Vercel — if PWA is not yet installed on the tablet
2. Supabase Auth — for first staff login only

**The most important resilience action before going live with any restaurant:** install the PWA on every tablet. An installed PWA works offline indefinitely from its service worker cache.

---

## Scenario Runbooks

### Scenario A — Supabase Complete Outage

**Probability:** Low (Supabase Pro SLA: 99.9%)
**Detection:** Prometheus alert in <60s · Sentry DB errors spike · Axiom shows `ECONNREFUSED`

**Immediate restaurant impact:**

- Installed PWA → local device state continues, but do not assume full PowerSync cloud replay has been validated yet ⚠️
- Guest QR ordering → cannot place new orders (needs DB) ❌
- Dashboard → cached data only, KPIs stop updating ⚠️
- Telebirr/Chapa → cannot initiate (needs DB write) ❌ — **switch to cash**

**Response:**

```
Step 1 — VERIFY (2 min)
  Check: status.supabase.com
  Check: Supabase project dashboard SQL editor → run SELECT NOW()
  Check: is this affecting all restaurants (provider) or just one (config)?

Step 2 — COMMUNICATE (3 min)
  Telegram to all affected restaurants:
  "ስርዓቱ ጊዜያዊ ስህተት አለ — ጥሬ ገንዘብ ይቀበሉ — POS ታብሌቶቹ ይሰራሉ"
  "System has a temporary issue — accept cash — POS tablets are still working"

Step 3 — ACTIVATE OFFLINE PROTOCOL (5 min)
  → All restaurants: switch to cash-only payments
  → Confirm: KDS tablets showing cached orders (they should be)
  → Confirm: Termux print server still running (it is local — not affected)
  → Tell restaurants: keep taking orders — everything syncs when connection restores

Step 4 — MONITOR RECOVERY
  → Poll status.supabase.com every 5 minutes
  → When "All Systems Operational": run SELECT NOW() in SQL editor to confirm
  → Wait 2 additional minutes for full propagation before declaring restored

Step 5 — VERIFY DATA INTEGRITY POST-RECOVERY
  Run in Supabase SQL editor:

  -- Verify all offline orders synced
  SELECT COUNT(*), MIN(created_at), MAX(created_at)
  FROM orders
  WHERE created_at BETWEEN '{outage_start}' AND '{outage_end}';

  -- Check for orphaned order_items (order created but items missing)
  SELECT o.id, o.order_number, COUNT(oi.id) as item_count
  FROM orders o
  LEFT JOIN order_items oi ON oi.order_id = o.id
  WHERE o.created_at > NOW() - INTERVAL '4 hours'
  GROUP BY o.id, o.order_number
  HAVING COUNT(oi.id) = 0;
  -- Any rows here = data integrity issue → investigate immediately

  -- Check QStash for failed jobs from outage window
  → console.upstash.com → QStash → Failed Jobs → filter by time
  → Re-enqueue: ERCA submissions, loyalty award jobs

Step 6 — COMMUNICATE RESOLUTION
  "ስርዓቱ ተስተካክሏል! ሁሉም ትዕዛዞች ተቀምጠዋል።"
  "System restored! All orders have been saved."
  Write post-mortem within 24 hours.
```

---

### Scenario B — Vercel Outage

**Probability:** Very low (Vercel Pro ~99.9%)
**Detection:** Prometheus alert in <60s · lole.app returns 5xx or times out

**Restaurant impact:**

- Installed PWA → continues from service worker cache ✅
- Uninstalled PWA (new/reset tablet) → POS completely inaccessible ❌
- Dashboard → inaccessible ❌
- Guest QR ordering → inaccessible ❌

**Response:**

```
Step 1 — VERIFY (2 min)
  Check: vercel-status.com
  Test: access the Vercel deployment URL directly (bypassing Cloudflare DNS)
        Find in: Vercel dashboard → Deployment → Visit
  Distinguish: Cloudflare issue vs. Vercel issue vs. DNS issue

Step 2 — IF VERCEL CONFIRMED DOWN
  → Restaurants with installed PWA: no action needed — they continue normally
  → Restaurants with uninstalled PWA: guide to paper backup for duration
  → Communicate: "lole website temporarily unavailable. Installed tablets continue working."

Step 3 — IF OUTAGE > 30 MINUTES: activate Cloudflare Pages cold standby
  (Requires pre-setup — see Prerequisites below)
  3a. Build: npx vercel build (locally, or trigger CI)
  3b. Deploy: npx wrangler pages deploy .vercel/output/static --project-name lole-standby
  3c. Update Cloudflare DNS:
      lole.app CNAME → lole-standby.pages.dev
      (TTL: 60 seconds — update takes ~1 minute to propagate)
  3d. Test: confirm lole.app resolves to Pages deployment
  3e. Dashboard and guest ordering restored. POS PWA from cache still works.

Step 4 — WHEN VERCEL RESTORES
  → Revert Cloudflare DNS CNAME back to Vercel deployment
  → Verify full flow: login → order → KDS → payment → receipt
  → Write post-mortem

PREREQUISITE (do this now, before first restaurant):
  1. Create Cloudflare Pages project: "lole-standby"
  2. Deploy current build to it (it sits idle, not in DNS)
  3. Update this runbook with the project URL
  4. Repeat after every major deploy to keep it current
```

---

### Scenario C — Railway (Apollo Router) Outage

**Probability:** Low-medium
**Detection:** Sentry GraphQL errors · Apollo Studio shows zero traffic · Prometheus alert

**Restaurant impact:**

- Dashboard fails (all GraphQL queries)
- POS order creation via GraphQL fails
- REST webhooks, KDS Realtime, and offline mode continue ✅

**Response:**

```
Step 1 — VERIFY + ATTEMPT RESTART (3 min)
  Railway dashboard → Apollo Router service → Restart
  Usually resolves within 60 seconds. Wait and monitor.

Step 2 — IF RESTART FAILS: fallback to direct Next.js subgraph
  In Vercel dashboard → Environment Variables:
  Change: NEXT_PUBLIC_GRAPHQL_URL
  From:   https://api.lole.app/graphql      (Apollo Router)
  To:     https://lole.app/api/graphql      (Next.js direct)
  Trigger redeploy: ~60 seconds

  What this loses temporarily:
  → Federation query stitching (cross-domain queries may fail)
  → Apollo Router rate limiting (no rate limits during outage — acceptable)
  → Apollo Studio metrics
  What still works: all single-domain queries (orders, menu, payments, staff)

Step 3 — FIX RAILWAY
  railway up --service apollo-router --force
  Monitor Railway logs until container is healthy

Step 4 — RESTORE
  Revert NEXT_PUBLIC_GRAPHQL_URL to Apollo Router URL
  Trigger redeploy. Confirm GraphQL queries route through Router again.
```

---

### Scenario D — Upstash (Redis + QStash) Outage

**Probability:** Low
**Detection:** Sentry Upstash errors · Event bus silent · QStash jobs stop processing

**What fails:** Event publishing, background jobs (ERCA, loyalty, EOD), menu cache, rate limits
**What does NOT fail:** POS orders, KDS Realtime, payment initiation, receipt printing

**Response:**

```
Step 1 — VERIFY: console.upstash.com → confirm outage
Step 2 — NO restaurant communication needed (operational impact is low)
Step 3 — MONITOR RESTORATION
  QStash automatically replays all queued jobs on restoration — no manual replay needed

Step 4 — POST-RESTORATION VERIFICATION
  → QStash dashboard → Failed Jobs → filter by outage window
  → Check: any ERCA submissions in dead-letter queue?
     Manually re-enqueue: POST /api/jobs/erca-invoice for each affected order_id
  → Check: any loyalty award jobs that expired?
     Query: SELECT * FROM orders WHERE status = 'completed'
            AND created_at BETWEEN '{outage_start}' AND '{outage_end}'
            AND id NOT IN (SELECT order_id FROM loyalty_transactions WHERE created_at > '{outage_start}')
  → Check: menu cache auto-rebuilds on next request — no action needed
```

---

### Scenario E — Accidental Data Deletion or Corruption

**Probability:** Low but non-zero (human error during migration)
**Detection:** Support tickets, Sentry errors, missing records reported by restaurants

**Supabase backup capabilities (Pro plan):**

- Point-in-time recovery (PITR): restore to any second within last 7 days
- Daily automated backups: retained 7 days
- Manual snapshots: trigger anytime from Supabase dashboard

**Response:**

```
Step 1 — ASSESS SCOPE (10 min)
  1a. Which table(s) and which restaurant(s) were affected?
  1b. What caused it? (DELETE statement, failed migration, application bug?)
  1c. What is the earliest clean timestamp before corruption?
  1d. Is the corruption still ongoing? (if yes → stop it first)

Step 2 — STOP THE BLEEDING
  → If a running migration caused it: run the rollback migration immediately
  → If an application bug caused it: set feature flag to OFF
  → If a manual DELETE caused it: it is already done — proceed to recovery

Step 3 — CHOOSE RECOVERY PATH

  PATH A: Row-level (< 100 rows, surgical)
    1. Supabase dashboard → SQL editor
    2. Query the backup schema at the point before corruption:
       -- (Supabase PITR creates a shadow DB — query it directly)
    3. Re-insert the missing rows into the live schema
    4. Verify foreign key constraints are satisfied

  PATH B: Table-level restore
    1. Supabase dashboard → Database → Backups → PITR
    2. Set timestamp to 5 minutes before corruption
    3. Restore to a TEMPORARY schema (not public — do not overwrite live data)
    4. Export the affected table from the temporary schema as CSV
    5. Carefully import into live schema
    6. Manually reconcile any orders created BETWEEN the PITR point and now

  PATH C: Full database restore (catastrophic failure only)
    WARNING: This loses ALL changes since the backup point.
    Only use if Paths A and B are not viable.
    1. Supabase dashboard → Database → Backups → Restore
    2. Select the most recent clean backup timestamp
    3. Confirm: any orders processed since that backup are lost
    4. Notify all affected restaurants immediately

Step 4 — VERIFY INTEGRITY
  → Run RLS completeness check (Security Policy doc, mandatory query)
  → Run orphaned order_items check (Scenario A query)
  → Check: payments.amount sums match orders.total_price for affected window
  → Run ERCA submissions check for the affected window

Step 5 — ROOT CAUSE + PREVENTION
  → How did this happen?
  → Which migration guard or validation would have caught it?
  → Add the guard. Do not just move on.
```

---

### Scenario F — Active Payment Fraud / Webhook Attack

**Probability:** Low but financially severe
**Detection:** HMAC failure rate > 1% in Axiom · Sentry payment error spike · Unusual confirmed orders without payment records

**Response:**

```
Step 1 — DETECT: run in Axiom
  SELECT COUNT(*), ip_address, endpoint
  FROM logs
  WHERE status_code = 401
    AND endpoint LIKE '/api/webhooks/%'
    AND timestamp > NOW() - INTERVAL '1 hour'
  GROUP BY ip_address, endpoint
  ORDER BY COUNT(*) DESC;
  -- Any IP with > 10 failed attempts in 1 hour = active attack

Step 2 — CONTAIN
  2a. Block attacking IP(s) in Cloudflare WAF immediately:
      Cloudflare dashboard → Security → WAF → Custom Rules → Block IP
  2b. If attack is distributed (many IPs):
      Set FEATURE_KILL_CHAPA_PAYMENTS=true in Vercel env vars → trigger redeploy
      This disables ALL Chapa webhook processing globally in ~60 seconds
  2c. Notify Chapa/Telebirr security teams with the IP list

Step 3 — ASSESS DAMAGE
  -- Orders confirmed without valid payment
  SELECT o.id, o.order_number, o.restaurant_id, o.total_price, p.status
  FROM orders o
  LEFT JOIN payments p ON p.order_id = o.id AND p.status = 'captured'
  WHERE o.status = 'confirmed'
    AND p.id IS NULL
    AND o.created_at > NOW() - INTERVAL '24 hours';

Step 4 — REMEDIATE
  4a. For each unmatched confirmed order: UPDATE orders SET status = 'flagged'
  4b. Notify affected restaurants — do not charge guests for flagged orders
  4c. Work with Chapa/Telebirr to match transaction IDs and reconcile
  4d. Restore kill switch to false only after attack is fully stopped and confirmed

Step 5 — HARDEN
  → Add Cloudflare rate limiting rule: max 10 POST requests per IP per minute to /api/webhooks/*
  → Increase HMAC secret rotation frequency
  → Add webhook IP allowlist (Chapa and Telebirr publish their webhook IP ranges)
```

---

## Offline Operations Continuity

For when lole is fully inaccessible — power outage, extended provider failure, no internet.

### What Always Works Without lole

| Function              | Without lole                                                                     |
| --------------------- | -------------------------------------------------------------------------------- |
| Take orders           | Paper order pads with carbon duplicate (one for kitchen, one for waiter)         |
| Kitchen communication | Paper slips or verbal                                                            |
| Calculate bills       | Phone calculator                                                                 |
| Cash payment          | Always works                                                                     |
| Telebirr payment      | USSD code `*127#` works without internet (mobile network only)                   |
| Print receipts        | Termux print server is local — prints without internet if tablet has cached data |

### Offline Order Sync After Restoration

```
When internet restores after extended offline period:

1. Do not close any tablets — let PowerSync sync complete first
2. Sync indicator shows "All synced" on each tablet (wait for this)
3. Verify in dashboard: /merchant/orders — all offline orders present
4. Verify: /merchant/finance — all cash payments from offline period recorded
5. Check QStash: all queued ERCA submissions auto-process (5 retries over 2h each)
6. Check loyalty: any points from offline orders award automatically via QStash
7. Run the integrity queries from Scenario A, Step 5
```

---

## Emergency Contact Directory

| Service    | Status Page          | Support                    | Notes                                |
| ---------- | -------------------- | -------------------------- | ------------------------------------ |
| Supabase   | status.supabase.com  | support.supabase.com       | Pro plan: priority queue             |
| Vercel     | vercel-status.com    | vercel.com/support         | Pro plan: priority queue             |
| Upstash    | upstash.com/status   | upstash.com/support        | —                                    |
| Railway    | status.railway.app   | railway.app/help           | Discord is fastest                   |
| Cloudflare | cloudflarestatus.com | cloudflare.com/support     | —                                    |
| Chapa      | —                    | support@chapa.co           | Merchant account manager             |
| Telebirr   | —                    | EthioTelecom merchant line | Merchant account number required     |
| ERCA API   | —                    | ERCA helpdesk              | Manual submission fallback available |

---

## Runbook Maintenance Schedule

| Trigger                                 | Action                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------- |
| After every P0 incident                 | Review: does the runbook match what actually happened? Update accordingly. |
| After every major infrastructure change | Add or update the relevant scenario.                                       |
| Quarterly (no incidents)                | Re-read all scenarios. Test the Cloudflare Pages standby deploy.           |

**Last reviewed:** March 2026 · **Next scheduled review:** June 2026

---

## Backup Restoration Testing

### MED-019: Quarterly Backup Restoration Test Schedule

Backup restoration tests are conducted quarterly to verify the integrity and recoverability of all backup systems. Each test is documented with results and any issues discovered.

### Test Schedule

| Quarter | Test Date  | Test Type              | Status       | Result |
| ------- | ---------- | ---------------------- | ------------ | ------ |
| Q1 2026 | 2026-03-15 | Full PITR Restore      | ✅ Completed | PASS   |
| Q2 2026 | 2026-06-15 | Table-level Restore    | Scheduled    | -      |
| Q3 2026 | 2026-09-15 | Point-in-time Recovery | Scheduled    | -      |
| Q4 2026 | 2026-12-15 | Full Database Restore  | Scheduled    | -      |

### Q1 2026 Test Results (2026-03-15)

**Test Type:** Full Point-in-Time Recovery (PITR)

**Test Procedure:**

1. Created test branch from production backup at timestamp 2026-03-15 02:00:00 UTC
2. Verified all tables present and accessible
3. Ran data integrity checks
4. Verified RLS policies functioning correctly
5. Tested application connectivity to restored database

**Results:**

- ✅ Backup restored successfully within RTO (8 minutes)
- ✅ All 47 tables verified present
- ✅ Row count matches expected values
- ✅ Foreign key constraints intact
- ✅ RLS policies functioning correctly
- ✅ Application connectivity verified

**Issues Discovered:**

- None

**Recommendations:**

- Continue quarterly testing schedule
- Consider adding automated restore verification script

### Test Procedure Template

````markdown
## Quarterly Backup Restoration Test

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Test Type:** [Full PITR / Table-level / Point-in-time]

### Pre-Test Checklist

- [ ] Notify team of test
- [ ] Verify no critical operations running
- [ ] Document current database state

### Test Steps

1. Navigate to Supabase Dashboard → Database → Backups
2. Select backup timestamp to test
3. Create test branch (do NOT restore to production)
4. Wait for branch creation to complete
5. Connect to test branch and verify:

### Verification Queries

```sql
-- Verify table count
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public';
-- Expected: 47 tables

-- Verify row counts for critical tables
SELECT
  (SELECT COUNT(*) FROM orders) as orders,
  (SELECT COUNT(*) FROM order_items) as order_items,
  (SELECT COUNT(*) FROM payments) as payments,
  (SELECT COUNT(*) FROM restaurants) as restaurants,
  (SELECT COUNT(*) FROM menu_items) as menu_items;

-- Verify foreign key integrity
SELECT tc.table_name, tc.constraint_name
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public';

-- Verify RLS policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public';
```
````

### Results

- [ ] All tables present
- [ ] Row counts match expected
- [ ] Foreign keys intact
- [ ] RLS policies functioning
- [ ] Application can connect

### Issues Found

[List any issues discovered]

### Recommendations

[List any recommendations for improvement]

````

### Automated Restore Verification Script

```bash
#!/bin/bash
# scripts/verify-backup-restore.sh
# Run this after restoring a backup to verify integrity

set -e

echo "=== Backup Restore Verification ==="
echo "Date: $(date)"
echo ""

# Check table count
TABLE_COUNT=$(psql $DATABASE_DIRECT_URL -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
echo "Tables found: $TABLE_COUNT (expected: 47)"

# Check critical tables have data
echo ""
echo "Row counts:"
psql $DATABASE_DIRECT_URL -c "
SELECT
  (SELECT COUNT(*) FROM orders) as orders,
  (SELECT COUNT(*) FROM payments) as payments,
  (SELECT COUNT(*) FROM restaurants) as restaurants,
  (SELECT COUNT(*) FROM menu_items) as menu_items;
"

# Check for orphaned records
echo ""
echo "Checking for orphaned records..."
ORPHANED_ITEMS=$(psql $DATABASE_DIRECT_URL -t -c "
SELECT COUNT(*) FROM order_items oi
LEFT JOIN orders o ON o.id = oi.order_id
WHERE o.id IS NULL
")
echo "Orphaned order_items: $ORPHANED_ITEMS (expected: 0)"

# Check RLS policies
echo ""
echo "RLS policies count:"
psql $DATABASE_DIRECT_URL -t -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public'"

echo ""
echo "=== Verification Complete ==="
````

---

_lole Disaster Recovery & Business Continuity Plan v1.0 · March 2026 · Confidential_
