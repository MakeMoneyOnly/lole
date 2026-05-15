# P0 Pilot Rollout via Feature Flags

Last updated: 2026-02-17
Task: `P0-094`

## Flags

- `ENABLE_P0_PILOT_ROLLOUT`
    - `false`: no cohort gating applied.
    - `true`: only allowlisted restaurants access P0 merchant rollout surfaces.
- `PILOT_RESTAURANT_IDS`
    - Comma-separated `restaurant_id` allowlist.
- `PILOT_BLOCK_MUTATIONS`
    - Emergency brake for write operations (`POST|PUT|PATCH|DELETE`) in pilot.

## Enforcement

Pilot gating is enforced in shared API access logic and key merchant routes via:

- `src/lib/config/pilotRollout.ts`
- `src/lib/api/pilotGate.ts`
- `src/lib/api/authz.ts`

Routes outside shared authz are explicitly gated where needed:

- `GET /api/merchant/command-center`
- `GET /api/merchant/activity`
- `GET /api/orders`
- `GET /api/orders/:id`
- `PATCH /api/orders/:id/status`
- `POST /api/orders/:id/assign`
- `POST /api/orders/bulk-status`
- `PATCH /api/service-requests/:id`

## Rollout Steps

1. Set `ENABLE_P0_PILOT_ROLLOUT=true` in pilot environment.
2. Populate `PILOT_RESTAURANT_IDS` with approved cohort IDs.
3. Keep `PILOT_BLOCK_MUTATIONS=false` for normal pilot operation.
4. Monitor SLO and support channels for 24-hour watch window.
5. Expand allowlist in controlled batches.

## Emergency Procedure

If critical issues emerge:

1. Set `PILOT_BLOCK_MUTATIONS=true`.
2. Reduce `PILOT_RESTAURANT_IDS` to known-safe merchants or disable rollout entirely.
3. Apply hotfix and verify through pilot feedback loop before re-enabling writes.
