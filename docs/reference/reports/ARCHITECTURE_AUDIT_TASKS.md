# Architecture Audit Implementation Tasks

**Generated from:** ARCHITECTURAL_AUDIT_2026-05-20.md  
**Date:** 2026-05-20  
**Project:** lole Restaurant OS  
**Architecture Score:** 8.2/10 (Strong Foundation with Remediation Opportunities)

---

## Priority Categories

| Priority | Description | Timeline |
|----------|-------------|----------|
| **P0-Critical** | Blocks production - must complete before launch | Immediate |
| **P1-High** | Address before production launch | Weeks 3-4 |
| **P2-Medium** | First sprint post-launch | Weeks 5-8 |
| **P3-Low** | Ongoing optimization | Ongoing |

---

## Phase 1: Foundation (Weeks 1-2) - COMPLETED ✅

| Task ID | Description | Effort | Owner | Dependencies | Status |
|---------|-------------|--------|-------|--------------|--------|
| P1-LOG-01 | Logging abstraction implementation | Medium | @backend | None | ✅ Completed |
| P1-TYPE-01 | Type safety enforcement (Core Layer) | Medium | @backend | None | ✅ Completed |
| P1-TYPE-02 | Type safety enforcement (Service Layer) | Medium | @backend | None | ✅ Completed |
| P1-TYPE-03 | Type safety enforcement (UI Layer) | Medium | @frontend | None | ✅ Completed |

---

## Phase 2: Security Hardening (Weeks 3-4)

### P0-Critical Tasks

| Task ID | Description | Effort | Owner | Dependencies | Status |
|---------|-------------|--------|-------|--------------|--------|
| P0-SEC-01 | PowerSync package completion | High | @fullstack | None | **Blocked** - Requires DATABASE_DIRECT_URL infrastructure |
| P0-SEC-02 | Exposed auth.users in view - security_invoker missing | Low | @backend | None | Pending |

### P1-High Tasks

| Task ID | Description | Effort | Owner | Dependencies | Status |
|---------|-------------|--------|-------|--------------|--------|
| P1-SEC-01 | Implement bcrypt PIN hashing | Low | @security | None | ✅ Completed - Implemented in pin.ts |
| P1-SEC-02 | Apply security_invoker to views | Low | @backend | None | ✅ Completed - Migration 20260408150000 addresses all views |
| P1-SEC-03 | Verify payment webhook job handler | Low | @backend | None | Pending |
| P1-SEC-04 | Add retry logic for KDS realtime | Low | @frontend | None | Pending |
| P1-SEC-05 | Configure connection pooling | Low | @ops | None | Pending |
| P1-SEC-06 | Add missing DataLoaders | Medium | @backend | None | ✅ Completed |
| P1-SEC-07 | Telebirr payment integration | High | @backend | None | Pending |

---

## Phase 3: Architecture Refactoring (Weeks 5-8)

### P2-Medium Tasks

| Task ID | Description | Effort | Owner | Dependencies | Status |
|---------|-------------|--------|-------|--------------|--------|
| P2-ARCH-01 | Split StaffService responsibilities (SRP) | High | @backend | None | ✅ Completed |
| P2-ARCH-02 | Externalize role permissions (OCP) | Medium | @backend | None | Pending |
| P2-ARCH-03 | Standardize error handling | Medium | @backend | None | Pending |
| P2-ARCH-04 | Add DataLoader tenant verification | Low | @backend | None | Pending |
| P2-ARCH-05 | Implement conflict resolution strategy | Medium | @fullstack | None | Pending |
| P2-ARCH-06 | Replace sync worker placeholders | Medium | @fullstack | None | Pending |
| P2-ARCH-07 | Dexie migration completion | Low | @backend | None | Pending |
| P2-ARCH-08 | Message deduplication for realtime | Low | @frontend | None | Pending |

### SOLID Principle Violations

| Task ID | Description | Effort | Owner | Dependencies | Status |
|---------|-------------|--------|-------|--------------|--------|
| SOLID-01 | Fix SRP violation in verifyPin - tenant isolation logging | Medium | @backend | None | Pending |
| SOLID-02 | Externalize permissions from hardcoded map | Medium | @backend | P2-ARCH-02 | Pending |
| SOLID-03 | Dependency injection for repositories | Medium | @backend | None | ✅ Completed |

---

## Phase 4: Optimization & Performance (Weeks 9-10)

### P2-Medium Tasks

| Task ID | Description | Effort | Owner | Dependencies | Status |
|---------|-------------|--------|-------|--------------|--------|
| P2-PERF-01 | Add remaining DataLoaders | Medium | @backend | P1-SEC-06 | ✅ Completed - Same work as P1-SEC-06 |
| P2-PERF-02 | Audit select star queries | Low | @backend | None | Pending |
| P2-PERF-03 | Implement real-time reconnection | Low | @frontend | P1-SEC-04 | Pending |

### P3-Low Tasks

| Task ID | Description | Effort | Owner | Dependencies | Status |
|---------|-------------|--------|-------|--------------|--------|
| P3-OPT-01 | Amharic translation coverage | Low | @i18n | None | Pending |
| P3-OPT-02 | Network speed detection | Medium | @frontend | None | Pending |
| P3-OPT-03 | Query performance monitoring | Low | @backend | None | Pending |
| P3-OPT-04 | Bundle size budgets | Low | @frontend | None | Pending |

---

## Domain Interface Creation

| Task ID | Description | Effort | Owner | Dependencies | Status |
|---------|-------------|--------|-------|--------------|--------|
| DOM-IF-01 | Create repository interfaces (port layer) | Medium | @backend | None | ✅ Completed |
| DOM-IF-02 | Define service interfaces per domain | Medium | @backend | DOM-IF-01 | ✅ Completed |
| DOM-IF-03 | Create async port definitions | Medium | @backend | DOM-IF-01 | Pending |
| DOM-IF-04 | Update payment domain interfaces | Medium | @backend | DOM-IF-02 | Pending |
| DOM-IF-05 | Update staff domain interfaces | Medium | @backend | DOM-IF-02 | Pending |
| DOM-IF-06 | Update order domain interfaces | Medium | @backend | DOM-IF-02 | Pending |
| DOM-IF-07 | Update cart domain interfaces | Medium | @backend | DOM-IF-02 | Pending |
| DOM-IF-08 | Update menu domain interfaces | Medium | @backend | DOM-IF-02 | Pending |

---

## Application Layer & Interface Exports

| Task ID | Description | Effort | Owner | Dependencies | Status |
|---------|-------------|--------|-------|--------------|--------|
| APP-01 | Create Application Layer with use cases | High | @backend | DOM-IF-01, DOM-IF-02 | ✅ Completed |
| APP-02 | Export domain interfaces from index barrel files | Low | @backend | DOM-IF-01 | ✅ Completed |

---

## Staff Service Refactoring

| Task ID | Description | Effort | Owner | Dependencies | Status |
|---------|-------------|--------|-------|--------------|--------|
| STAFF-REF-01 | Extract PinService from StaffService | Medium | @backend | None | ✅ Completed |
| STAFF-REF-02 | Extract RoleService from StaffService | Medium | @backend | None | ✅ Completed |
| STAFF-REF-03 | Extract PermissionService from StaffService | Medium | @backend | None | ✅ Completed |
| STAFF-REF-04 | Extract StaffCrudService from StaffService | Medium | @backend | None | ✅ Completed |
| STAFF-REF-05 | Move tenant isolation checks to middleware | Low | @backend | STAFF-REF-01 | ✅ Completed |
| STAFF-REF-06 | Update StaffService to delegate to smaller services | Low | @backend | STAFF-REF-01-STAFF-REF-04 | ✅ Completed |

---

## API Route Layer Refactoring

| Task ID | Description | Effort | Owner | Dependencies | Status |
|---------|-------------|--------|-------|--------------|--------|
| API-REF-01 | Standardize API route error handling | Medium | @backend | P2-ARCH-03 | Pending |
| API-REF-02 | Add input validation middleware | Medium | @backend | None | Pending |
| API-REF-03 | Add rate limiting middleware | Low | @security | None | Pending |
| API-REF-04 | Consolidate duplicate utility patterns | Low | @backend | None | Pending |
| API-REF-05 | Flatten nested app router depth where possible | Low | @frontend | None | Pending |

---

## Testing Updates

| Task ID | Description | Effort | Owner | Dependencies | Status |
|---------|-------------|--------|-------|--------------|--------|
| TEST-01 | Add unit tests for refactored services - Completed (tests exist for PinService, RoleService, PermissionService, StaffApplicationService, Repository) | Medium | @backend | P2-ARCH-01 | ✅ Completed |
| TEST-02 | Add integration tests for permission changes | Medium | @backend | P2-ARCH-02 | Pending |
| TEST-03 | Add tests for error handling standardization | Medium | @backend | P2-ARCH-03 | Pending |
| TEST-04 | Add property-based tests for PIN verification - Completed (existing pin.test.ts covers this) | Low | @security | P1-SEC-01 | ✅ Completed |
| TEST-05 | Add retry logic tests for realtime | Low | @frontend | P1-SEC-04 | Pending |
| TEST-06 | Add KDS realtime hook tests | Medium | @frontend | P3-OPT-02 | Pending |
| TEST-07 | Increase test coverage to 85% | High | @backend | All | Pending |
| TEST-08 | Add conflict resolution scenario tests | High | @fullstack | P2-ARCH-05 | Pending |

---

## Security Invoker Fixes

| Task ID | Description | Effort | Owner | Dependencies | Status |
|---------|-------------|--------|-------|--------------|--------|
| SEC-INV-01 | Apply security_invoker to active_menu_items view | Low | @backend | None | ✅ Completed - Migration 20260408150000 |
| SEC-INV-02 | Apply security_invoker to active_restaurants view | Low | @backend | None | ✅ Completed - Migration 20260408150000 |
| SEC-INV-03 | Apply security_invoker to active_tables view | Low | @backend | None | ✅ Completed - Migration 20260408150000 |
| SEC-INV-04 | Apply security_invoker to active_restaurant_staff view | Low | @backend | None | ✅ Completed - Migration 20260408150000 |
| SEC-INV-05 | Apply security_invoker to delivery_partner_integrations view | Low | @backend | None | ✅ Completed - Migration 20260408150000 |
| SEC-INV-06 | Verify no data leakage after invoker changes | Low | @security | SEC-INV-01-SEC-INV-05 | Pending |

---

## Error Handling Standardization

| Task ID | Description | Effort | Owner | Dependencies | Status |
|---------|-------------|--------|-------|--------------|--------|
| ERR-STD-01 | Document error handling pattern | Low | @backend | None | Pending |
| ERR-STD-02 | Convert all resolvers to GraphQL error format | Medium | @backend | None | Pending |
| ERR-STD-03 | Convert all services to throw exceptions | Medium | @backend | None | Pending |
| ERR-STD-04 | Create migration guide | Low | @backend | ERR-STD-01 | Pending |
| ERR-STD-05 | Update GraphQL response types | Medium | @backend | ERR-STD-02 | Pending |

---

## Dependency Injection Setup

| Task ID | Description | Effort | Owner | Dependencies | Status |
|---------|-------------|--------|-------|--------------|--------|
| DI-01 | Create container configuration | Medium | @backend | DOM-IF-01 | ✅ Completed |
| DI-02 | Define repository factory functions | Medium | @backend | DOM-IF-01 | Pending |
| DI-03 | Create service factory functions | Medium | @backend | DOM-IF-02 | Pending |
| DI-04 | Integrate DI with application bootstrap | Low | @backend | DI-01-DI-03 | Pending |
| DI-05 | Update GraphQL resolvers to use DI | Medium | @backend | DI-04 | Pending |
| DI-06 | Add unit test mocks using DI | Low | @backend | DI-05 | Pending |

---

## Anti-Pattern Fixes

| Task ID | Description | Effort | Owner | Dependencies | Status |
|---------|-------------|--------|-------|--------------|--------|
| ANTI-01 | Split StaffService God Object | High | @backend | P2-ARCH-01 | Pending |
| ANTI-02 | Remove magic strings/numbers | Low | @backend | None | Pending |
| ANTI-03 | Standardize error handling (duplicate) | Medium | @backend | P2-ARCH-03 | Pending |

---

## Tracking Summary Table

| Priority | Category | Tasks | Effort Distribution | Status |
|----------|----------|-------|---------------------|--------|
| P0 | Security Critical | 2 | 1 High, 1 Low | 0/2 Complete (1 Blocked) |
| P1 | Security High | 7 | 3 Low, 2 Medium, 2 High | 2/7 Complete |
| P2 | Architecture Medium | 11 | 5 Low, 4 Medium, 2 High | 1/11 Complete |
| P3 | Optimization Low | 4 | 3 Low, 1 Medium | 0/4 Complete |
| SOLID | Principle Violations | 3 | 2 Medium, 1 Low | 1/3 Complete |
| Domain | Interface Creation | 8 | All Medium | 2/8 Complete |
| Staff | Service Refactoring | 6 | 5 Medium, 1 Low | 6/6 Complete |
| API | Route Refactoring | 5 | 2 Low, 2 Medium, 1 Low | 0/5 Complete |
| Test | Testing Updates | 8 | 4 Low, 3 Medium, 1 High | 0/8 Complete |
| Security | Invoker Fixes | 6 | All Low | 5/6 Complete |
| Error | Handling | 5 | 1 Low, 3 Medium, 1 Low | 0/5 Complete |
| DI | Setup | 6 | 5 Medium, 1 Low | 1/6 Complete |
| App | Layer & Exports | 2 | 1 High, 1 Low | 2/2 Complete |
| Anti | Patterns | 3 | 1 High, 1 Low, 1 Medium | 0/3 Complete |

**Total Tasks:** 74  
**Completed:** 21 (Phase 1 Foundation + Domain/Staff/DI wave + Application Layer + Security tasks)  
**Pending:** 53 (1 Blocked)  
**Estimated Total Effort:** 25-35 weeks (assuming parallel execution)

---

## Next Review: 2026-06-15