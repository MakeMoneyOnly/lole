# P2 Peak-Flow Load Tests

Owner: Engineering  
Scope: Task `P2-050` in `Tasks.md`  
Last updated: 2026-02-21

## Goal

Validate that critical P2 read paths remain stable under concurrent merchant traffic during rollout.

## Scenarios

The load test script exercises:

- `GET /api/merchant/command-center?range=today`
- `GET /api/loyalty/programs`
- `GET /api/gift-cards?limit=100`
- `GET /api/inventory/variance?limit=100`
- `GET /api/finance/reconciliation?limit=100`
- `GET /api/payments/providers/health`

## Execution

Script:

- `scripts/load-tests/p2-peak-flows.mjs`

Default run:

```bash
node scripts/load-tests/p2-peak-flows.mjs
```

Recommended CI/staging run:

```bash
LOAD_BASE_URL=https://staging.example.com \
LOAD_AUTH_TOKEN=<jwt-or-service-token> \
LOAD_CONCURRENCY=20 \
LOAD_REQUESTS=300 \
LOAD_P95_THRESHOLD_MS=1200 \
LOAD_ERROR_RATE_THRESHOLD_PCT=2 \
node scripts/load-tests/p2-peak-flows.mjs
```

NPM shortcut:

```bash
pnpm test:load:p2
```

## Auth Model

The script sends `x-e2e-bypass-auth: 1` for non-production environments where E2E bypass auth is enabled.
You can also provide `LOAD_AUTH_TOKEN` to send `Authorization: Bearer <token>`.

For staging/prod-like tests where bypass auth is disabled, run through authenticated synthetic clients or equivalent service credentials.

## Pass/Fail Gates

- P95 latency per scenario `<= 1200ms` (tunable)
- Error rate per scenario `<= 2%` (tunable)
- Any scenario breach fails the run by default (`LOAD_FAIL_ON_THRESHOLD=true`)

## Rollback Trigger Input

If load test fails during rollout window:

1. Enable mutation freeze: `PILOT_BLOCK_MUTATIONS=true`
2. Reduce allowlist to known-safe merchants
3. Disable phase flag: `ENABLE_P2_PILOT_ROLLOUT=false`
4. Re-run load test before resuming rollout
