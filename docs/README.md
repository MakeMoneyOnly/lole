# lole Restaurant OS - Documentation Index

## Enterprise Documentation Structure (Diátaxis Framework)

This document describes the standardized documentation organization following the Diátaxis framework.

---

## Directory Structure

```
docs/
├── tutorials/           # LEARNING-ORIENTED
│   ├── 01-local-setup.md
│   └── 02-first-feature.md
├── how-to/              # GOAL-ORIENTED
│   ├── database-migrations.md
│   ├── deploy-to-staging.md
│   ├── adding-auth-middleware.md
│   ├── table-management.md
│   ├── kds-troubleshooting.md
│   ├── order-troubleshooting.md
│   ├── payment-troubleshooting.md
│   ├── operational-runbooks/
│   └── integrations/
├── reference/           # INFORMATION-ORIENTED
│   ├── api-spec.yaml    # OpenAPI spec (placeholder)
│   ├── env-vars.md      # Environment variables
│   ├── tech-stack.md    # Tech stack versions
│   ├── coding-standards.md
│   ├── database-erd.md
│   ├── graphql-federation-architecture.md
│   ├── kds-printer-webhook-contract.md
│   ├── feature-flags-catalogue.md
│   ├── security/
│   ├── reports/
│   └── archive/
└── explanation/         # UNDERSTANDING-ORIENTED
    ├── architecture/
    │   ├── system-design.md
    │   └── data-flow.md
    ├── decisions/       # ADRs
    ├── product-vision.md
    └── product/
```

---

## The Diátaxis Framework

Documentation is organized into four distinct categories:

| Type                             | Purpose                                 | Audience                    |
| -------------------------------- | --------------------------------------- | --------------------------- |
| **Tutorials** (`tutorials/`)     | Learning-oriented, step-by-step         | New users, onboarding       |
| **How-to Guides** (`how-to/`)    | Goal-oriented, problem-solving          | Practitioners               |
| **Reference** (`reference/`)     | Information-oriented, technical details | All technical users         |
| **Explanation** (`explanation/`) | Understanding-oriented, concepts        | Architects, decision-makers |

---

## Document Naming Conventions

1. **Use descriptive titles**: `security-policy.md` not `sec-pol.md`
2. **Use kebab-case**: All lowercase with hyphens
3. **Include dates for temporal docs**: `audit-2026-03.md`
4. **Use prefixes for ordering**: `01-`, `02-` for tutorials

---

## Maintenance

- Review documentation quarterly
- Update archive folder after each audit cycle
- Remove outdated reports after 1 year

---

_Last Updated: 2026-05-14T22:45:00+03:00_
