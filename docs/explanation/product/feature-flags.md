# lole — Feature Flags & Release Strategy

**Version 1.0 · March 2026**

> This document defines how lole ships features safely to a live restaurant platform. At 50 restaurants, a broken deploy affects real revenue. At 200 restaurants, it is a business-threatening event. Feature flags are how you maintain velocity without risking reliability.

---

## Why Feature Flags on a Pre-Series-A POS

A restaurant running a Friday dinner service at 7PM does not care that you are deploying a new discount engine. If the deploy breaks the POS, the restaurant loses revenue and you lose a customer. Feature flags decouple **deploy** from **release** — code ships to production, but features activate on a controlled schedule.

**The rule:** Any change that touches payment processing, order creation, or KDS display requires a feature flag. Anything else is at your discretion.

---

## Feature Flag Architecture

lole uses a **two-tier flag system**: database-backed flags for restaurant-level control, and environment-variable flags for platform-wide emergency overrides.

### Tier 1 — Restaurant-Level Flags (Database)

Stored in `feature_flags` table. Controlled per restaurant or per percentage rollout.

```sql
CREATE TABLE feature_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key        TEXT NOT NULL,           -- e.g. 'discount_engine', 'powersync_offline'
  description     TEXT,
  enabled_globally BOOLEAN DEFAULT false,  -- on for all restaurants
  rollout_percent  INTEGER DEFAULT 0       -- 0–100, for canary rollouts
    CHECK (rollout_percent BETWEEN 0 AND 100),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (flag_key)
);

CREATE TABLE restaurant_feature_flags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id),
  flag_key        TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT false,
  enabled_at      TIMESTAMPTZ,
  enabled_by      UUID REFERENCES restaurant_staff(id),
  notes           TEXT,
  UNIQUE (restaurant_id, flag_key)
);

ALTER TABLE feature_flags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_feature_flags ENABLE ROW LEVEL SECURITY;
```

### Tier 2 — Emergency Kill Switches (Environment Variable)

For platform-wide emergency disables that cannot wait for a database update + deploy cycle.

```bash
# In Vercel environment variables (editable without deploy):
FEATURE_KILL_TELEBIRR_PAYMENTS=false    # set to 'true' to disable all Telebirr payments
FEATURE_KILL_CHAPA_PAYMENTS=false
FEATURE_KILL_ERCA_SUBMISSIONS=false
FEATURE_KILL_LOYALTY_EARNING=false
FEATURE_KILL_DELIVERY_CHANNELS=false
```

These are read at runtime by `getKillSwitch(key)`. Setting one to `true` in Vercel and triggering a redeploy (< 60 seconds) takes that feature offline for the entire platform immediately.

---

## Feature Flag Client

```typescript
// src/lib/flags/feature-flags.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Check if a feature is enabled for a specific restaurant.
 * Resolution order:
 *   1. Emergency kill switch (env var) → always wins
 *   2. Restaurant-specific override (restaurant_feature_flags)
 *   3. Global rollout percentage (feature_flags.rollout_percent)
 *   4. Global enable (feature_flags.enabled_globally)
 *   5. Default: false
 */
export async function isFeatureEnabled(flagKey: string, restaurantId: string): Promise<boolean> {
    // 1. Emergency kill switch (fastest path — no DB query)
    const killKey = `FEATURE_KILL_${flagKey.toUpperCase().replace(/-/g, '_')}`;
    if (process.env[killKey] === 'true') return false;

    // 2. Restaurant-specific override
    const { data: override } = await supabase
        .from('restaurant_feature_flags')
        .select('enabled')
        .eq('restaurant_id', restaurantId)
        .eq('flag_key', flagKey)
        .single();

    if (override !== null) return override.enabled;

    // 3. Global flag settings
    const { data: flag } = await supabase
        .from('feature_flags')
        .select('enabled_globally, rollout_percent')
        .eq('flag_key', flagKey)
        .single();

    if (!flag) return false;
    if (flag.enabled_globally) return true;

    // 4. Deterministic percentage rollout
    // Hash restaurant_id to get a stable 0–100 number
    if (flag.rollout_percent > 0) {
        const hash = hashRestaurantId(restaurantId);
        return hash % 100 < flag.rollout_percent;
    }

    return false;
}

// Deterministic hash — same restaurant always gets same bucket
// This prevents a restaurant from flickering in/out of a rollout
function hashRestaurantId(restaurantId: string): number {
    let hash = 0;
    for (let i = 0; i < restaurantId.length; i++) {
        hash = (hash << 5) - hash + restaurantId.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

// React hook for client-side flag checks
export function useFeatureFlag(flagKey: string): boolean {
    // Flags are resolved server-side and passed via page props
    // This hook reads from the resolved flag context
    const flags = useContext(FeatureFlagContext);
    return flags[flagKey] ?? false;
}
```

---

## Feature Flag Catalogue

These are all flags in the system, their current state, and their release plan.

| Flag Key                | Description                                                              | Current State | Target State                      |
| ----------------------- | ------------------------------------------------------------------------ | ------------- | --------------------------------- |
| `payment_webhooks`      | Auto-confirm Telebirr and Chapa payments via webhook                     | 🔴 Off        | ✅ Global on — Sprint 1           |
| `amharic_pos`           | Amharic default locale on POS waiter app                                 | 🔴 Off        | ✅ Global on — Sprint 2           |
| `amharic_kds`           | Amharic default locale on all KDS stations                               | 🔴 Off        | ✅ Global on — Sprint 2           |
| `amharic_dashboard`     | Amharic default on merchant dashboard                                    | 🔴 Off        | ✅ Global on — Sprint 2           |
| `redis_event_bus`       | Publish/consume events via Upstash Redis Streams                         | 🔴 Off        | ✅ Global on — Sprint 3           |
| `loyalty_earning`       | Award points on order.completed event                                    | 🔴 Off        | ✅ Global on — Sprint 3           |
| `inventory_deduction`   | Auto-deduct stock on order confirm via DB trigger                        | 🔴 Off        | Canary 10% → Sprint 3             |
| `powersync_offline`     | Replace Dexie.js polling with PowerSync CRDT sync                        | 🔴 Off        | Canary 20% → Sprint 4             |
| `discount_engine`       | Discount picker in waiter POS and guest checkout                         | 🔴 Off        | Canary 25% → Sprint 5             |
| `modifier_tables`       | Serve modifiers from new tables (not JSONB)                              | 🔴 Off        | Canary 10% → Sprint 5             |
| `graphql_federation`    | Route POS/dashboard queries through Apollo Router                        | 🔴 Off        | Canary 5% → Sprint 6              |
| `erca_submission`       | Auto-submit ERCA e-invoice on order.completed                            | 🔴 Off        | VAT restaurants only → Sprint 8   |
| `subscription_gating`   | Enforce plan limits (Pro, Business features)                             | 🔴 Off        | Global on — Sprint 8              |
| `eod_telegram_report`   | Send daily report to owner via Telegram at 10PM                          | 🔴 Off        | Global on — Sprint 7              |
| `timescaledb_analytics` | Route analytics queries to TimescaleDB hypertable                        | 🔴 Off        | Global on — Sprint 7              |
| `delivery_channels`     | Enable beU Delivery / Deliver Addis / klik / Zmall Delivery order intake | 🔴 Off        | Per-restaurant — Phase 2          |
| `lole_now_app`          | Enable manager app API access                                            | 🔴 Off        | Per-restaurant — Phase 4          |
| `multi_location`        | Consolidated cross-location dashboard                                    | 🔴 Off        | Enterprise only — Phase 4         |
| `lole_pay`              | Route payments through lole Pay (not Chapa)                              | 🔴 Off        | Beta restaurants only — Horizon 2 |

---

## Release Tiers

Every new feature follows one of four release tiers based on risk.

### Tier A — Instant Global Release

For low-risk changes with no revenue or data impact.

**Examples:** UI copy changes, Amharic translation additions, dashboard card layout, colour changes, documentation links.

**Process:**

```
1. Code reviewed and merged to main
2. GitHub Actions deploys to production
3. Done — no flag needed
```

---

### Tier B — Dark Launch → Global

For new features that have backend components but limited user-visible impact.

**Examples:** New analytics query, new notification type, new dashboard chart, new settings option.

**Process:**

```
1. Deploy with feature flag OFF (dark launch — code in production but inactive)
2. Test on your own restaurant (restaurant_id = founder's test restaurant)
3. Enable for 2–3 pilot restaurants (restaurant_feature_flags = true)
4. Monitor for 7 days: Sentry errors, Supabase slow queries, unexpected behaviour
5. If clean: set enabled_globally = true in feature_flags table
6. Done
```

---

### Tier C — Canary Rollout (Percentage-Based)

For features that change existing behaviour or add new data flows.

**Examples:** PowerSync offline, modifier tables migration, Redis event bus, discount engine, GraphQL Federation.

**Process:**

```
Week 1:  Deploy with flag at 0%. Validate in staging/preview environment.
Week 1:  Enable for 5% of restaurants (rollout_percent = 5).
         Monitor: error rate, order success rate, KDS latency.
Week 2:  If clean → 20%.
Week 3:  If clean → 50%.
Week 4:  If clean → 100% (enabled_globally = true).
Abort:   If error rate increases >0.5% above baseline at any stage → rollback to 0%.
```

**Canary monitoring checklist (check daily during rollout):**

- [ ] Sentry: no new error group from the canary population
- [ ] Supabase: no slow queries introduced by the new feature
- [ ] Prometheus: no degradation in `/api/health` response time
- [ ] Order success rate: `SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '24h' AND status = 'cancelled'` — should not increase

---

### Tier D — Surgical / Staged (High Risk)

For payment-path changes, database migrations, and anything that touches money.

**Examples:** Payment webhook activation, santim migration, ERCA submission activation, subscription gating enforcement.

**Process:**

```
Stage 0: Deploy with flag OFF. Run migration in read-only verification mode.
Stage 1: Enable for founder's test restaurant only. Run 50 real transactions.
Stage 2: Enable for 3 pilot restaurants. Monitor for 48h. Review every transaction in Axiom.
Stage 3: Enable for 10 restaurants (mix of high and low volume). Monitor 48h.
Stage 4: Enable for all restaurants. Keep kill switch ready.

Throughout: Any payment error rate >1% → kill switch to OFF immediately.
```

**The 48-hour rule:** Never advance a Tier D rollout faster than 48 hours between stages, even if metrics look clean. Financial bugs often manifest at end-of-day reconciliation, not intra-day.

---

## Rollback Procedures

### Immediate Rollback (< 2 minutes)

Set the environment variable kill switch:

```bash
# In Vercel dashboard → Settings → Environment Variables
# Set FEATURE_KILL_{FLAG_NAME} = true
# Trigger redeploy (or wait for next request — env vars take effect immediately)

# Example: kill all Telebirr payments globally
FEATURE_KILL_TELEBIRR_PAYMENTS=true
```

No code change, no deploy — Vercel environment variable changes take effect within 60 seconds after triggering a redeploy.

### Flag Rollback (< 5 minutes)

```sql
-- Disable a feature for all restaurants immediately
UPDATE feature_flags
SET rollout_percent = 0, enabled_globally = false
WHERE flag_key = 'discount_engine';

-- Disable for a specific restaurant only
UPDATE restaurant_feature_flags
SET enabled = false, notes = 'Rolled back — 2026-03-07 payment error'
WHERE restaurant_id = '{restaurant_id}' AND flag_key = 'discount_engine';
```

### Code Rollback (< 10 minutes)

```bash
# Revert last deploy on Vercel
vercel rollback --token=$VERCEL_TOKEN

# Revert Apollo Router on Railway
railway rollback --service apollo-router
```

---

## Deploy Schedule

To protect restaurant operations, all production deploys follow this schedule:

| Day       | Deploy Window  | Reason                                   |
| --------- | -------------- | ---------------------------------------- |
| Monday    | Any time       | Low-risk day for restaurants             |
| Tuesday   | Any time       | —                                        |
| Wednesday | Any time       | —                                        |
| Thursday  | Before 4PM EAT | Restaurants start pre-dinner prep at 5PM |
| Friday    | **No deploys** | Peak dinner service. Too risky.          |
| Saturday  | **No deploys** | Highest revenue day for most restaurants |
| Sunday    | **No deploys** | Lunch service is also high-traffic       |

**Emergency hotfixes only exception:** A P0 incident (active payment failure, data breach) can override this schedule. Document the override and review within 48 hours.

---

## Feature Flag Governance

### Who Can Change Flags

| Action                                   | Who Can Do It                           |
| ---------------------------------------- | --------------------------------------- |
| Enable flag for a specific restaurant    | Founder                                 |
| Enable flag globally (Tier B)            | Founder after 7-day pilot               |
| Advance canary percentage (Tier C)       | Founder after checklist passes          |
| Advance payment/financial flags (Tier D) | Founder after 48h minimum               |
| Trigger emergency kill switch            | Founder — immediate, no review required |
| Remove a flag (clean up)                 | Founder after 30 days globally enabled  |

### Flag Hygiene

Flags are temporary scaffolding. Once a feature is globally enabled and stable for 30 days:

1. Remove the `isFeatureEnabled()` check from the code
2. Delete the row from `feature_flags` table
3. Remove the `FEATURE_KILL_*` env var from Vercel
4. Document the removal in this file's changelog

Dead flags accumulate into technical debt. A flag that has been globally enabled for 6 months is no longer a flag — it is a permanent feature. Treat it as such.

---

## Sprint-Aligned Release Plan

| Sprint | Feature               | Tier            | Rollout Plan                             |
| ------ | --------------------- | --------------- | ---------------------------------------- |
| 1      | Chapa webhook         | D — Surgical    | Founder test → 3 pilots → all            |
| 1      | Telebirr webhook      | D — Surgical    | Same as Chapa, sequential                |
| 1      | Santim migration      | D — Surgical    | Read-only verify → test restaurant → all |
| 1      | Sentry + alerting     | A — Instant     | Global immediately                       |
| 2      | Amharic POS           | B — Dark launch | 3 pilots for 1 week → global             |
| 2      | Amharic KDS           | B — Dark launch | Same                                     |
| 3      | Redis event bus       | C — Canary      | 5% → 20% → 50% → 100% over 4 weeks       |
| 3      | Loyalty earning       | C — Canary      | 10% → 25% → 100% over 3 weeks            |
| 4      | PowerSync offline     | C — Canary      | 5% → 20% → 50% → 100% over 4 weeks       |
| 5      | Discount engine       | B — Dark launch | 5 pilots → global                        |
| 5      | Modifier tables       | D — Surgical    | Test restaurant → 5 pilots → canary      |
| 6      | GraphQL Federation    | C — Canary      | 5% → 25% → 100% over 4 weeks             |
| 7      | EOD Telegram          | B — Dark launch | 5 willing owners → global                |
| 7      | TimescaleDB analytics | C — Canary      | 10% → 50% → 100%                         |
| 8      | ERCA submission       | D — Surgical    | VAT-registered only, sequential          |
| 8      | Subscription gating   | B — Dark launch | Announce 14 days before enforcement      |

---

## Changelog

| Version | Date       | Change           |
| ------- | ---------- | ---------------- |
| 1.0     | March 2026 | Initial document |

---

_lole Feature Flags & Release Strategy v1.0 · March 2026_
