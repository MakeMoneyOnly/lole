---
id: core-runtime
title: 'Core Runtime & Gateway'
leadAgent: 'RuntimeAgent'
coreSkills: ['architecture-interface-design', 'local-bus-orchestration']
autonomyLevel: 90
---

# Core Runtime & Gateway

This entity page tracks the current state of the `core-runtime` functional unit directly from the codebase.

## Responsibilities

- Store Gateway logic
- MQTT transport
- Local-first runtime

## Codebase Boundaries

Based on the `coreSkills` mapped to this functional unit, the following codebase boundaries were identified during the audit:

- `src\app\api\sync\route.ts`
- `src\lib\brand\constants.ts`
- `src\lib\services\dashboardDataService.ts`
- `src\lib\subscription\plan-features.ts`
- `src\app\(guest)\demo-table\page.tsx`
- `src\app\(guest)\[slug]\info\info-client.tsx`
- `src\app\(guest)\[slug]\menu-client.tsx`
- `src\app\(guest)\[slug]\tracker\tracker-client.tsx`
- `src\app\api\campaigns\route.ts`
- `src\app\api\campaigns\[campaignId]\launch\route.ts`
- _...and 397 more files._

## Current State & Capabilities

### Discovered Capabilities

- **Embedded MQTT Broker (`Aedes`)**: The core runtime acts as a fully self-contained local bus, hosting an embedded MQTT broker (via Aedes) allowing devices (POS, KDS) to communicate securely over local networks via WebSockets and TCP without cloud dependency.
- **Tenant Isolation & Security**: Employs an internal topic-based ACL (`broker-acl.ts`) ensuring strict tenant isolation across published messages and subscriptions. Session authentication leverages JWT-aligned HMAC-SHA256 tokens.
- **Graceful Shutdown & Observability**: Robust lifecycle management with SIGINT/SIGTERM handlers in `entrypoint.ts` that safely drain the HTTP server and MQTT broker. Live health metrics and a Prometheus-compatible `/metrics` endpoint provide operational visibility.
- **Offline Persistence & Continuity**: A JSON-file backed persistent command queue handles `enqueue/dequeue/ack/nack` operations for reliable local message delivery. The `FiscalContinuityService` stub prepares the environment for localized receipt signing and MoR reporting during internet outages.

## Linked Concepts

_(Wikilinks to related systems)_
