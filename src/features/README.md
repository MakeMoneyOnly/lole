# Features

Presentation layer following **feature-slice design** with layered architecture. Each feature is a self-contained module with clear separation of concerns.

## Architecture Evolution

The feature structure has evolved to include more granular directories for better separation of concerns:

```
features/
├── orders/                    # New expanded structure
│   ├── api/                   # API route delegates and handlers
│   ├── services/              # Feature-specific orchestration logic
│   ├── domain/                # Re-exports from src/domains/orders/
│   ├── contracts/             # Zod schemas for API request/response validation
│   ├── events/                # Event types and handlers
│   ├── hooks/                 # React hooks for the feature
│   └── tests/                 # Feature-specific tests
├── merchant/
│   ├── hooks/
│   ├── components/
│   ├── lib/
│   └── utils/
└── kds/
    ├── hooks/
    ├── components/
    └── lib/
```

### Directory Responsibilities

| Directory    | Purpose                                                         |
| ------------ | --------------------------------------------------------------- |
| `api/`       | Server-side API route handlers, delegates to domain services    |
| `services/`  | Client-side orchestration, combining multiple domain operations |
| `domain/`    | Thin re-export layer pointing to `src/domains/[feature]/`       |
| `contracts/` | Zod schemas defining API request/response shapes                |
| `events/`    | Event types, payloads, and event handlers                       |
| `hooks/`     | React hooks for data fetching and UI state management           |
| `tests/`     | Unit, integration, and component tests                          |

## Conventions

### Hooks

- **Feature-specific hooks** → `features/[feature]/hooks/`
- **Generic hooks** → `hooks/` root level

Examples of generic hooks: `useSafeFetch`, `useHaptic`, `useCurrency`, `usePageLoadGuard`

Examples of feature hooks: `useStaff`, `useDevices`, `useMerchantActivity`

### API Contracts

Define request/response schemas in `contracts/`:

```typescript
// features/orders/contracts/create-order.ts
import { z } from 'zod';

export const CreateOrderRequest = z.object({
    items: z.array(
        z.object({
            menuItemId: z.string(),
            quantity: z.number().int().positive(),
            modifiers: z.record(z.any()).optional(),
        })
    ),
    tableId: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderRequest>;
```

### Creating a New Feature

```bash
mkdir -p features/new-feature/{api,services,domain,contracts,events,hooks,tests}
```

```typescript
// features/new-feature/hooks/useNewFeature.ts
import { newDomainService } from '@/domains/new-domain';

export function useNewFeature() {
    return useQuery(['new-feature'], () => newDomainService.getData());
}
```

## Available Features

- `merchant` - Merchant management UI
- `kds` - Kitchen Display System
- `auth` - Authentication flows
- `orders` - Order management (expanding to full feature-slice structure)

## References

- [Architecture Documentation](../../docs/architecture/README.md)
- [ADR-002: Feature-Sliced Design](../../docs/architecture/adr/002-feature-slice-design.md)
