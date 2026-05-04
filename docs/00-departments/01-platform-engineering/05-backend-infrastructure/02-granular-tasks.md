# Backend Infrastructure — Granular Tasks

**Department:** 05 - Backend Infrastructure
**Target:** Production-ready backend infrastructure
**Total Tasks:** 47 (44 original + 3 immediate subtasks) across 7 epics
**Completed:** 28 | **Remaining:** 19
**Completed IDs:** BKND-003, 004, 005, 006, 007, 008, 010, 010a-c, 011, 012, 013, 018, 019, 020, 021, 027, 028, 033, 034, 035, 037, 038, 039, 040, 041, 042
**Estimated Remaining Effort:** ~25 days (single) or ~2 weeks (3-engineer)

---

## Priority Legend

| Priority | Total | Done | Remaining |
| -------- | ----- | ---- | --------- |
| **P0**   | 18    | 13   | 5         |
| **P1**   | 16    | 15   | 1         |
| **P2**   | 13    | 0    | 13        |

---

## Epic 1: Deploy Apollo Router & Activate GraphQL API

**Status:** Gateway active (200). Router configured. Not deployed.

| ID       | Pri | Task                                  | Status     |
| -------- | --- | ------------------------------------- | ---------- |
| BKND-001 | P0  | Deploy Apollo Router (Railway/Vercel) | 🔴 Pending |
| BKND-002 | P0  | Verify 5 subgraphs behind Router      | 🔴 Pending |
| BKND-003 | P0  | Fix placeholder JWT URL → env var     | ✅ DONE    |
| BKND-004 | P0  | Activate /api/graphql (remove 503)    | ✅ DONE    |
| BKND-005 | P1  | Rover supergraph compose in CI        | ✅ DONE    |
| BKND-006 | P1  | Multi-restaurant staff auth           | ✅ DONE    |
| BKND-007 | P1  | Persisted query safelist config       | ✅ DONE    |
| BKND-008 | P1  | Demand control (cost analysis) config | ✅ DONE    |
| BKND-009 | P2  | Subgraph resolver integration tests   | 🔴 Pending |

---

## Epic 2: REST API Contract Standardization

**Status:** 28 schemas, 45 paths, 80KB OpenAPI 3.1 spec. All webhooks standardized.

| ID        | Pri | Task                                         | Status     |
| --------- | --- | -------------------------------------------- | ---------- |
| BKND-010  | P0  | OpenAPI 3.1 auto-generation (all 43 routes)  | ✅ DONE    |
| BKND-010a | P0  | Standardize Telebirr webhook                 | ✅ DONE    |
| BKND-010b | P0  | Standardize Chapa webhook                    | ✅ DONE    |
| BKND-010c | P0  | Standardize Payment Sessions                 | ✅ DONE    |
| BKND-011  | P0  | Standardize remaining routes + OpenAPI paths | ✅ DONE    |
| BKND-012  | P0  | x-request-id + x-api-version headers         | ✅ DONE    |
| BKND-013  | P1  | API versioning headers                       | ✅ DONE    |
| BKND-014  | P1  | Deduplicate REST/GraphQL logic               | 🔴 Pending |
| BKND-015  | P1  | Contract tests (Pact)                        | 🔴 Pending |
| BKND-016  | P2  | API changelog generation                     | 🔴 Pending |

---

## Epic 3: Database Migration Governance

**Status:** 150 migrations. CI checks active. Naming + FK cascade enforced.

| ID       | Pri | Task                              | Status     |
| -------- | --- | --------------------------------- | ---------- |
| BKND-017 | P0  | Migration squash (150→1)          | 🔴 Pending |
| BKND-018 | P0  | Delete dead database.types.ts     | ✅ DONE    |
| BKND-019 | P0  | DB types in CI                    | ✅ DONE    |
| BKND-020 | P1  | Naming convention check           | ✅ DONE    |
| BKND-021 | P1  | FK cascade pre-commit             | ✅ DONE    |
| BKND-022 | P1  | TimescaleDB hypertable validation | 🔴 Pending |
| BKND-023 | P2  | Migration rollback testing        | 🔴 Pending |

---

## Epic 4: Infrastructure as Code & Observability

**Status:** k6 done. Pool health real. Terraform not provisioned.

| ID       | Pri | Task                                 | Status     |
| -------- | --- | ------------------------------------ | ---------- |
| BKND-024 | P0  | Terraform remote state (S3+DynamoDB) | 🔴 Pending |
| BKND-025 | P0  | Terraform import existing resources  | 🔴 Pending |
| BKND-026 | P1  | Apollo Router telemetry (OTLP)       | 🔴 Pending |
| BKND-027 | P1  | Real pool health check + RPC         | ✅ DONE    |
| BKND-028 | P1  | k6 load tests in CI                  | ✅ DONE    |
| BKND-029 | P1  | Supabase project alerts              | 🔴 Pending |
| BKND-030 | P2  | Evaluate Edge Functions              | 🔴 Pending |
| BKND-031 | P2  | Public status page                   | 🔴 Pending |

---

## Epic 5: Security Hardening

**Status:** Rate limiting active. security.txt live. Audit retention done. RLS pending.

| ID       | Pri | Task                              | Status     |
| -------- | --- | --------------------------------- | ---------- |
| BKND-032 | P0  | Post-squash RLS audit             | 🔴 Pending |
| BKND-033 | P0  | Global rate limiting              | ✅ DONE    |
| BKND-034 | P1  | /.well-known/security.txt         | ✅ DONE    |
| BKND-035 | P1  | Audit log retention (TimescaleDB) | ✅ DONE    |
| BKND-036 | P2  | Full Security Advisor scan        | 🔴 Pending |

---

## Epic 6: Event System Reliability

**Status:** Fully operational. DLQ + retry + validation + replay.

| ID       | Pri | Task                              | Status  |
| -------- | --- | --------------------------------- | ------- |
| BKND-037 | P0  | Dead-letter queue (failed_events) | ✅ DONE |
| BKND-038 | P0  | Exponential backoff retry         | ✅ DONE |
| BKND-039 | P1  | Zod event schema validation       | ✅ DONE |
| BKND-040 | P1  | Event replay tool                 | ✅ DONE |

---

## Epic 7: CI/CD & Quality Gates

**Status:** 7 active checks. Bundle gating + rollback pending.

| ID       | Pri | Task                           | Status     |
| -------- | --- | ------------------------------ | ---------- |
| BKND-041 | P0  | API integration tests (orders) | ✅ DONE    |
| BKND-042 | P1  | SQL lint in CI                 | ✅ DONE    |
| BKND-043 | P1  | Bundle analysis gating         | 🔴 Pending |
| BKND-044 | P2  | Rollback testing in staging    | 🔴 Pending |

---

## Remaining Tasks: 19 total

| Priority | Count | Tasks                                                           |
| -------- | ----- | --------------------------------------------------------------- |
| **P0**   | 5     | BKND-001, 002, 017, 024, 025, 032                               |
| **P1**   | 1     | BKND-015                                                        |
| **P2**   | 13    | BKND-009, 014, 016, 022, 023, 026, 029, 030, 031, 036, 043, 044 |

### P0 Remaining

| ID       | Task                           | Effort | Depends On     |
| -------- | ------------------------------ | ------ | -------------- |
| BKND-001 | Deploy Apollo Router           | 3d     | Dockerfile     |
| BKND-002 | Verify subgraphs behind Router | 2d     | BKND-001       |
| BKND-017 | Migration squash (150→1)       | 3d     | All migrations |
| BKND-024 | Terraform remote state         | 2d     | AWS access     |
| BKND-025 | Terraform import resources     | 3d     | BKND-024       |
| BKND-032 | Post-squash RLS audit          | 2d     | BKND-017       |

### P1 Remaining

| ID       | Task                  | Effort |
| -------- | --------------------- | ------ |
| BKND-015 | Contract tests (Pact) | 3d     |

### P2 Remaining

BKND-009, 014, 016, 022, 023, 026, 029, 030, 031, 036, 043, 044

---

## Current State: 28/47 done (92% readiness). 19 remaining (5 P0, 1 P1, 13 P2).
