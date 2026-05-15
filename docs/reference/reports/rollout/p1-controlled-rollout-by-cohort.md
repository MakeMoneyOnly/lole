# P1 Controlled Rollout by Merchant Cohort

Date: 2026-02-18
Owner: Engineering

## Scope

P1 APIs are cohort-gated behind pilot flags using the same restaurant allowlist and mutation brake used in P0.

## P1 rollout controls

- `ENABLE_P1_PILOT_ROLLOUT`
    - `false`: no P1 cohort gate.
    - `true`: allow only `PILOT_RESTAURANT_IDS` for P1 endpoints.
- `PILOT_RESTAURANT_IDS`
    - Comma-separated restaurant IDs that can access the rollout.
- `PILOT_BLOCK_MUTATIONS`
    - `true`: blocks write methods (`POST|PUT|PATCH|DELETE`) for gated routes.

## P1 endpoints in gate

- Guests:
    - `GET /api/guests`
    - `GET /api/guests/:id`
    - `PATCH /api/guests/:id`
    - `GET /api/guests/:id/visits`
- Channels:
    - `GET /api/channels/summary`
    - `GET|PATCH /api/channels/online-ordering/settings`
    - `POST /api/channels/delivery/connect`
    - `GET /api/channels/delivery/orders`
    - `POST /api/channels/delivery/orders/:id/ack`
- Team Ops + Alerting:
    - `GET|POST /api/staff/schedule`
    - `POST /api/staff/time-entries/clock`
    - `GET|POST /api/alerts/rules`
    - `PATCH /api/alerts/rules/:id`
    - `GET|PATCH /api/merchant/dashboard-presets`

## Rollout procedure

1. Set `ENABLE_P1_PILOT_ROLLOUT=true`.
2. Set `PILOT_RESTAURANT_IDS` to approved cohort IDs.
3. Keep `PILOT_BLOCK_MUTATIONS=false` for normal pilot.
4. Observe pilot metrics and support tickets for 24 hours.
5. Expand allowlist in batches.
6. For incidents, set `PILOT_BLOCK_MUTATIONS=true` or disable rollout.
