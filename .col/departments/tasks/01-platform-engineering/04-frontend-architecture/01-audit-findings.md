# 04 — Frontend Architecture: Audit Findings

**Date:** 2026-05-03  
**Auditor:** Autonomous Systems Architect (via Kilo)  
**Remediation:** Same day (in-session)  
**Scope:** ~95 components, 52 pages, 100 API routes, 9 route groups, 167 'use client' directives

---

## Remediation Status Legend

| Mark        | Meaning                     |
| ----------- | --------------------------- |
| ✅ RESOLVED | Finding fully addressed     |
| 🔶 PARTIAL  | Some work done, more needed |
| ⬜ OPEN     | Not yet addressed           |

---

## CRITICAL Findings

### C1 — Zero RSC Adoption 🔶 PARTIAL

Root `layout.tsx` converted to server component. `ClientProviders.tsx` wrapper extracts all client-side providers. **8 new files created.** 24 loading.tsx files now use shared skeleton components. Remaining: page-level RSC conversion for marketing/guest/dashboard pages.

**Resolved files:** `src/app/layout.tsx`, `src/components/providers/ClientProviders.tsx`
**Remaining:** 52 page.tsx files still use `'use client'`

### C2 — No Middleware for Route Protection ✅ RESOLVED

`src/middleware.ts` created. Wires existing `updateSession()` from `src/lib/supabase/middleware.ts`. Auth gating at edge: checks Supabase session cookie, redirects unauthenticated users from protected routes to `/auth/login`. Whitelist: `(guest)`, `(marketing)`, `(public)`, `/auth/*`, `/api/*`, `/`, `/offline`.

**File:** `src/middleware.ts`

### C3 — Zero not-found Pages ✅ RESOLVED

3 branded not-found pages created:

- `src/app/not-found.tsx` — Root: "Page Not Found" + Go Home / Sign In
- `src/app/(dashboard)/not-found.tsx` — Dashboard: "Back to Dashboard" link
- `src/app/(guest)/[slug]/not-found.tsx` — Guest: "Restaurant Not Found" + Visit Lole link

---

## HIGH Findings

### H1 — All Loading States Are Identical Spinners ✅ RESOLVED

4 shared skeleton components created at `src/components/ui/Skeletons.tsx`:

- `<PageSkeleton variant="pos|kds|dashboard|guest">` — 4 route-specific shell layouts
- `<ChartSkeleton>` — Chart placeholder with title + legend
- `<TableSkeleton rows={5} cols={4}>` — Table row placeholders
- `<CardSkeleton>` — Card block placeholder

All 24 `loading.tsx` files migrated from `<Loader2>` spinner to `<PageSkeleton>` with appropriate variant. Exported via `src/components/ui/index.ts`.

### H2 — Error Boundaries Only at Route-Group Level 🔶 PARTIAL

`ErrorFallback` shared component created at `src/components/ui/ErrorFallback.tsx` with:

- 3 severity variants (critical, warning, info)
- "Try Again" button calling `reset()`
- "Copy Error" button for support
- Error message display

**Remaining:** Per-tab error boundaries in 9 merchant dashboard tabs not yet wrapped. Layout-level Suspense not added. Sentry.ErrorBoundary not integrated at POS/KDS surfaces.

### H3 — Component Library Ad-Hoc ⬜ OPEN

No changes. Component catalog page, visual regression, JSDoc, Storybook still needed.

### H4 — Zustand Installed but Integration Unclear ⬜ OPEN

No changes. Audit needed.

### H5 — Design Token Integration Questionable ⬜ OPEN

No changes. style-dictionary integration verification needed.

---

## MEDIUM Findings

### M1 — Suspense Only in Pages ⬜ OPEN

No changes. Layout-level Suspense boundaries not added.

### M2 — No RSC Data-Fetching Pattern ⬜ OPEN

No changes. Server-side data fetching not yet implemented for any pages.

### M3 — i18n Foundation Incomplete ⬜ OPEN

No changes. Amharic component not created.

### M4 — ExpeditorBoard Uses localStorage Auth Bypass ✅ RESOLVED

`process.env.NODE_ENV !== 'production'` environment gate added to both `RoleGuard.tsx:20` and `ExpeditorBoard.tsx:173`. Bypass only active in dev/test environments. In production, `__e2e_bypass_auth` localStorage key is never checked.

**Files:** `src/components/auth/guards/RoleGuard.tsx`, `src/features/kds/components/ExpeditorBoard.tsx`

### M5 — No Core Web Vitals Instrumentation ⬜ OPEN

No changes. `useReportWebVitals` hook not yet implemented.

### M6 — Inconsistent Loading Patterns ✅ RESOLVED

All 24 `loading.tsx` files now use shared `<PageSkeleton>` component. Inline `<Loader2>` spinners replaced. Consistent loading UX across all route groups.

---

## LOW Findings

### L1 — CSS Approach Inconsistent ⬜ OPEN

### L2 — No Route Group Documentation ⬜ OPEN

### L3 — E2E Auth Bypass in Production ✅ RESOLVED (via M4 fix)

### L4 — Zod Validation Without Form Integration ⬜ OPEN

### L5 — No Bundle Size Budgets ⬜ OPEN

### L6 — 5 Animation Libraries on Landing Page ⬜ OPEN

---

## New Files Created

| File                                           | Purpose                      |
| ---------------------------------------------- | ---------------------------- |
| `src/components/providers/ClientProviders.tsx` | Client-side provider wrapper |
| `src/middleware.ts`                            | Auth gating at edge          |
| `src/app/not-found.tsx`                        | Branded 404 page             |
| `src/app/(dashboard)/not-found.tsx`            | Dashboard 404                |
| `src/app/(guest)/[slug]/not-found.tsx`         | Restaurant not found         |
| `src/components/ui/Skeletons.tsx`              | 4 shared skeleton components |
| `src/components/ui/ErrorFallback.tsx`          | Reusable error fallback      |

## Files Modified

| File                                             | Change                               |
| ------------------------------------------------ | ------------------------------------ |
| `src/app/layout.tsx`                             | Converted to server component        |
| `src/components/ui/index.ts`                     | Export new skeletons + ErrorFallback |
| `src/components/auth/guards/RoleGuard.tsx`       | Environment-gated e2e bypass         |
| `src/features/kds/components/ExpeditorBoard.tsx` | Environment-gated e2e bypass         |
| 24 `loading.tsx` files                           | Migrated to PageSkeleton             |

---

## Total Finding Count (After Remediation)

| Severity  | Original | Resolved   | Remaining             |
| --------- | -------- | ---------- | --------------------- |
| CRITICAL  | 3        | 2 (C2, C3) | 1 (C1 partial)        |
| HIGH      | 5        | 1 (H1)     | 4 (H2 partial, H3-H5) |
| MEDIUM    | 6        | 2 (M4, M6) | 4 (M1-M3, M5)         |
| LOW       | 6        | 1 (L3)     | 5 (L1-L2, L4-L6)      |
| **TOTAL** | **20**   | **6**      | **14**                |
