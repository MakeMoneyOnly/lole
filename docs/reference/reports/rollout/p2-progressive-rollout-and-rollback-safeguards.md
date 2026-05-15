# P2 Progressive Rollout and Rollback Safeguards

Owner: Engineering + Operations  
Scope: Task `P2-051` in `Tasks.md`  
Last updated: 2026-02-21

## Flags and Guards

- `ENABLE_P2_PILOT_ROLLOUT`
- `PILOT_RESTAURANT_IDS`
- `PILOT_BLOCK_MUTATIONS`

P2 APIs are phase-gated through `getAuthorizedRestaurantContext(..., { phase: 'p2' })`, which enforces:

- Cohort allowlist access only when rollout is enabled
- Optional global mutation freeze via `PILOT_BLOCK_MUTATIONS=true`

## Rollout Stages

1. Stage 0 (dark launch)
    - `ENABLE_P2_PILOT_ROLLOUT=false`
    - Validate E2E, API, and load-test readiness in staging.
2. Stage 1 (internal canary)
    - `ENABLE_P2_PILOT_ROLLOUT=true`
    - `PILOT_RESTAURANT_IDS=<internal-canary-ids>`
    - `PILOT_BLOCK_MUTATIONS=false`
3. Stage 2 (pilot cohort expansion)
    - Expand `PILOT_RESTAURANT_IDS` in controlled batches.
    - Monitor P95 latency, error rates, and finance/inventory exception drift.
4. Stage 3 (broad release)
    - Keep rollout enabled for all intended merchants or transition to standard availability policy.

## Immediate Rollback Levers

1. Freeze writes instantly:
    - `PILOT_BLOCK_MUTATIONS=true`
2. Reduce blast radius:
    - Shrink `PILOT_RESTAURANT_IDS` to known-safe IDs
3. Disable P2 rollout entirely:
    - `ENABLE_P2_PILOT_ROLLOUT=false`

## Verification Checklist

- `src/lib/api/__tests__/pilotGate.test.ts` includes P2 allowlist block coverage.
- P2 route tests remain green:
    - `src/app/api/__tests__/p2-revenue-api-routes.test.ts`
    - `src/app/api/__tests__/p2-inventory-api-routes.test.ts`
    - `src/app/api/__tests__/p2-finance-api-routes.test.ts`
- P2 E2E flows remain green:
    - `e2e/p2-loyalty-gift-card.spec.ts`
    - `e2e/p2-inventory-variance.spec.ts`
    - `e2e/p2-finance-reconciliation.spec.ts`
