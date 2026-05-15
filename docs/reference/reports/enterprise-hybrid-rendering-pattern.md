# Enterprise-Grade Hybrid Server/Client Rendering Pattern

## Overview

This document describes the enterprise-grade hybrid rendering pattern implemented in lole Restaurant OS. This pattern combines Server Components for initial data fetching with Client Components for interactivity, delivering optimal performance and user experience.

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│  Page (Server Component)                                        │
│  ├── export const dynamic = 'force-dynamic'                     │
│  ├── export const revalidate = X (caching strategy)             │
│  ├── Parallel data fetching (Promise.all)                       │
│  ├── Error handling with try/catch                              │
│  └── Pass ONLY serializable, non-sensitive props                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Client Component ('use client')                                │
│  ├── Receives initial server data (no loading flash)            │
│  ├── Handles interactivity (filters, search, CRUD)             │
│  ├── Subscribes to Realtime (merges with server data)          │
│  └── Optimistic updates for mutations                          │
└─────────────────────────────────────────────────────────────────┘
```

## Performance Benchmarks (2025 Research)

| Rendering Strategy          | TTI (Time to Interactive) | Bundle Size |
| --------------------------- | ------------------------- | ----------- |
| CSR (Client-Side)           | 4.3s                      | ~500KB      |
| SSR                         | 3.1s                      | ~300KB      |
| **RSC (Server Components)** | **1.6s**                  | **~100KB**  |

## Implementation Guide

### 1. Server Component (page.tsx)

```tsx
// src/app/(dashboard)/merchant/page.tsx

import { redirect } from 'next/navigation';
import { getCommandCenterData, resolveRestaurantId } from '@/lib/services/dashboardDataService';
import { MerchantDashboardClient } from '@/components/merchant/MerchantDashboardClient';

// Force dynamic rendering - data changes frequently
export const dynamic = 'force-dynamic';

// Revalidate every 0 seconds (always fresh)
export const revalidate = 0;

export default async function MerchantDashboardPage() {
    // Check authentication and restaurant context
    const restaurantId = await resolveRestaurantId();

    if (!restaurantId) {
        redirect('/auth/signin?error=no_restaurant');
    }

    // Fetch initial data on the server
    const initialData = await getCommandCenterData('today');

    // Pass server-fetched data to Client Component
    return <MerchantDashboardClient initialData={initialData} />;
}
```

### 2. Client Component

```tsx
// src/components/merchant/MerchantDashboardClient.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';

interface MerchantDashboardClientProps {
    initialData: CommandCenterData | null;
}

export function MerchantDashboardClient({ initialData }: MerchantDashboardClientProps) {
    // Initialize state with server data - NO loading flash!
    const [data, setData] = useState(initialData);
    const [refreshing, setRefreshing] = useState(false);

    // Handle interactivity (filters, refresh, etc.)
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        const response = await fetch('/api/merchant/command-center');
        const payload = await response.json();
        setData(payload.data);
        setRefreshing(false);
    }, []);

    // Subscribe to realtime updates
    useEffect(() => {
        const channel = supabase
            .channel('command-center')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },
                () => handleRefresh()
            )
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [handleRefresh]);

    return (
        // Render UI with server data
    );
}
```

### 3. Server-Side Data Service

```tsx
// src/lib/services/dashboardDataService.ts

import { createClient } from '@/lib/supabase/server';

export async function getCommandCenterData(
    range: 'today' | 'week' | 'month' = 'today'
): Promise<CommandCenterData | null> {
    const supabase = await createClient();

    // Resolve restaurant context
    const restaurantId = await resolveRestaurantId();
    if (!restaurantId) return null;

    // Parallel data fetching for performance
    const [orders, requests, tables, alerts] = await Promise.all([
        supabase.from('orders').select('...').eq('restaurant_id', restaurantId),
        supabase.from('service_requests').select('...').eq('restaurant_id', restaurantId),
        supabase.from('tables').select('...').eq('restaurant_id', restaurantId),
        supabase.from('alert_events').select('...').eq('restaurant_id', restaurantId),
    ]);

    // Return serializable data (no functions, no sensitive data)
    return {
        restaurant_id: restaurantId,
        metrics: { ... },
        attention_queue: [ ... ],
    };
}
```

## Caching Strategies by Data Type

| Data Type              | Server Fetch | Client Fetch     | Caching            | Realtime         |
| ---------------------- | ------------ | ---------------- | ------------------ | ---------------- |
| Command Center metrics | ✅ Initial   | ✅ Range filter  | `force-dynamic`    | ✅ Orders/tables |
| Orders list            | ✅ Initial   | ✅ Search/filter | `force-dynamic`    | ✅ Orders table  |
| Tables grid            | ✅ Initial   | ✅ CRUD          | `force-dynamic`    | ✅ Tables table  |
| Analytics              | ✅ Initial   | ✅ Range filter  | `revalidate: 60`   | ❌               |
| Menu items             | ✅ Initial   | ✅ CRUD          | `revalidate: 300`  | ❌               |
| Guests                 | ✅ Initial   | ✅ Search        | `revalidate: 60`   | ❌               |
| Staff                  | ✅ Initial   | ✅ CRUD          | `revalidate: 300`  | ❌               |
| Finance                | ✅ Initial   | ✅ Export        | `force-dynamic`    | ❌               |
| Inventory              | ✅ Initial   | ✅ CRUD          | `revalidate: 60`   | ❌               |
| Channels               | ✅ Initial   | ✅ Connect/ack   | `force-dynamic`    | ❌               |
| Help                   | ✅ Initial   | ✅ Search        | `revalidate: 3600` | ❌               |

## Key Principles

### 1. Server Components by Default

- Use Server Components for all pages by default
- Fetch data on the server to eliminate loading states
- Pass only serializable data to Client Components

### 2. Client Components for Interactivity

- Use `'use client'` only when you need:
    - Browser APIs (localStorage, window, etc.)
    - React hooks (useState, useEffect, etc.)
    - Event handlers (onClick, onChange, etc.)
    - Realtime subscriptions

### 3. Keep loading.tsx Files

- `loading.tsx` creates automatic Suspense boundaries
- Enables streaming SSR for progressive rendering
- Shows fallback while server fetches data

### 4. Error Boundaries

- Every route should have `error.tsx`
- Catches both server and client errors
- Provides recovery options (retry, navigate home)

### 5. Security Considerations

- Never pass sensitive data (API keys, tokens) to Client Components
- Validate all inputs on the server
- Use RLS policies for data isolation

## File Structure

```
src/
├── app/
│   └── (dashboard)/
│       └── merchant/
│           ├── page.tsx           # Server Component
│           ├── loading.tsx        # Suspense fallback
│           └── error.tsx          # Error boundary
├── components/
│   └── merchant/
│       └── MerchantDashboardClient.tsx  # Client Component
└── lib/
    └── services/
        └── dashboardDataService.ts  # Server-side data fetching
```

## Migration Guide

### From Client-Only to Hybrid

1. **Create Server Component**
    - Move data fetching to server
    - Add caching strategy exports
    - Handle authentication/authorization

2. **Create Client Component**
    - Extract interactivity logic
    - Accept initial data as props
    - Keep realtime subscriptions

3. **Update Page**
    - Import Client Component
    - Pass server data as props
    - Remove loading state from initial render

### Example: Orders Page Migration

**Before (Client-Only):**

```tsx
// page.tsx
'use client';

export default function OrdersPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrders().then(data => {
            setOrders(data);
            setLoading(false);
        });
    }, []);

    if (loading) return <Skeleton />;
    return <OrdersList orders={orders} />;
}
```

**After (Hybrid):**

```tsx
// page.tsx (Server Component)
import { getOrdersPageData } from '@/lib/services/dashboardDataService';
import { OrdersPageClient } from '@/components/merchant/OrdersPageClient';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
    const initialData = await getOrdersPageData('all', '', 100);
    return <OrdersPageClient initialData={initialData} />;
}

// OrdersPageClient.tsx (Client Component)
('use client');

export function OrdersPageClient({ initialData }) {
    const [orders, setOrders] = useState(initialData?.orders ?? []);
    // No loading state needed - data is already available!

    // Handle interactivity and realtime updates
    return <OrdersList orders={orders} />;
}
```

## Performance Optimization Tips

1. **Parallel Data Fetching**

    ```tsx
    const [orders, tables, guests] = await Promise.all([getOrders(), getTables(), getGuests()]);
    ```

2. **Request Deduplication**
    - Next.js automatically deduplicates fetch requests with the same URL
    - Use consistent cache keys in service layer

3. **Streaming with Suspense**

    ```tsx
    // page.tsx
    export default async function Page() {
        const data = await getData(); // Streams with Suspense
        return <ClientComponent data={data} />;
    }

    // loading.tsx creates the streaming fallback
    ```

4. **Optimistic Updates**

    ```tsx
    const handleUpdate = async (id: string, status: string) => {
        // Optimistically update UI
        setOrders(prev => prev.map(o => (o.id === id ? { ...o, status } : o)));

        // Sync with server
        await fetch(`/api/orders/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
    };
    ```

## Testing

### Unit Tests

- Test service layer functions independently
- Mock Supabase client for server-side tests
- Test Client Components with React Testing Library

### Integration Tests

- Test data flow from server to client
- Verify realtime subscription behavior
- Test error handling and recovery

### E2E Tests

- Verify no loading flash on initial render
- Test interactivity after initial render
- Verify realtime updates work correctly

## References

- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [React Server Components Best Practices](https://react.dev/reference/rsc/server-components)
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime)
- [AGENTS.md](../AGENTS.md) - Project-specific rules
