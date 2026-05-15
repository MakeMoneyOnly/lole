# ADR-001: Domain Repository-Service Pattern

**Status:** Accepted  
**Date:** 2026-05-13  
**Deciders:** Architecture Review

## Context

The codebase needed a consistent pattern for organizing business logic across domains (staff, cart, orders, menu, guests, payments).

## Decision

Adopt the **repository-service pattern** for all domain business logic:

- **Repository**: Handles data persistence, external API calls, and database queries
- **Service**: Contains business logic and use cases
- **Resolvers**: GraphQL-specific resolver logic (optional)

## Consequences

### Positive

- Clear separation of concerns
- Easy testing with mockable repositories
- Consistent structure across all domains
- Type-safe boundaries between layers

### Negative

- Additional files per domain
- Indirection for simple operations

## Implementation

```typescript
// domains/staff/service.ts
export const staffService = {
    async getStaff(id: string): Promise<Staff> {
        return staffRepository.getById(id);
    },
    async updateStaff(id: string, data: StaffUpdate): Promise<Staff> {
        // Business logic here
        return staffRepository.update(id, data);
    },
};

// domains/staff/repository.ts
export const staffRepository = {
    async getById(id: string): Promise<Staff> {
        const { data } = await supabase.from('staff').select('*').eq('id', id);
        return data;
    },
    async update(id: string, data: StaffUpdate): Promise<Staff> {
        // Data persistence logic
    },
};
```
