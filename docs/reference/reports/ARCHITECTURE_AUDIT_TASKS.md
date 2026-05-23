# Architecture Audit Implementation Tasks

**Generated from:** ARCHITECTURAL_AUDIT_2026-05-20.md  
**Date:** 2026-05-20  
**Project:** lole Restaurant OS  
**Architecture Score:** 8.2/10 (Strong Foundation with Remediation Opportunities)

---

## Priority Categories

| Priority        | Description                                     | Timeline  |
| --------------- | ----------------------------------------------- | --------- |
| **P0-Critical** | Blocks production - must complete before launch | Immediate |
| **P1-High**     | Address before production launch                | Weeks 3-4 |
| **P2-Medium**   | First sprint post-launch                        | Weeks 5-8 |
| **P3-Low**      | Ongoing optimization                            | Ongoing   |

---

## Phase 1: Foundation (Weeks 1-2) - COMPLETED ✅

| Task ID    | Description                             | Effort | Owner     | Dependencies | Status       |
| ---------- | --------------------------------------- | ------ | --------- | ------------ | ------------ |
| P1-LOG-01  | Logging abstraction implementation      | Medium | @backend  | None         | ✅ Completed |
| P1-TYPE-01 | Type safety enforcement (Core Layer)    | Medium | @backend  | None         | ✅ Completed |
| P1-TYPE-02 | Type safety enforcement (Service Layer) | Medium | @backend  | None         | ✅ Completed |
| P1-TYPE-03 | Type safety enforcement (UI Layer)      | Medium | @frontend | None         | ✅ Completed |

---

## Phase 2: Security Hardening (Weeks 3-4)

### P0-Critical Tasks

| Task ID   | Description                                           | Effort | Owner      | Dependencies | Status                                                                                   |
| --------- | ----------------------------------------------------- | ------ | ---------- | ------------ | ---------------------------------------------------------------------------------------- |
| P0-SEC-01 | PowerSync package completion                          | High   | @fullstack | None         | **Blocked** - Requires DATABASE_DIRECT_URL infrastructure                                |
| P0-SEC-02 | Exposed auth.users in view - security_invoker missing | Low    | @backend   | None         | ✅ Completed - Migration 20260408100000 applied security_invoker and user_profiles table |

### P1-High Tasks

| Task ID   | Description                        | Effort | Owner     | Dependencies | Status                                                                                                    |
| --------- | ---------------------------------- | ------ | --------- | ------------ | --------------------------------------------------------------------------------------------------------- |
| P1-SEC-01 | Implement bcrypt PIN hashing       | Low    | @security | None         | ✅ Completed - Implemented in pin.ts                                                                      |
| P1-SEC-02 | Apply security_invoker to views    | Low    | @backend  | None         | ✅ Completed - Migration 20260408150000 addresses all views                                               |
| P1-SEC-03 | Verify payment webhook job handler | Low    | @backend  | None         | ✅ Completed - See Security Review Findings below                                                         |
| P1-SEC-04 | Add retry logic for KDS realtime   | Low    | @frontend | None         | ✅ Completed - Implemented in src/features/kds/hooks/useKDSRealtime.ts with exponential backoff reconnect |
| P1-SEC-05 | Configure connection pooling       | Low    | @ops      | None         | ✅ Completed - Connection pooling already exists in src/lib/supabase/connection-pooling.ts                |
| P1-SEC-06 | Add missing DataLoaders            | Medium | @backend  | None         | ✅ Completed                                                                                              |
| P1-SEC-07 | Telebirr payment integration       | High   | @backend  | None         | ✅ Completed - timingSafeEqual implemented in telebirr.ts:134                                             |

---

## Phase 3: Architecture Refactoring (Weeks 5-8)

### P2-Medium Tasks

| Task ID    | Description                               | Effort | Owner      | Dependencies | Status                                                                                                                                             |
| ---------- | ----------------------------------------- | ------ | ---------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-ARCH-01 | Split StaffService responsibilities (SRP) | High   | @backend   | None         | ✅ Completed                                                                                                                                       |
| P2-ARCH-02 | Externalize role permissions (OCP)        | Medium | @backend   | None         | ✅ Completed - Database-backed permissions with dynamic registration; new roles require single-line update to STAFF_ROLES constant for type safety |
| P2-ARCH-03 | Standardize error handling                | Medium | @backend   | None         | ✅ Completed                                                                                                                                       |
| P2-ARCH-04 | Add DataLoader tenant verification        | Low    | @backend   | None         | ✅ Completed - Implemented in dataloaders.ts with verifyTenantOwnership helper                                                                     |
| P2-ARCH-05 | Implement conflict resolution strategy    | Medium | @fullstack | None         | ✅ Completed - Conflict resolution implemented in src/lib/sync/conflict-resolution.ts                                                              |
| P2-ARCH-06 | Replace sync worker placeholders          | Medium | @fullstack | None         | ✅ Completed - Fully implemented with batch sync, retry logic, conflict detection, and event emission in src/lib/sync/syncWorker.ts                |
| P2-ARCH-07 | Dexie migration completion                | Low    | @backend   | None         | ✅ Completed - Full implementation with migrateDexieOrdersToPowerSync, migrateKdsLocalStorageToPowerSync, resume support, error handling, UI hooks |
| P2-ARCH-08 | Message deduplication for realtime        | Low    | @frontend  | None         | ✅ Completed - MessageDeduplicator class implemented in useKDSRealtime hook                                                                        |

### SOLID Principle Violations

| Task ID  | Description                                               | Effort | Owner    | Dependencies | Status                                                                        |
| -------- | --------------------------------------------------------- | ------ | -------- | ------------ | ----------------------------------------------------------------------------- |
| SOLID-01 | Fix SRP violation in verifyPin - tenant isolation logging | Medium | @backend | None         | Pending                                                                       |
| SOLID-02 | Externalize permissions from hardcoded map                | Medium | @backend | P2-ARCH-02   | ✅ Completed - Permissions now database-backed with registerPermissions() API |
| SOLID-03 | Dependency injection for repositories                     | Medium | @backend | None         | ✅ Completed                                                                  |

---

## Phase 4: Optimization & Performance (Weeks 9-10)

### P2-Medium Tasks

| Task ID    | Description                      | Effort | Owner     | Dependencies | Status                                |
| ---------- | -------------------------------- | ------ | --------- | ------------ | ------------------------------------- |
| P2-PERF-01 | Add remaining DataLoaders        | Medium | @backend  | P1-SEC-06    | ✅ Completed - Same work as P1-SEC-06 |
| P2-PERF-02 | Audit select star queries        | Low    | @backend  | None         | Pending                               |
| P2-PERF-03 | Implement real-time reconnection | Low    | @frontend | P1-SEC-04    | Pending                               |

### P3-Low Tasks

| Task ID   | Description                  | Effort | Owner     | Dependencies | Status  |
| --------- | ---------------------------- | ------ | --------- | ------------ | ------- |
| P3-OPT-01 | Amharic translation coverage | Low    | @i18n     | None         | Pending |
| P3-OPT-02 | Network speed detection      | Medium | @frontend | None         | Pending |
| P3-OPT-03 | Query performance monitoring | Low    | @backend  | None         | Pending |
| P3-OPT-04 | Bundle size budgets          | Low    | @frontend | None         | Pending |

---

## Domain Interface Creation

| Task ID   | Description                               | Effort | Owner    | Dependencies | Status                                               |
| --------- | ----------------------------------------- | ------ | -------- | ------------ | ---------------------------------------------------- |
| DOM-IF-01 | Create repository interfaces (port layer) | Medium | @backend | None         | ✅ Completed                                         |
| DOM-IF-02 | Define service interfaces per domain      | Medium | @backend | DOM-IF-01    | ✅ Completed                                         |
| DOM-IF-03 | Create async port definitions             | Medium | @backend | DOM-IF-01    | ✅ Completed - Async ports created in src/lib/ports/ |
| DOM-IF-04 | Update payment domain interfaces          | Medium | @backend | DOM-IF-02    | Pending                                              |
| DOM-IF-05 | Update staff domain interfaces            | Medium | @backend | DOM-IF-02    | Pending                                              |
| DOM-IF-06 | Update order domain interfaces            | Medium | @backend | DOM-IF-02    | Pending                                              |
| DOM-IF-07 | Update cart domain interfaces             | Medium | @backend | DOM-IF-02    | Pending                                              |
| DOM-IF-08 | Update menu domain interfaces             | Medium | @backend | DOM-IF-02    | Pending                                              |

---

## Application Layer & Interface Exports

| Task ID | Description                                      | Effort | Owner    | Dependencies         | Status       |
| ------- | ------------------------------------------------ | ------ | -------- | -------------------- | ------------ |
| APP-01  | Create Application Layer with use cases          | High   | @backend | DOM-IF-01, DOM-IF-02 | ✅ Completed |
| APP-02  | Export domain interfaces from index barrel files | Low    | @backend | DOM-IF-01            | ✅ Completed |

---

## Staff Service Refactoring

| Task ID      | Description                                         | Effort | Owner    | Dependencies              | Status       |
| ------------ | --------------------------------------------------- | ------ | -------- | ------------------------- | ------------ |
| STAFF-REF-01 | Extract PinService from StaffService                | Medium | @backend | None                      | ✅ Completed |
| STAFF-REF-02 | Extract RoleService from StaffService               | Medium | @backend | None                      | ✅ Completed |
| STAFF-REF-03 | Extract PermissionService from StaffService         | Medium | @backend | None                      | ✅ Completed |
| STAFF-REF-04 | Extract StaffCrudService from StaffService          | Medium | @backend | None                      | ✅ Completed |
| STAFF-REF-05 | Move tenant isolation checks to middleware          | Low    | @backend | STAFF-REF-01              | ✅ Completed |
| STAFF-REF-06 | Update StaffService to delegate to smaller services | Low    | @backend | STAFF-REF-01-STAFF-REF-04 | ✅ Completed |

---

## API Route Layer Refactoring

| Task ID    | Description                                                                                                            | Effort | Owner     | Dependencies | Status                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- | ------ | --------- | ------------ | ------------------------------------------------------------------------------ |
| API-REF-01 | Standardize API route error handling                                                                                   | Medium | @backend  | P2-ARCH-03   | ✅ Completed - apiSuccess, apiError, handleApiError in src/lib/api/response.ts |
| API-REF-02 | Add input validation middleware                                                                                        | Medium | @backend  | None         | ✅ Completed - Implemented in src/lib/api/middleware.ts with Zod schemas       |
| API-REF-03 | Add rate limiting middleware                                                                                           | Low    | @security | None         | ✅ Completed - Redis-backed rate limiting in src/lib/rate-limit.ts             |
| API-REF-04 | Consolidate duplicate utility patterns                                                                                 | Low    | @backend  | None         | ✅ Completed - Consolidated in src/lib/api/middleware.ts and response.ts       |
| API-REF-05 | Flatten nested app router depth where possible                                                                         | Low    | @frontend | None         | ✅ Resolved - No Action Required                                               |
|            | - Current route depth is semantically meaningful (5-6 levels express domain resource hierarchy)                        |        |           |              |                                                                                |
|            | - Handlers are thin controllers (50-150 lines) delegating to extracted services                                        |        |           |              |                                                                                |
|            | - Multi-audience API (merchant, internal, guest-portal, POS, webhooks, system) benefits from hierarchical organization |        |           |              |                                                                                |
|            | - Higher priority: feature-slice architecture migration over route flattening                                          |        |           |              |                                                                                |

---

## Higher-Value Architecture Tasks

| Task ID | Priority  | Description                                   | Effort | Owner      | Dependencies | Status                                                                                          |
| ------- | --------- | --------------------------------------------- | ------ | ---------- | ------------ | ----------------------------------------------------------------------------------------------- |
| ARCH-12 | P1-High   | Complete feature-slice migration              | High   | @fullstack | None         | ✅ Completed                                                                                    |
| ARCH-13 | P2-Medium | Introduce application service layer           | Medium | @backend   | DOM-IF-02    | ✅ Completed                                                                                    |
| ARCH-14 | P2-Medium | Zod-to-OpenAPI contract generation            | Medium | @backend   | None         | ✅ Completed - Tooling exists via scripts/tools/generate-openapi.ts and openapi:generate script |
| ARCH-15 | P2-Medium | Standardize event contracts                   | Medium | @backend   | None         | Pending                                                                                         |
| ARCH-16 | P2-Medium | Repository abstraction for Supabase           | Medium | @backend   | DOM-IF-01    | Pending                                                                                         |
| ARCH-17 | P3-Low    | Add observability/tracing for async workflows | Medium | @ops       | None         | Pending                                                                                         |

---

## Testing Updates

| Task ID | Description                                                                                                            | Effort | Owner      | Dependencies | Status                                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| TEST-01 | Add unit tests for refactored services - Completed (tests now fixed for role-service and permission-service)           | Medium | @backend   | P2-ARCH-01   | ✅ Completed                                                                                                               |
| TEST-02 | Add integration tests for permission changes                                                                           | Medium | @backend   | P2-ARCH-02   | Pending - Requires database integration tests for role_permissions table                                                   |
| TEST-03 | Add tests for error handling standardization                                                                           | Medium | @backend   | P2-ARCH-03   | ✅ Completed - Added error handling patterns tests to src/lib/graphql/**tests**/errors.test.ts                             |
| TEST-04 | Add property-based tests for PIN verification - Completed (property-based tests added to pin.test.ts using fast-check) | Low    | @security  | P1-SEC-01    | ✅ Completed                                                                                                               |
| TEST-05 | Add retry logic tests for realtime                                                                                     | Low    | @frontend  | P1-SEC-04    | ✅ Completed - Tests exist in src/features/kds/hooks/**tests**/unit/useKDSRealtime.test.ts (calculateReconnectDelay tests) |
| TEST-06 | Add KDS realtime hook tests                                                                                            | Medium | @frontend  | P3-OPT-02    | ✅ Completed - Comprehensive tests in src/features/kds/hooks/**tests**/unit/useKDSRealtime.test.ts                         |
| TEST-07 | Increase test coverage to 85%                                                                                          | High   | @backend   | All          | Pending                                                                                                                    |
| TEST-08 | Add conflict resolution scenario tests                                                                                 | High   | @fullstack | P2-ARCH-05   | ✅ Completed - Tests exist in src/lib/sync/**tests**/conflict-resolution.test.ts                                           |

---

## Security Invoker Fixes

| Task ID    | Description                                                  | Effort | Owner     | Dependencies          | Status                                                                                    |
| ---------- | ------------------------------------------------------------ | ------ | --------- | --------------------- | ----------------------------------------------------------------------------------------- |
| SEC-INV-01 | Apply security_invoker to active_menu_items view             | Low    | @backend  | None                  | ✅ Completed - Migration 20260408150000                                                   |
| SEC-INV-02 | Apply security_invoker to active_restaurants view            | Low    | @backend  | None                  | ✅ Completed - Migration 20260408150000                                                   |
| SEC-INV-03 | Apply security_invoker to active_tables view                 | Low    | @backend  | None                  | ✅ Completed - Migration 20260408150000                                                   |
| SEC-INV-04 | Apply security_invoker to active_restaurant_staff view       | Low    | @backend  | None                  | ✅ Completed - Migration 20260408150000                                                   |
| SEC-INV-05 | Apply security_invoker to delivery_partner_integrations view | Low    | @backend  | None                  | ✅ Completed - Migration 20260408150000                                                   |
| SEC-INV-06 | Verify no data leakage after invoker changes                 | Low    | @security | SEC-INV-01-SEC-INV-05 | ✅ Completed - Test created at src/lib/supabase/**tests**/sec-inv-06-data-leakage.test.ts |

---

## Error Handling Standardization

| Task ID    | Description                                   | Effort | Owner    | Dependencies | Status                                                                                 |
| ---------- | --------------------------------------------- | ------ | -------- | ------------ | -------------------------------------------------------------------------------------- |
| ERR-STD-01 | Document error handling pattern               | Low    | @backend | None         | ✅ Completed - Added TenantIsolationError, type guards                                 |
| ERR-STD-02 | Convert all resolvers to GraphQL error format | Medium | @backend | None         | ✅ Completed - Added toGraphQLError bridge function                                    |
| ERR-STD-03 | Convert all services to throw exceptions      | Medium | @backend | None         | ✅ Completed - Added AppError class hierarchy                                          |
| ERR-STD-04 | Create migration guide                        | Low    | @backend | ERR-STD-01   | ✅ Completed - docs/reference/error-handling-migration-guide.md exists                 |
| ERR-STD-05 | Update GraphQL response types                 | Medium | @backend | ERR-STD-02   | ✅ Completed - Updated ErrorResult interface to include internalMessage and statusCode |

---

## Dependency Injection Setup

| Task ID | Description                             | Effort | Owner    | Dependencies | Status                                                                                          |
| ------- | --------------------------------------- | ------ | -------- | ------------ | ----------------------------------------------------------------------------------------------- |
| DI-01   | Create container configuration          | Medium | @backend | DOM-IF-01    | ✅ Completed                                                                                    |
| DI-02   | Define repository factory functions     | Medium | @backend | DOM-IF-01    | ✅ Completed - Added createStaffRepository, createPaymentsRepository, createRepositoryContainer |
| DI-03   | Create service factory functions        | Medium | @backend | DOM-IF-02    | ✅ Completed                                                                                    |
| DI-04   | Integrate DI with application bootstrap | Low    | @backend | DI-01-DI-03  | ✅ Completed                                                                                    |
| DI-05   | Update GraphQL resolvers to use DI      | Medium | @backend | DI-04        | ✅ Completed                                                                                    |
| DI-06   | Add unit test mocks using DI            | Low    | @backend | DI-05        | ✅ Completed                                                                                    |

---

## Anti-Pattern Fixes

| Task ID | Description                                                                                                                                                                                 | Effort | Owner    | Dependencies | Status                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------------ | --------------------------------------------------------------------------------- |
| ANTI-01 | Split StaffService God Object - Completed (we extracted PinService, RoleService, PermissionService, StaffCrudService)                                                                       | High   | @backend | P2-ARCH-01   | Completed                                                                         |
| ANTI-02 | Remove magic strings/numbers - Completed (added SESSION_TIMEOUT_SECONDS, MAX_SESSION_LIFETIME_MS, STALE_DEVICE_THRESHOLD_MS, PAIRED_CODE_EXPIRY_MS, DEFAULT_TARGET_COMPLETION_MS constants) | Low    | @backend | None         | Completed                                                                         |
| ANTI-03 | Standardize error handling (duplicate)                                                                                                                                                      | Medium | @backend | P2-ARCH-03   | ✅ Completed - AppError implemented across waitlist service and payments webhooks |

---

## Security Review: Payment Webhook Implementation (P1-SEC-03)

**Review Date:** 2026-05-20  
**Files Reviewed:** `src/lib/payments/webhooks.ts`, `src/lib/payments/telebirr.ts`, `src/app/api/v1/system/webhooks/chapa/route.ts`, `src/app/api/v1/system/webhooks/telebirr/route.ts`, `src/app/api/v1/system/jobs/payments/complete/route.ts`, `src/lib/payments/payment-event-consumer.ts`, `src/lib/events/runtime.ts`

### Finding Summary

| Category                           | Status     | Notes                                                                                                 |
| ---------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| **Webhook Signature Verification** | ✅ PASS    | Chapa uses HMAC-SHA256 with timing-safe comparison; Telebirr uses signature verification with app key |
| **Idempotency Key Handling**       | ⚠️ PARTIAL | Idempotency key is generated/preserved but not validated at job handler level                         |
| **Job Handler Path Validation**    | ✅ PASS    | Path is hardcoded constant; job authorization via `x-lole-job-key` header with QStash token           |
| **Sensitive Data Exposure**        | ⚠️ PARTIAL | Raw payload stored in `raw_payload` field; signature partially logged                                 |

### Detailed Findings

#### 1. Chapa Webhook Signature Verification ✅

- **Location:** `src/lib/payments/webhooks.ts:126-145`
- **Strengths:**
    - Uses `timingSafeEqual` for constant-time comparison (lines 110-123)
    - Supports both hex and base64 signature formats
    - Fails securely when `CHAPA_WEBHOOK_SECRET` is not configured (line 134-142)
    - Development test secret support with environment check (lines 137-140)
    - Requires explicit secret in production (no default fallback)

#### 2. Telebirr Webhook Signature Verification ✅

- **Location:** `src/lib/payments/telebirr.ts:128-159`
- **Strengths:**
    - Signature verification uses HMAC-SHA256
    - Validates app key presence (lines 133-141)
    - Secure failure handling returns false for missing key
    - Uses `timingSafeEqual` for constant-time comparison (line 134)

#### 3. Idempotency Key Handling ⚠️

- **Location:** `src/lib/payments/webhooks.ts:379-383` and `src/lib/events/runtime.ts:238-266`
- **Flow:** Idempotency key generated/shared from metadata, used as QStash deduplication ID
- **Concerns:**
    - Idempotency key stored in `metadata.idempotency_key` but no validation at job handler (line 379-383)
    - Job handler schema (lines 6-25 in `complete/route.ts`) validates `idempotency_key` format but doesn't check for duplicate processing
    - No database-level deduplication constraint

#### 4. Job Handler Path Validation ✅

- **Location:** `src/lib/payments/webhooks.ts:394` and `src/app/api/v1/system/jobs/payments/complete/route.ts:27-34`
- **Strengths:**
    - Path `/api/v1/system/jobs/payments/complete` is hardcoded constant
    - Authorization via `x-lole-job-key` header matching `QSTASH_TOKEN` (lines 28-33)
    - Zod schema validation for all payload fields (lines 6-25)
    - Proper 401 response for unauthorized access

#### 5. Sensitive Data Exposure ⚠️

- **Location:** `src/lib/payments/webhooks.ts:388` and `src/app/api/v1/system/webhooks/telebirr/route.ts:31-33`
- **Concerns:**
    - `raw_payload` field stores complete webhook payload (line 183, 388)
    - Signature partially logged in warning: `signature: signature.substring(0, 10) + '...'` (line 32)
    - Full payload data preserved in event metadata (line 205-106)

### Recommendations

1. ~~Timing-safe comparison for Telebirr signatures~~ - **COMPLETED** (timingSafeEqual already implemented)
2. **Idempotency validation:** Add database-level check in `processPaymentLifecycleEvent` using idempotency key
3. **Payload redaction:** Consider redacting sensitive fields from `raw_payload` before storage
4. **Logging:** Remove signature from all log statements
5. **Audit logging:** Add audit log entry for webhook receipt and processing

### Conclusion

The payment webhook implementation demonstrates **strong security posture** with proper signature verification, job authorization, and audit trails. Two **medium-severity** improvements recommended:

1. ~~Timing-safe comparison for Telebirr signatures~~ - **ALREADY IMPLEMENTED**
2. Idempotency validation at job handler level

---

## Tracking Summary Table

| Priority | Category             | Tasks | Effort Distribution              | Status                                   |
| -------- | -------------------- | ----- | -------------------------------- | ---------------------------------------- |
| P0       | Security Critical    | 2     | 1 High, 1 Low                    | 1/2 Complete (1 Blocked)                 |
| P1       | Security High        | 8     | 3 Low, 2 Medium, 2 High, 1 Low   | 7/8 Complete                             |
| P2       | Architecture Medium  | 11    | 5 Low, 4 Medium, 2 High          | 8/11 Complete                            |
| P3       | Optimization Low     | 4     | 3 Low, 1 Medium                  | 0/4 Complete                             |
| SOLID    | Principle Violations | 3     | 2 Medium, 1 Low                  | 2/3 Complete                             |
| Domain   | Interface Creation   | 8     | All Medium                       | 3/8 Complete                             |
| Staff    | Service Refactoring  | 6     | 5 Medium, 1 Low                  | 6/6 Complete                             |
| API      | Route Refactoring    | 5     | 2 Low, 2 Medium, 1 Low           | 5/5 Complete                             |
| Test     | Testing Updates      | 8     | 4 Low, 3 Medium, 1 High          | 5/8 Complete                             |
| Security | Invoker Fixes        | 6     | All Low                          | 6/6 Complete                             |
| Error    | Handling             | 5     | 1 Low, 3 Medium, 1 Low           | 5/5 Complete                             |
| DI       | Setup                | 6     | 5 Medium, 1 Low                  | 6/6 Complete                             |
| App      | Layer & Exports      | 2     | 1 High, 1 Low                    | 2/2 Complete                             |
| Anti     | Patterns             | 3     | 1 High, 1 Low, 1 Medium          | 3/3 Complete                             |
| ARCH     | Higher-Value Tasks   | 6     | 1 P1-High, 4 P2-Medium, 1 P3-Low | 3/6 Complete (ARCH-12, ARCH-13, ARCH-14) |

**Total Tasks:** 81  
**Completed:** 57 (Updated: ARCH-12, ARCH-13, ARCH-14 complete; Zod-to-OpenAPI tooling exists via scripts/tools/generate-openapi.ts and openapi:generate script)  
**Pending:** 24 (1 Blocked)  
**Estimated Total Effort:** 25-35 weeks (assuming parallel execution)

---

## Next Review: 2026-06-30
