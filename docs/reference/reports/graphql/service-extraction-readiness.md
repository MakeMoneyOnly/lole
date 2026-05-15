# GraphQL Service Extraction Readiness

## Overview

This document validates that lole's GraphQL Federation architecture allows subgraphs to be extracted into separate services without requiring client rewrites. This addresses the CRIT-07 requirement: "Service extraction possible without client rewrites."

## Architecture Validation

### Current State

All subgraphs are currently implemented as Next.js API routes within the monolith:

| Subgraph | Route                     | Schema File                          | Resolver                            |
| -------- | ------------------------- | ------------------------------------ | ----------------------------------- |
| Orders   | `/api/subgraphs/orders`   | `graphql/subgraphs/orders.graphql`   | `src/domains/orders/resolvers.ts`   |
| Menu     | `/api/subgraphs/menu`     | `graphql/subgraphs/menu.graphql`     | `src/domains/menu/resolvers.ts`     |
| Payments | `/api/subgraphs/payments` | `graphql/subgraphs/payments.graphql` | `src/domains/payments/resolvers.ts` |
| Guests   | `/api/subgraphs/guests`   | `graphql/subgraphs/guests.graphql`   | `src/domains/guests/resolvers.ts`   |
| Staff    | `/api/subgraphs/staff`    | `graphql/subgraphs/staff.graphql`    | `src/domains/staff/resolvers.ts`    |

### Federation 2 Compliance

All subgraphs follow Apollo Federation 2 specifications:

1. **Independent Schemas**: Each subgraph has its own `.graphql` schema file with Federation 2 directives (`@key`, `@external`, `@requires`, `@shareable`)

2. **Standard GraphQL Context**: All subgraphs use the same `GraphQLContext` interface:

    ```typescript
    interface GraphQLContext {
        token: string | null;
        guestSession: string | null;
        user: {
            id: string;
            restaurantId: string;
            role?: string;
        } | null;
    }
    ```

3. **Apollo Server Integration**: Each subgraph uses `ApolloServer` with standard configuration

## Extraction Path

### Step 1: Deploy Subgraph as Standalone Service

When extracting a subgraph (e.g., Orders):

1. Create new service repository
2. Copy schema file (`orders.graphql`)
3. Copy resolver (`domains/orders/resolvers.ts`)
4. Copy repository and service layers (`domains/orders/repository.ts`, `domains/orders/service.ts`)
5. Set up database connection (Supabase client)
6. Deploy to container service (Railway, Fly.io, AWS ECS)

### Step 2: Update Apollo Router Configuration

Update `router/router.yaml` or `graphql/supergraph.yaml`:

```yaml
subgraphs:
    orders:
        routing_url: https://orders-service.lole.app/graphql
        schema:
            file: ./subgraphs/orders.graphql
```

### Step 3: No Client Changes Required

Clients continue to query the same GraphQL endpoint. The Apollo Router handles routing to the new service location transparently.

## Validation Checklist

### ✅ Schema Independence

- [x] Each subgraph has its own schema file
- [x] Schemas use Federation 2 directives
- [x] No cross-subgraph type dependencies that require co-location

### ✅ Resolver Independence

- [x] Each subgraph has its own resolver file
- [x] Resolvers don't import from other subgraph resolvers
- [x] Data loading is self-contained within each domain

### ✅ Data Layer Independence

- [x] Each domain has its own repository (`domains/*/repository.ts`)
- [x] Each domain has its own service layer (`domains/*/service.ts`)
- [x] Database queries are scoped to domain tables

### ✅ Context Propagation

- [x] JWT authentication handled at router level
- [x] User context propagated via headers (`x-user-id`, `x-restaurant-id`, `x-user-role`)
- [x] Guest session context propagated via `x-guest-session` header

### ✅ Apollo Router Configuration

- [x] Router configured for JWT validation
- [x] Rate limiting configured at router level
- [x] CORS configured for allowed origins
- [x] Header propagation configured

## Domain Dependency Analysis

### Orders Domain

**Dependencies:**

- Database: `orders`, `order_items`, `payments` tables
- Internal: None (standalone)

**Extraction Complexity:** Low

### Menu Domain

**Dependencies:**

- Database: `menu_items`, `categories`, `modifier_groups`, `modifier_options` tables
- Internal: None (standalone)

**Extraction Complexity:** Low

### Payments Domain

**Dependencies:**

- Database: `payments`, `refunds` tables
- External: Chapa, Telebirr payment gateways
- Internal: None (standalone)

**Extraction Complexity:** Medium (external integrations)

### Guests Domain

**Dependencies:**

- Database: `guests`, `guest_sessions` tables
- Internal: None (standalone)

**Extraction Complexity:** Low

### Staff Domain

**Dependencies:**

- Database: `restaurant_staff`, `staff_schedules`, `time_entries` tables
- Internal: None (standalone)

**Extraction Complexity:** Low

## Migration Strategy

### Phase 1: Extract Payments Service (Highest Isolation)

Payments has the clearest boundaries and would benefit most from independent scaling.

1. Deploy payments subgraph as standalone service
2. Update router configuration
3. Monitor for 2 weeks
4. Decommission monolith payments route

### Phase 2: Extract Orders Service (Highest Traffic)

Orders handles the most critical path and would benefit from independent scaling.

1. Deploy orders subgraph as standalone service
2. Update router configuration
3. Monitor for 2 weeks
4. Decommission monolith orders route

### Phase 3: Extract Remaining Services

Follow same pattern for Menu, Guests, and Staff domains.

## Conclusion

**Status: ✅ READY FOR SERVICE EXTRACTION**

The GraphQL Federation architecture is properly structured to allow any subgraph to be extracted into a standalone service without requiring client changes. The Apollo Router serves as the abstraction layer that makes the physical location of subgraphs transparent to clients.

Key enablers:

1. Federation 2 compliant schemas
2. Independent domain resolvers
3. Standard GraphQL context propagation
4. Apollo Router as the single client-facing endpoint

## Related Documentation

- [Apollo Router Deployment Guide](./apollo-router-deployment.md)
- [GraphQL Subgraph Schemas](../../../graphql/subgraphs/)
- [Supergraph Configuration](../../../graphql/supergraph.yaml)
