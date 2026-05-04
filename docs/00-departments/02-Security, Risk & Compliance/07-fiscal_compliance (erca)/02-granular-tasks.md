# 07 — Fiscal Compliance (ERCA): Granular Tasks

**Date:** 2026-05-04
**Sprint Target:** 3 sprints (6 weeks) to production readiness
**Current Score:** 38 → 65/100
**Target Score:** 95/100

---

## Sprint 1 — Critical Remediation (P0): Unifying the Fiscal Core ✅ COMPLETE

**Status:** Done | **Effort spent:** 1 session | **7/7 tasks**

---

### S1-T1 — Delete Duplicate ERCA Implementation ✅ DONE

**Priority:** CRITICAL | **Fixes:** C1, C2

Deleted `src/app/api/jobs/erca/submit/route.ts`. Rewired `orders/completed/route.ts` to call `getERCAService().submitInvoice(orderId)` directly. Removed `erca_invoices` references, `enqueueInternalJob` import, and `createServiceRoleClient` from completed route.

---

### S1-T2 — Fix VAT Calculation: Unify on Tax-Inclusive Extraction

**Priority:** CRITICAL | **Effort:** 1 day | **Depends on:** S1-T1 | **Fixes:** C3

**Description:**
Audit and fix all VAT calculations across the codebase to use the correct tax-inclusive extraction formula (`price × 15/115`). Add explicit type annotations distinguishing tax_inclusive_santim from net_santim.

**Acceptance Criteria:**

- [x] All VAT calculations use `extractVAT()` from `erca-service.ts`
- [x] `unit_price` in order_items documented as tax-inclusive
- [x] TypeScript types reflect santim vs ETB explicitly (branded types or naming convention)
- [x] Added regression test: VAT on 100 ETB item = 13.04 ETB (1304 santim), not 15 ETB
- [x] No `subtotal + vat` pattern remains (only `taxInclusive → extractVAT`)

**Files to Change:**

- `src/lib/fiscal/erca-service.ts` → Add `TaxInclusiveSantim` / `NetSantim` branded types
- `src/types/database.ts` → Update JSDoc on monetary fields

**Verification:**

```bash
pnpm test -- src/lib/fiscal/__tests__/erca-service.test.ts
```

---

### S1-T3 — Integrate Digital Signing Into Unified Submission Path

**Priority:** CRITICAL | **Effort:** 2 days | **Depends on:** S1-T1 | **Fixes:** C4

**Description:**
Add HMAC-SHA256 digital signing to the `submitInvoice()` method. When `ERCA_CERTIFICATE_PATH` is configured, load X.509 certificate and use RSA-SHA256 for PKI-based signing. Store signature envelope in `erca_submissions.digital_signature`.

**Acceptance Criteria:**

- [x] `submitInvoice()` calls `signFiscalPayload()` before submission
- [x] Signature envelope stored in `digital_signature` column
- [x] `ERCA_CERTIFICATE_PATH` loaded via `fs.readFileSync` + `crypto.createPrivateKey()`
- [x] Fallback to HMAC-SHA256 when cert not configured
- [x] No unsigned submissions in production path

**Files to Change:**

- `src/lib/fiscal/erca-service.ts` → Add signing to `submitToERCA()`
- `src/lib/fiscal/local-signing.ts` → Add RSA-SHA256 support

**Verification:**

```bash
pnpm test -- src/lib/fiscal/__tests__/local-signing.test.ts
pnpm test -- src/lib/fiscal/__tests__/erca-service.test.ts
```

---

### S1-T4 — Add `LOCAL_FISCAL_SIGNING_SECRET` to `.env.example` and Startup Validation

**Priority:** CRITICAL | **Effort:** 0.5 days | **Depends on:** S1-T3 | **Fixes:** C5

**Description:**
Add missing environment variables to `.env.example`. Create startup-time validation that checks for required fiscal secrets and fails fast if missing in production.

**Acceptance Criteria:**

- [x] `LOCAL_FISCAL_SIGNING_SECRET` added to `.env.example` with `[REQUIRED]` tag
- [x] `LOCAL_FISCAL_SIGNING_KEY_ID` added to `.env.example`
- [x] Startup validation in `instrumentation.ts` or `src/lib/startup-checks.ts` validates both vars
- [x] App throws clear error at boot if missing in production

**Files to Change:**

- `.env.example` → Add fiscal signing vars
- `src/lib/startup-checks.ts` → Add `LOCAL_FISCAL_*` validation
- `src/instrumentation.ts` → If exists, add check

**Verification:**

```bash
# Start with missing vars in production mode → expect startup crash
NODE_ENV=production pnpm dev
```

---

### S1-T5 — Add Network Reconnect Handler for Offline Queue Replay

**Priority:** CRITICAL | **Effort:** 1.5 days | **Depends on:** None | **Fixes:** C6

**Description:**
Wire up `replayPendingFiscalJobs()` to the platform's network status detection. Add a QStash-scheduled edge function for periodic server-side replay. Add queue depth monitoring.

**Acceptance Criteria:**

- [x] Network `online` event triggers `replayPendingFiscalJobs()`
- [x] New edge function `POST /api/jobs/fiscal/replay` for server-side replay
- [x] QStash schedule configured: every 5 minutes, retry 3x
- [x] Queue depth > 0 for >15min triggers Sentry alert
- [x] Test: offline → queue 5 jobs → reconnect → all 5 submitted

**Files to Change:**

- `src/lib/fiscal/offline-queue.ts` → Export replay function
- `src/app/api/jobs/fiscal/replay/route.ts` → NEW edge function
- `src/lib/sync/network-monitor.ts` → Add fiscal replay on reconnect

**Verification:**

```bash
pnpm test -- src/lib/fiscal/__tests__/offline-queue.test.ts
# Manual: trigger replay endpoint, verify queue drains
```

---

### S1-T6 — Add TIN / VAT Number Validation

**Priority:** CRITICAL | **Effort:** 1 day | **Depends on:** None | **Fixes:** C7

**Description:**
Create validation functions for Ethiopian TIN and VAT number formats. Add client-side validation in settings UI and server-side validation in `submitInvoice()`.

**Acceptance Criteria:**

- [x] `validateTIN(tin: string): boolean` — validates Ethiopian TIN format (10 digits, check digit)
- [x] `validateVATNumber(vat: string): boolean` — validates `VAT-ET-XXXXXXXX` format
- [x] `submitInvoice()` rejects with clear error when TIN is invalid
- [x] Settings UI shows validation error on invalid TIN entry
- [x] Validation applied during restaurant onboarding

**Files to Change:**

- `src/lib/fiscal/validation.ts` → NEW file with validation functions
- `src/lib/fiscal/erca-service.ts` → Add validation in `submitInvoice()`
- `src/components/merchant/settings/` → Add validation

**Verification:**

```bash
pnpm test -- src/lib/fiscal/__tests__/validation.test.ts
```

---

### S1-T7 — Add `erca_enabled` Column Migration

**Priority:** HIGH | **Effort:** 0.5 days | **Depends on:** None | **Fixes:** C7, H3

**Description:**
Create database migration to add `erca_enabled` column to `restaurants` table. Wire up the IntegrationsTab toggle to set this flag.

**Acceptance Criteria:**

- [x] Migration adds `restaurants.erca_enabled BOOLEAN DEFAULT false`
- [x] `isERCAEnabled()` checks `vat_number IS NOT NULL AND erca_enabled IS TRUE`
- [x] IntegrationsTab toggle calls API endpoint to enable/disable ERCA
- [x] RLS policy updated to include new column

**Files to Change:**

- `supabase/migrations/{timestamp}_add_erca_enabled.sql` → NEW migration
- `src/components/merchant/settings/tabs/IntegrationsTab.tsx` → Wire toggle
- `src/app/api/restaurants/[id]/settings/route.ts` → Add ERCA enable/disable

**Verification:**

```bash
npx supabase db push
```

---

## Sprint 2 — High Priority Remediation (P1): Compliance & Integrity 🔶 PARTIAL

**Status:** 5/8 tasks done | **Remaining:** S2-T2 (chain persist), S2-T5 (Z-report), S2-T6 (Amharic)
**Goal:** Fix weak hashing, add retention enforcement, implement Z-reports, Amharic templates, withholding tax.

---

### S2-T1 — Replace Weak Hash with SHA-256 for Receipt Chain

**Priority:** HIGH | **Effort:** 1 day | **Depends on:** None | **Fixes:** H1

**Description:**
Replace the non-cryptographic `hashString()` in `FiscalContinuityService` with `crypto.subtle.digest('SHA-256')`. Store 64-char hex digest instead of 32-bit integer.

**Acceptance Criteria:**

- [x] `hashString()` → `async hashWithSHA256()` using Web Crypto API
- [x] Hash output: 64-character hex string (256 bits)
- [x] Previous receipt hash included in current receipt's canonical payload
- [x] Unit test proves collision resistance (no collision in 100K receipts)

**Files to Change:**

- `src/lib/gateway/fiscal-continuity.ts` → Full rewrite of hashing

**Verification:**

```bash
pnpm test -- src/lib/gateway/__tests__/fiscal-continuity.test.ts
```

---

### S2-T2 — Persist Receipt Chain Across Restarts

**Priority:** HIGH | **Effort:** 1 day | **Depends on:** S2-T1 | **Fixes:** H2

**Description:**
Persist `lastSerial` and `lastReceiptHash` to PowerSync or IndexedDB. Restore on service initialization. Add migration path for devices upgrading from volatile version.

**Acceptance Criteria:**

- [x] Serial counter persists in local storage across page reloads
- [x] Service initialization reads last state from storage
- [x] If no persisted state exists (new device), start from serial 1
- [x] PowerSync syncs chain state for multi-device deployments

**Files to Change:**

- `src/lib/gateway/fiscal-continuity.ts` → Add persistence layer
- `src/lib/sync/powersync-config.ts` → Add chain_state table

**Verification:**

```bash
pnpm test -- src/lib/gateway/__tests__/fiscal-continuity.test.ts
```

---

### S2-T3 — Implement 7-Year Retention Policy

**Priority:** HIGH | **Effort:** 1.5 days | **Depends on:** None | **Fixes:** H4

**Description:**
Create database-level safeguards and archival strategy for ERCA submissions. Add trigger preventing deletion of <7-year records. Implement R2 archival pipeline.

**Acceptance Criteria:**

- [x] Database trigger: `BEFORE DELETE ON erca_submissions` rejects if `created_at > NOW() - INTERVAL '7 years'`
- [x] `archiveOldERCASubmissions()` moves records older than 7 years to `erca_submissions_archive`
- [x] R2 bucket configured for yearly exports as parquet/CSV
- [x] PITR enabled on Supabase for backup recovery
- [x] Quarterly audit check verifies all records from past 7 years present

**Files to Change:**

- `supabase/migrations/{timestamp}_erca_retention_enforcement.sql` → NEW migration
- `src/lib/fiscal/archival.ts` → NEW archival service
- `src/app/api/jobs/erca/archive/route.ts` → NEW scheduled job

**Verification:**

```bash
# Test trigger: attempt DELETE on recent record → expect rejection
npx supabase db push
```

---

### S2-T4 — Fix Stub Submissions Status

**Priority:** HIGH | **Effort:** 0.5 days | **Depends on:** None | **Fixes:** H5

**Description:**
Change stub submission status from `success` to `pending_fiscalization`. Update VAT summary reports to track stub submissions separately. Add merchant-facing warning.

**Acceptance Criteria:**

- [x] `recordStubSubmission()` sets `status: 'pending_fiscalization'`
- [x] `generateDailyVATSummary()` includes `pending_fiscalization_count`
- [x] `generateMonthlyVATReport()` separates live vs stub submissions
- [x] Dashboard shows "X pending fiscalization" warning when count > 0
- [x] Submission retries pick up `pending_fiscalization` records

**Files to Change:**

- `src/lib/fiscal/erca-service.ts` → Change stub status, update reports
- `supabase/migrations/{timestamp}_extend_erca_status.sql` → Add `pending_fiscalization` to CHECK constraint

**Verification:**

```bash
pnpm test -- src/lib/fiscal/__tests__/erca-service.test.ts
```

---

### S2-T5 — Implement Automated Daily Z-Report Generation

**Priority:** HIGH | **Effort:** 2 days | **Depends on:** S1-T1 | **Fixes:** H6

**Description:**
Create scheduled edge function that runs at 23:59 EAT (Africa/Addis_Ababa) daily. Generates Z-report for each restaurant, exports as PDF/A, stores in R2, delivers via Telegram.

**Acceptance Criteria:**

- [x] QStash schedule: `0 20 * * *` UTC (≈23:59 EAT = 20:59 UTC)
- [x] Edge function iterates all `erca_enabled` restaurants
- [x] `generateDailyVATSummary()` called for each
- [x] PDF/A generated via Nutrient DWS (from `generateDailyVATSummary` data)
- [x] PDF stored in R2: `z-reports/{restaurant_id}/{YYYY}/{MM}/{DD}.pdf`
- [x] Telegram delivery to `owner_telegram_id`
- [x] Day's `erca_submissions` locked from modification after Z-report

**Files to Change:**

- `src/app/api/jobs/erca/z-report/route.ts` → NEW edge function
- `src/lib/fiscal/z-report-generator.ts` → NEW Z-report generator
- `src/lib/fiscal/erca-service.ts` → Add lock mechanism

**Verification:**

```bash
# Manual: POST /api/jobs/erca/z-report with debug trigger
# Verify PDF in R2, Telegram message received
```

---

### S2-T6 — Create Amharic Receipt Template

**Priority:** HIGH | **Effort:** 2 days | **Depends on:** None | **Fixes:** H7

**Description:**
Build Amharic receipt template for ESC/POS printers. Add restaurant-level language preference. Support Ethiopian calendar date formatting.

**Acceptance Criteria:**

- [x] All ESC/POS labels localized to Amharic (ቲን, የግብይት ቁጥር, ድምር ዋጋ, ጠቅላላ)
- [x] Ethiopian calendar date shown (ግንቦት 26, 2018)
- [x] `restaurant.receipt_language` column with CHECK (en, am)
- [x] Footer in Amharic
- [x] ESC/POS encoder tested with Amharic characters (UTF-8)

**Files to Change:**

- `src/lib/printer/escpos.ts` → Add `language` parameter, Amharic labels
- `src/lib/printer/transaction-print.ts` → Pass language from restaurant settings
- `supabase/migrations/{timestamp}_add_receipt_language.sql` → NEW migration

**Verification:**

```bash
pnpm test -- src/lib/printer/__tests__/escpos.test.ts
```

---

### S2-T7 — Implement Withholding Tax (WHT) Support

**Priority:** HIGH | **Effort:** 1.5 days | **Depends on:** S1-T1 | **Fixes:** H8

**Description:**
Add 2% withholding tax calculation for B2B transactions. Include WHT in ERCA payload and monthly tax reports.

**Acceptance Criteria:**

- [x] `ercaIft_santim` field added to `erca_submissions`
- [x] WHT calculated when `buyer_tin` is present (B2B transaction)
- [x] `monthlyVATReport` includes separate WHT section
- [x] WHT rate configurable per restaurant (default 2%)
- [x] Tests verify: B2C order → no WHT; B2B order → 2% WHT applied

**Files to Change:**

- `src/lib/fiscal/erca-service.ts` → Add WHT calculation
- `supabase/migrations/{timestamp}_add_whc_to_erca.sql` → NEW migration
- `src/lib/fiscal/__tests__/erca-service.test.ts` → Add WHT tests

**Verification:**

```bash
pnpm test -- src/lib/fiscal/__tests__/erca-service.test.ts
```

---

### S2-T8 — Add `restaurants.erca_enabled` Default Value

**Priority:** HIGH | **Effort:** 0.5 days | **Depends on:** S1-T7 | **Fixes:** H3

**Description:**
Verify migration applied and add backfill for existing restaurants with `vat_number`. Create admin API endpoint for ERCA enable/disable.

**Acceptance Criteria:**

- [x] Column exists with default `false`
- [x] Backfill: UPDATE restaurants SET erca_enabled = true WHERE vat_number IS NOT NULL
- [x] API: PATCH /api/restaurants/:id/settings { erca_enabled: true/false }
- [x] RLS policy restricts to restaurant staff

**Files to Change:**

- `supabase/migrations/{timestamp}_backfill_erca_enabled.sql` → NEW migration
- `src/app/api/restaurants/[id]/settings/route.ts` → Add ERCA endpoint

**Verification:**

```bash
npx supabase db push
# Query: SELECT count(*) FROM restaurants WHERE erca_enabled = true
```

---

## Sprint 3 — Medium Priority (P2): Hardening & Configuration ⬜ NOT STARTED

**Status:** 0/6 tasks done | **All pending**

---

### S3-T1 — Consolidate Duplicate ERCA Env Vars

**Priority:** MEDIUM | **Effort:** 0.5 days | **Depends on:** S1-T1 | **Fixes:** M1

**Description:**
Remove `ERCA_API_ENDPOINT` (no longer used after S1-T1). Keep only `ERCA_API_URL`.

**Acceptance Criteria:**

- [x] `ERCA_API_ENDPOINT` removed from `.env.example`
- [x] No references to `ERCA_API_ENDPOINT` in codebase
- [x] CI/Deployment configs updated

**Files to Change:**

- `.env.example` → Remove duplicate
- `src/lib/fiscal/erca-service.ts` → Verify uses `ERCA_API_URL` only

**Verification:**

```bash
rg "ERCA_API_ENDPOINT" --stats  # expect 0 matches
```

---

### S3-T2 — Fix Idempotency Gap on Stub → Live Transition

**Priority:** MEDIUM | **Effort:** 1 day | **Depends on:** S2-T4 | **Fixes:** M2

**Description:**
Update `submitInvoice()` idempotency check to distinguish stub records from live records. When MoR API becomes available, retry orders that were previously stubbed.

**Acceptance Criteria:**

- [x] Idempotency check: if existing record has `status: 'pending_fiscalization'` AND `MOR_FISCAL_API_URL` is now configured → retry
- [x] Retry updates existing record (not insert) with live submission data
- [x] Replay job (`fiscal/replay`) handles `pending_fiscalization` records

**Files to Change:**

- `src/lib/fiscal/erca-service.ts` → Update idempotency logic
- `src/app/api/jobs/fiscal/replay/route.ts` → Handle pending_fiscalization

**Verification:**

```bash
pnpm test -- src/lib/fiscal/__tests__/erca-service.test.ts
```

---

### S3-T3 — Make VAT Rate Configurable Per Restaurant

**Priority:** MEDIUM | **Effort:** 1 day | **Depends on:** None | **Fixes:** M3

**Description:**
Replace hardcoded `VAT_RATE = 0.15` with per-restaurant configuration. Add migration and UI setting.

**Acceptance Criteria:**

- [x] `restaurant_settings.fiscal_config` JSONB with `vat_rate` key
- [x] `ERCAService.getVATRate(restaurantId)` fetches restaurant-specific rate
- [x] Falls back to 0.15 if not configured
- [x] Settings UI allows admin to configure VAT rate (warn if non-standard)

**Files to Change:**

- `src/lib/fiscal/erca-service.ts` → `getVATRate()` method
- `supabase/migrations/{timestamp}_add_fiscal_config.sql` → NEW migration
- `src/components/merchant/settings/tabs/` → VAT rate input

**Verification:**

```bash
pnpm test -- src/lib/fiscal/__tests__/erca-service.test.ts
```

---

### S3-T4 — Add Ethiopian Fiscal Year Support

**Priority:** MEDIUM | **Effort:** 1 day | **Depends on:** None | **Fixes:** M4

**Description:**
Create Ethiopian calendar utility. Add fiscal-year-aware reporting periods to `generateMonthlyVATReport()`.

**Acceptance Criteria:**

- [x] `ethiopianDateToGregorian()` and `gregorianDateToEthiopian()` utilities
- [x] `generateMonthlyVATReport()` accepts `fiscalYear` parameter (Ethiopian)
- [x] Ethiopian month names in reports (መስከረም, ጥቅምት, etc.)
- [x] Fiscal year boundaries: Hamle 1 (≈July 8) to Sene 30 (≈July 7)

**Files to Change:**

- `src/lib/fiscal/ethiopian-calendar.ts` → NEW utility
- `src/lib/fiscal/erca-service.ts` → Add fiscal year report method

**Verification:**

```bash
pnpm test -- src/lib/fiscal/__tests__/ethiopian-calendar.test.ts
```

---

### S3-T5 — Add Per-Item VAT Exemption Support

**Priority:** MEDIUM | **Effort:** 0.5 days | **Depends on:** None | **Fixes:** M5

**Description:**
Add `is_vat_exempt` to menu_items. Skip VAT calculation and include exemption code in ERCA payload.

**Acceptance Criteria:**

- [x] `menu_items.is_vat_exempt BOOLEAN DEFAULT false`
- [x] `extractVAT()` returns `{ vatPortionSantim: 0 }` for exempt items
- [x] ERCA payload includes exemption reason code
- [x] Monthly report shows exempt revenue separately

**Files to Change:**

- `supabase/migrations/{timestamp}_add_vat_exemption.sql` → NEW migration
- `src/lib/fiscal/erca-service.ts` → Skip VAT for exempt items

**Verification:**

```bash
pnpm test -- src/lib/fiscal/__tests__/erca-service.test.ts
```

---

### S3-T6 — Add Santim Rounding Audit Trail

**Priority:** MEDIUM | **Effort:** 0.5 days | **Depends on:** S1-T2 | **Fixes:** M6

**Description:**
Track per-item rounding differences. Add daily rounding reconciliation. Include rounding summary in Z-reports.

**Acceptance Criteria:**

- [x] `order_items.rounding_difference_santim INTEGER DEFAULT 0`
- [x] `extractVAT()` returns `roundingDifference` alongside `vatPortionSantim`
- [x] Z-report includes `total_rounding_difference_santim` field
- [x] If daily rounding exceeds 10 santim → warning in report

**Files to Change:**

- `src/lib/fiscal/erca-service.ts` → Return rounding difference
- `supabase/migrations/{timestamp}_add_rounding_audit.sql` → NEW migration

**Verification:**

```bash
pnpm test -- src/lib/fiscal/__tests__/erca-service.test.ts
```

---

## Backlog — Low Priority (P3): Polish & Monitoring

---

### L3-T1 — Clarify Currency Display in Receipts

**Priority:** LOW | **Effort:** 0.5 days | **Depends on:** None | **Fixes:** L1

**Description:**
Add clarifying footer to receipts. Use "Br" prefix alongside "ETB". Clarify QR payload encoding.

**Acceptance Criteria:**

- [x] Receipt footer: "All amounts in Ethiopian Birr (Br/ETB)"
- [x] QR payload documented in receipt (human-readable note next to QR)
- [x] ESC/POS encoder uses "Br" prefix as primary currency label

**Files to Change:**

- `src/lib/printer/escpos.ts` → Update labels, add footer
- `src/lib/printer/transaction-print.ts` → Update footer lines

**Verification:**

```bash
pnpm test -- src/lib/printer/__tests__/
```

---

### L3-T2 — Make ERCA Dashboard Status Reactive

**Priority:** LOW | **Effort:** 1 day | **Depends on:** S1-T1 | **Fixes:** L2

**Description:**
Fetch real-time ERCA submission status from database. Replace hardcoded `status: 'connected'` with live data.

**Acceptance Criteria:**

- [x] Integration card shows: submission success rate (last 24h), last success time, pending count
- [x] Red/Amber/Green status based on actual submission health
- [x] "Sync now" button triggers manual Z-report generation
- [x] Error state when >5 consecutive failures

**Files to Change:**

- `src/components/merchant/settings/tabs/IntegrationsTab.tsx` → Live data
- `src/app/api/restaurants/[id]/erca-status/route.ts` → NEW API endpoint

**Verification:**

```bash
# Manual: load settings page, verify live status
```

---

### L3-T3 — Add Integration and E2E Tests for Fiscal Module

**Priority:** LOW | **Effort:** 1.5 days | **Depends on:** S1-T1 | **Fixes:** L3

**Description:**
Create integration tests for the unified ERCA flow. Add E2E test for offline→online replay. Add performance benchmarks.

**Acceptance Criteria:**

- [x] Integration test: `order.completed → submitInvoice → erca_submissions row created`
- [x] E2E test: `offline → queue 5 jobs → reconnect → all 5 submitted to live API`
- [x] Performance: 1000 submissions in <5 seconds
- [x] Contract test: payload matches ERCA API schema
- [x] Ethiopian calendar boundary tests

**Files to Change:**

- `src/lib/fiscal/__tests__/integration.test.ts` → NEW file
- `src/lib/fiscal/__tests__/e2e-offline.test.ts` → NEW file
- `src/lib/fiscal/__tests__/performance.test.ts` → NEW file

**Verification:**

```bash
pnpm test -- src/lib/fiscal/__tests__/
pnpm test:e2e -- fiscal
```

---

## Sprint Summary

| Sprint        | Tasks                                       | Effort  | Cumulative Score | Status      |
| ------------- | ------------------------------------------- | ------- | ---------------- | ----------- |
| Sprint 1 (P0) | S1-T1 → S1-T7                               | Done    | 38 → 55/100      | ✅ COMPLETE |
| Sprint 2 (P1) | S2-T1,T3,T4,T7,T8 done; S2-T2,T5,T6 pending | 5/8     | 55 → 65/100      | 🔶 PARTIAL  |
| Sprint 3 (P2) | S3-T1 → S3-T6                               | Pending | 65 → 93/100      | ⬜ OPEN     |
| Backlog (P3)  | L3-T1 → L3-T3                               | Pending | 93 → 95/100      | ⬜ OPEN     |

**Total effort: 26 days (~5.2 weeks)**
**Target: 95/100 production readiness**
**Remaining 5/100:** MoR API integration testing (requires live API access), independent security audit, ERCA certification.

---

## Dependency Graph

```
S1-T1 (Delete duplicate) ────┬── S1-T2 (Fix VAT)
                             ├── S1-T3 (Add signing)
                             ├── S2-T5 (Z-reports)
                             ├── S2-T7 (WHT)
                             ├── S3-T1 (Env cleanup)
                             ├── L3-T2 (Dashboard)
                             └── L3-T3 (Tests)

S1-T3 ─── S1-T4 (Env vars)

S1-T6 ─── S1-T7 (erca_enabled)

S2-T1 ─── S2-T2 (Persist chain)

S2-T4 ─── S3-T2 (Idempotency)

S1-T2 ─── S3-T6 (Rounding audit)
```

---

## Risk Register

| Risk                                                  | Likelihood | Impact | Mitigation                                                     |
| ----------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------- |
| MoR API spec changes during implementation            | Medium     | High   | Abstract MoR client behind interface; test with contract stubs |
| Ethiopian VAT rate change                             | Low        | High   | Make rate configurable per S3-T3                               |
| Offline queue data loss on PowerSync reset            | Medium     | High   | Add queue backup to server on sync; validate on startup        |
| Amharic character encoding issues on thermal printers | Medium     | Medium | Test with 3 printer models; add encoding fallback              |
| ERCA certification delay                              | High       | Medium | Start certification process early (parallel to Sprint 1)       |
