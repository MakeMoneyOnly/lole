# lole Restaurant OS — Enterprise-Grade Production Readiness Tasks

> **Generated**: 2026-04-16  
> **Last Updated**: 2026-05-08 (Department Gap Analysis Complete)  
> **Status**: In Progress — 63/73 action items pending  
> **Total Items**: 73 action items across 4 priority sections  
> **Completed**: 10 items verified, 63 pending

---

## Section 1: Critical Security Blockers (6 tasks)

These must be resolved before any production traffic. Each represents a direct data-exfiltration or compliance-violation risk.

### 1.1 ☐ CRIT-002: Audit remaining permissive RLS policies

- **Finding**: While `USING (true)` / `WITH CHECK (true)` policies for `TO authenticated` roles have been replaced with tenant-scoped alternatives (migration `20260408130000`), new migrations still create redundant `TO service_role USING (true) WITH CHECK (true)` policies (e.g., `20260405110000`). These are harmless (service_role bypasses RLS) but represent policy sprawl.
- **Status**: Partially Resolved — dangerous policies fixed; redundant policies remain
- **Action**:
    - [ ] Run `SELECT * FROM pg_policies WHERE polqual = 'true' OR polwithcheck = 'true'` against production database
    - [ ] Document all remaining `USING (true)` policies as intentional (public read for guest menu, anon insert for guest checkout) or redundant (service_role)
    - [ ] Add a lint rule to CI that fails if new migrations introduce `TO authenticated USING (true)` without a comment explaining why
    - [ ] Clean up redundant `service_role` policies in a single migration
- **Severity**: Critical
- **Files**: `supabase/migrations/20260408130000_security_advisor_fix_permissive_policies.sql`, `supabase/migrations/20260405110000_med024_erca_submissions.sql`

### 1.2 ☐ CRIT-007: Enable Supabase leaked password protection

- **Finding**: The Supabase Security Advisor flagged leaked password protection as disabled. This is a dashboard-only setting (not code), but no evidence exists that it was enabled. Stage 0 of the remediation plan explicitly prioritizes this.
- **Status**: Unresolved
- **Action**:
    - [ ] Log into Supabase Dashboard → Authentication → Settings
    - [ ] Enable "Leaked password protection" toggle
    - [ ] Screenshot and commit evidence to `docs/08-reports/database/` or note in remediation tracker
    - [ ] Add to pre-production Go/No-Go checklist
- **Severity**: Critical
- **Files**: N/A (Supabase Dashboard setting)

### 1.3 ☐ DATA-001: Fix daily_sales ERCA retention mismatch (3yr vs 7yr)

- **Finding**: `daily_sales` retention is configured for 3 years but ERCA requires 7 years. This is a direct compliance violation for Ethiopian tax law. Documented in `docs/02-security/data-retention-policy.md`.
- **Status**: Unresolved
- **Action**:
    - [ ] Create migration to extend `daily_sales` retention policy to 7 years
    - [ ] Verify no existing data will be purged before the migration runs
    - [ ] Update retention policy document with confirmation
    - [ ] Add ERCA retention check to quarterly audit schedule
- **Severity**: Critical
- **Files**: `docs/02-security/data-retention-policy.md`, new migration needed

### 1.4 ☐ CSRF-001: Add verifyOrigin to unprotected login Server Action

- **Finding**: Of 4 Server Action files, 3 use `verifyOrigin()`. The login action (`src/app/auth/login/actions.ts`) does NOT use CSRF protection. This means the login form is vulnerable to CSRF-based login attacks.
- **Status**: Partially Resolved (3/4 = 75% coverage)
- **Action**:
    - [ ] Add `verifyOrigin()` call to `src/app/auth/login/actions.ts`
    - [ ] Audit ALL `'use server'` functions across the entire codebase (not just auth files) for `verifyOrigin` usage
    - [ ] Create a CI check that flags Server Actions without `verifyOrigin`
    - [ ] Update `docs/implementation/csrf-coverage-audit.md` with expanded scope
- **Severity**: Critical
- **Files**: `src/app/auth/login/actions.ts`, `src/lib/security/csrf.ts`

### 1.5 ☐ A11Y-001: Add aria-live regions for dynamic order status changes

- **Finding**: Only 1 instance of `aria-live` exists in the entire codebase (`GuestProfileDrawer.tsx`). KDS order status changes, POS cart updates, payment status transitions, and notification toasts all lack `aria-live` announcements. This fails WCAG 2.1 AA for screen reader users.
- **Status**: Unresolved
- **Action**:
    - [ ] Add `aria-live="polite"` to all order status containers in KDS (`StationBoard.tsx`)
    - [ ] Add `aria-live="polite"` to cart item count and total in POS (`WaiterPosPage`)
    - [ ] Add `aria-live="assertive"` to error/failure notifications
    - [ ] Add `aria-live="polite"` to guest order tracker status changes
    - [ ] Create an `AccessibleStatus` reusable component that wraps dynamic status with aria-live
- **Severity**: Critical (WCAG 2.1 AA compliance)
- **Files**: `src/app/(kds)/kds/StationBoard.tsx`, `src/app/(pos)/waiter/page.tsx`, `src/app/(guest)/`

### 1.6 ☐ A11Y-002: Audit all icon-only buttons for aria-labels

- **Finding**: While `Button.tsx` has a runtime warning for icon-only buttons missing `aria-label`, custom icon buttons outside the `<Button>` component are not audited. The accessibility audit identifies this as Critical.
- **Status**: Partially Resolved (Button component enforced; custom buttons not audited)
- **Action**:
    - [ ] Run `rg 'icon.*button|IconButton|<svg' src/ --type tsx -l` to find all icon-only button instances
    - [ ] Verify each has an `aria-label` or is wrapped in a labeled container
    - [ ] Add eslint rule to flag `<button>` elements without text content or `aria-label`
    - [ ] Add KDS bump-bar key labels to screen reader output
- **Severity**: Critical
- **Files**: `src/components/ui/Button.tsx`, all component files with icon-only buttons

---

## Section 2: High-Priority Implementation Gaps (18 tasks)

### 2.1 ☐ POS-001: Implement split-check UI

- **Finding**: Database schema exists (`order_check_splits`, `order_check_split_items` tables via migration `20260301113000`), but no split-check UI component exists. The PRD lists split-check as a P0 feature. Toast parity requires this.
- **Status**: Database ready; UI missing
- **Action**:
    - [ ] Design split-check flow (even split, custom amounts, item assignment)
    - [ ] Implement `SplitCheckDialog` component in POS
    - [ ] Create `POST /api/orders/:id/split` endpoint
    - [ ] Add split-check to KDS display (show which items belong to which check)
    - [ ] Write integration tests for split-check → payment flow
- **Severity**: High (P0 feature gap)

### 2.2 ☐ KDS-001: Resolve PowerSync vs Dexie.js offline architecture

- **Finding**: Codebase contains both PowerSync configuration (`src/lib/sync/powersync-config.ts`) and Dexie.js/IndexedDB offline queue (`src/lib/kds/offlineQueue.ts`). PowerSync packages are dynamically imported with a fallback to offline-only mode if not installed. Documentation references both interchangeably, causing confusion.
- **Status**: Partial — KDS works with IndexedDB fallback; PowerSync Cloud sync not confirmed active
- **Action**:
    - [ ] Decide: Is PowerSync the target offline architecture or is Dexie.js/IndexedDB sufficient?
    - [ ] If PowerSync: Install `@powersync/web` and `@powersync/react` packages, verify cloud sync works end-to-end
    - [ ] If Dexie.js: Remove PowerSync configuration files and references, update all documentation
    - [ ] Update `docs/01-foundation/architecture.md`, `docs/01-foundation/system-architecture.md`, and all runbooks to reflect the chosen approach
    - [ ] Document the offline architecture decision as an ADR
- **Severity**: High (architectural clarity)

### 2.3 ☐ NOTIF-001: Complete push notification delivery

- **Finding**: Notification queue, SMS, retry, dedup, and fallback are all implemented. Push notification delivery via FCM/Web Push is scaffolded but the queue processor logs `"not implemented yet"` and marks push as `skipped: true`.
- **Status**: Partial — queue and SMS work; push delivery not wired
- **Action**:
    - [ ] Complete FCM push notification delivery in `src/lib/notifications/push.ts`
    - [ ] Wire push delivery into `src/lib/notifications/queue.ts` processor (remove `skipped` flag)
    - [ ] Test end-to-end: order status → queue → push → device
    - [ ] Add push notification failure → SMS fallback integration
    - [ ] Update feature flags catalogue with `ENABLE_PUSH_NOTIFICATIONS`
- **Severity**: High (guest notification reliability)

### 2.4 ☐ PAGINATE-001: Add cursor-based pagination to orders API

- **Finding**: KDS queue API has full cursor-based pagination. Orders API (`/api/orders`) uses offset-based pagination only (`.range()` with `offset` + `limit`). This does not scale for high-volume restaurants and risks skipped/duplicate records during concurrent writes.
- **Status**: Partially Resolved (KDS has cursors; orders does not)
- **Action**:
    - [ ] Implement cursor-based pagination for `GET /api/orders` using created_at + id cursor
    - [ ] Add `cursor`, `limit`, `before`, `after` query parameters
    - [ ] Update API documentation in `docs/api/endpoints.md`
    - [ ] Add load test comparing offset vs cursor performance at 10K+ orders
    - [ ] Apply cursor pagination to command center and delivery aggregator APIs
- **Severity**: High (scalability)

### 2.5 ☐ RETENT-001: Automate data retention policies

- **Finding**: `data-retention-policy.md` defines 6 retention policies requiring automation. None are implemented:
    - Guest fingerprint anonymization (90 days)
    - Order archival (2 years)
    - Staff record anonymization (2 years after deactivation)
    - Auth audit log cleanup (1 year)
    - Guest account deletion workflow
    - Legal hold mechanism
- **Status**: Unresolved
- **Action**:
    - [ ] Create QStash cron jobs or Supabase pg_cron tasks for each retention policy
    - [ ] Add `deactivated_at` column to staff table for anonymization trigger
    - [ ] Implement guest account deletion workflow with 30-day grace period
    - [ ] Build legal hold flag on records (prevents retention job from processing)
    - [ ] Add retention job monitoring and alerting
    - [ ] Update `data-retention-policy.md` with implementation status
- **Severity**: High (compliance)

### 2.6 ☐ SEC-001: Implement payment webhook HMAC verification for all endpoints

- **Finding**: Chapa HMAC verification is implemented. Telebirr signature verification is implemented. However, the security policy lists webhook HMAC verification as Sprint 1 target with no completion confirmation. Unsourced payment capture (webhook-only without verification) was identified as a vulnerability.
- **Status**: Partially Resolved (Chapa + Telebirr done; need to verify completeness)
- **Action**:
    - [ ] Audit ALL webhook endpoints for HMAC/signature verification
    - [ ] Verify Telebirr webhook uses constant-time comparison (like Chapa)
    - [ ] Add integration test: webhook with invalid signature returns 401
    - [ ] Add monitoring alert for webhook verification failures
    - [ ] Update `docs/02-security/security-policy.md` with completed status
- **Severity**: High

### 2.7 ☐ SEC-002: Implement PIN brute force rate limiting

- **Finding**: Redis-backed rate limiting exists for API endpoints but the security policy specifically calls out PIN brute force protection as Sprint 1 target. Need to verify PIN-specific rate limiting exists.
- **Status**: Needs Verification
- **Action**:
    - [ ] Check if PIN authentication endpoint has specific rate limiting (5 attempts per 5 minutes)
    - [ ] If missing, add PIN-specific rate limit to `src/lib/rate-limit.ts`
    - [ ] Add account lockout after N failed PIN attempts
    - [ ] Add security event logging for PIN failures
    - [ ] Write test for brute force rate limiting on PIN endpoint
- **Severity**: High

### 2.8 ☐ CONN-001: Wire connection pooling into Supabase client initialization

- **Finding**: Connection pooling configuration modules exist (`src/lib/supabase/connection-pooling.ts`, `src/lib/supabase/pool.ts`) with Supavisor URL construction, pool config, and health checks. However, neither module is imported by the actual Supabase client creation paths (`server.ts`, `client.ts`). The pooling code is dead code.
- **Status**: Partially Resolved (config exists; not wired)
- **Action**:
    - [ ] Update `src/lib/supabase/server.ts` to use pooler URL when `SUPABASE_POOLER_ENABLED=true`
    - [ ] Add `SUPABASE_POOLER_URL` to environment variable configuration
    - [ ] Test connection pooling with load test (verify connection count stays within pool limits)
    - [ ] Add pool health check to `/api/health` endpoint
    - [ ] Update `docs/08-reports/connection-pooling.md` with implementation confirmation
- **Severity**: High (scalability under load)

### 2.9 ☐ SELECT-001: Replace remaining SELECT \* queries

- **Finding**: 11 `SELECT *` instances remain in offline/SQLite modules. The orders API uses `.select('*', { count: 'exact' })` against PostgreSQL. A `query-columns.ts` constant file exists but may not be used everywhere.
- **Status**: Partially Resolved (12 hot-path PostgreSQL queries fixed; 11 SQLite + 1 PostgreSQL remain)
- **Action**:
    - [ ] Replace `.select('*', { count: 'exact' })` in `src/app/api/orders/route.ts` with explicit column list
    - [ ] Replace SQLite `SELECT *` in `src/lib/sync/` modules with explicit column lists (use `query-columns.ts` constants)
    - [ ] Replace SQLite `SELECT *` in `src/lib/fiscal/offline-queue.ts`
    - [ ] Add eslint rule to flag `.select('*')` and `SELECT *` in new code
    - [ ] Update `docs/implementation/HIGH-013-intentional-select-star.md` with final status
- **Severity**: High

### 2.10 ☐ FEAT-001: Implement database-backed feature flags (Tier 2)

- **Finding**: Only environment-variable-based Tier 1 flags exist. The two-tier flag system (env + database) described in `docs/03-product/feature-flags.md` is only partially implemented. No `feature_flags` table or database-backed flag service exists.
- **Status**: Partial — Tier 1 only
- **Action**:
    - [ ] Create `feature_flags` table migration with RLS
    - [ ] Implement `DatabaseFeatureFlagService` that reads flags per-restaurant
    - [ ] Wire into `isFeatureEnabled()` with fallback to env vars
    - [ ] Add admin UI for flag management
    - [ ] Migrate pilot rollout flags (PILOT_RESTAURANT_IDS) to database
- **Severity**: High (per-restaurant feature gating required for rollout)

### 2.11 ☐ GRAPHQL-001: Add query whitelisting and field-level complexity

- **Finding**: GraphQL depth limit (10) and complexity limit (1000) are implemented. CSRF prevention is enabled. However, the framework best practices audit identifies missing query whitelisting, operation name validation, and field-level complexity as Medium-priority documented items.
- **Status**: Partially Resolved (depth + complexity limits exist; whitelisting and operation name validation missing)
- **Action**:
    - [ ] Add persisted query support (query whitelisting) to Apollo Router config
    - [ ] Add operation name validation (reject anonymous queries in production)
    - [ ] Evaluate field-level complexity analysis for high-cost fields
    - [ ] Update `docs/10-reference/graphql-federation-architecture.md` with security measures
- **Severity**: High (production GraphQL security)

### 2.12 ☐ ARCH-001: Add PowerSync reconnection with exponential backoff

- **Finding**: The architecture scalability audit identifies missing reconnection logic for PowerSync sync. If the WebSocket connection drops, the client should automatically reconnect with exponential backoff.
- **Status**: Unresolved
- **Action**:
    - [ ] Add reconnection handler to `src/lib/sync/powersync-config.ts`
    - [ ] Implement exponential backoff (1s, 2s, 4s, 8s, max 30s)
    - [ ] Add jitter to prevent thundering herd
    - [ ] Add `useSyncStatus` hook update for reconnection state
    - [ ] Test with network interruption scenarios
- **Severity**: High (offline resilience)

### 2.13 ☐ FEE-001: Verify platform fee model implementation

- **Finding**: The platform fee model audit identifies 4 implementation rules not confirmed done:
    - `platform_fee_percentage` reinterpretation as `hosted_checkout_fee_percentage`
    - Server-enforced settlement eligibility (Rule 1)
    - Fee reporting separating estimate from actual (Rule 4)
    - Target pricing tables not yet implemented (post-V1)
- **Status**: Needs Verification
- **Action**:
    - [ ] Verify `platform_fee_percentage` field semantics in code and UI
    - [ ] Implement server-side settlement eligibility validation
    - [ ] Add fee estimate vs actual separation in reporting
    - [ ] Update `docs/03-product/platform-fee-model.md` with verification results
- **Severity**: High (monetization accuracy)

### 2.14 ☐ TELEBIRR-001: Confirm Telebirr scope decision

- **Finding**: Architecture audit lists "Telebirr payment integration missing" as HIGH-007. Feature tasks audit says Telebirr is removed from scope. The codebase HAS a full Telebirr implementation (`src/lib/payments/telebirr.ts`, `src/app/api/webhooks/telebirr/route.ts`). Documentation is contradictory.
- **Status**: Implemented but scope ambiguous
- **Action**:
    - [ ] Confirm: Is Telebirr in scope or out of scope for production?
    - [ ] If in scope: Update all audit documents marking HIGH-007 as resolved
    - [ ] If out of scope: Remove Telebirr code and webhooks, update feature flags
    - [ ] Update `docs/08-reports/architecture/architecture-scalability-audit-report-2026-03-23.md`
    - [ ] Update `docs/03-product/roadmap.md` with clear scope decision
- **Severity**: High (scope clarity)

### 2.15 ☐ DATA-002: Implement data retention automation for guest fingerprint anonymization

- **Finding**: Guest fingerprint data must be anonymized after 90 days per the privacy policy. No automation exists.
- **Status**: Unresolved
- **Action**:
    - [ ] Create QStash scheduled task or Supabase pg_cron job
    - [ ] Hash or delete fingerprint fields after 90 days
    - [ ] Add audit log entry for each anonymization event
    - [ ] Add monitoring dashboard for anonymization job health
- **Severity**: High (privacy compliance)

### 2.16 ☐ DATA-003: Implement order archival pipeline (2-year retention)

- **Finding**: Orders older than 2 years should be archived per retention policy. No archival mechanism exists.
- **Status**: Unresolved
- **Action**:
    - [ ] Design archival table schema (e.g., `archived_orders`, `archived_order_items`)
    - [ ] Create pg_cron job that moves records older than 2 years
    - [ ] Ensure archived data remains accessible for ERCA compliance queries
    - [ ] Add PITR-awareness (archival should not break backup restoration)
- **Severity**: High

### 2.17 ☐ SECURITY-DOC-001: Fix phantom health endpoint references in runbooks

- **Finding**: Multiple runbooks reference non-existent health endpoints (`/api/health/payments`, `/api/health/realtime`, `/api/health/kds`). The actual endpoint is `GET /api/health` which covers all subsystems.
- **Status**: Unresolved
- **Action**:
    - [ ] Update `docs/09-runbooks/telebirr-chapa-integration.md` — replace phantom endpoints with `/api/health`
    - [ ] Update `docs/09-runbooks/payment-gateway-outages.md` — replace phantom endpoints
    - [ ] Search all `.md` files for `/api/health/` and fix references
    - [ ] Add link checker to CI to catch broken references
- **Severity**: High (operational: runbooks with wrong URLs cause delayed incident response)

### 2.18 ☐ AGENTS-PATH-001: Fix broken path in AGENTS.md

- **Finding**: AGENTS.md references `docs/implementation/p0-release-readiness-and-rollback.md` which does not exist. The actual path is `docs/08-reports/rollout/p0-release-readiness-and-rollback.md`.
- **Status**: Unresolved
- **Action**:
    - [ ] Update AGENTS.md with correct path
    - [ ] Search AGENTS.md for other potentially broken paths
    - [ ] Add AGENTS.md path validation to CI
- **Severity**: High (AGENTS.md is the north-star document for AI agents)

---

## Section 3: Medium-Priority Implementation Gaps (15 tasks)

### 3.1 ☐ A11Y-003: Complete KDS keyboard navigation

- **Finding**: KDS has extensive keyboard shortcuts (1-9, arrows, Enter, s/h/r). The accessibility audit flags that not all KDS queue actions may be keyboard-accessible.
- **Status**: Partial
- **Action**:
    - [ ] Audit every KDS action for keyboard accessibility
    - [ ] Add keyboard shortcut for "recall" action
    - [ ] Add keyboard shortcut for "rush" / "expedite"
    - [ ] Document all keyboard shortcuts in a visible help overlay
- **Severity**: Medium

### 3.2 ☐ A11Y-004: Audit color contrast for secondary/gray text

- **Finding**: Accessibility audit identifies potential WCAG 4.5:1 contrast failures for secondary/gray text. Non-text contrast (form borders, disabled states) may not meet 3:1.
- **Status**: Unresolved
- **Action**:
    - [ ] Run axe-core audit on all primary surfaces (POS, KDS, Guest, Dashboard)
    - [ ] Fix any text contrast failures below 4.5:1
    - [ ] Fix any non-text contrast failures below 3:1
    - [ ] Add contrast check to CI (e.g., `pa11y` or `axe-core` in E2E tests)
- **Severity**: Medium

### 3.3 ☐ A11Y-005: Add form error aria-describedby linkage

- **Finding**: Not all form error states are linked to their inputs via `aria-describedby`.
- **Status**: Unresolved
- **Action**:
    - [ ] Audit all form components for error → input linkage
    - [ ] Add `aria-describedby` + `aria-invalid` to all form inputs with error states
    - [ ] Create reusable `FormField` component that handles this automatically
- **Severity**: Medium

### 3.4 ☐ A11Y-006: Verify reduced motion is universally applied

- **Finding**: `useReducedMotion` hook is implemented but the accessibility audit notes it is not universally applied to all animations.
- **Status**: Partial
- **Action**:
    - [ ] Audit all `transition`, `animate`, `motion.*` components for reduced-motion handling
    - [ ] Add CSS `@media (prefers-reduced-motion: reduce)` fallbacks
    - [ ] Test with OS-level reduced motion enabled
- **Severity**: Medium

### 3.5 ☐ I18N-001: Complete Amharic translation coverage (~35% missing)

- **Finding**: Amharic coverage is ~60-65% of English keys. Missing keys include: actions (import, view, print, download), menu (newItem, editItem, deleteItem, modifiers, options), tables (capacity, transfer, merge, split), KDS (bumped, recall, rush, fireAll, expedite), payments (split, addTip, refund, partialRefund), staff (editStaff, status, onBreak, shiftHours, pin), guests (guestInfo, totalSpent, notes, allergies, preferences), settings (several keys), and reports section.
- **Status**: Partial
- **Action**:
    - [ ] Prioritize P0 keys: KDS, payments, order status (staff-facing, safety-critical)
    - [ ] Translate all missing keys in `src/lib/i18n/translations.ts`
    - [ ] Add `t()` calls for all hardcoded English strings in KDS, order status, payment flow
    - [ ] Add i18n completeness check to CI (count en vs am keys, fail if < 90%)
    - [ ] Update `docs/10-reference/amharic-translation-audit.md` with new coverage percentage
- **Severity**: Medium (operational in Addis Ababa)

### 3.6 ☐ I18N-002: Replace hardcoded English strings in KDS, Order Status, Payment Flow

- **Finding**: Amharic translation audit identifies hardcoded English strings in KDS Display, Order Status Badges, and Payment Flow components.
- **Status**: Unresolved
- **Action**:
    - [ ] Identify all hardcoded English strings in KDS components
    - [ ] Replace with `t('kds.bumped')`, `t('kds.recall')`, etc.
    - [ ] Repeat for Order Status Badges and Payment Flow
    - [ ] Verify all surfaces render correctly in Amharic after changes
- **Severity**: Medium

### 3.7 ☐ SEC-003: Add gitleaks pre-commit hook

- **Finding**: Security policy lists gitleaks pre-commit hook as Sprint 1 target. Not confirmed implemented.
- **Status**: Needs Verification
- **Action**:
    - [ ] Check if `gitleaks` is in `.pre-commit-config.yaml` or `.husky/`
    - [ ] If missing, add gitleaks to pre-commit hooks
    - [ ] Add `.gitleaks.toml` configuration with allowlist for test fixtures
    - [ ] Test that pre-commit hook catches a dummy secret
- **Severity**: Medium

### 3.8 ☐ SEC-004: Rate limit keyed on restaurant_id instead of IP

- **Finding**: Current rate limiting uses IP-based keys. Multi-tenant safety requires rate limiting per restaurant to prevent one tenant from affecting another.
- **Status**: Unresolved
- **Action**:
    - [ ] Add `restaurant_id` to rate limit key alongside IP
    - [ ] Implement per-tenant rate limit buckets
    - [ ] Add tenant-specific rate limit monitoring
    - [ ] Update `src/lib/rate-limit.ts` with dual-key strategy
- **Severity**: Medium

### 3.9 ☐ SEC-005: Configure Cloudflare WAF and direct access blocking

- **Finding**: Security policy lists Cloudflare WAF as Sprint 7 target. Production API should not be directly accessible bypassing Cloudflare.
- **Status**: Unresolved
- **Action**:
    - [ ] Configure Cloudflare WAF rules for API endpoints
    - [ ] Block direct Vercel deployment URL access (only allow through Cloudflare)
    - [ ] Add Cloudflare bot protection
    - [ ] Document WAF rules and configuration
- **Severity**: Medium (Sprint 7 target)

### 3.10 ☐ MONITOR-001: Fix Grafana/Prometheus references in monitoring docs

- **Finding**: Monitoring dashboard documentation references Grafana/Prometheus but the project uses Sentry + Better Uptime + Axiom. Grafana sections are aspirational and misleading.
- **Status**: Documentation issue
- **Action**:
    - [ ] Mark Grafana/Prometheus/Datadog sections as "Future/Planned" in `docs/05-infrastructure/monitoring/monitoring-dashboards.md`
    - [ ] Move current-reality monitoring (Sentry, Telegram, Better Uptime) to top of doc
    - [ ] Update `docs/implementation/monitoring-dashboards.md` similarly
    - [ ] Consolidate `docs/05-infrastructure/monitoring/api-reliability-dashboard.md` into parent doc
- **Severity**: Medium (operational clarity)

### 3.11 ☐ CHAOS-001: Fix chaos engineering doc for Vercel serverless

- **Finding**: Chaos engineering document references `gcloud compute firewall-rules` and `iptables` commands that assume Linux server access. The platform runs on Vercel (serverless), making these injection methods infeasible.
- **Status**: Documentation issue
- **Action**:
    - [ ] Replace GCP/iptables injection methods with Vercel-compatible approaches (e.g., Vercel Edge Middleware for latency injection, environment variable flags for service disabling)
    - [ ] Remove or rewrite the network instability experiment for serverless
    - [ ] Add Vercel-specific chaos experiments (cold start simulation, function timeout, edge function failures)
    - [ ] Update `docs/implementation/chaos-engineering.md`
- **Severity**: Medium

### 3.12 ☐ DBPERF-001: Add missing RLS indexes for policy predicates

- **Finding**: Database audit identifies missing indexes on columns used by RLS policy predicates. These cause sequential scans on every query.
- **Status**: Needs Verification (some may be addressed by Stage 5 evidence-based indexing)
- **Action**:
    - [ ] Query `pg_policies` for all RLS predicate columns
    - [ ] Cross-reference with existing indexes
    - [ ] Create migration for missing RLS indexes
    - [ ] Validate with `EXPLAIN ANALYZE` before/after
- **Severity**: Medium (performance under load)

### 3.13 ☐ DBPERF-002: Add GIN indexes for JSONB columns

- **Finding**: Database audit identifies JSONB columns without GIN indexes. These cause slow lookups on modifier groups, order metadata, and settings.
- **Status**: Needs Verification
- **Action**:
    - [ ] Identify all JSONB columns used in WHERE clauses
    - [ ] Create GIN index migration for each
    - [ ] Validate with `EXPLAIN ANALYZE`
    - [ ] Add to FK-protected keep list
- **Severity**: Medium

### 3.14 ☐ RISK-001: Update risk register with current status

- **Finding**: All 5 risks in the risk register are marked "Open" but several are likely mitigated (e.g., R-003 RLS misconfiguration is substantially mitigated per security-advisor-remediation). Last updated Feb 17.
- **Status**: Unresolved (outdated)
- **Action**:
    - [ ] Review each risk against audit remediation evidence
    - [ ] Update R-003 status to "Mitigated" with evidence from security-advisor-remediation-2026-04-08
    - [ ] Update R-001, R-002, R-004, R-005 with current status
    - [ ] Schedule weekly risk register review
    - [ ] Update `docs/08-reports/risk-register.md`
- **Severity**: Medium (governance)

### 3.15 ☐ MISC-001: Fix GRANT ALL statements in runbooks

- **Finding**: `docs/09-runbooks/telebirr-chapa-integration.md` and `docs/09-runbooks/database-migrations.md` contain `GRANT ALL ON table_name TO authenticated` examples that contradict AGENTS.md least-privilege mandate.
- **Status**: Documentation issue
- **Action**:
    - [ ] Replace `GRANT ALL` with specific grants (e.g., `GRANT SELECT, INSERT ON table_name TO authenticated`)
    - [ ] Add note about least-privilege principle
    - [ ] Update both runbook files
- **Severity**: Medium (security guidance accuracy)

---

## Section 4: Documentation Cleanup (16 tasks)

### 4.1 ☐ DOC-001: Remove obsolete files (7 files)

- **Files to delete**:
    - [ ] `CI_Failures.md` — raw CI log dump, no structure
    - [ ] `CONTEXT.md` — unedited AI chat transcript, superseded
    - [ ] `AI_Engineering.md` — generic methodology, duplicates AGENTS.md
    - [ ] `IMPLEMENTATION_TASKS.md` — all tasks completed 2026-03-23
    - [ ] `docs/07-audits/archive/git-cicd-audit-report.md` — archived, all resolved
    - [ ] `docs/07-audits/archive/feature-tasks-audit-report.md` — archived, superseded
    - [ ] `docs/07-audits/archive/database-supabase-best-practices-audit.md` — archived, superseded
    - [ ] `docs/07-audits/archive/codebase-skills-audit-report.md` — archived, all resolved
    - [ ] `docs/REMAINING_FEATURE_TASKS.md` — corrupted file with garbage characters
    - [ ] `docs/p2-lazy-load-threejs-components.md` — investigation complete, no 3D components exist

### 4.2 ☐ DOC-002: Consolidate duplicated documentation (6 pairs)

- [ ] Merge `docs/02-security/privacy-policy.md` into `docs/02-security/data-privacy.md` (70% duplication; keep internal+public sections in one doc)
- [ ] Merge `docs/05-infrastructure/monitoring/api-reliability-dashboard.md` into `docs/05-infrastructure/monitoring/monitoring-dashboards.md`
- [ ] Merge `docs/implementation/erca-integration.md` into `docs/09-runbooks/erca-integration.md` (keep runbook as canonical)
- [ ] Merge `docs/implementation/performance-slo-validation.md` into `docs/implementation/load-testing.md`
- [ ] Merge or delete `docs/1. Engineering Foundation/1. PRD.md` (duplicates `docs/01-foundation/product-requirements.md`)
- [ ] Archive 5 resolved audit reports from `docs/07-audits/` to `docs/07-audits/archive/`

### 4.3 ☐ DOC-003: Reorganize misfiled documents

- [ ] Move `docs/08-runbooks/backup-and-restore.md` to `docs/09-runbooks/backup-and-restore.md`
- [ ] Restructure `docs/01-foundation/payments-direction.md/Direction.md` — move to `docs/01-foundation/payments-direction.md` (remove nested directory)
- [ ] Update `docs/README.md` to reflect actual directory structure (add `implementation/`, `api/`, remove non-existent `1. Engineering Foundation/`)

### 4.4 ☐ DOC-004: Fix root-level documentation inaccuracies

- [ ] `README.md`: Verify/update tech stack versions (Next.js 16?), fix broken links, align brand with Lole decision
- [ ] `terraform/README.md`: Replace placeholder clone URL (`your-org/lole.git`), fix Next.js version, resolve MIT vs Proprietary license conflict
- [ ] `LOLE_DESIGN_SYSTEM_FOUNDATION.md`: Replace absolute Windows file paths with relative paths
- [ ] `DASHBOARD.md`: Add implementation status annotations to each recommendation

### 4.5 ☐ DOC-005: Fix documentation cross-references

- [ ] Fix AGENTS.md broken path (see task 2.18)
- [ ] Fix phantom health endpoint references (see task 2.17)
- [ ] Fix `docs/08-reports/connection-pooling.md` dead link to `health-check-api.md`
- [ ] Fix `docs/09-runbooks/payment-gateway-outages.md` cross-reference to `engineering-runbook.md` path
- [ ] Add markdown link checker to CI pipeline

### 4.6 ☐ DOC-006: Restructure architecture.md (2,190 lines → ~500 lines)

- [ ] Extract Toast comparison matrix to `docs/03-product/toast-parity-matrix.md`
- [ ] Extract "12 Laws" to `docs/01-foundation/engineering-principles.md`
- [ ] Extract key files appendix to `docs/10-reference/codebase-map.md`
- [ ] Remove AI-prompt framing ("Feed this entire document to Claude Opus 4.6")
- [ ] Remove duplicated content already in `tech-stack.md`, `system-architecture.md`, `database-schema.md`, `api-design.md`, `security-policy.md`
- [ ] Keep architecture.md as a high-level overview (~500 lines) with links to specialized docs

---

## Section 5: Feature Implementation Status Matrix

Based on codebase verification against documented requirements.

| Feature                | PRD Priority | Implementation Status | Evidence                                                                 | Gap                                       |
| ---------------------- | ------------ | --------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| Waiter POS             | P0           | ✅ Implemented        | `src/app/(pos)/waiter/page.tsx` (1025 lines)                             | Split-check UI missing                    |
| KDS Display            | P0           | ✅ Implemented        | `src/app/(kds)/kds/StationBoard.tsx`                                     | PowerSync vs Dexie unclear                |
| Guest QR Ordering      | P0           | ✅ Implemented        | `src/app/(guest)/[slug]/` routes                                         | —                                         |
| Merchant Dashboard     | P0           | ✅ Implemented        | `src/app/(dashboard)/` routes                                            | —                                         |
| ERCA VAT Compliance    | P0           | ✅ Implemented        | `src/lib/fiscal/erca-service.ts` (662 lines)                             | Stub mode when API unconfigured           |
| Payment — Chapa        | P0           | ✅ Implemented        | `src/lib/payments/webhooks.ts`, `src/lib/services/chapaService.ts`       | —                                         |
| Payment — Telebirr     | P0           | ✅ Implemented        | `src/lib/payments/telebirr.ts`, `src/app/api/webhooks/telebirr/route.ts` | Scope decision needed                     |
| Split Check            | P0           | ⚠️ Partial            | DB schema exists, no UI                                                  | **UI implementation needed**              |
| Offline Mode           | P0           | ⚠️ Partial            | IndexedDB queue + PowerSync scaffold                                     | PowerSync packages not confirmed          |
| Push Notifications     | P1           | ⚠️ Partial            | Queue/SMS/retry done                                                     | Push delivery logged as "not implemented" |
| Feature Flags (Tier 2) | P1           | ❌ Missing            | Only env-var flags exist                                                 | Database-backed flags not built           |
| Cursor Pagination      | P1           | ⚠️ Partial            | KDS has it; orders API does not                                          | Orders API needs cursor pagination        |
| Connection Pooling     | P1           | ⚠️ Partial            | Config modules exist                                                     | Not wired into client initialization      |
| Course Firing          | P1           | ✅ Implemented        | `StationBoard.tsx` — `handleAdvanceCourse`                               | —                                         |
| Printer Fallback       | P1           | ✅ Implemented        | `src/lib/sync/printerFallback.ts`                                        | —                                         |
| Guest Loyalty          | P2           | ⚠️ Partial            | DB tables exist                                                          | Service layer not confirmed               |
| Delivery Partners      | P2           | ✅ Spec'd             | `docs/06-integrations/delivery-partners.md`                              | Forward-looking spec, not yet built       |
| Developer API          | P2           | ✅ Spec'd             | `docs/06-integrations/developer-api.md`                                  | Forward-looking spec, not yet built       |
| GraphQL Federation     | P2           | ✅ Implemented        | 5 subgraph routes + Apollo Router                                        | Main endpoint disabled by design          |
| Realtime Sync          | P0           | ✅ Implemented        | `useKDSRealtime`, PowerSync config                                       | Reconnection logic missing                |
| Rate Limiting          | P0           | ✅ Implemented        | Redis-backed + in-memory fallback                                        | Per-restaurant keying missing             |
| CSRF Protection        | P0           | ⚠️ Partial            | 3/4 Server Actions covered                                               | Login action unprotected                  |
| CSP Headers            | P0           | ✅ Implemented        | Nonce-based CSP in middleware                                            | —                                         |
| Security Invoker Views | P0           | ✅ Resolved           | All 7 views have `security_invoker=on`                                   | —                                         |
| RLS Policies           | P0           | ⚠️ Partial            | Dangerous policies fixed                                                 | Redundant service_role policies remain    |
| Data Retention         | P1           | ❌ Missing            | Policy defined; automation missing                                       | 6 policies need implementation            |
| External Pentest       | P3           | ❌ Pending            | Planning doc exists                                                      | Vendor engagement + budget needed         |
| Amharic i18n           | P0           | ⚠️ Partial            | ~60-65% coverage                                                         | ~35% keys missing; hardcoded strings      |

---

## Section 6: Resolved Audit Findings (for reference)

These findings have been verified as resolved through codebase inspection. Listed for traceability.

| Finding                                    | Severity | Resolution  | Evidence                                                        |
| ------------------------------------------ | -------- | ----------- | --------------------------------------------------------------- |
| Exposed `auth.users` in public view        | Critical | ✅ Resolved | Migration `20260408100000` drops the view                       |
| Open redirect vulnerability                | Critical | ✅ Resolved | Origin validation implemented                                   |
| E2E test auth bypass in production         | Critical | ✅ Resolved | Conditional header check; disabled in production                |
| PowerSync sync worker placeholder          | Critical | ✅ Resolved | `syncWorker.ts` — full implementation                           |
| `security_invoker` missing on views        | High     | ✅ Resolved | All 7 views have `security_invoker=on`                          |
| 19 missing migrations from version control | High     | ✅ Resolved | Reconciliation migration created; CI drift check active         |
| N+1 query patterns                         | High     | ✅ Resolved | 12 DataLoaders with tenant isolation                            |
| Missing DataLoaders                        | High     | ✅ Resolved | 12 DataLoaders covering all entity types                        |
| CORS wildcard                              | High     | ✅ Resolved | Restricted to specific origins                                  |
| In-memory rate limiting                    | High     | ✅ Resolved | Redis-backed with in-memory fallback                            |
| Missing GraphQL introspection control      | High     | ✅ Resolved | Disabled in production with env override                        |
| 300+ `any` types                           | High     | ✅ Resolved | TypeScript strict mode + ESLint enforcement                     |
| Missing CSP headers                        | High     | ✅ Resolved | Nonce-based CSP in middleware                                   |
| Service role key audit logging             | High     | ✅ Resolved | Security event logging implemented                              |
| Missing health check endpoints             | High     | ✅ Resolved | `/health`, `/health/live`, `/health/ready`                      |
| Missing rollback automation                | Medium   | ✅ Resolved | Rollback procedures + enhanced rollback docs                    |
| Duplicate Vercel regions                   | Critical | ✅ Resolved | vercel.json fixed                                               |
| Missing `loading.tsx` files                | Medium   | ✅ Resolved | Added to key routes                                             |
| Touch target below 44px                    | High     | ✅ Resolved | Button component enforced                                       |
| `prefers-reduced-motion`                   | High     | ✅ Resolved | Hook implemented                                                |
| Migration drift                            | High     | ✅ Resolved | 147 migrations; CI drift check workflow                         |
| Sync conflict resolution                   | High     | ✅ Resolved | 4 strategies (last-write-wins, server-wins, client-wins, merge) |

---

## Section 7: Pre-Production Go/No-Go Checklist

Every item must be ✅ before production traffic is allowed.

### Security

- [ ] CRIT-002: All permissive RLS policies audited and documented
- [ ] CRIT-007: Leaked password protection enabled in Supabase Dashboard
- [ ] CSRF-001: All Server Actions have `verifyOrigin()` (currently 3/4)
- [ ] SEC-001: All webhook endpoints have HMAC/signature verification
- [ ] SEC-002: PIN brute force rate limiting implemented
- [ ] No `auth.users` exposed in public schema (verified ✅)
- [ ] All views have `security_invoker=on` (verified ✅)
- [ ] CSP headers applied (verified ✅)
- [ ] GraphQL introspection disabled in production (verified ✅)

### Data & Compliance

- [ ] DATA-001: `daily_sales` retention extended to 7 years
- [ ] DATA-002: Guest fingerprint anonymization automated (90 days)
- [ ] DATA-003: Order archival pipeline operational (2 years)
- [ ] ERCA VAT compliance functional (verified ✅)

### Operational Readiness

- [ ] CONN-001: Connection pooling wired into Supabase client
- [ ] NOTIF-001: Push notification delivery operational
- [ ] Rollback procedures tested (verified ✅)
- [ ] Incident response plan reviewed (verified ✅)
- [ ] Health check endpoints functional (verified ✅)

### Accessibility

- [ ] A11Y-001: `aria-live` regions for dynamic content
- [ ] A11Y-002: All icon-only buttons have `aria-label`
- [ ] A11Y-003: KDS fully keyboard-accessible
- [ ] A11Y-004: Color contrast meets WCAG 2.1 AA

### Localization

- [ ] I18N-001: Amharic coverage ≥ 90%
- [ ] I18N-002: No hardcoded English in KDS/Payment/Order status

### Documentation

- [ ] AGENTS-PATH-001: All AGENTS.md paths verified
- [ ] SECURITY-DOC-001: All runbook endpoint references correct
- [ ] Risk register updated with current status

---

## Section 8: Post-Production / P2+ Tasks

These are important but do not block production launch.

- [ ] PENTEST-001: Engage external penetration testing vendor (budget: $15K-$40K)
- [ ] FEE-002: Implement target pricing tables (`pricing_plans`, `restaurant_pricing_assignments`)
- [ ] GRAPHQL-002: Implement persisted queries / query whitelisting
- [ ] DARK-MODE-001: Implement dark mode tokens (documented as accepted risk)
- [ ] CONTAINER-QUERY-001: Add container queries for responsive components
- [ ] ADR-001: Create Architecture Decision Records for key decisions
- [ ] MONITOR-002: Add Grafana/Prometheus monitoring stack (currently Sentry + Axiom)
- [ ] LOYALTY-001: Build guest loyalty service layer
- [ ] DELIVERY-001: Build delivery partner integrations
- [ ] API-VERSION-001: Implement API versioning strategy
- [ ] BUNDLE-001: Add bundle analyzer to CI pipeline
- [ ] JSDOC-001: Add JSDoc to all service layer functions
- [ ] DB-DOC-001: Auto-generate database-erd.md from live schema
- [ ] BRAND-001: Complete Lole rebrand or revert to lole across all docs
- [ ] CODEOWNERS-001: Replace `docs/10-reference/owners.md` with CODEOWNERS file
- [ ] CI-I18N-001: Add i18n completeness check to CI pipeline
- [ ] CI-LINK-001: Add markdown link checker to CI pipeline
- [ ] CI-DOC-001: Add documentation freshness check to CI (flag docs older than 90 days without review)

---

## Section 9: Task Summary & Priority Matrix

| Priority                   | Count               | Description                                                     |
| -------------------------- | ------------------- | --------------------------------------------------------------- |
| **P0 — Critical Blockers** | 6                   | Must fix before any production traffic (Section 1)              |
| **P1 — High Priority**     | 18                  | Must fix before general availability (Section 2)                |
| **P2 — Medium Priority**   | 15                  | Should fix within 30 days of launch (Section 3)                 |
| **P3 — Documentation**     | 16                  | Documentation cleanup and consolidation (Section 4)             |
| **P4 — Post-Production**   | 18                  | Post-launch improvements (Section 8)                            |
| **Total**                  | **73 action items** | Plus 22 verified-resolved findings for traceability (Section 6) |

### Estimated Effort

| Priority           | Estimated Effort     | Recommended Timeline           |
| ------------------ | -------------------- | ------------------------------ |
| P0 Critical        | 3-5 developer-days   | Before production launch       |
| P1 High            | 10-15 developer-days | Week 1-2 post-launch           |
| P2 Medium          | 8-10 developer-days  | Month 1                        |
| P3 Documentation   | 5-7 developer-days   | Month 1 (can parallel with P2) |
| P4 Post-Production | Ongoing              | Quarter 2+                     |

---

_This document is the single source of truth for all pre-production tasks. Update task status with `[x]` as items are completed. When all P0 and P1 items are resolved, the platform is ready for general availability._

---

## Department Gap Analysis Completion Status (2026-05-08)

All 23 departments have completed their gap analysis and reports are available in `.col/departments/`:

| Department          | Report Status | Priority Gaps                           |
| ------------------- | ------------- | --------------------------------------- |
| core-runtime        | ✅ Complete   | MQTT auth, circuit breaker              |
| mobile-native       | ✅ Complete   | Android build, plugin tests             |
| sync-persistence    | ✅ Complete   | PowerSync config, SQLCipher             |
| frontend-arch       | ✅ Complete   | Component tests                         |
| backend-infra       | ✅ Complete   | RLS remediation, persisted queries      |
| cybersecurity       | ✅ Complete   | RLS fixes, SQLCipher, PIN rate limiting |
| fiscal-compliance   | ✅ Complete   | daily_sales retention                   |
| data-privacy-audit  | ✅ Complete   | Retention automation                    |
| pos-ux              | ✅ Complete   | Split-check UI, aria-live               |
| merchant-dash       | ✅ Complete   | Component tests                         |
| guest-exp           | ✅ Complete   | Amharic translation                     |
| systems-design      | ✅ Complete   | Color contrast                          |
| devops-sre          | ✅ Complete   | WAF, doc updates                        |
| fleet-mgmt          | ✅ Complete   | OTA updates                             |
| hardware-ops        | ✅ Complete   | Cash drawer testing                     |
| data-engineering    | ✅ Complete   | JSONB indexes, RLS indexes              |
| strategic-analytics | ✅ Complete   | Forecasting validation                  |
| ai-orchestration    | ✅ Complete   | Agent skills, MCP servers               |
| growth-engineering  | ✅ Complete   | Conversion tracking                     |
| product-marketing   | ✅ Complete   | Competitive positioning                 |
| content-docs        | ✅ Complete   | Obsolete files removal                  |
| merchant-success    | ✅ Complete   | Satisfaction tracking                   |
| billing-finance     | ✅ Complete   | Fee model verification                  |

**Executive Summary**: See `.col/memory/reports/executive-summary-q2-2026.md`
