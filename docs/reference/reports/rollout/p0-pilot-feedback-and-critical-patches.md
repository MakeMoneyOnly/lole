# P0 Pilot Feedback and Critical Patch Workflow

Last updated: 2026-02-17
Task: `P0-095`

## Feedback Intake Channels

- Merchant support tickets (`Help` tab flow).
- Daily pilot check-in summary with pilot operators.
- API-level pilot gate responses for non-allowlisted merchants.

## Feedback Classification

- `Critical`
    - Blocks order flow, table flow, or core staff operations.
    - Requires same-day patch or rollback action.
- `High`
    - Major slowdown or frequent errors with workaround.
    - Patch in current release window.
- `Medium`
    - Functional gap with acceptable workaround.
    - Schedule into next sprint.
- `Low`
    - UX polish or non-blocking enhancement.
    - Add to backlog.

## Critical Patch Loop

1. Reproduce issue with concrete merchant context and timestamp.
2. Classify severity using incident rubric.
3. Apply minimal-risk fix with focused tests.
4. Deploy to pilot scope only.
5. Validate with reporting merchant and telemetry trend.
6. Record root cause and preventive follow-up.

## Tracking Template

| ID     | Merchant | Surface | Severity | Status | Owner | Patch PR | Validation |
| ------ | -------- | ------- | -------- | ------ | ----- | -------- | ---------- |
| PF-001 |          |         |          | Open   |       |          |            |

## Current Pilot Critical Issues

- None logged yet.
