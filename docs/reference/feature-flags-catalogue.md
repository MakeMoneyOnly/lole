# Feature Flags Catalogue

**Last Updated:** 2026-04-09
**Status:** Active

## Overview

lole uses a two-tier feature flag system for controlled rollouts and emergency kill switches.

## Tier 1: Environment Variable Flags (Implemented)

These flags are configured via environment variables and checked using `isFeatureEnabled()` from `src/lib/config/env.ts`.

| Flag                      | Default | Description                                                    | Used In      |
| ------------------------- | ------- | -------------------------------------------------------------- | ------------ |
| `ENABLE_OFFLINE_MODE`     | `true`  | Enables offline-first sync behavior for unstable connectivity  | Sync workers |
| `ENABLE_AR_MENU`          | `false` | Enables AR menu viewing for guest menu pages                   | Guest menu   |
| `ENABLE_ANALYTICS`        | `true`  | Enables analytics tracking and reporting                       | Dashboard    |
| `RATE_LIMIT_ENABLED`      | `true`  | Enables rate limiting on API endpoints                         | Middleware   |
| `ENABLE_P0_PILOT_ROLLOUT` | `false` | Enables P0 pilot features for early access restaurants         | Pilot gate   |
| `ENABLE_P1_PILOT_ROLLOUT` | `false` | Enables P1 pilot features                                      | Pilot gate   |
| `ENABLE_P2_PILOT_ROLLOUT` | `false` | Enables P2 pilot features                                      | Pilot gate   |
| `PILOT_RESTAURANT_IDS`    | `''`    | Comma-separated restaurant IDs allowed in pilot                | Pilot gate   |
| `PILOT_BLOCK_MUTATIONS`   | `false` | Emergency lever to block all write operations during incidents | Pilot gate   |

### Pilot Rollout Hierarchy

P2 implies P1 implies P0. When `ENABLE_P2_PILOT_ROLLOUT` is enabled, P1 and P0 features are automatically enabled.

### How to Enable

1. Set the environment variable in `.env.local` or deployment config
2. For pilot rollouts, also set `PILOT_RESTAURANT_IDS` with the allowed restaurant IDs
3. Restart the application for changes to take effect

### Checking Flags in Code

```typescript
import { isFeatureEnabled } from '@/lib/config/env';

if (isFeatureEnabled('ENABLE_OFFLINE_MODE')) {
    // offline-specific logic
}
```

## Tier 2: Database-Backed Feature Flags (Planned - NOT YET IMPLEMENTED)

These flags are documented in `docs/03-product/feature-flags.md` but have **no implementation**. No migration, no `feature_flags` table, no `src/lib/flags/feature-flags.ts` file exists.

| Flag Key                | Description                                                        | Target Rollout |
| ----------------------- | ------------------------------------------------------------------ | -------------- |
| `payment_webhooks`      | Auto-confirm payments via webhook                                  | Sprint 1       |
| `amharic_pos`           | Amharic default locale on POS                                      | Sprint 2       |
| `amharic_kds`           | Amharic default locale on KDS                                      | Sprint 2       |
| `amharic_dashboard`     | Amharic default on merchant dashboard                              | Sprint 2       |
| `redis_event_bus`       | Events via Upstash Redis Streams                                   | Sprint 3       |
| `loyalty_earning`       | Award points on order.completed                                    | Sprint 3       |
| `inventory_deduction`   | Auto-deduct stock on order confirm                                 | Sprint 3       |
| `powersync_offline`     | Replace Dexie.js with PowerSync CRDT                               | Sprint 4       |
| `discount_engine`       | Discount picker in POS and checkout                                | Sprint 5       |
| `modifier_tables`       | Serve modifiers from new tables                                    | Sprint 5       |
| `graphql_federation`    | Route queries through Apollo Router                                | Sprint 6       |
| `eod_telegram_report`   | Daily report to owner via Telegram                                 | Sprint 7       |
| `timescaledb_analytics` | Route analytics to TimescaleDB                                     | Sprint 7       |
| `erca_submission`       | Auto-submit ERCA e-invoice                                         | Sprint 8       |
| `subscription_gating`   | Enforce plan limits                                                | Sprint 8       |
| `delivery_channels`     | Enable beU Delivery/Deliver Addis/klik/Zmall Delivery order intake | Phase 2        |
| `lole_now_app`          | Enable manager app API access                                      | Phase 4        |
| `multi_location`        | Cross-location dashboard                                           | Phase 4        |
| `lole_pay`              | Route payments through lole Pay                                    | Horizon 2      |

### Implementation Requirements

When Tier 2 is implemented, the following is needed:

1. Migration to create `feature_flags` and `restaurant_feature_flags` tables
2. `src/lib/flags/feature-flags.ts` module with `isFeatureEnabled(key, context)` function
3. `useFeatureFlag(key)` React hook for client components
4. `FEATURE_KILL_*` emergency kill switch environment variables
5. Admin UI for managing feature flags per restaurant

## Emergency Kill Switches

For production incidents, use these emergency levers:

| Scenario                     | Action                              | Recovery                      |
| ---------------------------- | ----------------------------------- | ----------------------------- |
| Runaway mutations            | Set `PILOT_BLOCK_MUTATIONS=true`    | Remove the flag               |
| Pilot feature causing issues | Set `ENABLE_P*_PILOT_ROLLOUT=false` | Re-enable when fixed          |
| Rate limiting issues         | Set `RATE_LIMIT_ENABLED=false`      | Re-enable after investigation |
| Offline sync issues          | Set `ENABLE_OFFLINE_MODE=false`     | Re-enable after sync fix      |
