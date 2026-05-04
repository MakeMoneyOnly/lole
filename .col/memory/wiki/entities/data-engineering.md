---
id: data-engineering
title: 'Data Engineering'
leadAgent: 'DataEngAgent'
coreSkills: ['timescaledb-hypertables', 'data-aggregation-pipelines']
autonomyLevel: 90
---

# Data Engineering

This entity page tracks the current state of the `data-engineering` functional unit directly from the codebase.

## Responsibilities

- Transaction storage
- High-performance queries
- Data lakes

## Codebase Boundaries

Based on the `coreSkills` mapped to this functional unit, the following codebase boundaries were identified during the audit:

- `src\app\api\analytics\overview\route.ts`
- `src\lib\services\timescaleAnalyticsService.ts`
- `src\app\(dashboard)\layout.tsx`
- `src\app\(dashboard)\merchant\menus\page.tsx`
- `src\app\(dashboard)\merchant\page.tsx`
- `src\app\(guest)\demo-table\page.tsx`
- `src\app\(guest)\[slug]\info\info-client.tsx`
- `src\app\(guest)\[slug]\info\page.tsx`
- `src\app\(guest)\[slug]\menu-client.tsx`
- `src\app\(guest)\[slug]\page.tsx`
- _...and 477 more files._

## Current State & Capabilities

> [!NOTE] Synthesis Generated via Heuristics
> The LLM Proxy was unreachable. This is an auto-generated structural summary.

### Discovered Capabilities

- Actively maintains implementations across the provided source boundaries.
- Codebase evidence confirms structural presence of the required logic.
- Needs manual review or a re-run of the Synthesis Engine when the LLM is online.

## Linked Concepts

_(Wikilinks to related systems)_
