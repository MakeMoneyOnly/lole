# ADR-001: Store Gateway Runtime

Date: 2026-04-21
Status: Accepted
Owners: Platform / POS / Device Runtime

## Decision

Adopt per-restaurant **Store Gateway** as local authority for in-store operations.

Initial design choices:

- runtime role: store-resident gateway
- LAN transport: **MQTT**
- local write model: **journal-first**
- fiscal continuity: **local signing + persistent local queue**
- cloud role: eventual sync, fleet coordination, analytics, remote management

## Why

Current app still routes too much restaurant-critical work through cloud APIs and cloud realtime.
That fails Addis constraint:

- WAN cut stops cross-device convergence
- KDS path crosses cloud
- fiscal continuity weak
- device fleet depends on remote mediation

Store Gateway fixes this by moving live store authority into restaurant LAN.

## Runtime Choice

Gateway target runtime for v1 foundation:

- process model: dedicated long-running local service
- preferred hosts:
    - mini PC
    - hardened Android edge box
    - embedded Linux box
- non-goal for v1: direct peer mesh without gateway authority

## Gateway Responsibilities

- MQTT broker client or broker-side adapter for store event fan-out
- local command intake for orders, KDS, tables, printers, fiscal actions
- append-only local journal ownership
- print spooler ownership
- fiscal queue ownership
- local signing ownership
- sync replay to cloud when WAN exists
- local health and mode reporting

## Client Responsibilities

- create domain commands
- append locally before UX success
- publish to gateway over LAN
- render gateway-authoritative state
- fall back to read-only or degraded mode when gateway unreachable

## Failure Model

- WAN loss: store stays operational through gateway
- client loss: other devices continue
- printer loss: jobs queue/reroute
- cloud loss: replay later
- gateway loss: temporary degraded local device mode, then reconcile after gateway return

## Update Model

- gateway and client ship separately
- risky gateway features behind flags
- rollout rings required before broad rollout

## Consequences

Good:

- removes cloud from same-building critical path
- enables deterministic local QoS
- enables legal/fiscal continuity design
- centralizes hardware orchestration

Tradeoff:

- new local runtime to own and monitor
- more device policy work for Esper/kiosk networking
- more LAN security/auth work

## Next Linked Tasks

- `ENT-002` headless domain core
- `ENT-003` local journal schema
- `ENT-004` MQTT transport
- `ENT-005` deterministic local persistence bootstrap
- `ENT-006` local signing + persistent fiscal queue
