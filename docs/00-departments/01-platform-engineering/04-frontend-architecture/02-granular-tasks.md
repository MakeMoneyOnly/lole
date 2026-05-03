# Granular Tasks: Frontend Architecture Remediation

**Functional Unit:** Frontend Architecture  
**Department:** Platform Engineering  
**Document Version:** 1.0  
**Date:** 2026-05-02

---

## Phase 1: Critical Issues (P0 - 2-4 weeks)

### Task 1.1: Consolidate Cart State Management (CRITICAL)

**Priority:** P0  
**Estimated Effort:** 2-3 weeks  
**Assignee:** Frontend Lead  
**Dependencies:** None

#### Sub-tasks:

1. [ ] Audit current CartContext usage across codebase
2. [ ] Audit current Zustand cart-store usage
3. [ ] Choose Zustand as primary (document rationale)
4. [ ] Migrate CartContext consumers to useCartStore
5. [ ] Update cart types to be consistent
6. [ ] Remove CartContext.tsx
7. [ ] Update all imports
8. [ ] Add migration guide to README

#### Success Criteria:

- Single source of truth for cart state
- All cart functionality preserved
- No double-persistence issues

---

### Task 1.2: Implement Bundle Splitting (HIGH)

**Priority:** P0  
**Estimated Effort:** 1-2 weeks  
**Assignee:** Frontend Engineer  
**Dependencies:** None

#### Sub-tasks:

1. [x] Identify heavy components (charts, modals, complex forms) - DONE: RevenueChart, SalesPerformanceChart already use dynamic imports
2. [ ] Audit remaining components for dynamic import opportunities
3. [ ] Add next/dynamic for identified components (VisitHeatmap, MenuGridEditor, etc.)
4. [ ] Add loading states for dynamically loaded components
5. [ ] Verify SSR behavior for each dynamic import
6. [ ] Run bundle analyzer to measure improvement

#### Components Status:

- [x] RevenueChart - Already uses next/dynamic
- [x] SalesPerformanceChart - Already uses next/dynamic
- [ ] VisitHeatmap - Needs investigation
- [ ] MenuGridEditor - Needs investigation

---

### Task 1.3: Fix Unnecessary Re-renders (HIGH)

**Priority:** P0  
**Estimated Effort:** 2 weeks  
**Assignee:** Frontend Engineer  
**Dependencies:** None

#### Sub-tasks:

1. [ ] Audit components with React DevTools Profiler
2. [ ] Add React.memo to pure components
3. [ ] Add useMemo for expensive calculations
4. [ ] Add useCallback for stable function references
5. [ ] Verify performance improvements

---

## Phase 2: High Priority (P1 - 4-6 weeks)

### Task 2.1: Standardize App Router Patterns (HIGH)

**Priority:** P1  
**Estimated Effort:** 2-3 weeks  
**Assignee:** Frontend Lead  
**Dependencies:** None

#### Sub-tasks:

1. [ ] Document standard route group structure
2. [ ] Create layout.tsx template for new route groups
3. [ ] Add loading.tsx to all route groups
4. [ ] Add error.tsx to all route groups
5. [ ] Refactor DashboardLayoutClient scroll locking
6. [ ] Remove duplicate SkipLink implementations

---

### Task 2.2: Create State Management Guidelines (HIGH)

**Priority:** P1  
**Estimated Effort:** 1 week  
**Assignee:** Tech Lead  
**Dependencies:** Task 1.1

#### Sub-tasks:

1. [ ] Document when to use Zustand vs Context vs local state
2. [ ] Create decision tree diagram
3. [ ] Document state persistence patterns
4. [ ] Add guidelines to team wiki
5. [ ] Create ESLint rules for state management

---

### Task 2.3: Implement Storybook (MEDIUM)

**Priority:** P1  
**Estimated Effort:** 2-3 weeks  
**Assignee:** Frontend Engineer  
**Dependencies:** None

#### Sub-tasks:

1. [ ] Install and configure Storybook
2. [ ] Create stories for Button component
3. [ ] Create stories for Card component
4. [ ] Create stories for Input component
5. [ ] Create stories for Modal component
6. [ ] Add accessibility addon
7. [ ] Deploy to Storybook hosting

---

### Task 2.4: Add State Management Integration Tests (MEDIUM)

**Priority:** P1  
**Estimated Effort:** 1 week  
**Assignee:** QA Engineer  
**Dependencies:** Task 1.1

#### Sub-tasks:

1. [ ] Test cart state persistence
2. [ ] Test cart state synchronization
3. [ ] Test cart edge cases (max quantity, etc.)

---

## Phase 3: Medium Priority (P2 - 6-8 weeks)

### Task 3.1: Complete Design System Integration (MEDIUM)

**Priority:** P2  
**Estimated Effort:** 3-4 weeks  
**Assignee:** UI Engineer  
**Dependencies:** None

#### Sub-tasks:

1. [ ] Audit all components for design token usage
2. [ ] Replace hardcoded colors with tokens
3. [ ] Replace hardcoded spacing with tokens
4. [ ] Replace hardcoded typography with tokens
5. [ ] Create theme switching capability

---

### Task 3.2: Implement Accessibility Audit (MEDIUM)

**Priority:** P2  
**Estimated Effort:** 2 weeks  
**Assignee:** QA Engineer  
**Dependencies:** None

#### Sub-tasks:

1. [ ] Run axe-core automated tests
2. [ ] Manual screen reader testing
3. [ ] Fix color contrast issues
4. [ ] Add missing ARIA attributes
5. [ ] Implement focus management for modals

---

### Task 3.3: Add Component Tests (MEDIUM)

**Priority:** P2  
**Estimated Effort:** 3-4 weeks  
**Assignee:** QA Engineer  
**Dependencies:** None

#### Sub-tasks:

1. [ ] Write tests for Button component
2. [ ] Write tests for Card component
3. [ ] Write tests for Modal component
4. [ ] Write tests for Form components
5. [ ] Add visual regression tests

---

### Task 3.4: Enable TypeScript Strict Mode (MEDIUM)

**Priority:** P2  
**Estimated Effort:** 1-2 weeks  
**Assignee:** Frontend Engineer  
**Dependencies:** None

#### Sub-tasks:

1. [ ] Enable strict mode in tsconfig.json
2. [ ] Fix all strict mode errors
3. [ ] Add missing type annotations
4. [ ] Replace `any` types with proper types

---

## Phase 4: Low Priority (P3 - 8+ weeks)

### Task 4.1: Implement Intercepting Routes (LOW)

**Priority:** P3  
**Estimated Effort:** 2 weeks  
**Assignee:** Frontend Engineer  
**Dependencies:** Task 2.1

#### Sub-tasks:

1. [ ] Implement modal intercepting routes
2. [ ] Update navigation to use intercepting routes
3. [ ] Add back button handling
4. [ ] Test on mobile devices

---

### Task 4.2: Add Performance Monitoring (LOW)

**Priority:** P3  
**Estimated Effort:** 1 week  
**Assignee:** DevOps  
**Dependencies:** None

#### Sub-tasks:

1. [ ] Add Core Web Vitals tracking
2. [ ] Set up performance budgets
3. [ ] Configure alerts for performance regressions

---

## Dependencies Matrix

| Task                    | Depends On | Blocks   |
| ----------------------- | ---------- | -------- |
| 1.1 Consolidate Cart    | None       | 2.2, 2.4 |
| 1.2 Bundle Splitting    | None       | None     |
| 1.3 Fix Re-renders      | None       | None     |
| 2.1 Standardize Router  | None       | 4.1      |
| 2.2 State Guidelines    | 1.1        | None     |
| 2.3 Storybook           | None       | None     |
| 3.1 Design System       | None       | None     |
| 3.4 TypeScript Strict   | None       | None     |
| 4.1 Intercepting Routes | 2.1        | None     |

---

## Resource Requirements

| Role               | Hours Required    |
| ------------------ | ----------------- |
| Frontend Lead      | 40-60 hours       |
| Frontend Engineers | 80-120 hours each |
| QA Engineer        | 40-60 hours       |
| UI Engineer        | 60-80 hours       |
| DevOps             | 10-20 hours       |

---

## Success Metrics

1. **Performance**: 20% reduction in bundle size
2. **Re-renders**: 50% reduction in unnecessary re-renders
3. **Developer Experience**: Storybook with 20+ documented components
4. **Code Quality**: TypeScript strict mode enabled with 0 errors
5. **Accessibility**: WCAG 2.1 AA compliance score > 95%

---

_Document Version: 1.0_  
_Last Updated: 2026-05-02_  
_Next Review: 2026-06-02_
