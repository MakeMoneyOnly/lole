---
id: cybersecurity
title: 'CyberSecurity (SecOps)'
leadAgent: 'SecAgent'
coreSkills: ['security-stride-model', 'encryption-at-rest']
autonomyLevel: 70
---

# CyberSecurity (SecOps)

This entity page tracks the current state of the `cybersecurity` functional unit directly from the codebase.

## Responsibilities

- System hardening
- Auth security
- Vulnerability scanning

## Codebase Boundaries

Based on the `coreSkills` mapped to this functional unit, the following codebase boundaries were identified during the audit:

- `src\app\.well-known\security.txt\route.ts`
- `src\app\api\delivery\aggregator\orders\route.ts`
- `src\app\api\device\orders\route.ts`
- `src\app\api\guest\context\route.ts`
- `src\app\api\guest\session\route.ts`
- `src\app\api\guest\track\route.ts`
- `src\app\api\guests\[guestId]\route.ts`
- `src\app\api\jobs\cron\silent-callback-check\route.ts`
- `src\app\api\metrics\route.ts`
- `src\app\api\orders\route.ts`
- _...and 512 more files._

## Current State & Capabilities

> [!NOTE] Synthesis Generated via Heuristics
> The LLM Proxy was unreachable. This is an auto-generated structural summary.

### Discovered Capabilities

- Actively maintains implementations across the provided source boundaries.
- Codebase evidence confirms structural presence of the required logic.
- Needs manual review or a re-run of the Synthesis Engine when the LLM is online.

## Linked Concepts

_(Wikilinks to related systems)_
