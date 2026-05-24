# ADR-001: Feature-Slice Architecture Pattern

**Status:** Accepted  
**Date:** 2026-05-23  
**Deciders:** Architecture Review

## Context

The codebase required a structural organization pattern that improves maintainability, feature isolation, and developer onboarding. Traditional layer-based organization (grouping by file type) led to scattered feature code across multiple directories.

## Decision

Adopt **feature-slice architecture** as the primary organizational pattern for the `src/` directory. Each feature is a self-contained module with all code relevant to that feature co-located.

### Structure

```
src/
├── features/
│   ├── merchant/          # Merchant profile & settings
│   │   ├── components/    # Feature-specific UI components
│   │   ├── hooks/         # Feature-specific hooks
│   │   ├── lib/           # Feature utilities & business logic
│   │   ├── types/         # Feature-specific types
│   │   └── index.ts       # Public API exports
│   ├── orders/            # Order management feature
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types/
│   ├── menu/              # Menu management feature
│   └── kds/               # Kitchen Display System
├── shared/                # Cross-cutting concerns
│   ├── components/        # Reusable/common components
│   ├── hooks/             # Generic hooks
│   ├── lib/
│   └── types/
└── app/                   # Next.js App Router (route handlers only)
```

## Rules

1. **Feature-first placement**: All feature-specific code lives in `features/[feature]/`
2. **Shared code**: Truly generic utilities, hooks, and components go in `shared/`
3. **Route handlers**: Pages and route handlers remain in `app/` per Next.js convention
4. **Explicit exports**: Each feature exports its public API via `index.ts`
5. **Type safety**: Each feature defines its own types in `types/` subdirectory

## Benefits

- **Cognitive locality**: All code for a feature is in one place
- **Easier refactoring**: Delete a feature by removing one directory
- **Clear boundaries**: Explicit dependencies between features
- **Better testing**: Can test features in isolation
- **Improved onboarding**: New developers understand features independently

## Consequences

- Features with shared logic require explicit dependency management
- Cross-feature communication should use shared types/interfaces
- Migration requires moving code from old structure to feature folders

## Alternatives Considered

| Option                | Pros                  | Cons                     |
| --------------------- | --------------------- | ------------------------ |
| Layer-based (current) | Familiar              | Scattered logic          |
| Domain-driven         | Aligned with business | Requires domain analysis |
| Module-based          | Clear separation      | Rigid boundaries         |

## Related

- See `docs/explanation/decisions/002-feature-slice-design.md` for initial FSD adoption
- See `docs/reference/REFACTORING_PLAN.md` for migration status
