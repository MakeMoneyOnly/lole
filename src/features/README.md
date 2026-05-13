# Features

Presentation layer following **feature-sliced design**. Each feature is a self-contained module.

## Structure

```
features/
├── merchant/
│   ├── hooks/        # Feature-specific hooks
│   ├── components/   # UI components
│   ├── lib/          # Feature utilities
│   └── utils/        # Feature utilities
└── kds/
    ├── hooks/
    ├── components/
    └── lib/
```

## Conventions

### Hooks

- **Feature-specific hooks** → `features/[feature]/hooks/`
- **Generic hooks** → `hooks/` root level

Examples of generic hooks: `useSafeFetch`, `useHaptic`, `useCurrency`, `usePageLoadGuard`

Examples of feature hooks: `useStaff`, `useDevices`, `useMerchantActivity`

### Components

- Colocate with their feature
- Use domain services for business logic
- Keep UI logic in components, business logic in domains

## Creating a New Feature

```bash
mkdir -p features/new-feature/{hooks,components,lib}
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

## References

- [Architecture Documentation](../../docs/architecture/README.md)
- [ADR-002: Feature-Sliced Design](../../docs/architecture/adr/002-feature-slice-design.md)
