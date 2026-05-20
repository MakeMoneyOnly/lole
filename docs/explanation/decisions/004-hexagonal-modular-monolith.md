# ADR-004: Hexagonal Modular Monolith Architecture

**Status:** Proposed  
**Date:** 2026-05-20  
**Deciders:** Architecture Review

## Context

The current codebase suffers from several architectural issues:

- **StaffService God Object**: A single service handling too many responsibilities, violating Single Responsibility Principle
- **API routes bypassing domain layer**: Direct database access from route handlers without proper domain boundaries
- **Tight coupling**: Components, services, and infrastructure are tightly coupled, making changes risky and testing difficult

The existing repository-service pattern (ADR-001) lacks dependency inversion, leading to implicit coupling between domain and infrastructure.

## Decision

Adopt **Hexagonal Modular Monolith** with **Ports/Adapters pattern** to enforce clean boundaries and dependency inversion:

```
src/
├── core/                 # Core Domain layer (no dependencies on outer layers)
│   └── domains/
│       ├── staff/
│       │   ├── entities/     # Domain entities (Staff, Role)
│       │   ├── value-objects/ # Domain-specific types
│       │   └── services/     # Domain business logic
│       └── ...
├── ports/                # Ports layer (interfaces defining dependencies)
│   └── staff/
│       └── staff-repository.port.ts
├── application/          # Application Services layer (use cases)
│   └── staff/
│       └── staff-service.application.ts
└── adapters/             # Adapters layer (implementations)
    ├── inbound/
    │   └── api/
    │       └── staff.controller.ts
    └── outbound/
        └── database/
            └── staff-repository.adapter.ts
```

### Layers

1. **Core Domain**: Entities, value objects, and domain services containing pure business logic with **zero external dependencies**
2. **Ports**: Interfaces defining what the core needs (e.g., `StaffRepository` interface)
3. **Application Services**: Use case orchestrators that depend on ports, not implementations
4. **Adapters**: Concrete implementations of ports (database, external APIs, HTTP handlers)

### Migration Path

**Phase 1: Core**
- Identify and extract domain entities from StaffService
- Create `core/domains/staff/entities/` with pure Staff entity
- Move business logic to domain services

**Phase 2: Ports**
- Define port interfaces in `ports/staff/`
- Example: `StaffRepositoryPort` with `findById`, `save`, `delete` methods

**Phase 3: Adapters**
- Implement ports in `adapters/outbound/database/`
- Refactor API routes to use application services
- Ensure dependency direction: adapters → application → ports → core

## Consequences

### Positive

- **Better testability**: Core domain can be tested without database or HTTP mocks
- **Cleaner separation**: Ports define explicit contracts; adapters implement them
- **Easier maintenance**: Changes to infrastructure don't affect domain logic
- **Migration-ready**: Architecture supports future microservice extraction

### Negative

- Upfront refactoring effort for existing code
- More files and indirection for simple operations
- Learning curve for team unfamiliar with hexagonal pattern