---
id: fleet-mgmt
title: 'MDM & Fleet Management (Esper)'
leadAgent: 'MDMAgent'
coreSkills: ['esper-policy-templates', 'ota-update-orchestration']
autonomyLevel: 90
---

# MDM & Fleet Management (Esper)

This entity page tracks the current state of the `fleet-mgmt` functional unit directly from the codebase.

## Responsibilities

- Device provisioning
- Fleet health
- Remote management

## Codebase Boundaries

Based on the `coreSkills` mapped to this functional unit, the following codebase boundaries were identified during the audit:

- `src\app\(dashboard)\merchant\page.tsx`
- `src\app\api\devices\provision\route.ts`
- `src\app\api\devices\[deviceId]\management-actions\route.ts`
- `src\app\api\internal\fleet\devices\[deviceId]\management-actions\route.ts`
- `src\app\api\jobs\cron\stale-device-check\route.ts`
- `src\components\agency\FleetManagementPageClient.tsx`
- `src\components\merchant\shared\SalesPerformanceChart.tsx`
- `src\components\merchant\shared\SalesPerformanceChartContent.tsx`
- `src\components\merchant\takeout\KitchenLoadCard.tsx`
- `src\lib\api\authz.ts`
- _...and 311 more files._

## Current State & Capabilities

> [!NOTE] Synthesis Generated via Heuristics
> The LLM Proxy was unreachable. This is an auto-generated structural summary.

### Discovered Capabilities

- Actively maintains implementations across the provided source boundaries.
- Codebase evidence confirms structural presence of the required logic.
- Needs manual review or a re-run of the Synthesis Engine when the LLM is online.

## Linked Concepts

_(Wikilinks to related systems)_
