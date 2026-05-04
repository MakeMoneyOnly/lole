---
id: devops-sre
title: 'DevOps & SRE'
leadAgent: 'SREAgent'
coreSkills: ['ci-cd-pipeline-security', 'production-monitoring-sentry']
autonomyLevel: 95
---

# DevOps & SRE

This entity page tracks the current state of the `devops-sre` functional unit directly from the codebase.

## Responsibilities

- Infrastructure uptime
- Deployment safety
- Site reliability

## Codebase Boundaries

Based on the `coreSkills` mapped to this functional unit, the following codebase boundaries were identified during the audit:

- `src\lib\monitoring\notification-metrics.ts`
- `src\lib\notifications\deduplication.ts`
- `src\lib\rate-limit.ts`
- `src\lib\security\rateLimiterRedis.ts`
- `src\lib\__tests__\rate-limit.test.ts`
- `src\app\.well-known\security.txt\route.ts`
- `src\app\api\delivery\aggregator\orders\route.ts`
- `src\app\api\device\orders\route.ts`
- `src\app\api\guest\context\route.ts`
- `src\app\api\guest\session\route.ts`
- _...and 126 more files._

## Current State & Capabilities

> [!NOTE] Synthesis Generated via Heuristics
> The LLM Proxy was unreachable. This is an auto-generated structural summary.

### Discovered Capabilities

- Actively maintains implementations across the provided source boundaries.
- Codebase evidence confirms structural presence of the required logic.
- Needs manual review or a re-run of the Synthesis Engine when the LLM is online.

## Linked Concepts

_(Wikilinks to related systems)_
