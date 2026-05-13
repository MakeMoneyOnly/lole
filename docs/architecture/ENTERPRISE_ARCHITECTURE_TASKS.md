# Enterprise Architecture Tasks

## Overview

Comprehensive task list to bring the `@src` directory to enterprise-grade standards with optimal Developer Experience (DX).

**Created:** 2026-05-13
**Status:** Completed

---

## 🚨 CRITICAL ISSUES (P0)

### 1. Consolidate StaffRole Type Definitions

**Status:** DONE  
**Effort:** Low  
**Impact:** High

- [x] Audit all StaffRole definitions across the codebase
- [x] Select canonical definition in `types/status.ts` as single source of truth
- [x] Update `domains/staff/service.ts` to import from types/status.ts
- [x] Update `hooks/useStaff.ts` to import from types/status.ts
- [x] Update `types/models.ts` to remove duplicate definition
- [x] Update `features/auth/hooks/useRole.ts` if affected
- [x] Run type checking to verify no regressions

### 2. Standardize Repository Pattern

**Status:** DONE  
**Effort:** Medium  
**Impact:** High

- [x] Audit all repository implementations in `domains/`
- [x] Identify variations in client initialization patterns
- [x] Update `domains/staff/repository.ts` to use `getRepositoryClient()`
- [x] Ensure all repositories extend `RepositoryBase` pattern
- [x] Add consistent error logging format across all repositories
- [x] Update any inline `createClient` calls in other domains

---

## ⚠️ HIGH PRIORITY ISSUES (P1)

### 3. Separate Business Logic from Context Providers

**Status:** DONE  
**Effort:** Medium  
**Impact:** Medium

- [x] Extract business logic from `context/CartContext.tsx`
- [x] Create `domains/cart/` directory with:
    - [x] `service.ts` - Cart business logic
    - [x] `repository.ts` - Data persistence
    - [x] `index.ts` - Public exports
- [x] Update `CartContext.tsx` to use domain service
- [x] Move PowerSync sync logic to repository layer
- [x] Add unit tests for cart domain service

### 4. Create Architecture Documentation

**Status:** DONE  
**Effort:** Low  
**Impact:** Medium

- [x] Create `docs/architecture/` directory
- [x] Write `README.md` explaining directory structure:
    - `domains/` - Business logic (repository-service pattern)
    - `features/` - Presentation/UI layer
    - `hooks/` - Generic reusable hooks only
    - `lib/` - Shared utilities
    - `types/` - Global type definitions
- [x] Document import conventions and path aliases
- [x] Create ADRs for key architectural decisions

### 5. Fix Feature-Specific Hook Placement

**Status:** DONE  
**Effort:** Medium  
**Impact:** Medium

- [x] Move `hooks/useStaff.ts` → `features/merchant/hooks/useStaff.ts`
- [x] Move `hooks/useDevices.ts` → `features/merchant/hooks/useDevices.ts`
- [x] Move `hooks/useMerchantActivity.ts` → `features/merchant/hooks/useMerchantActivity.ts` (already existed, verified correct location)
- [x] Move `hooks/useDeviceHeartbeat.ts` → `features/merchant/hooks/useDeviceHeartbeat.ts`
- [x] Move `hooks/useManagedDeviceSession.ts` → `features/merchant/hooks/useManagedDeviceSession.ts`
- [x] Update imports in waiter/page.tsx, kds/page.tsx, terminal/page.tsx
- [x] Move test file to `__tests__/useManagedDeviceSession.test.ts`
- [x] Keep generic hooks in root (`useSafeFetch`, `useHaptic`, `useCurrency`, etc.)

---

## 🔧 MEDIUM PRIORITY (P2)

### 6. Improve Type Safety Consistency

**Status:** DONE  
**Effort:** Medium  
**Impact:** Medium

- [x] Run `supabase gen types` to regenerate latest types (already generated)
- [x] Audit all files using inline database types
- [x] Replace custom Row types with generated `Database['public']['Tables']` types
- [x] Add eslint rule preventing manual type definitions for database tables
- [x] Create type utility for common transformations (`types/db-helpers.ts`)

### 7. Standardize Test Organization

**Status:** DONE  
**Effort:** Low  
**Impact:** Low

- [x] Add `__tests__/` folder structure to all features:
    ```
    feature/
      __tests__/
        unit/
        integration/
    ```
- [x] Move existing tests to appropriate subdirectories
- [x] Update test naming conventions (consistent across project)
- [x] Add test utility documentation

### 8. Remove Code Duplication in useMerchantActivity

**Status:** DONE  
**Effort:** Low  
**Impact:** Low

- [x] Extract activity transformation logic to shared utility
- [x] Remove duplicate `orderActivities` and `requestActivities` mapping
- [x] Create `features/merchant/utils/transformActivity.ts`

---

## ✨ DX IMPROVEMENTS (P3)

### 9. Add Directory README Files

**Status:** DONE  
**Effort:** Low  
**Impact:** Medium

- [x] Create `src/domains/README.md` - Domain layer guidelines
- [x] Create `src/features/README.md` - Feature folder conventions
- [x] Create `src/hooks/README.md` - Hook design patterns
- [x] Create `src/lib/README.md` - Utility guidelines
- [x] Create `src/context/README.md` - Context usage rules

### 10. Improve Component Type Organization

**Status:** DONE  
**Effort:** Low  
**Impact:** Low

- [x] Audit `.types.ts` files - None found in codebase
- [x] No DishDetailDrawer.types.ts to rename
- [ ] Standardize: types live with component OR in `types/` directory (N/A - no such files)

### 11. Add Linting Rules for Architecture Boundaries

**Status:** DONE  
**Effort:** Low  
**Impact:** High

- [x] Add eslint rule preventing `features/` imports from `domains/`
- [x] Add eslint rule enforcing separation of concerns
- [x] Add eslint rule preventing type duplication (custom DB types)
- [x] Add eslint rule for consistent import order

---

## 📊 PROGRESS TRACKING

| Section         | Total Tasks | Completed | Progress |
| --------------- | ----------- | --------- | -------- |
| Critical Issues | 2           | 2         | 100%     |
| High Priority   | 3           | 3         | 100%     |
| Medium Priority | 3           | 3         | 100%     |
| DX Improvements | 3           | 3         | 100%     |
| **Overall**     | **11**      | **11**    | **100%** |

---

## 📝 NOTES

### Decision Log

- **2026-05-13**: Initial audit completed. Types should be consolidated in `types/status.ts` as the canonical source per enterprise standards.
- **2026-05-13**: Architecture documentation created with ADRs for repository pattern, feature-slice design, and type inference.
- **2026-05-13**: ESLint rules added for architecture boundaries - prevents features from importing domains directly, prevents custom DB row type definitions.
- **2026-05-13**: Type utilities created in `types/db-helpers.ts` for common database type transformations.
- **2026-05-13**: Test organization standardized with `unit/` and `integration/` subdirectories under `__tests__/`. Test orchestration pipeline created at `src/lib/architecture/test-orchestrator.ts`.

### References

- AGENTS.md - Project-specific operating rules
- types/status.ts - Canonical status types
- docs/architecture/TEST_ORGANIZATION.md - Test organization guide
