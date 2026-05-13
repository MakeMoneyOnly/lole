# Context

React Context providers for application state management.

## Rules

1. **Keep context thin** - Use domain services for business logic
2. **Use domain repository-service pattern** - Import from `domains/`
3. **Separation of concerns** - Orchestration only in context

## Available Contexts

### CartContext

- Shopping cart state management
- Uses `cartService` for business logic
- Uses `cartRepository` for data persistence

### Implementation Pattern

```typescript
'use client'

import React, { createContext, useContext } from 'react'
import { domainService } from '@/domains/domain'

export function MyProvider({ children }) {
  const data = domainService.getData()  // Business logic in domain

  return (
    <MyContext.Provider value={data}>
      {children}
    </MyContext.Provider>
  )
}
```

## Creating a New Context

1. Extract business logic to `domains/[domain]/service.ts`
2. Keep context focused on state orchestration
3. Use repository for data persistence

## References

- [Architecture Documentation](../../docs/architecture/README.md)
- [ADR-001: Repository-Service Pattern](../../docs/architecture/adr/001-domain-repository-pattern.md)
