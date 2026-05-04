---
id: backend-infra
title: 'Backend Infrastructure'
leadAgent: 'BackendAgent'
coreSkills: ['postgres-schema-design', 'edge-function-orchestration']
autonomyLevel: 85
---

# Backend Infrastructure

This entity page tracks the current state of the `backend-infra` functional unit directly from the codebase.

## Responsibilities

- Database migrations
- Server-side logic
- API contracts

## Codebase Boundaries

Based on the `coreSkills` mapped to this functional unit, the following codebase boundaries were identified during the audit:

- `src\app\(guest)\[slug]\tracker\tracker-client.tsx`
- `src\app\api\merchant\command-center\route.ts`
- `src\features\kds\hooks\useKDSRealtime.ts`
- `src\features\kds\hooks\__tests__\useKDSRealtime.test.ts`
- `src\hooks\useSplitRealtimeChannels.ts`
- `src\lib\api\audit.ts`
- `src\lib\api\errors.ts`
- `src\lib\api\__tests__\errors.test.ts`
- `src\lib\db\admin.ts`
- `src\lib\db\app.ts`
- _...and 715 more files._

## Current State & Capabilities

> [!NOTE] Synthesis Generated via Heuristics
> The LLM Proxy was unreachable. This is an auto-generated structural summary.

### Discovered Capabilities

- Actively maintains implementations across the provided source boundaries.
- Codebase evidence confirms structural presence of the required logic.
- Needs manual review or a re-run of the Synthesis Engine when the LLM is online.

## Linked Concepts

_(Wikilinks to related systems)_
