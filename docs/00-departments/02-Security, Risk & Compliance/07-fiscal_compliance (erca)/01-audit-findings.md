# 07 — Fiscal Compliance (ERCA): Audit Findings

**Date:** 2026-05-04
**Auditor:** Autonomous Systems Architect (via Kilo)
**Scope:** Ethiopian MoR integration, Santim Integer patterns, digital signing
**Skills:** volt-agent/compliance/openaccountants-tax-logic, volt-agent/compliance/nutrient-document-processing, volt-agent/security/security-threat-model, superpowers/systematic-debugging

---

## Remediation Status Legend

| Mark    | Meaning           |
| ------- | ----------------- |
| ⬜ OPEN | Not yet addressed |

---

## CRITICAL Findings

### C1 — Duplicate ERCA Implementation: Two Parallel Systems, Different Outputs ⬜ OPEN

**File:** `src/lib/fiscal/erca-service.ts` vs `src/app/api/jobs/erca/submit/route.ts`
**STRIDE:** Tampering, Repudiation
**COL Department:** `fiscal-compliance` (lead: `FiscalAgent`, skills: `mor-sigtas-compliance`, `fiscal-signing-logic`)

Lole has **two completely independent ERCA implementations** with zero shared code:

| Aspect          | Path A: `erca-service.ts`              | Path B: `jobs/erca/submit/route.ts`             |
| --------------- | -------------------------------------- | ----------------------------------------------- |
| Trigger         | `transaction-print.ts` at POS          | `orders/completed` via QStash                   |
| Data store      | `erca_submissions` table               | `erca_invoices` table                           |
| Santim pattern  | ✅ All values in santim                | ❌ Floats/doubles                               |
| VAT calculation | ✅ Extract from tax-inclusive (15/115) | ❌ Adds 15% on top (see C3)                     |
| Digital signing | ✅ HMAC-SHA256 via `local-signing.ts`  | ❌ None                                         |
| Invoice number  | `{restaurant_prefix}-{order_number}`   | `INV-{vat_number}-{YYYYMMDD}-{order_number}`    |
| Idempotency     | Check `order_id` before submit         | On-conflict upsert on `restaurant_id, order_id` |
| Error handling  | Retry up to 5x, record failures        | Silently stores failed attempts                 |
| Test coverage   | ✅ 1067 lines                          | ❌ None                                         |

**Impact:** Two data stores for the same fiscal obligation. ERCA auditors would find inconsistencies between submitted invoices (`erca_invoices`) and receipt-level data (`erca_submissions`). This is a compliance violation.

**Recommendation:** Unify on `erca_submissions` table. Delete `jobs/erca/submit/route.ts`. Let the `ERCAService.submitInvoice()` method be the single source of truth. Trigger it from the order completion handler directly.

---

### C2 — Missing `erca_invoices` Table Migration ⬜ OPEN

**File:** `src/app/api/jobs/erca/submit/route.ts:229`
**STRIDE:** Denial of Service

The async ERCA job `storeERCAInvoice()` function writes to:

```typescript
await admin.from('erca_invoices').upsert(...)
```

No migration file creates the `erca_invoices` table. The schema expects columns: `restaurant_id`, `order_id`, `invoice_number`, `invoice_date`, `customer_tin`, `customer_name`, `subtotal`, `discount`, `vat_amount`, `grand_total`, `items`, `erca_reference`, `status`, `submitted_at`. None of these exist in any migration.

**Impact:** If this code path is triggered in production (and ERCA is enabled for a restaurant), the upsert will fail with a database error. The error is caught by `.catch(console.error)` so it silently fails — no invoice is stored and no alert is raised.

**Recommendation:** After unifying on `erca_submissions` (C1), this issue is resolved by deletion. If `erca_invoices` is kept, create a migration with RLS, indexes, and the full column set.

---

### C3 — VAT Calculation Bug in Async Job Path ⬜ OPEN

**File:** `src/app/api/jobs/erca/submit/route.ts:141-144`
**STRIDE:** Tampering

The async job path calculates VAT by **adding** it to the unit price:

```typescript
const subtotal = quantity * unitPrice;
const vatRate = 0.15;
const vatAmount = Math.round(subtotal * vatRate);
// ...
totalAmount: subtotal + vatAmount,
```

But `unitPrice` from `order_items.unit_price` is **already tax-inclusive** (it's the displayed price the customer sees). This means:

- The customer already paid the displayed price (which includes VAT)
- The async job extracts that displayed price, treats it as net, and adds 15% VAT on top
- **Result: VAT is double-counted**

Compare with the correct implementation in `erca-service.ts:151-157`:

```typescript
export function extractVAT(taxInclusivePriceSantim: number) {
    const vatPortionSantim = Math.round((taxInclusivePriceSantim * VAT_RATE) / (1 + VAT_RATE));
    const netPriceSantim = taxInclusivePriceSantim - vatPortionSantim;
    return { netPriceSantim, vatPortionSantim };
}
```

**Impact:** For a 100 ETB item (10000 santim tax-inclusive), the correct VAT is 1304 santim. The buggy path calculates 1500 santim — a 15% overstatement. Over a restaurant's monthly revenue of 500,000 ETB, this overstates VAT by ~9,800 ETB, creating a phantom tax liability.

**Recommendation:** Delete the duplicate implementation. Use `ERCAService.extractVAT()` as the single VAT calculation. Unit test with Ethiopian tax authority examples.

---

### C4 — No Digital Signing on Async Job Path ⬜ OPEN

**File:** `src/app/api/jobs/erca/submit/route.ts` (entire file)
**STRIDE:** Repudiation, Spoofing

Path A (POS receipt flow) signs fiscal payloads with HMAC-SHA256 using `local-signing.ts`:

- Canonicalizes payload to deterministic string
- Creates SHA-256 digest
- Signs with HMAC using `LOCAL_FISCAL_SIGNING_SECRET`

Path B (async job flow) has zero cryptographic signing:

- No HMAC signature
- No SHA-256 digest
- No certificate-based signing
- `ERCA_CERTIFICATE_PATH` is defined in `.env.example` but never consumed anywhere in the codebase

**Impact:** ERCA requires digitally signed invoices for non-repudiation. Unsigned invoices can be disputed, altered, or forged. This is a compliance blocker for VAT-registered restaurants.

**Recommendation:** Use `signFiscalPayload()` from `local-signing.ts` in the unified submission path. Add X.509 certificate loading when `ERCA_CERTIFICATE_PATH` is configured. Store the signature envelope in the `erca_submissions.digital_signature` field.

---

### C5 — Missing `LOCAL_FISCAL_SIGNING_SECRET` from `.env.example` ⬜ OPEN

**File:** `.env.example` (entire file) vs `src/lib/fiscal/local-signing.ts:129`
**STRIDE:** Denial of Service

Two critical environment variables are referenced in code but absent from `.env.example`:

- `LOCAL_FISCAL_SIGNING_SECRET` — used by `getLocalFiscalSigningConfig()` in `local-signing.ts:129`
- `LOCAL_FISCAL_SIGNING_KEY_ID` — used by `getLocalFiscalSigningConfig()` in `local-signing.ts:135`

Without these, `submitFiscalTransaction()` falls from `local` mode to `stub` mode even when offline signing would be possible. The stub mode creates receipts with `stub-signature-{txn}` — not cryptographically verifiable.

**Impact:** In production deployments where MoR live API is unavailable (common in Addis Ababa due to connectivity), all receipts fall to stub mode without any cryptographic signing, rendering them non-compliant.

**Recommendation:** Add both vars to `.env.example` with `[REQUIRED]` tag. Add startup validation in `validateSecrets()` / `instrumentation.ts`.

---

### C6 — Offline Queue Replay Not Scheduled ⬜ OPEN

**File:** `src/lib/fiscal/offline-queue.ts` (exported but uncalled)
**STRIDE:** Denial of Service

The offline queue system (`queueFiscalJob`, `getPendingFiscalJobs`, `replayPendingFiscalJobs`) is fully implemented but **never invoked by any scheduler**:

- No cron job calls `replayPendingFiscalJobs()`
- No edge function periodically flushes the queue
- No on-connect event triggers replay when network is restored
- `replayPendingFiscalJobs` is only called in test files

The local `fiscal_jobs` table (PowerSync SQLite) accumulates pending submissions indefinitely.

**Impact:** Offline transactions sit in local SQLite forever. Once the device comes back online, there's no mechanism to replay them to MoR. Restaurant operators would need to manually trigger replay — violating the real-time/near-real-time submission requirement.

**Recommendation:** Add a network status listener that calls `replayPendingFiscalJobs()` on reconnect. Add a cron/scheduled edge function for periodic server-side replay. Add health check monitoring for queue depth.

---

### C7 — No TIN / VAT Number Validation ⬜ OPEN

**File:** `src/lib/fiscal/erca-service.ts:357-358`, `src/app/api/jobs/erca/submit/route.ts:64-72`
**STRIDE:** Tampering

TIN and VAT numbers are accepted without any format validation:

- Ethiopian TIN format: typically 8-12 numeric digits
- VAT registration number format: `VAT-ET-` prefix + digits
- No checksum validation
- No existence check against MoR database

The `erca-service.ts` simply uses whatever value is stored:

```typescript
tin: order.restaurant.tin_number,
```

And the async route only checks for presence:

```typescript
if (!restaurant?.erca_enabled || !restaurant?.vat_number) {
    return { success: false, error: 'ERCA not enabled for this restaurant' };
}
```

**Impact:** Invalid TINs/VAT numbers submitted to ERCA will be rejected by the MoR API (if live). Worse, in stub mode, invalid identifiers are stored as successful submissions, creating audit records with non-existent tax IDs.

**Recommendation:** Add client-side and server-side TIN/VAT validation. At minimum: regex pattern validation. Ideally: validate against MoR's TIN lookup API during restaurant onboarding.

---

## HIGH Findings

### H1 — Weak (Non-Cryptographic) Hash for Receipt Chain Integrity ⬜ OPEN

**File:** `src/lib/gateway/fiscal-continuity.ts:64-71`
**STRIDE:** Tampering

The `FiscalContinuityService.hashString()` uses a simple Java-style integer hash:

```typescript
private hashString(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const chr = input.charCodeAt(i);
        hash = ((hash << 5) - hash + chr) | 0;
    }
    return hash;
}
```

This is **not cryptographically secure**. It produces a 32-bit integer with high collision probability and is trivially reversible. Ethiopian fiscal law in several jurisdictions requires SHA-256 or stronger for receipt chain integrity.

**Impact:** Receipt chain can be tampered with or replayed without detection. An attacker could modify a receipt and recompute the matching hash. This invalidates the audit chain for MoR inspections.

**Recommendation:** Replace with `crypto.subtle.digest('SHA-256', ...)` from Web Crypto API. Store the full 256-bit hash as a hex string. Add chain verification that validates hash continuity across sequential receipts.

---

### H2 — Receipt Chain Not Persisted Across Restarts ⬜ OPEN

**File:** `src/lib/gateway/fiscal-continuity.ts:14-21`
**STRIDE:** Repudiation

The `FiscalContinuityService` maintains receipt chain state in-memory:

```typescript
private lastSerial: number;
private lastReceiptHash: number | null;

constructor(initialSerial = 1) {
    this.lastSerial = initialSerial;
    this.lastReceiptHash = null;
}
```

On service restart (browser refresh, device reboot, server redeploy), the serial counter resets to 1 and the hash chain is lost. This means:

- Serial numbers restart from 1 after every restart
- No way to verify that receipt #42 follows receipt #41 across restarts
- Chain integrity cannot be proven to MoR auditors

**Impact:** Violates fiscal continuity requirements. MoR mandates an unbroken sequential receipt chain. Restarting the counter creates gaps and duplicates.

**Recommendation:** Persist `lastSerial` and `lastReceiptHash` to local storage (IndexedDB) or PowerSync. On service initialization, load the last state. Add a migration path for devices that upgrade from the non-persistent version.

---

### H3 — Missing `erca_enabled` Column on `restaurants` Table ⬜ OPEN

**File:** `src/app/api/jobs/erca/submit/route.ts:64`, `src/app/api/jobs/orders/completed/route.ts:91`
**STRIDE:** Denial of Service

Both the ERCA submit job and the orders completed handler reference `restaurants.erca_enabled`:

```typescript
.select('name, name_am, vat_number, erca_enabled')
// ...
if (!restaurant?.erca_enabled || !restaurant?.vat_number) {
```

No migration file adds the `erca_enabled` column to the `restaurants` table. The `vat_number` column was added by `med024_erca_submissions.sql` but `erca_enabled` was not.

**Impact:** Database queries will fail with `column "erca_enabled" does not exist` when the ERCA submission path is triggered. This silently fails the entire fiscalization flow.

**Recommendation:** Add migration to create `restaurants.erca_enabled BOOLEAN DEFAULT false`. Wire up the IntegrationsTab toggle to set this flag. After C1 unification, this flag gates whether ERCA submission is attempted at all.

---

### H4 — No Automated 7-Year Retention Enforcement ⬜ OPEN

**File:** `supabase/migrations/20260405110000_med024_erca_submissions.sql:73`
**STRIDE:** Information Disclosure

The migration includes a comment but no enforcement:

```sql
COMMENT ON TABLE erca_submissions IS 'ERCA invoice submission audit trail. Retention: 7 years minimum per Ethiopian VAT law.';
```

There is:

- No partition by year policy
- No automated archiving to cold storage (S3/R2)
- No scheduled cleanup of records older than 7 years
- No backup verification for the retention period
- No WORM (Write Once Read Many) compliance for audit immutability

**Impact:** Records could be accidentally or maliciously deleted before the mandatory 7-year period. MoR audits require data availability covering the full retention window.

**Recommendation:** Add database-level retention policy (trigger that prevents deletion of records <7 years old). Add R2/S3 archival job for records approaching the 7-year mark. Add backup verification checks. Consider enabling Point-in-Time Recovery (PITR) on Supabase.

---

### H5 — Stub Submissions Incorrectly Marked as `status: 'success'` ⬜ OPEN

**File:** `src/lib/fiscal/erca-service.ts:452-478`
**STRIDE:** Repudiation

`recordStubSubmission()` creates records with `status: 'success'` despite the receipt NOT being submitted to ERCA:

```typescript
await this.supabase.from('erca_submissions').insert({
    // ...
    status: 'success',
    error_message: 'Stub mode - ERCA API not configured',
});
```

These records:

- Appear in VAT summaries as "successful" submissions
- Are counted in `generateDailyVATSummary()` (filter: `s.status === 'success'`)
- Contaminate monthly VAT reports with non-compliant transactions

**Impact:** A restaurant operating in stub mode for 6 months would have 6 months of data marked as successfully submitted, but zero actual submissions to MoR. When audited, this would be a compliance violation with penalties.

**Recommendation:** Use `status: 'pending_fiscalization'` or `status: 'stub'` for non-live submissions. Add a separate status filter in reports. Add merchant-facing warning when operating in stub mode for >24 hours.

---

### H6 — No Automated Z-Report / Daily Closure Integration ⬜ OPEN

**File:** `src/lib/fiscal/erca-service.ts:484-518`
**STRIDE:** Repudiation

Ethiopian fiscal regulations require daily Z-reports (end-of-day fiscal summaries). `generateDailyVATSummary()` exists but:

- It's never called by any automated scheduler
- No cron job or edge function invokes it at end of day
- No integration with EOD report delivery (Telegram)
- No mechanism to freeze/lock a day's fiscal data after Z-report generation
- No PDF/A export for the Z-report (Ethiopian requirements)

**Impact:** Every restaurant must manually generate their own fiscal reports. In practice, 90%+ of Addis Ababa restaurants won't do this, creating compliance liability for both the restaurant and Lole.

**Recommendation:** Create a scheduled edge function that runs at midnight EAT (Africa/Addis_Ababa). Generate Z-report for each restaurant, store as PDF/A in R2, and deliver via Telegram to owner. Lock the day's `erca_submissions` from further modification.

---

### H7 — No Comprehensive Amharic Receipt Template ⬜ OPEN

**File:** `src/lib/fiscal/erca-service.ts:341-342`, `src/lib/printer/escpos.ts:111`
**STRIDE:** (Compliance)

ERCA requires invoices in Amharic for local businesses. While the data model supports Amharic (`name_am`, `description_am`), the receipt templates are English-only:

- ESC/POS receipt header, labels, and footer are hardcoded in English
- "TIN:", "Txn:", "Subtotal", "TOTAL" labels not localized
- Footer text "lole Restaurant OS" not in Amharic
- No Amharic date format support (Ethiopian calendar: day/month/year in Ge'ez)

**Impact:** Amharic-language invoices are a legal requirement. English-only receipts risk rejection during MoR inspections.

**Recommendation:** Create Amharic receipt template with all labels localized. Support Ethiopian calendar date formatting. Add `restaurant.receipt_language` setting (en/am). Use Nutrient DWS for PDF/A generation with proper Amharic font embedding (Nyala or Noto Sans Ethiopic).

---

### H8 — No Withholding Tax (WHT) Support ⬜ OPEN

**File:** Entire fiscal module
**STRIDE:** (Compliance)

Ethiopian tax law requires 2% withholding tax on certain B2B transactions. The codebase has:

- No `withholding_tax` column or table
- No WHT calculation logic
- No WHT reporting/summary
- No mention of WHT in any file

**Impact:** B2B transactions (e.g., corporate catering, event invoices) would under-report tax liability by 2%. For restaurants serving corporate clients, this creates tax compliance gaps.

**Recommendation:** Add `withholding_tax_rate` config per restaurant. Add `withholding_tax_santim` to `erca_submissions`. Include WHT in monthly VAT reports. Add WHT field to invoice payload for ERCA submission.

---

## MEDIUM Findings

### M1 — Duplicate ERCA API URL Environment Variables ⬜ OPEN

**File:** `.env.example:340,343`
**STRIDE:** (Operational)

Two variables serve the same purpose:

- `ERCA_API_URL` — used by `erca-service.ts:208`
- `ERCA_API_ENDPOINT` — used by `jobs/erca/submit/route.ts:197`

With identical descriptions and same placeholder value. This creates confusion and potential for drift.

**Recommendation:** After unifying ERCA implementations (C1), consolidate to single `ERCA_API_URL`. Remove `ERCA_API_ENDPOINT`.

---

### M2 — Idempotency Gap in Stub Submissions ⬜ OPEN

**File:** `src/lib/fiscal/erca-service.ts:293-308,452-478`
**STRIDE:** Tampering

The `submitInvoice()` method checks for existing success records to prevent duplicates:

```typescript
const { data: existing } = await this.supabase
    .from('erca_submissions')
    .select('id, ...')
    .eq('order_id', orderId)
    .eq('status', 'success')
    .single();
```

But `recordStubSubmission()` also creates records with `status: 'success'`. If an order is retried (after initial stub submission), the idempotency check finds the stub success record and skips re-submission — even if MoR API has since become available.

**Impact:** Orders submitted during offline/stub periods are never re-submitted to live MoR API, even after connectivity is restored.

**Recommendation:** Distinguish stub records from live records with a different status. Update the idempotency check to retry stub/pending records when the API becomes available.

---

### M3 — VAT Rate Hardcoded at 15% Everywhere ⬜ OPEN

**File:** `src/lib/fiscal/erca-service.ts:117`, `src/app/api/jobs/erca/submit/route.ts:143`, `src/lib/fiscal/local-signing.ts:5`
**STRIDE:** (Business Logic)

The 15% VAT rate is hardcoded in at least 4 separate locations:

```typescript
export const VAT_RATE = 0.15; // erca-service.ts
const vatRate = 0.15; // jobs/erca/submit/route.ts
tax_rate: number; // local-signing.ts interface
item.tax_rate.toFixed(4); // local-signing.ts
```

If the Ethiopian government changes the VAT rate (as has happened in other countries), updating requires code changes and redeployment across all files.

**Recommendation:** Make VAT rate configurable per restaurant via `restaurant_settings` or a dedicated `fiscal_config` table. Default to 15%. Allow override for exempt items. Add migration to add `vat_rate` column.

---

### M4 — No Ethiopian Fiscal Year Support ⬜ OPEN

**File:** `src/lib/fiscal/erca-service.ts:597-598`
**STRIDE:** (Business Logic)

Ethiopian fiscal year runs Hamle 1 to Sene 30 (approximately July 8 to July 7). The monthly report uses Gregorian calendar:

```typescript
const startDate = new Date(year, month - 1, 1);
const endDate = new Date(year, month, 0);
```

Fiscal reporting to MoR must follow Ethiopian fiscal year periods. Gregorian calendar alignment will create incorrect quarterly and annual filings.

**Recommendation:** Add Ethiopian calendar conversion utility. Generate fiscal-year-aware reports. Support both Gregorian (for internal) and Ethiopian (for MoR submission) date ranges.

---

### M5 — No Per-Item VAT Exemption Support ⬜ OPEN

**File:** `src/lib/fiscal/erca-service.ts:336-349`
**STRIDE:** (Business Logic)

All items are treated as VAT-applicable. Ethiopian law exempts certain basic foodstuffs (unprocessed injera, raw milk, etc.) from VAT. The `buildPayload()` method applies VAT to every item without checking exemption status.

**Impact:** Restaurants selling both taxable and exempt items would over-report VAT. Over months, this creates incorrect tax liabilities.

**Recommendation:** Add `is_vat_exempt` boolean to `menu_items` table. Skip VAT calculation for exempt items. Include exemption reason code in ERCA payload. Add exemption reporting to monthly VAT reports.

---

### M6 — No Santim Rounding Audit Trail ⬜ OPEN

**File:** `src/lib/fiscal/erca-service.ts:155-157`
**STRIDE:** (Data Integrity)

Rounding happens silently via `Math.round()`:

```typescript
const vatPortionSantim = Math.round((taxInclusivePriceSantim * VAT_RATE) / (1 + VAT_RATE));
const netPriceSantim = taxInclusivePriceSantim - vatPortionSantim;
```

Over thousands of transactions, rounding differences accumulate. The rounding logic ensures `netPrice + vatPortion = taxInclusivePrice` (by subtraction), but the allocated VAT amount may differ from the exact proportional VAT by ±1 santim per item.

**Impact:** Cumulative rounding differences between reported VAT and collected VAT could trigger audit flags. Without a rounding audit trail, these discrepancies are unexplainable to MoR.

**Recommendation:** Add `rounding_difference_santim` column to line items or submission records. Track accumulated rounding differences per day. Reconcile monthly with a compensating entry.

---

## LOW Findings

### L1 — Inconsistent Currency Display in ESC/POS Receipts ⬜ OPEN

**File:** `src/lib/printer/escpos.ts:51-53,165`
**STRIDE:** (UX)

Receipts display amounts as "ETB" with decimal formatting:

```typescript
function money(value: number, currency: string): string {
    return `${currency} ${value.toFixed(2)}`;
}
```

But the internal representation is santim (integers). The receipt doesn't clarify whether displayed amounts are in ETB or santim, and the ESC/POS QR code encodes santim values directly without labeling.

**Recommendation:** Add "All amounts in Ethiopian Birr (ETB)" footer to receipts. Clarify QR encoded format. Use "Br" prefix (colloquial Ethiopian notation) alongside "ETB".

---

### L2 — ERCA Integration Status is Static/Hardcoded in UI ⬜ OPEN

**File:** `src/components/merchant/settings/tabs/IntegrationsTab.tsx:88-97`
**STRIDE:** (UX)

The ERCA integration card shows `status: 'connected'` as a hardcoded value:

```typescript
{
    id: 'erca',
    name: 'Erca e-Tax Portal',
    status: 'connected', // Static — not reactive
    lastSync: '2024-04-16T09:30:00Z', // Hardcoded date
}
```

It doesn't reflect actual submission status from `erca_submissions`. A restaurant could have 100 failed submissions and the dashboard would still show "Connected" with an old sync date.

**Recommendation:** Fetch real-time ERCA status from `erca_submissions`. Show submission success rate, last successful submission time, pending count, and failure alerts. Gate the "connected" status on actual API connectivity.

---

### L3 — Test Coverage Gaps in Fiscal Module ⬜ OPEN

**File:** Test directory structure
**STRIDE:** (Quality)

| Module                      | Unit Tests | Integration | E2E | DR/Offline |
| --------------------------- | ---------- | ----------- | --- | ---------- |
| `erca-service.ts`           | ✅         | ❌          | ❌  | ❌         |
| `mor-client.ts`             | ✅         | ❌          | ❌  | ❌         |
| `local-signing.ts`          | ✅         | ❌          | ❌  | ❌         |
| `offline-queue.ts`          | ✅         | ❌          | ❌  | ❌         |
| `fiscal-continuity.ts`      | ❌         | ❌          | ❌  | ❌         |
| `transaction-print.ts`      | ✅         | ❌          | ❌  | ❌         |
| `jobs/erca/submit/route.ts` | ❌         | ❌          | ❌  | ❌         |

Missing test scenarios:

- End-to-end: order completing → fiscal submission → printer integration
- Disaster recovery: offline → queue → reconnect → replay
- Performance: batch submission of 100+ orders
- Compliance: MoR API contract validation
- Ethiopian calendar: date boundary tests

**Recommendation:** Add integration tests for the unified ERCA flow. Add E2E test for offline→online replay. Add performance benchmarks for bulk submission. Add contract test against MoR API spec.

---

## Risk Matrix (Current State)

| Risk Area                   | Current Level | Target Level | Gap                                              |
| --------------------------- | ------------- | ------------ | ------------------------------------------------ |
| VAT calculation correctness | MEDIUM (50%)  | HIGH (100%)  | Path B has incorrect logic                       |
| Digital signing             | LOW (25%)     | HIGH (100%)  | Path B unsigned; weak hash in continuity         |
| Data consistency            | LOW (20%)     | HIGH (100%)  | Two parallel systems, different tables           |
| Offline resilience          | HIGH (90%)    | HIGH (100%)  | Queue works but replay not scheduled             |
| Regulatory compliance       | LOW (15%)     | HIGH (100%)  | Missing Z-reports, Amharic, WHT, fiscal year     |
| Audit trail integrity       | MEDIUM (50%)  | HIGH (100%)  | No chain verification; stub=success              |
| Operational readiness       | LOW (30%)     | HIGH (100%)  | No monitoring, no automated replay, no retention |
