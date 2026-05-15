# Fiscal Continuity: Local Signing + Persistent Local Queue

Date: 2026-04-21
Task: `ENT-006`

## Decision

Use **local signing** combined with **persistent local queue** as fiscal outage strategy.

## Required Behavior

- receipt intent written durably before success shown
- receipt payload signed locally at store edge
- signed payload queued locally until upstream authority acknowledges
- reconciliation after WAN return preserves signature, order, device, and timestamps

## Why

Queue without local signing still leaves legal ambiguity.
Signing without durable queue still risks data loss.
Need both.

## Local Flow

`fiscal request -> canonical payload -> local signature -> local queue -> printed receipt -> later upstream replay`

## Minimum Stored Fields

- order id
- transaction number
- canonical payload
- local signature
- signature algorithm
- signing key id
- signed at
- queue status
- replay attempts
- last error

## Compliance Note

This foundation code creates local signing and persistence path.
Production legal readiness still requires:

- approved key custody model
- ERCA / EFM certification alignment
- key rotation and secure enclave/HSM plan where required
