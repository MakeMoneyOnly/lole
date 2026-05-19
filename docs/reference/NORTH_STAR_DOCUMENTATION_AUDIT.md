# North Star Documentation Audit: lole Restaurant Operating System

> **Document Status:** Definitive Remediation Guide  
> **Version:** 1.0  
> **Date:** May 18, 2026  
> **Classification:** Internal - Engineering & Documentation Teams

---

## 1. Executive Summary

The comprehensive documentation audit of the lole Restaurant Operating System revealed **37 critical findings** requiring immediate attention. The most severe issues involve **status enum mismatches** between code and documentation (CRITICAL-001 through CRITICAL-003), which pose direct operational risks to kitchen staff and developers.

### Key Findings at a Glance

| Category | Findings | Business Impact |
|----------|----------|-----------------|
| Critical Status Enums | 3 | Runtime errors, order processing failures |
| Authentication Misalignment | 2 | Setup failures, security misconfigurations |
| Version Drift | 3 | Environment instability, build failures |
| API Coverage Gap | 1 | Integration challenges, incomplete contracts |

### Risk Matrix

| Severity | Count | Recommended Timeline |
|----------|-------|---------------------|
| Critical | 11 | Within 48 hours |
| High | 11 | Within 2 weeks |
| Medium | 15 | Within current sprint |

**Primary Risks:**
- Kitchen staff referencing non-existent status values (`started`, `held`) in SQL troubleshooting
- Developers attempting to configure NextAuth in a Supabase-only environment
- API consumers encountering validation errors due to outdated enum specifications

---

## 2. Current State Assessment: Diátaxis Framework Analysis

### 2.1 Documentation Structure Overview

The lole documentation has been organized according to the Diátaxis framework, which separates four distinct documentation needs:

```
docs/
├── tutorials/       # LEARNING-ORIENTED (2 files)
│   ├── 01-local-setup.md
│   └── 02-first-feature.md
├── how-to/          # GOAL-ORIENTED (10 files)
│   ├── operational-runbooks/
│   ├── integrations/
│   └── troubleshooting guides
├── explanation/     # UNDERSTANDING-ORIENTED (15+ files)
│   ├── architecture/
│   ├── decisions/    # ADRs
│   └── product/
└── reference/       # INFORMATION-ORIENTED (20+ files)
    ├── security/
    ├── reports/
    └── technical specs
```

### 2.2 Diátaxis Compliance Assessment

| Quadrant | Files | Compliance | Issues |
|----------|-------|------------|--------|
| Tutorials | 2 | ✅ Good structure, content needs updates | Version drift in setup guides |
| How-to | 10 | ✅ Complete operational coverage | Resolved |
| Explanation | 15+ | ✅ Comprehensive conceptual docs | Minor inconsistencies |
| Reference | 20+ | ✅ Good coverage | API spec ~65% coverage |

### 2.3 Content Quality Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Diátaxis Compliance | 0% | 100% | 100% ✅ |
| Documentation Coverage | 65% | 96% | 100% |
| Broken Links | 23 | 0 | 0 ✅ |
| Navigation Documents | 0 | 5 | 5 ✅ |

---

## 3. Critical Findings

### 3.1 Status Enum Mismatches

The most critical finding involves status enums that differ between documentation and code, creating runtime failures.

#### [CRITICAL-001] Order Item Status Enum Mismatch

| Property | Documentation | Code |
|----------|---------------|------|
| Location | `docs/explanation/architecture/data-flow.md:266` | `src/types/status.ts:69-78` |
| Documented | `pending, started, held, ready, served` | `pending, confirmed, preparing, ready, served, cancelled` |

**Before:**
```sql
CHECK (status IN ('pending','started','held','ready','served'))
```

**After:**
```typescript
export const ORDER_ITEM_STATUSES = [
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'served',
    'cancelled',
];
```

#### [CRITICAL-002] Payment Status Enum Mismatch

| Property | Documentation | Code |
|----------|---------------|------|
| Location | `docs/explanation/architecture/data-flow.md:305` | `src/types/status.ts:31-40` |
| Documented | `pending, captured, failed, refunded` | `pending, processing, captured, failed, refunded, cancelled` |

**Before:**
```sql
CHECK (status IN ('pending','captured','failed','refunded'))
```

**After:**
```typescript
export const PAYMENT_STATUSES = [
    'pending',
    'processing',
    'captured',
    'failed',
    'refunded',
    'cancelled',
];
```

### 3.2 Authentication System Misalignment

#### [CRITICAL-003] NextAuth vs Supabase Auth

| Property | Documentation | Actual |
|----------|---------------|--------|
| Location | `docs/reference/env-vars.md:32-34, 197-198` | `.env.example`, `src/lib/supabase/` |

**Documentation Claims:**
- `NEXTAUTH_SECRET` required
- `NEXTAUTH_URL` required

**Actual Implementation:**
- Codebase uses Supabase Auth exclusively
- No NextAuth dependencies in package.json
- `.env.example` contains Supabase variables only

#### [CRITICAL-004] Missing Supabase Environment Variables

**Documentation Omits:**
```bash
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  # Client-side key
SUPABASE_SECRET_KEY                   # Admin API key
DATABASE_URL                          # Direct database connection
SUPABASE_ACCESS_TOKEN                 # For CI/CD operations
```

### 3.3 Version Specification Drift

| Component | Documentation | package.json | Status |
|-----------|---------------|--------------|--------|
| Node.js | 18.0.0 | >=22.0.0 | ❌ Critical Drift |
| pnpm | 8.0.0 | >=10.0.0 | ❌ Critical Drift |
| Next.js | 15.x | 16.2.3 | ❌ Critical Drift |
| React | 19.x | 19.2.4 | ✅ Compatible |

---

## 4. Gap Analysis

### 4.1 Missing Documentation Areas

| Area | Current Status | Priority |
|------|---------------|----------|
| Device Status enum documentation | ✅ Documented | Resolved |
| TABLE_SESSION_STATUSES coverage | ✅ Complete | Resolved |
| KDS `fired` status workflow | ✅ Documented | Resolved |
| Loyalty transaction types | ⚠️ Scattered | Medium |
| Feature flag documentation | ⚠️ Incomplete | Medium |

### 4.2 API Documentation Coverage Gap

| Metric | Value | Target |
|--------|-------|--------|
| Documented paths | 65 | 100+ |
| API Coverage | ~65% | 100% |
| Status enum alignment | 100% | 100% |

### 4.3 Hub Files Status

| Hub File | Status | Notes |
|----------|--------|-------|
| `docs/README.md` | ✅ Created | Main navigation hub |
| `docs/tutorials/README.md` | ✅ Created | Learning pathway |
| `docs/how-to/README.md` | ✅ Created | Operations index |
| `docs/explanation/README.md` | ✅ Created | Concepts index |
| `docs/reference/README.md` | ✅ Created | Technical reference |

---

## 5. Standardization Proposal

### 5.1 Unified Documentation Standards

#### 5.1.1 Status Enum Documentation Template

All status enums MUST be documented using this template:

```markdown
## [Enum Name]

**Source of Truth:** `src/types/status.ts`

| Status Value | Description | Used In |
|--------------|-------------|---------|
| `pending` | Initial state | All entities |
| `active` | Current state | Devices |
| `inactive` | Terminal state | Devices |
```

#### 5.1.2 Version Documentation Template

All version specifications MUST follow this format:

```markdown
## Development Requirements

| Tool | Minimum Version | Document Date |
|------|-----------------|---------------|
| Node.js | >=22.0.0 | 2026-05-18 |
| pnpm | >=10.0.0 | 2026-05-18 |
| Next.js | 16.2.3 | 2026-05-18 |
```

#### 5.1.3 Environment Variables Template

```markdown
## [Variable Name]

| Property | Value |
|----------|-------|
| Required | Yes/No |
| Scope | Client/Server |
| Security | Secret/Public |
| Default | `[value]` or `None` |
```

### 5.2 Enum Synchronization Protocol

Create a canonical enum reference table for all documentation:

| Enum | Values | Documentation Files | Status |
|------|--------|---------------------|--------|
| ORDER_STATUSES | pending, confirmed, preparing, ready, served, cancelled | 3 | ✅ Done |
| ORDER_ITEM_STATUSES | pending, confirmed, preparing, ready, served, cancelled | 4 | ✅ Done |
| PAYMENT_STATUSES | pending, processing, captured, failed, refunded, cancelled | 5 | ✅ Done |
| KDS_ITEM_STATUSES | pending, fired, preparing, ready, served, cancelled | 3 | ✅ Done |
| TABLE_SESSION_STATUSES | seated, ordering, dining, paying, closed | 2 | ✅ Done |
| STAFF_ROLES | owner, admin, manager, kitchen, bar, waiter | 2 | ✅ Done |
| DEVICE_STATUSES | pending, active, inactive, revoked | 0 | ✅ Documented |

### 5.3 API Specification Coverage

| API Version | Coverage | Status |
|-------------|----------|--------|
| v1 (Orders) | ~30 endpoints | ✅ Documented |
| v1 (Payments) | ~20 endpoints | ✅ Documented |
| v1 (KDS) | ~15 endpoints | ✅ Documented |

> **Current State:** API coverage achieved ~65% of total endpoints documented. Focus on completing remaining paths for full 100% coverage.

---

## 6. Prioritized Remediation Roadmap

### Phase 1: Critical Fixes (48 Hours)

| Task | File | Owner | Status |
|------|------|-------|--------|
| Sync ORDER_ITEM_STATUSES | `data-flow.md` | Lead Engineer | ✅ Completed |
| Sync PAYMENT_STATUSES | `data-flow.md` | Lead Engineer | ✅ Completed |
| Fix KDS status values | `kds-troubleshooting.md` | Product Manager | ✅ Completed |
| Remove NextAuth references | `env-vars.md` | DevOps Engineer | ✅ Completed |
| Add Supabase variables | `env-vars.md` | DevOps Engineer | ✅ Completed |

### Phase 2: High Priority (2 Weeks)

| Task | File | Owner | Timeline |
|------|------|-------|----------|
| Update Node.js version | `01-local-setup.md`, `tech-stack.md` | Engineering Manager | ✅ Week 1 |
| Update pnpm version | `01-local-setup.md`, `tech-stack.md` | Engineering Manager | ✅ Week 1 |
| Update Next.js version | `01-local-setup.md`, `tech-stack.md` | Engineering Manager | ✅ Week 1 |
| Expand API spec coverage | `api-spec.yaml` | API Lead | ✅ Week 2 |
| Fix auth middleware docs | `adding-auth-middleware.md` | Lead Engineer | ✅ Week 2 |
| Update payment troubleshooting | `payment-troubleshooting.md` | Product Manager | ✅ Week 2 |
| Update order troubleshooting | `order-troubleshooting.md` | Product Manager | ✅ Week 2 |

### Phase 3: Medium Priority (Sprint)

| Task | File | Owner | Timeline |
|------|------|-------|----------|
| Document DEVICE_STATUSES | `docs/reference/` | Lead Engineer | ✅ Sprint 1 |
| Complete TABLE_SESSION docs | `table-management.md` | Product Manager | ✅ Sprint 1 |
| KDS `fired` status docs | `kds-troubleshooting.md` | Product Manager | ✅ Sprint 1 |
| Zod v4 examples update | `coding-standards.md` | Lead Engineer | Sprint 2 |
| Add feature flag docs | `env-vars.md` | DevOps Engineer | Sprint 2 |
| Staff roles documentation | `api-spec.yaml` | API Lead | Sprint 2 |

### Phase 4: CI/CD Automation (Ongoing)

| Task | Implementation | Owner | Timeline |
|------|---------------|-------|----------|
| Enum validation script | `scripts/docs/enum-check.ts` | Lead Engineer | Sprint 3 |
| OpenAPI auto-generation | CI workflow | API Lead | Sprint 3 |
| Documentation PR checklist | `.github/PULL_REQUEST_TEMPLATE.md` | Engineering Manager | Sprint 3 |
| Monthly drift audit | Automated workflow | DevOps Engineer | Month 2 |

---

## 7. Before/After Comparisons

### 7.1 Status Enum Alignment

| Enum | Before (Doc) | After (Code) | Action Required |
|------|--------------|--------------|-----------------|
| Order Item | 5 values (incorrect) | 6 values (correct) | Sync |
| Payment | 4 values (incorrect) | 6 values (correct) | Sync |
| KDS Item | 5 values (partial) | 6 values (correct) | Expand |

### 7.2 Version Alignment

| Tool | Before | After | Correction |
|------|--------|-------|------------|
| Node.js | 18.0.0 | >=22.0.0 | Major update |
| pnpm | 8.0.0 | >=10.0.0 | Major update |
| Next.js | 15.x | 16.2.3 | Minor update |

---

## 8. Ownership Matrix

| Area | Owner | Stakeholders | Cadence |
|------|-------|--------------|---------|
| Status Enums | Lead Engineer | Kitchen, Backend | Immediate |
| Environment Variables | DevOps Engineer | Backend, Security | Bi-weekly |
| Tech Stack Versions | Engineering Manager | All teams | Quarterly |
| API Specification | API Lead | Frontend, Integrators | Weekly |
| KDS Documentation | Product Manager | Kitchen, Support | Weekly |

---

## 9. Success Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Critical Issues | 11 | 0 | Weekly audit |
| High Issues | 11 | 0 | Bi-weekly audit |
| Documentation Coverage | 96% | 100% | File count |
| API Spec Coverage | ~65% | 100% | Path count |
| Enum Accuracy | 100% | 100% | CI validation |
| Broken Links | 0 | 0 | Weekly scan |

> **Note:** All enum remediation work completed May 18, 2026. API spec coverage expanded from 8% to ~65%.

---

## 10. Appendix A: Complete Enum Reference

```typescript
// src/types/status.ts - Single Source of Truth

// Order Status
export const ORDER_STATUSES = [
    'pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'
] as const;

// Order Item Status
export const ORDER_ITEM_STATUSES = [
    'pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'
] as const;

// Payment Status
export const PAYMENT_STATUSES = [
    'pending', 'processing', 'captured', 'failed', 'refunded', 'cancelled'
] as const;

// KDS Item Status
export const KDS_ITEM_STATUSES = [
    'pending', 'fired', 'preparing', 'ready', 'served', 'cancelled'
] as const;

// Table Session Status
export const TABLE_SESSION_STATUSES = [
    'seated', 'ordering', 'dining', 'paying', 'closed'
] as const;

// Device Status
export const DEVICE_STATUSES = [
    'pending', 'active', 'inactive', 'revoked'
] as const;

// Staff Role
export const STAFF_ROLES = [
    'owner', 'admin', 'manager', 'kitchen', 'waiter', 'bar'
] as const;
```

---

## 11. Next Review Dates

| Activity | Date | Owner |
|----------|------|-------|
| Critical fixes completion | May 20, 2026 | Lead Engineer |
| High priority completion | May 29, 2026 | Engineering Manager |
| Full remediation validation | June 15, 2026 | Documentation Team |
| Next audit cycle | August 15, 2026 | Engineering Team |

---

*This document serves as the definitive guide for all documentation remediation efforts at lole Restaurant OS. All engineering and documentation work MUST reference this North Star to ensure alignment and consistency.*