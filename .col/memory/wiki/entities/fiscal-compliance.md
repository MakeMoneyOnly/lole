---
id: fiscal-compliance
title: 'Fiscal Compliance (ERCA)'
leadAgent: 'FiscalAgent'
coreSkills: ['mor-sigtas-compliance', 'fiscal-signing-logic']
autonomyLevel: 60
---

# Fiscal Compliance (ERCA)

This entity page tracks the current state of the `fiscal-compliance` functional unit directly from the codebase.

## Responsibilities

- Tax law alignment
- Digital receipt validity
- MoR reporting

## Codebase Boundaries

Based on the `coreSkills` mapped to this functional unit, the following codebase boundaries were identified during the audit:

- `src\components\merchant\reports\tabs\TaxTab.tsx`
- `src\components\merchant\settings\tabs\IntegrationsTab.tsx`
- `src\app\(public)\accessibility\page.tsx`
- `src\app\api\jobs\cron\eod-report\route.ts`
- `src\app\api\jobs\erca\submit\route.ts`
- `src\components\merchant\employees\EmployeesPageClient.tsx`
- `src\components\merchant\settings\tabs\BusinessInfoTab.tsx`
- `src\components\merchant\settings\tabs\FinancialsTab.tsx`
- `src\components\ui\Button.tsx`
- `src\components\ui\SkipLink.tsx`
- _...and 105 more files._

## Current State & Capabilities

> [!NOTE] Synthesis Generated via Heuristics
> The LLM Proxy was unreachable. This is an auto-generated structural summary.

### Discovered Capabilities

- Actively maintains implementations across the provided source boundaries.
- Codebase evidence confirms structural presence of the required logic.
- Needs manual review or a re-run of the Synthesis Engine when the LLM is online.

## Linked Concepts

_(Wikilinks to related systems)_
