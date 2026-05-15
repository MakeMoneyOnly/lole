# GraphQL Federation Architecture

**Created:** 2026-03-24
**Status:** Active
**Related:** LOW-003 - GraphQL Federation Documentation

## Overview

lole Restaurant OS uses Apollo Federation 2 for GraphQL API composition. This document describes the federation architecture, subgraph organization, and development patterns.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Apollo Router                             │
│                   (GraphQL Gateway)                              │
│                                                                 │
│  - Query planning and execution                                 │
│  - Request routing to subgraphs                                 │
│  - Response composition                                         │
│  - Authentication/Authorization propagation                     │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Orders      │    │    Menu       │    │   Payments    │
│   Subgraph    │    │   Subgraph    │    │   Subgraph    │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Guests      │    │    Staff      │    │   Database    │
│   Subgraph    │    │   Subgraph    │    │  (Supabase)   │
└───────────────┘    └───────────────┘    └───────────────┘
```

## Subgraph Organization

### Domain Subgraphs

| Subgraph   | Domain             | File                                 | Purpose                                    |
| ---------- | ------------------ | ------------------------------------ | ------------------------------------------ |
| `orders`   | Order Management   | `graphql/subgraphs/orders.graphql`   | Order lifecycle, items, status transitions |
| `menu`     | Menu Management    | `graphql/subgraphs/menu.graphql`     | Menu items, categories, modifiers, pricing |
| `payments` | Payment Processing | `graphql/subgraphs/payments.graphql` | Payment initiation, verification, refunds  |
| `guests`   | Guest Experience   | `graphql/subgraphs/guests.graphql`   | Guest sessions, orders, feedback           |
| `staff`    | Staff Management   | `graphql/subgraphs/staff.graphql`    | Staff profiles, roles, permissions         |

### Subgraph Endpoints

Each subgraph is exposed via Next.js API routes:

```
/api/subgraphs/orders   → Orders subgraph
/api/subgraphs/menu     → Menu subgraph
/api/subgraphs/payments → Payments subgraph
/api/subgraphs/guests   → Guests subgraph
/api/subgraphs/staff    → Staff subgraph
```

## Federation 2 Features Used

### @key Directive

Entities are shared across subgraphs using the `@key` directive:

```graphql
type Order @key(fields: "id") {
    id: ID!
    # ... other fields
}

type MenuItem @key(fields: "id") {
    id: ID!
    # ... other fields
}

type Guest @key(fields: "id") {
    id: ID!
    # ... other fields
}
```

### @shareable Directive

Fields that can be resolved by multiple subgraphs:

```graphql
type Restaurant @key(fields: "id") {
    id: ID!
    name: String! @shareable
    # Can be resolved by multiple subgraphs
}
```

### @link Directive

Schema composition with Federation 2 specification:

```graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@shareable"])
```

## Entity Resolution

### Reference Resolver Pattern

Each subgraph implements reference resolvers for its entities:

```typescript
// Example: Orders subgraph
const resolvers = {
    Order: {
        __resolveReference(reference: { id: string }) {
            return fetchOrderById(reference.id);
        },
    },
};
```

### Cross-Subgraph Relationships

```
Order (orders subgraph)
  ├── items: [OrderItem] (orders subgraph)
  │     └── menuItem: MenuItem (menu subgraph - via @key)
  ├── guest: Guest (guests subgraph - via @key)
  └── payments: [Payment] (payments subgraph - via @key)
```

## Configuration Files

### Supergraph Configuration

Location: `graphql/supergraph.yaml`

```yaml
subgraphs:
    orders:
        routing_url: ${NEXT_PUBLIC_APP_URL}/api/subgraphs/orders
        schema:
            file: ./subgraphs/orders.graphql
    # ... other subgraphs
```

### Apollo Router Configuration

Location: `router/router.yaml`

- Query planning settings
- Authentication plugins
- Rate limiting configuration
- Telemetry and monitoring

## Development Workflow

### Local Development

1. Start Next.js development server (serves subgraph endpoints)
2. Run Apollo Router locally or use Apollo Sandbox
3. Compose supergraph schema locally:

```bash
rover supergraph compose --config graphql/supergraph.yaml
```

### Schema Changes

1. Modify subgraph schema in `graphql/subgraphs/*.graphql`
2. Run composition to validate changes
3. Publish to Apollo GraphOS (production)

```bash
rover subgraph publish lole-api@current \
    --name orders \
    --schema graphql/subgraphs/orders.graphql
```

## Authentication & Authorization

### Context Propagation

Authentication context is propagated from the router to subgraphs via headers:

```typescript
// Apollo context
interface GraphQLContext {
    userId?: string;
    restaurantId?: string;
    role?: string;
    isAuthenticated: boolean;
}
```

### Authorization Patterns

1. **Field-level authorization**: Resolver-level checks
2. **Query-level authorization**: Middleware validation
3. **Entity-level authorization**: RLS policies in database

## DataLoaders

DataLoaders prevent N+1 queries in federated resolvers:

Location: `src/lib/graphql/dataloaders.ts`

```typescript
export function createDataLoaders(supabase: SupabaseClient, context: TenantContext) {
    return {
        orders: new DataLoader(async (ids: string[]) => {
            // Batch load orders with tenant verification
        }),
        menuItems: new DataLoader(async (ids: string[]) => {
            // Batch load menu items with tenant verification
        }),
        // ... other loaders
    };
}
```

## Error Handling

### Federated Errors

Errors are properly formatted for federation:

```typescript
interface GraphQLError {
    message: string;
    extensions: {
        code: string;
        http: { status: number };
        // Additional context
    };
}
```

### Error Classification

| Code               | HTTP Status | Description                       |
| ------------------ | ----------- | --------------------------------- |
| `UNAUTHENTICATED`  | 401         | Missing or invalid authentication |
| `FORBIDDEN`        | 403         | Insufficient permissions          |
| `NOT_FOUND`        | 404         | Entity not found                  |
| `VALIDATION_ERROR` | 400         | Input validation failed           |
| `INTERNAL_ERROR`   | 500         | Server error                      |

## Monitoring & Observability

### Apollo Studio

- Query tracing
- Performance metrics
- Error tracking
- Schema change history

### Custom Metrics

- Subgraph response times
- Entity resolution latency
- DataLoader hit rates

## Best Practices

### Schema Design

1. **Domain-driven subgraphs**: Each subgraph owns its domain
2. **Minimal cross-subgraph dependencies**: Reduce federation overhead
3. **Consistent naming**: Follow GraphQL naming conventions
4. **Documentation**: All types and fields have descriptions

### Performance

1. **Use DataLoaders**: Always batch database queries
2. **Limit depth**: Avoid deeply nested queries
3. **Pagination**: All list fields support pagination
4. **Caching**: Use `@cacheControl` directives where appropriate

### Security

1. **Tenant isolation**: All DataLoaders verify tenant ownership
2. **Input validation**: Zod schemas for all mutations
3. **Rate limiting**: Per-user and per-IP rate limits
4. **Query complexity**: Limit query depth and breadth

## Migration Path

### From REST to GraphQL

1. Subgraphs can coexist with REST endpoints
2. Gradual migration of clients
3. BFF (Backend for Frontend) pattern for mobile apps

### Versioning

1. **Additive changes**: New fields are non-breaking
2. **Deprecation**: Use `@deprecated` directive
3. **Sunset notices**: Communicate removal timeline

## References

- [Apollo Federation 2 Documentation](https://www.apollographql.com/docs/federation/)
- [GraphQL Specification](https://spec.graphql.org/)
- [Apollo Router Documentation](https://www.apollographql.com/docs/router/)
- Related: `src/lib/graphql/` - GraphQL implementation
- Related: `router/` - Apollo Router configuration
