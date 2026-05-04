---
name: hermes-toolset-distribution
description: >
    Assigns the minimal, role-appropriate toolset to each COL agent rather than
    giving every agent access to every tool. Adapted from Hermes Agent
    (NousResearch/hermes-agent, MIT — toolsets.py, toolset_distributions.py).
    Use when configuring a new agent, auditing agent capabilities, or
    implementing least-privilege tool access. Triggers on: "configure agent tools",
    "what tools does X agent need", or security review of agent capabilities.
metadata:
    sources:
        - kind: github-file
          repo: NousResearch/hermes-agent
          path: toolsets.py
          attribution: NousResearch
          license: MIT
          usage: referenced
        - kind: github-file
          repo: NousResearch/hermes-agent
          path: toolset_distributions.py
          attribution: NousResearch
          license: MIT
          usage: referenced
---

# Hermes Toolset Distribution

**Principle of Least Privilege for AI Agents.**

Every agent in the COL receives ONLY the tools it needs for its role. This
prevents agents from making out-of-scope changes, reduces accidental damage,
and creates a clear audit trail.

---

## Toolset Registry

### TIER 1: Read-Only Tools (safe for all agents)

```
- read_file           → Read any file in the workspace
- list_dir            → List directory contents
- grep_search         → Search codebase
- search_web          → Web research (Exa)
- context7_search     → Documentation lookup
- read_url            → Fetch public URLs
- view_memory         → Read .col/memory/** files
```

### TIER 2: Write Tools (requires manager-level role)

```
- write_file          → Create/overwrite files
- edit_file           → Patch existing files
- run_command         → Execute shell commands (read-only commands)
- write_memory        → Write to .col/memory/**
- create_issue        → Create GitHub issue
```

### TIER 3: Execution Tools (requires VP-level role)

```
- run_command         → Execute ANY shell command
- apply_migration     → Apply Supabase database migrations
- deploy_function     → Deploy Supabase Edge Functions
- create_pr           → Create GitHub pull requests
- merge_pr            → Merge GitHub pull requests
```

### TIER 4: Administrative Tools (C-Suite only)

```
- approve_budget      → Approve spend > threshold
- modify_rls          → Alter RLS policies
- rotate_secrets      → Rotate API keys/certificates
- update_wiki         → Modify .col/memory/wiki/core/**
- publish_release     → Trigger production deployment
```

---

## Agent Toolset Assignments

| Agent                | Tier         | Additional Allowed Tools                             |
| -------------------- | ------------ | ---------------------------------------------------- |
| CEO                  | T1 + T4      | `update_wiki`, `approve_budget`, `publish_release`   |
| CTO                  | T1 + T3 + T4 | All technical tools + `modify_rls`, `rotate_secrets` |
| CPO                  | T1 + T2      | `create_issue`, `write_memory`                       |
| CFO                  | T1 + T4      | `approve_budget` only                                |
| CMO                  | T1 + T2      | `create_issue`                                       |
| COO                  | T1 + T2      | `write_memory`, `create_issue`                       |
| CSO                  | T1 + T3 + T4 | `modify_rls`, `rotate_secrets`                       |
| VP Engineering       | T1 + T2 + T3 | All dev tools                                        |
| VP Product           | T1 + T2      | `create_issue`, `write_memory`                       |
| VP Security          | T1 + T2 + T3 | `modify_rls`, CVE scan                               |
| VP Data              | T1 + T2 + T3 | `apply_migration`, `execute_sql`                     |
| VP Growth            | T1 + T2      | Campaign tools                                       |
| VP Finance           | T1 + T2      | `approve_budget` (up to threshold)                   |
| VP Operations        | T1 + T2      | `write_memory`, `run_command` (read-only)            |
| VP Customer Success  | T1 + T2      | `create_issue`                                       |
| Eng Manager Core     | T1 + T2 + T3 | All backend dev tools                                |
| Eng Manager Mobile   | T1 + T2 + T3 | Mobile/Android tools                                 |
| Eng Manager Platform | T1 + T2 + T3 | CI/CD, infra tools                                   |
| Eng Manager Frontend | T1 + T2 + T3 | UI/CSS/component tools                               |
| PM POS               | T1 + T2      | `create_issue`, write specs                          |
| PM Merchant          | T1 + T2      | `create_issue`, write specs                          |
| Security Manager     | T1 + T2 + T3 | `modify_rls`, CVE                                    |
| Compliance Manager   | T1 + T2 + T3 | ERCA/MoR tools                                       |
| Data Manager         | T1 + T2 + T3 | `apply_migration`, `execute_sql`                     |
| DevOps Lead          | T1 + T2 + T3 | CI/CD, deploy tools                                  |

---

## Enforcement Protocol

### At Agent Startup

Every agent MUST declare its toolset in its heartbeat header:

```yaml
agent: eng-manager-core
toolset: tier-3
allowed_extra:
    - apply_migration
    - deploy_edge_function
forbidden:
    - approve_budget
    - rotate_secrets
    - modify_rls
```

### Tool Request Validation

Before executing ANY tool, the agent MUST verify:

1. The tool is in its assigned toolset
2. The target file/resource is within its file boundaries
3. The operation is not in the `forbidden` list

### Escalation on Boundary Violation

If a tool call would exceed the agent's toolset:

1. STOP immediately — do not execute the tool
2. Log the attempted access to `.col/memory/episodes/security-audit.md`
3. Create a `request_board_approval` item for the CSO
4. Wait for explicit approval before proceeding

---

## File Boundary Enforcement

Each agent also has **file boundaries** — directories it is allowed to modify.
These are defined in the agent's `AGENTS.md` `File Boundaries` section.

Any write to a file OUTSIDE the agent's boundaries requires:

- VP-level approval, OR
- CTO approval (for cross-department architectural changes)

---

## Source Reference

Adapted from `toolsets.py` and `toolset_distributions.py` in
[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) (MIT License).
