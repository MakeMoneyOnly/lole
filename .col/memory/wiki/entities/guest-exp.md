---
id: guest-exp
title: 'Guest Experience (QR/PWA)'
leadAgent: 'GuestAgent'
coreSkills: ['qr-ordering-flow', 'loyalty-interface-design']
autonomyLevel: 90
---

# Guest Experience (QR/PWA)

This entity page tracks the current state of the `guest-exp` functional unit directly from the codebase.

## Responsibilities

- Contactless ordering
- Guest retention tools
- Self-service

## Codebase Boundaries

Based on the `coreSkills` mapped to this functional unit, the following codebase boundaries were identified during the audit:

- `src\app\(guest)\layout.tsx`
- `src\app\(guest)\[slug]\menu-client.tsx`
- `src\app\api\channels\online-ordering\settings\route.ts`
- `src\app\api\guest\restaurant\route.ts`
- `src\app\api\onboarding\route.ts`
- `src\app\api\orders\route.ts`
- `src\app\api\webhooks\delivery\route.ts`
- `src\app\api\__tests__\channels-api-routes.test.ts`
- `src\app\api\__tests__\delivery-webhook.route.test.ts`
- `src\app\merchant\onboarding\page.tsx`
- _...and 365 more files._

## Current State & Capabilities

> [!NOTE] Synthesis Generated via Heuristics
> The LLM Proxy was unreachable. This is an auto-generated structural summary.

### Discovered Capabilities

- Actively maintains implementations across the provided source boundaries.
- Codebase evidence confirms structural presence of the required logic.
- Needs manual review or a re-run of the Synthesis Engine when the LLM is online.

## Linked Concepts

_(Wikilinks to related systems)_
