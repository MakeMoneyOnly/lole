# Local-First Boundary

Date: 2026-04-21

## Rule

For in-store restaurant operations, write path is:

`Client -> Local Journal -> MQTT LAN -> Store Gateway -> Local State -> Cloud Replay`

Not:

`Client -> Cloud API -> Cloud Realtime -> Other Store Devices`

## Local-First Command Scope

Commands that must route local-first:

- order create/update/delete
- table open/transfer/close
- course fire / hold / bump
- KDS item state transitions
- print intents
- fiscal intents
- device health/presence

## Cloud Scope

Cloud stays source for:

- multi-store reporting
- long-term backup
- remote device management
- fleet rollouts
- external notifications
- third-party integrations after local durability

## Boundary Contract

- UI must not own operational orchestration.
- UI emits domain commands only.
- Gateway owns local ordering, sequencing, and replay.
- Audit and fiscal evidence append before user-visible success.
