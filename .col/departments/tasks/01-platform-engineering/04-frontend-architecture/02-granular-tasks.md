# 04 — Frontend Architecture: Granular Tasks

**Date:** 2026-05-03  
**Total Sprints:** 6  
**Total Tasks:** 33 (7 completed, 26 remaining)  
**Estimated Remaining Effort:** ~6 weeks

---

## Sprint 1: RSC Foundation + Route Protection 🔶 PARTIAL

**Goal:** Establish React Server Component baseline, implement edge-level auth, add not-found pages.  
**Status:** 3 of 7 tasks complete

| Task                                                     | Status | Notes                                                                                            |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| F1-T1 — Extract ClientProviders wrapper                  | ✅     | `src/components/providers/ClientProviders.tsx` created. Root layout now server component.        |
| F1-T2 — Implement middleware.ts for auth gating          | ✅     | `src/middleware.ts` created, wires existing `updateSession()`.                                   |
| F1-T3 — Create not-found pages                           | ✅     | 3 not-found pages: root, dashboard, guest slug.                                                  |
| F1-T4 — Convert marketing/public pages to RSC            | ⬜     | `src/app/(marketing)/login/page.tsx`, `(public)/accessibility/page.tsx` still client components. |
| F1-T5 — Partially SSR guest QR menu                      | ⬜     | `src/app/(guest)/[slug]/page.tsx` still full client.                                             |
| F1-T6 — Replace spinner loading.tsx with skeleton shells | ✅     | 24 files migrated to PageSkeleton. Covered by F2-T1 + F2-T2.                                     |
| F1-T7 — Pre/post Lighthouse audit                        | ⬜     | Needs running dev server.                                                                        |

---

## Sprint 2: Shared Component Library 🔶 PARTIAL

**Goal:** Standardized skeleton components, consistent loading UX, component catalog.  
**Status:** 2 of 6 tasks complete

| Task                                                     | Status | Notes                                                                      |
| -------------------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| F2-T1 — Create shared skeleton components                | ✅     | `src/components/ui/Skeletons.tsx` with Page, Chart, Table, Card skeletons. |
| F2-T2 — Migrate all Loader2 spinners to shared skeletons | ✅     | 24 loading.tsx migrated via task agent.                                    |
| F2-T3 — Create component catalog page                    | ⬜     | `/components` page not created.                                            |
| F2-T4 — Audit and document Zustand usage                 | ⬜     | No audit done.                                                             |
| F2-T5 — Standardize prop patterns on UI components       | ⬜     | size/variant props not added.                                              |
| F2-T6 — Extend visual regression test for components     | ⬜     | Snapshots not added.                                                       |

---

## Sprint 3: Error/Suspense Architecture 🔶 PARTIAL

**Goal:** Component-level fault isolation, instant layout shells, Sentry integration.  
**Status:** 1 of 5 tasks complete

| Task                                                   | Status | Notes                                                           |
| ------------------------------------------------------ | ------ | --------------------------------------------------------------- |
| F3-T1 — Per-tab error boundaries in merchant dashboard | ⬜     | 9 PageClient files not wrapped.                                 |
| F3-T2 — Layout-level Suspense boundaries               | ⬜     | Dashboard/KDS/POS layouts not updated.                          |
| F3-T3 — Create ErrorFallback shared component          | ✅     | `src/components/ui/ErrorFallback.tsx` with 3 severity variants. |
| F3-T4 — Global error boundary at root                  | ⬜     | ClientProviders not wrapped in ErrorBoundary.                   |
| F3-T5 — Sentry ErrorBoundary at critical surfaces      | ⬜     | POS/KDS/payment not wrapped.                                    |

---

## Sprint 4: Performance & Bundle Optimization ⬜

**Status:** Not started (0 of 6 tasks)

| Task                                      | Status |
| ----------------------------------------- | ------ |
| F4-T1 — Implement useReportWebVitals      | ⬜     |
| F4-T2 — Bundle analyzer in CI             | ⬜     |
| F4-T3 — Audit landing page dependencies   | ⬜     |
| F4-T4 — Lazy-load heavy dashboard tabs    | ⬜     |
| F4-T5 — prefetch=false on rare links      | ⬜     |
| F4-T6 — Enable Partial Prerendering (PPR) | ⬜     |

---

## Sprint 5: Design System Hardening 🔶 PARTIAL

**Status:** 1 of 5 tasks complete

| Task                                                | Status | Notes                                                           |
| --------------------------------------------------- | ------ | --------------------------------------------------------------- |
| F5-T1 — Verify style-dictionary token consumption   | ⬜     |                                                                 |
| F5-T2 — Migrate inline styles to Tailwind           | ⬜     |                                                                 |
| F5-T3 — Add CI a11y contrast check                  | ⬜     |                                                                 |
| F5-T4 — Create AmharicText component                | ⬜     |                                                                 |
| F5-T5 — Remove e2e_bypass_auth from production code | ✅     | Environment-gated with NODE_ENV check. Bypass only in dev/test. |

---

## Sprint 6: Developer Experience ⬜

**Status:** Not started (0 of 4 tasks)

| Task                                                        | Status |
| ----------------------------------------------------------- | ------ |
| F6-T1 — Route group READMEs                                 | ⬜     |
| F6-T2 — Architecture Decision Record                        | ⬜     |
| F6-T3 — Lint rule for 'use client' in server-eligible files | ⬜     |
| F6-T4 — JSDoc prop documentation on all UI components       | ⬜     |

---

## Task Summary

| Sprint    | Tasks  | Completed           | Remaining | Priority |
| --------- | ------ | ------------------- | --------- | -------- |
| F1        | 7      | **4** (T1,T2,T3,T6) | 3         | P0       |
| F2        | 6      | **2** (T1,T2)       | 4         | P1       |
| F3        | 5      | **1** (T3)          | 4         | P1       |
| F4        | 6      | 0                   | 6         | P1       |
| F5        | 5      | **1** (T5)          | 4         | P2       |
| F6        | 4      | 0                   | 4         | P2       |
| **Total** | **33** | **8**               | **25**    |          |

---

## Findings Cross-Reference (Final)

| Finding                        | Status      | Sprint | Task              |
| ------------------------------ | ----------- | ------ | ----------------- |
| C1 — Zero RSC adoption         | 🔶 Partial  | F1     | T4, T5 remain     |
| C2 — No middleware auth        | ✅ Resolved | F1     | T2                |
| C3 — No not-found pages        | ✅ Resolved | F1     | T3                |
| H1 — Spinner-only loading      | ✅ Resolved | F2     | T1, T2            |
| H2 — Route-group only errors   | 🔶 Partial  | F3     | T1, T4, T5 remain |
| H3 — No component catalog      | ⬜ Open     | F2     | T3                |
| H4 — Zustand unclear           | ⬜ Open     | F2     | T4                |
| H5 — Token integration unclear | ⬜ Open     | F5     | T1                |
| M1 — Suspense in pages only    | ⬜ Open     | F3     | T2                |
| M2 — No RSC data fetching      | ⬜ Open     | F1     | T4, T5            |
| M3 — i18n incomplete           | ⬜ Open     | F5     | T4                |
| M4 — e2e auth bypass           | ✅ Resolved | F5     | T5                |
| M5 — No CWV tracking           | ⬜ Open     | F4     | T1                |
| M6 — Inconsistent loading      | ✅ Resolved | F2     | T1, T2            |
| L1-L6 — Various                | ⬜ Open     | F4-F6  | Various           |
