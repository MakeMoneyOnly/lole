# Split-Brain Scenario Matrix

Date: 2026-04-27
Status: active

## Purpose

This matrix defines expected merge behavior for offline multi-terminal conflicts.

## Scenario Matrix

| Scenario                                         | Client intent         | Server intent                     | Expected outcome                                    | Operator review |
| ------------------------------------------------ | --------------------- | --------------------------------- | --------------------------------------------------- | --------------- |
| Order note edit vs pricing recompute             | notes change          | totals/VAT change                 | merge notes from client, totals from server         | no              |
| Order cancel vs kitchen-ready fire               | cancelled             | ready/preparing                   | preserve conflict row, do not silently pick one     | yes             |
| Table close vs transfer                          | close session         | transfer table                    | preserve conflict row, explicit operator resolution | yes             |
| Table seat edit vs staff assign                  | guest_count change    | assigned_staff_id change          | merge both fields                                   | no              |
| Payment provider verify vs local amount mismatch | local captured amount | upstream settled amount differs   | mark review_required/manual_review                  | yes             |
| KDS status race                                  | preparing             | ready/bumped                      | server/device-authoritative kitchen state wins      | no              |
| Void/dispute replay mismatch                     | void requested        | server keeps payment/order active | preserve review queue, no silent merge              | yes             |

## Test Anchors

- `src/lib/sync/__tests__/conflict-resolution.test.ts`
- `src/lib/sync/__tests__/enterprise-runtime-drills.test.ts`

## Latency / Convergence Targets

- LAN event convergence target: P95 under 500ms for POS, KDS, handheld simulation.
- Duplicate/out-of-order delivery must converge to same final sequence or be explicitly dropped.
- Manual-review conflicts must surface in logs and unresolved counts, never silently overwrite.
