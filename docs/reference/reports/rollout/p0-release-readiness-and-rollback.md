# P0 Release Readiness and Rollback Plan

Last updated: 2026-02-17
Scope: `P0-001` through `P0-095`

## Release Readiness Review

### Go/No-Go Criteria

- All P0 tasks through `P0-092` are completed and validated.
- Unit, integration, and E2E suites for P0 critical paths pass on release candidate.
- No open `Sev1` or `Sev2` incidents tied to merchant P0 scope.
- API SLO dashboards are healthy for:
    - `GET /api/merchant/command-center`
    - `GET /api/orders`
    - `PATCH /api/orders/:id/status`
- Pilot feature-flag rollout config is reviewed and approved.
- Rollback owner and communication owner are assigned before launch.

### Release Readiness Checklist

- [ ] Build and lint pass in CI.
- [ ] DB migrations already applied and verified for P0 schema scope.
- [ ] Security endpoint checklist reviewed for all P0 write APIs.
- [ ] Risk register reviewed and updated with current status.
- [ ] Incident triage contacts and escalation path confirmed.
- [ ] `CHANGELOG.md` and `Tasks.md` updated in release PR.

## Rollback Strategy

### Trigger Conditions

- `Sev1` incident in core merchant ordering/service operations.
- Sustained SLO breach (15+ minutes latency breach or 5+ minutes error breach).
- Data integrity issue in P0 workflows (orders, table sessions, service requests).
- Pilot feedback indicates critical business blocker without immediate safe patch.

### Rollback Levers

1. Pilot cohort hard-stop:
    - Set `ENABLE_P0_PILOT_ROLLOUT=false`.
2. Write protection:
    - Set `PILOT_BLOCK_MUTATIONS=true` while keeping read-only visibility.
3. Allowlist isolation:
    - Narrow `PILOT_RESTAURANT_IDS` to a minimal safe subset.
4. Deploy rollback:
    - Re-deploy prior stable release candidate.

### Rollback Verification

- Confirm non-pilot restaurants receive controlled access-denied response.
- Confirm pilot mutation routes return `PILOT_MUTATION_BLOCK_ENABLED` when write block is on.
- Confirm error/latency trends stabilize post rollback action.
- Confirm incident timeline and root-cause notes are recorded.

## Ownership

- Incident commander: Engineering on-call
- Rollback executor: Platform
- Merchant communication: Product + Support
- Post-incident review owner: Engineering manager
