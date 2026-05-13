# Architecture Documentation

This directory contains the architectural decision records (ADRs) and documentation for the project's source code structure.

## Source Code Directory Structure

The `src/` directory follows a **domain-driven, layered architecture** with clear separation of concerns.

```
src/
├── domains/           # Business logic layer (repository-service pattern)
├── features/          # Presentation/UI layer (feature-sliced)
├── hooks/             # Generic reusable React hooks
├── lib/               # Shared utilities and helpers
├── types/             # Global type definitions
└── context/           # React context providers
```

## Directory Conventions

### `domains/` - Business Logic Layer

Contains core business logic following the **repository-service pattern**:

- Each domain (staff, cart, orders, menu, guests, payments) is a self-contained module
- **repository.ts**: Data persistence and external API integration
- **service.ts**: Business logic and use cases
- **resolvers.ts**: GraphQL/resolver-specific logic (if applicable)
- **index.ts**: Public exports for the domain

```typescript
// Example: domains/staff/service.ts
export const staffService = {
  async getStaff(id: string): Promise<Staff> { ... },
  async updateStaff(id: string, data: StaffUpdate): Promise<Staff> { ... },
}
```

### `features/` - Presentation Layer

Feature-sliced design with colocated components, hooks, and utilities:

```
features/
├── merchant/
│   ├── hooks/        # Feature-specific hooks
│   ├── components/   # UI components
│   └── utils/        # Feature utilities
└── kds/
    ├── hooks/
    ├── components/
    └── lib/
```

### `hooks/` - Generic Reusable Hooks

Only **generic, reusable hooks** belong here. Feature-specific hooks must live in `features/[feature]/hooks/`.

Examples: `useSafeFetch`, `useHaptic`, `useCurrency`, `usePageLoadGuard`

### `lib/` - Shared Utilities

Utility functions used across multiple features or domains. Avoid domain-specific helpers here.

### `types/` - Global Type Definitions

- `status.ts`: Canonical status enums (StaffRole, OrderStatus)
- `models.ts`: Domain model interfaces (when not generated)
- `index.ts`: Central export point

### `context/` - React Context Providers

- Use domain services for business logic
- Keep context thin - orchestration only

## Import Conventions

Use path aliases defined in `tsconfig.json`:

```typescript
import { staffService } from '@/domains/staff';
import { useStaff } from '@/features/merchant/hooks/useStaff';
import { useSafeFetch } from '@/hooks/useSafeFetch';
```

## Architecture Decision Records (ADRs)

- [ADR-001](./adr/001-domain-repository-pattern.md) - Repository-Service Pattern
- [ADR-002](./adr/002-feature-slice-design.md) - Feature-Sliced Design
- [ADR-003](./adr/003-type-inference.md) - Database Type Inference

## References

- [AGENTS.md](../AGENTS.md) - Project operating rules
- [Enterprise Architecture Tasks](./ENTERPRISE_ARCHITECTURE_TASKS.md) - Task tracking
