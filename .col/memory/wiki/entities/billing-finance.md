---
id: billing-finance
title: 'Billing, Subscription & Payouts'
leadAgent: 'FinanceAgent'
coreSkills: ['subscription-logic-billing', 'reconciliation-settlement']
autonomyLevel: 75
---

# Billing, Subscription & Payouts

This entity page tracks the current state of the `billing-finance` functional unit directly from the codebase.

## Responsibilities

- SaaS billing
- Payment settlement
- Financial audit

## Codebase Boundaries

Based on the `coreSkills` mapped to this functional unit, the following codebase boundaries were identified during the audit:

- `src\app\(guest)\[slug]\menu-client.tsx`
- `src\app\api\notifications\push\subscribe\route.ts`
- `src\components\merchant\settings\tabs\ModulesTab.tsx`
- `src\components\merchant\settings\tabs\NotificationsTab.tsx`
- `src\features\auth\hooks\useRole.ts`
- `src\features\auth\hooks\__tests__\useRole.test.ts`
- `src\features\kds\hooks\useKDSRealtime.ts`
- `src\features\kds\hooks\__tests__\useKDSRealtime.local.test.ts`
- `src\features\kds\hooks\__tests__\useKDSRealtime.test.ts`
- `src\hooks\usePlanFeature.ts`
- _...and 88 more files._

## Current State & Capabilities

> [!NOTE] Synthesis Generated via Heuristics
> The LLM Proxy was unreachable. This is an auto-generated structural summary.

### Discovered Capabilities

- Actively maintains implementations across the provided source boundaries.
- Codebase evidence confirms structural presence of the required logic.
- Needs manual review or a re-run of the Synthesis Engine when the LLM is online.

## Linked Concepts

_(Wikilinks to related systems)_
