# Canonical Local Schema

Date: 2026-04-23
Status: active source of truth for store-local persistence

## Purpose

This is canonical local schema for in-store operations.

It exists so client, gateway, replay worker, and audit/fiscal flows all target one durable model.

## Table Groups

### Operational state

- `orders`
- `order_items`
- `kds_items`
- `table_sessions`
- `order_check_splits`
- `order_check_split_items`
- `payment_sessions`
- `payments`

### Local payment ledger

- `payment_sessions`
- `payments`
- `payment_events`
- `reconciliation_entries`

This keeps offline settlement truth durable before replay:

- session lifecycle and selected provider/method
- captured payment rows linked to split/order/session scope
- append-only local payment event history
- reconciliation evidence with expected vs settled amount and delta
- settlement metadata for cashier terminal, source, and manual/offline mode
- payment truth labels for `local_capture`, `pending_verification`, `verified`, `failed`, and `review_required`
- table-balance reads and split-balance reads derived from same ledger, not transient UI math

### Domain event ledger

- `domain_events`

This stores versioned local-first domain events for:

- orders
- course fire
- KDS state
- print intents
- fiscal intents
- audit intents

### Local durability and replay

- `local_journal`
- `sync_queue`
- `sync_replay_checkpoints`
- `local_sequence_counters`

### Operational side-effect queues

- `printer_jobs`
- `fiscal_jobs`

### Audit and dispute evidence

- `audit_logs`
- `sync_conflict_logs`

## Rules

- User-visible success for in-store mutations must depend on local durability first.
- Domain commands append to `local_journal`.
- Domain events append to `domain_events` and/or `local_journal` depending on workflow stage.
- Payment capture must write `payment_sessions`, `payments`, `payment_events`, and `reconciliation_entries` in one local transaction.
- Payment capture and reconciliation must append `local_journal` command/event entries before user success is shown.
- Deferred online processors may close operational settlement locally only when payment truth remains explicit as `pending_verification`.
- Replay workers consume durable local records, not transient UI state.
- Conflict records must remain queryable after reconnect for support and dispute handling.
- Active in-store runtime must not fall back to ad hoc `localStorage` or Dexie queues for orders/KDS/table flows.
- Gateway LAN event consumers must reject duplicate and out-of-order messages per aggregate using durable message ids and monotonic local sequence.
- Offline order numbers and receipt numbers must allocate from `local_sequence_counters` so reconnect reconciliation can map device-local identifiers back to fiscal and replay trails.
- Legacy queue modules may remain only as isolated compatibility surfaces while active runtime uses PowerSync-backed local persistence.

## Current code anchors

- SQL schema and PowerSync table map: `src/lib/sync/powersync-config.ts`
- Local payment ledger helper: `src/lib/payments/local-ledger.ts`
- Terminal local read/capture surface: `src/lib/terminal/read-adapter.ts`
- Terminal local table-close settlement: `src/lib/terminal/settlement-adapter.ts`
- Shared enterprise event contracts: `src/lib/domain/core/events.ts`
- Local append-only journal helpers: `src/lib/journal/local-journal.ts`
