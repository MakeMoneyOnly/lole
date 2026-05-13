# Hooks

Generic reusable React hooks. **Feature-specific hooks must live in their feature folder.**

## Rules

1. Hooks here must be **generic** and reusable across features
2. **Feature-specific hooks** → `features/[feature]/hooks/`
3. Document hook usage and parameters

## Available Hooks

### Data & Async

- `useSafeFetch` - Safe data fetching with loading/error states
- `useSessionRefresh` - Session management
- `useTableSessionRealtime` - Realtime session updates
- `useSplitRealtimeChannels` - Multiple channel management

### UI & Interaction

- `useHaptic` - Haptic feedback
- `useFocusTrap` - Focus management for modals
- `usePageLoadGuard` - Loading state management
- `useReducedMotion` - Accessibility preference

### Utilities

- `useCurrency` - Currency formatting
- `useAppLocale` - Locale management
- `usePlanFeature` - Feature flagging
- `useAbortableEffect` - Cancelable effects

## Creating a New Hook

```typescript
// hooks/useMyHook.ts
import { useState, useEffect } from 'react';

interface UseMyHookOptions {
    initialValue: string;
}

export function useMyHook(options: UseMyHookOptions) {
    const [value, setValue] = useState(options.initialValue);

    useEffect(() => {
        // Hook logic
    }, []);

    return { value, setValue };
}
```

## References

- [Architecture Documentation](../../docs/architecture/README.md)
