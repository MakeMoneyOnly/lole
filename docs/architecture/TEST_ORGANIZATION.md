# Test Organization Guide

**Status:** Implemented  
**Version:** 1.0  
**Last Updated:** 2026-05-13

## Overview

This document describes the standardized test organization pattern used across the codebase.

## Directory Structure

```
feature/
  __tests__/
    unit/           # Unit tests (fast, isolated)
    integration/    # Integration tests (slower, with dependencies)
```

```
domain/
  __tests__/
    unit/           # Unit tests for domain logic
    integration/    # Integration tests for domain workflows
```

```
lib/
  __tests__/
    unit/
    integration/
```

## Naming Conventions

### File Naming

- `.test.ts` or `.test.tsx` - Unit tests
- `.integration.test.ts` or `.integration.test.tsx` - Integration tests

### Examples

```
features/merchant/hooks/__tests__/unit/useStaff.test.ts
features/kds/hooks/__tests__/unit/useKDSRealtime.test.ts
lib/api/__tests__/integration/openapi-contract.test.ts
```

## Test Writing Guidelines

### Unit Tests

- Test single units of code in isolation
- Mock external dependencies (API calls, database, etc.)
- Run quickly (< 100ms per test)
- Use descriptive test names that explain behavior

```typescript
describe('CartService', () => {
    it('should add a new item to an empty cart', () => {
        // Arrange
        const items: CartItem[] = [];
        const newItem = { menuItemId: 'item-1', title: 'Burger', price: 10 };

        // Act
        const result = cartService.addItem(items, newItem);

        // Assert
        expect(result).toHaveLength(1);
    });
});
```

### Integration Tests

- Test multiple units working together
- Can use test databases or mocks
- Test real workflows and data flows
- Marked with `.integration.` in filename

```typescript
describe('Order API', () => {
    it('should create and retrieve an order', async () => {
        // Test full workflow
    });
});
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test src/features/kds/hooks/__tests__/unit/useKDSRealtime.test.ts

# Run tests matching a pattern
pnpm test --useKDS
```

## Test Utilities

### Common Setup

Use `vitest` with the following configuration:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
```

### Mocking

```typescript
// Mock a module
vi.mock('@/lib/supabase/client', () => ({
    createClient: () => mockClient,
}));
```

## Migration Guide

When moving existing tests:

1. Create `unit/` subdirectory under `__tests__/`
2. Move test files into the appropriate subdirectory
3. Update any relative imports
4. Run tests to verify nothing broke

## Orchestration

The test orchestrator at `src/lib/architecture/test-orchestrator.ts` can help automate reorganization:

```bash
npx tsx src/lib/architecture/test-orchestrator.ts
```

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [ADR-002: Feature-Sliced Design](../adr/002-feature-slice-design.md)
