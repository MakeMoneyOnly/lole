---
id: hardware-ops
title: 'Peripheral & Hardware Ops'
leadAgent: 'HardwareAgent'
coreSkills: ['esc-pos-driver-design', 'printer-health-reporting']
autonomyLevel: 85
---

# Peripheral & Hardware Ops

This entity page tracks the current state of the `hardware-ops` functional unit directly from the codebase.

## Responsibilities

- Printer stability
- Scanner integration
- Hardware fault detection

## Codebase Boundaries

Based on the `coreSkills` mapped to this functional unit, the following codebase boundaries were identified during the audit:

- `src\app\api\kds\queue\route.ts`
- `src\components\merchant\settings\tabs\DevicesTab.tsx`
- `src\features\kds\hooks\useKDSRealtime.ts`
- `src\features\kds\hooks\__tests__\useKDSRealtime.test.ts`
- `src\lib\delivery\beu.ts`
- `src\lib\delivery\deliver-addis.ts`
- `src\lib\delivery\esoora.ts`
- `src\lib\delivery\index.ts`
- `src\lib\delivery\zmall.ts`
- `src\lib\devices\hardware-abstraction.ts`
- _...and 127 more files._

## Current State & Capabilities

> [!NOTE] Synthesis Generated via Heuristics
> The LLM Proxy was unreachable. This is an auto-generated structural summary.

### Discovered Capabilities

- Actively maintains implementations across the provided source boundaries.
- Codebase evidence confirms structural presence of the required logic.
- Needs manual review or a re-run of the Synthesis Engine when the LLM is online.

## Linked Concepts

_(Wikilinks to related systems)_
