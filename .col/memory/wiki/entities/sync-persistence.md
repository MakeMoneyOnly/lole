---
id: sync-persistence
title: 'Sync & Persistence'
leadAgent: 'SyncAgent'
coreSkills: ['powersync-schema-design', 'conflict-resolution-merging']
autonomyLevel: 95
---

# Sync & Persistence

This entity page tracks the current state of the `sync-persistence` functional unit directly from the codebase.

## Responsibilities

- Local SQLite management
- Cloud sync bridge
- Data convergence

## Codebase Boundaries

Based on the `coreSkills` mapped to this functional unit, the following codebase boundaries were identified during the audit:

- `src\app\api\health\route.ts`
- `src\app\api\sync\route.ts`
- `src\app\api\sync\__tests__\payroll-sync.route.test.ts`
- `src\app\api\sync\__tests__\route.test.ts`
- `src\components\providers\ClientProviders.tsx`
- `src\components\providers\OfflineIndicator.tsx`
- `src\components\providers\__tests__\OfflineIndicator.test.tsx`
- `src\context\CartContext.tsx`
- `src\features\kds\lib\command-adapter.ts`
- `src\features\kds\lib\handoff-adapter.ts`
- _...and 238 more files._

## Current State & Capabilities

### Discovered Capabilities

- **Local SQLite & Cloud Sync**: Leverages PowerSync with SQLite as the primary persistence layer (`src/lib/sync/index.ts`). This allows local-first read/write operations with eventual consistency to the cloud database when online.
- **Offline & Conflict Resolution**: Replaces legacy `offlineQueue` logic with deterministic PowerSync convergence models. Includes handling for offline queuing (Orders, KDS, printers) and robust conflict resolution patterns (e.g., LWW, custom merging) to guarantee data integrity across devices.
- **State Transparency**: Exposes connection state through frontend providers (`ClientProviders.tsx`, `OfflineIndicator.tsx`), gracefully rendering degradation UI elements (e.g., hiding or showing banners) based on the `isMqttConnected` status and database replication health.
- **API & Health Monitoring**: Ensures sync integrity via dedicated backend routes (`/api/sync/route.ts`) and tracks synchronization health alongside broader system metrics to proactively detect failures in persistence loops.

## Linked Concepts

_(Wikilinks to related systems)_
