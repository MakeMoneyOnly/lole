# Risk Register

Last updated: 2026-02-17

## Risk Log

| ID    | Risk                                      | Impact   | Probability | Owner         | Mitigation                                         | Status |
| ----- | ----------------------------------------- | -------- | ----------- | ------------- | -------------------------------------------------- | ------ |
| R-001 | API drift from Tasks.md sequence          | High     | Medium      | Product + Eng | Enforce task-first implementation and PR mapping   | Open   |
| R-002 | Migration conflicts across environments   | High     | Medium      | Platform      | Standardize migration rules and staging validation | Open   |
| R-003 | RLS misconfiguration exposing tenant data | Critical | Low         | Security      | Security checklist + policy review gate            | Open   |
| R-004 | Realtime queue stale under peak load      | High     | Medium      | Platform      | Add queue metrics and staleness alerts             | Open   |
| R-005 | UX regressions during rapid iteration     | Medium   | Medium      | Design + QA   | Add E2E regression for critical journeys           | Open   |

## Review Cadence

- Weekly during delivery review.
- Immediate update on new Sev1/Sev2 incidents.
