# Printer Failover Drills

Date: 2026-04-27
Status: active

## Goal

Verify gateway spooler survives printer outage without hidden drops.

## Drill Cases

1. Primary route offline before dispatch.
   Expected: job marked `rerouted`, backup route receives new pending job.
2. Dispatch fails and retry budget remains.
   Expected: job returns to `pending` with `queued_retry` and next attempt timestamp.
3. Dispatch fails and retry budget exhausted.
   Expected: job marked `failed` with explicit error text.
4. Operator manual retry after failure.
   Expected: job returns to `pending` with `manual_retry`.

## Test Anchors

- `src/lib/sync/__tests__/printerFallback.test.ts`

## Operator Signals

- Devices screen must show:
    - printer route state
    - queue depth
    - failed/pending/printing counts
    - rerouted jobs
    - latest visible error
