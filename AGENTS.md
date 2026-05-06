# AGENTS.md

## Purpose

This file defines project-specific operating rules for AI agents in this repo.
It is optimized for Lole's goal: building a world-class Restaurant Operating System with enterprise-grade reliability, security, and delivery discipline.

## Mandatory Source-of-Truth Order

When guidance conflicts, follow this order:

1. User request in current task.
2. This `AGENTS.md`.
3. `CONTEXT.md` (Domain, Architecture, Design).
4. Project docs under `docs/`.
5. Skill guidance in `.agents/skills/`.

## Skill Activation Matrix

Use the minimal set of skills that covers the task. Prefer stack-specific skills first.

### Data & Security Foundations

- `/.agents/skills/core/supabase-postgres-best-practices/SKILL.md`
    - Use for RLS design, indexing, and query optimization.
- `/.agents/skills/security/security-threat-model/SKILL.md`
    - Use for threat modeling and security audits.
- `/.agents/skills/security/api-security-best-practices/SKILL.md`
    - Use for endpoint hardening and rate limiting.

### Runtime Architecture

- `/.agents/skills/core/nextjs-best-practices/SKILL.md`
    - Use for App Router architecture and performance.
- `/.agents/skills/core/nextjs-apollo/apollo-server/SKILL.md`
    - Use for GraphQL resolver logic and server configuration.
- `/.agents/skills/core/nextjs-apollo/apollo-router/SKILL.md`
    - Use for production federation and traffic shaping.
- `/.agents/skills/core/rust-best-practices/SKILL.md`
    - Use for Apollo Router custom plugin development (Rust).

### Operations & Compliance

- `/.agents/skills/ops/sentry-nextjs-sdk/SKILL.md`
    - Use for error monitoring and session replay setup.
- `/.agents/skills/ops/n8n-workflow-patterns/SKILL.md`
    - Use for automation and event-driven workflows.
- `/.agents/skills/ops/courier-skills/SKILL.md`
    - Use for multi-channel notifications (SMS/Push).
- `/.agents/skills/compliance/nutrient-document-processing/SKILL.md`
    - Use for PDF/A fiscal export and document processing.
- `/.agents/skills/compliance/openaccountants-tax-logic/SKILL.md`
    - Use for tax classification and fiscal reporting.

### UX & Performance

- `/.agents/skills/development/core-web-vitals/SKILL.md`
    - Use for LCP/INP/CLS optimization.
- `/.agents/skills/creative-design/accessibility-auditor/SKILL.md`
    - Use for WCAG 2.1 AA audits and fixes.
- `/.agents/skills/creative-design/frontend-design/SKILL.md`
    - Use for net-new UI surfaces and design system maintenance.

### Enterprise Development (Superpowers)

- `/.agents/skills/superpowers/using-superpowers/SKILL.md`
    - Core bootstrap for the superpower ecosystem.
- `/.agents/skills/superpowers/brainstorming/SKILL.md`
    - Use for requirements gathering and design specs.
- `/.agents/skills/superpowers/writing-plans/SKILL.md`
    - Use for generating detailed implementation plans.
- `/.agents/skills/superpowers/executing-plans/SKILL.md`
    - Use for executing plans with discipline and checkpoints.
- `/.agents/skills/superpowers/subagent-driven-development/SKILL.md`
    - Use for high-quality, task-isolated implementation.
- `/.agents/skills/superpowers/dispatching-parallel-agents/SKILL.md`
    - Use for managing multiple independent investigation streams.
- `/.agents/skills/superpowers/requesting-code-review/SKILL.md`
    - Use for formal quality gates before merging.
- `/.agents/skills/superpowers/receiving-code-review/SKILL.md`
    - Use for technical evaluation of feedback.
- `/.agents/skills/superpowers/using-git-worktrees/SKILL.md`
    - Use for workspace isolation and context management.
- `/.agents/skills/superpowers/systematic-debugging/SKILL.md`
    - Use for finding root causes before implementing fixes.
- `/.agents/skills/superpowers/test-driven-development/SKILL.md`
    - Use for implementing behavior with failing tests first.
- `/.agents/skills/superpowers/verification-before-completion/SKILL.md`
    - Use for proving correctness before claiming success.
- `/.agents/skills/superpowers/finishing-a-development-branch/SKILL.md`
    - Use for merging and cleaning up after work is complete.

### External Intelligence (MCP Servers)

- **Context7 (`context7` MCP)**
    - _Must_ be used before writing code or plans involving 3rd-party libraries (e.g., Next.js, Rust, Tailwind). Always fetch the latest live documentation to prevent hallucinations or deprecated API usage.
- **Exa Search (`exa` MCP)**
    - Use during `brainstorming`, `to-prd`, and deep architectural investigations. Fetches clean, markdown-ready web content to anchor system designs in state-of-the-art industry research.

### Hermes Capabilities (from NousResearch/hermes-agent, MIT)

- `/.col/skills/hermes-persistent-memory/SKILL.md`
    - **MANDATORY at every heartbeat.** Persist session decisions to WAL SQLite + markdown. Search past sessions before doing any work. Prevents re-solving solved problems.
- `/.col/skills/hermes-context-compressor/SKILL.md`
    - Use when any agent session exceeds 80% token budget. Compresses middle turns into a `[CONTEXT SUMMARY]` block, preserving head and tail. Protects CEO/CTO and compliance sessions.
- `/.col/skills/hermes-toolset-distribution/SKILL.md`
    - Use when configuring any agent or during security audits. Enforces least-privilege tool access per role. Violation triggers CSO escalation.
- `/.col/skills/hermes-insights-loop/SKILL.md`
    - Use for weekly CEO Routine (Monday 08:00 EAT). Scans all agent sessions from last 7 days, surfaces completion rates, block rates, cost regressions. Triggers `write-a-skill` on recurring patterns.
- `/.col/skills/hermes-acp-messaging/SKILL.md`
    - **MANDATORY for all inter-agent communication.** All task delegations, status reports, blocker notifications, and board approval requests MUST use the ACP envelope format. Written to `.col/memory/inbox/{agent}/`.

### Engineering Orchestration (Codex Control Plane)

- `/.col/skills/symphony-orchestrator/SKILL.md`
    - **Control Plane for Work Management.** Transforms project work into isolated, autonomous implementation runs. Enforces "Proof of Work" (PoW) artifacts (CI, walkthroughs) before handoff. Tailored from OpenAI Symphony.

## Definition of Done (Enterprise Grade)

A task is not done until all applicable items pass:

- **Security**: Authz/tenant scope/input validation reviewed.
- **Data**: Migration safety, indexes, and RLS triaged.
- **Performance**: No regressions against SLO/CWV expectations.
- **Tests**: Appropriate unit/integration/e2e coverage updated.
- **Docs**: Relevant docs updated for behavior changes.

## Cognitive Orchestration Layer (COL) & Technical Memory

The `.col/` directory contains the proactive orchestrator system and our LLM Wiki.

- **The Executive Layer**: Uses `brainstorming`, `to-prd`, `triage`, and `dispatching-parallel-agents` to govern tasks.
- **The 23 Departments**: Every Lead Agent must adhere to their specialized stack skills listed above.
- **The Memory Engine**:
    - `/.col/memory/wiki/` (Semantic Memory): Codebase boundaries. Read before touching files.
    - `/.col/memory/episodes/` (Episodic Memory): Read before debugging. Logs past fixes.
    - `/.col/memory/sessions/` (Persistent Memory): Cross-session SQLite state store (Hermes).
    - `/.col/memory/wiki/research/` (SEKE): Autonomous ingestion of multi-modal research.
- **Document Standard (AAC)**:
    - Every `.md` file in `.col/` MUST include standardized YAML frontmatter (`id`, `type`, `owner`, `parent`, `links`) for machine-navigable organizational topology.
- **Self-Evolution**: After an episode is resolved, use `write-a-skill` to automatically extract the workflow into `.agents/skills/`. The `hermes-insights-loop` and **SEKE** engine drive autonomous knowledge expansion.

_(Note: The COL is IDE-agnostic. The AI Agent reading this file acts as the primary Orchestrator engine.)_
