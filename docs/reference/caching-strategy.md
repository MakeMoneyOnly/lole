# Caching Strategy Guide

This document outlines the caching patterns and best practices for Lole's Next.js application.

## Overview

Lole uses a multi-layered caching approach:

1. **React Cache Components** (`'use cache'` directive) - Automatic caching of server components
2. **unstable_cache** - Fine-grained cache control with tags and revalidation
3. **Service Worker** - Client-side caching for offline support
4. **Next.js PWA** - HTTP caching for static assets

## React Cache Components

The `'use cache'` directive at the top of a server component enables automatic caching.

### When to Use

- Data that doesn't change frequently (reference data, menus, categories)
- Public data accessible to all users
- Data fetched in server components only

### Basic Pattern

```tsx
'use cache';

import { unstable_cache } from 'next/cache';

async function getData() {
    const supabase = await createClient();
    const { data } = await supabase.from('table').select();
    return data;
}

export const getCachedData = unstable_cache(getData, ['cache-key'], {
    tags: ['data-tag'],
    revalidate: 300, // 5 minutes
});
```

### Cache Key Best Practices

- Include entity IDs in cache keys for per-tenant isolation
- Use descriptive, consistent naming: `['restaurant-menu', restaurantId]`
- Keys should be serializable (no functions, classes, or circular references)

## unstable_cache Configuration

### Options

| Option                    | Type       | Description                                              |
| ------------------------- | ---------- | -------------------------------------------------------- |
| `tags`                    | `string[]` | Cache tags for targeted invalidation                     |
| `revalidate`              | `number`   | Seconds until cache expires (default: never)             |
| `allowNegativeRevalidate` | `boolean`  | Allow negative revalidate values for manual invalidation |

### Cache Tags

Use tags for granular cache invalidation:

```typescript
const CACHE_TAGS = {
    MENU_ITEMS: 'menu-items',
    CATEGORIES: 'categories',
    RESTAURANT: 'restaurant',
    ORDERS: 'orders',
    GUESTS: 'guests',
} as const;
```

### Revalidation Timings

```typescript
const DEFAULT_REVALIDATE = {
    SECONDS_1_MIN: 60,
    SECONDS_5_MIN: 300,
    SECONDS_15_MIN: 900,
    SECONDS_1_HOUR: 3600,
    SECONDS_24_HOURS: 86400,
} as const;
```

## Cache Invalidation

### On-Demand Revalidation

```typescript
// In server actions or route handlers
import { revalidateTag, revalidatePath } from 'next/cache';

export async function updateMenuItem(input: MenuItemInput) {
    // Update data
    await updateMenuRepository(input);

    // Invalidate caches (Next.js 16 requires profile argument)
    revalidateTag('menu-items', 'hours');
    revalidatePath(`/restaurant/${input.restaurantId}/menu`);
}
```

### Targeted Invalidation

```typescript
// Invalidating specific restaurant's cache
export async function revalidateRestaurantMenu(restaurantId: string) {
    const { revalidateTag } = await import('next/cache');
    const { revalidatePath } = await import('next/cache');

    revalidateTag(CACHE_TAGS.MENU_ITEMS, 'hours');
    revalidateTag(CACHE_TAGS.CATEGORIES, 'hours');
    revalidatePath(`/restaurant/${restaurantId}/menu`);
}
```

## Data Sensitivity & Cache Safety

### Never Cache

- User-specific data (orders, personal info)
- Authentication tokens
- Financial data
- Data requiring real-time accuracy

### Safe to Cache

- Restaurant menu items (public)
- Categories (infrequently changing)
- Restaurant profiles (public info)
- Reference data

### Tenant Isolation

When caching multi-tenant data, always include tenant ID in cache key:

```typescript
export const getRestaurantMenu = unstable_cache(
    ([restaurantId]) => getCachedMenuItems(restaurantId),
    ['restaurant-menu'], // Generic key
    { tags: ['menu-items'] }
);
```

For better isolation, use restaurant-specific cache keys:

```typescript
export const getRestaurantMenu = (restaurantId: string) =>
    unstable_cache(() => getCachedMenuItems(restaurantId), [`restaurant-menu-${restaurantId}`], {
        tags: [`menu-items-${restaurantId}`],
    });
```

## Layered Caching Stack

| Layer | Technology             | TTL          | Use Case                     |
| ----- | ---------------------- | ------------ | ---------------------------- |
| L1    | React Cache Components | Per-request  | Dedupe within render pass    |
| L2    | unstable_cache         | Configurable | Server-side data caching     |
| L3    | Service Worker         | Configurable | Offline, background sync     |
| L4    | CDN/Vercel Edge        | Static       | Images, fonts, static assets |

## Performance Considerations

### Cache Hit Benefits

- Eliminates database queries
- Reduces server response time (from ~100ms to ~1-5ms)
- Decreases database load
- Improves Core Web Vitals (LCP primarily)

### Memory Usage

- Monitor cache size in production
- Use appropriate TTLs to prevent memory bloat
- Consider cache warming for critical paths

### Debugging

Enable cache logging in development:

```typescript
// In next.config.js
experimental: {
    cacheComponents: true,
    logging: {
        fetching: {
            fullUrl: true,
        },
    },
}
```

## Common Patterns

### Pattern 1: Cached Data Provider Component

```tsx
'use cache';

import { unstable_cache } from 'next/cache';

export async function CachedDataProvider({ restaurantId, children }) {
    const [data, related] = await Promise.all([
        getCachedData(restaurantId),
        getCachedRelated(restaurantId),
    ]);

    return children({ data, related });
}
```

### Pattern 2: Cache with Context

```tsx
'use cache';

export const getCachedRestaurantContext = (restaurantId: string) =>
    unstable_cache(
        async () => fetchRestaurantContext(restaurantId),
        [`restaurant-context-${restaurantId}`],
        { tags: [`restaurant-${restaurantId}`], revalidate: 900 }
    );
```

### Pattern 3: Conditional Caching

For data that may or may not be public:

```typescript
async function getMenuData(restaurantId: string, isPublic: boolean) {
    if (isPublic) {
        return getCachedMenu(restaurantId);
    }
    // Bypass cache for private data
    return fetchFreshMenu(restaurantId);
}
```

## Troubleshooting

### Cache Not Invalidating

- Verify tag names match between cache and revalidateTag
- Check that you're calling revalidateTag in a server action or route handler
- Ensure the data function is wrapped with unstable_cache

### Stale Data

- Reduce revalidate time
- Call revalidateTag after data mutations
- Consider using shorter TTLs for frequently updated data

### Type Errors

- Ensure cache functions return serializable data
- Avoid caching Date objects directly - convert to ISO strings
- Don't cache functions or circular references

## Monitoring

Track cache performance in production:

1. Vercel Analytics for response times
2. Database query count reduction
3. Error rates on cached vs uncached paths

## References

- [Next.js Cache Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components#reducing-server-components-size)
- [Next.js Data Caching](https://nextjs.org/docs/app/building-your-application/data-fetching/caching)
