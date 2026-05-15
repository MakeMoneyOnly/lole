# Release Cadence

Last updated: 2026-02-17

## Weekly Rhythm

- Monday: Sprint planning, scope lock for the week
- Tuesday-Wednesday: Core implementation
- Thursday: Integration, regression, release candidate cut
- Friday: Controlled rollout and post-release review

## Branch and Merge Rules

- `main` is always deployable
- Feature work in short-lived branches
- PR required for all merges
- At least one reviewer from owning domain

## Release Gates

- All critical tests passing
- No unresolved P0 severity bugs in release scope
- Rollback plan documented
- Observability checks in place for changed services

## Deployment Strategy

- Staging deploy first
- Pilot cohort rollout second
- Full rollout after pilot validation window

## Post-Release

- 24-hour watch window for error/latency regressions
- Incident review if thresholds are breached
- Changelog and task board updates within same day
