# WAN Chaos Harness

Date: 2026-04-23
Status: active validation harness for local-first store runtime

## Purpose

This harness validates single-store survivability when WAN is cut.

Current scope:

- local order create during WAN outage
- local order status update during WAN outage
- no data loss across gateway restart
- no data loss across client restart
- delayed reconnect with pending local queue preserved until replay completion

## Source of Truth

- reusable harness helper: `src/lib/sync/__tests__/helpers/storeRuntimeHarness.ts`
- validation scenarios: `src/lib/sync/__tests__/store-runtime-harness.test.ts`

## What it proves

- local journal and sync queue persist operational intent while WAN is disconnected
- user-facing local write flows continue without cloud availability
- restart turbulence does not erase local operational state
- reconnect can resume from durable pending queue state

## Current limitation

This harness validates local durability and restart survival.

It does not claim full PowerSync cloud replay is live. That remains blocked under `ENT-018` until direct logical replication and `powersync` publication are operational.
