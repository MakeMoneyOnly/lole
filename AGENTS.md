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

- `/.agents/skills/core-technologies/supabase-postgres-best-practices/SKILL.md`
    - Use for RLS design, indexing, and query optimization.
- `/.agents/skills/security-and-ops/security-threat-model/SKILL.md`
    - Use for threat modeling and security audits.
- `/.agents/skills/security-and-ops/api-security-best-practices/SKILL.md`
    - Use for endpoint hardening and rate limiting.

### Runtime Architecture

- `/.agents/skills/core-technologies/nextjs-best-practices/SKILL.md`
    - Use for App Router architecture and performance.
- `/.agents/skills/core-technologies/apollo-server/SKILL.md`
    - Use for GraphQL resolver logic and server configuration.
- `/.agents/skills/core-technologies/apollo-router/SKILL.md`
    - Use for production federation and traffic shaping.
- `/.agents/skills/core-technologies/rust-best-practices/SKILL.md`
    - Use for Apollo Router custom plugin development (Rust).

### Operations & Compliance

- `/.agents/skills/security-and-ops/sentry-nextjs-sdk/SKILL.md`
    - Use for error monitoring and session replay setup.
- `/.agents/skills/security-and-ops/n8n-workflow-patterns/SKILL.md`
    - Use for automation and event-driven workflows.
- `/.agents/skills/security-and-ops/courier-skills/SKILL.md`
    - Use for multi-channel notifications (SMS/Push).
- `/.agents/skills/compliance-and-domain/nutrient-document-processing/SKILL.md`
    - Use for PDF/A fiscal export and document processing.
- `/.agents/skills/compliance-and-domain/openaccountants-tax-logic/SKILL.md`
    - Use for tax classification and fiscal reporting.

### UX & Performance

- `/.agents/skills/compliance-and-domain/core-web-vitals/SKILL.md`
    - Use for LCP/INP/CLS optimization.
- `/.agents/skills/design-and-ui/accessibility-auditor/SKILL.md`
    - Use for WCAG 2.1 AA audits and fixes.
- `/.agents/skills/design-and-ui/frontend-design/SKILL.md`
    - Use for net-new UI surfaces and design system maintenance.

### Enterprise Development (Superpowers)

- `/.agents/skills/workflow-and-superpowers/using-superpowers/SKILL.md`
    - Core bootstrap for the superpower ecosystem.
- `/.agents/skills/workflow-and-superpowers/brainstorming/SKILL.md`
    - Use for requirements gathering and design specs.
- `/.agents/skills/workflow-and-superpowers/writing-plans/SKILL.md`
    - Use for generating detailed implementation plans.
- `/.agents/skills/workflow-and-superpowers/executing-plans/SKILL.md`
    - Use for executing plans with discipline and checkpoints.
- `/.agents/skills/workflow-and-superpowers/subagent-driven-development/SKILL.md`
    - Use for high-quality, task-isolated implementation.
- `/.agents/skills/workflow-and-superpowers/dispatching-parallel-agents/SKILL.md`
    - Use for managing multiple independent investigation streams.
- `/.agents/skills/workflow-and-superpowers/requesting-code-review/SKILL.md`
    - Use for formal quality gates before merging.
- `/.agents/skills/workflow-and-superpowers/receiving-code-review/SKILL.md`
    - Use for technical evaluation of feedback.
- `/.agents/skills/workflow-and-superpowers/using-git-worktrees/SKILL.md`
    - Use for workspace isolation and context management.
- `/.agents/skills/workflow-and-superpowers/systematic-debugging/SKILL.md`
    - Use for finding root causes before implementing fixes.
- `/.agents/skills/workflow-and-superpowers/test-driven-development/SKILL.md`
    - Use for implementing behavior with failing tests first.
- `/.agents/skills/workflow-and-superpowers/verification-before-completion/SKILL.md`
    - Use for proving correctness before claiming success.
- `/.agents/skills/workflow-and-superpowers/finishing-a-development-branch/SKILL.md`
    - Use for merging and cleaning up after work is complete.

### External Intelligence (MCP Servers)

- **Context7 (`context7` MCP)**
    - _Must_ be used before writing code or plans involving 3rd-party libraries (e.g., Next.js, Rust, Tailwind). Always fetch the latest live documentation to prevent hallucinations or deprecated API usage.
- **Exa Search (`exa` MCP)**
    - Use during `brainstorming`, `to-prd`, and deep architectural investigations. Fetches clean, markdown-ready web content to anchor system designs in state-of-the-art industry research.

## Definition of Done (Enterprise Grade)

A task is not done until all applicable items pass:

- **Security**: Authz/tenant scope/input validation reviewed.
- **Data**: Migration safety, indexes, and RLS triaged.
- **Performance**: No regressions against SLO/CWV expectations.
- **Tests**: Appropriate unit/integration/e2e coverage updated.
- **Docs**: Relevant docs updated for behavior changes.
