# Orders Feature

Order management feature following feature-slice architecture.

## Structure

```
orders/
├── api/                 # API route delegates
├── services/            # Feature orchestration
├── domain/              # Re-exports from src/domains/orders/
├── contracts/           # Zod schemas for API validation
├── events/              # Event types and handlers
├── hooks/               # React hooks for orders
└── tests/               # Feature tests
```

## Usage

```typescript
// Using hooks
import { useOrders } from '@/features/orders/hooks/useOrders';
const { orders, isLoading } = useOrders({ restaurantId });

// Using services
import { createOrderService } from '@/features/orders/services/create-order-service';
await createOrderService.createOrder(orderData);

// Using contracts
import { CreateOrderRequestSchema } from '@/features/orders/contracts';
```

## Links

- [Domain Layer](../../domains/orders/) - Business logic
- [Features README](../README.md) - Architecture overview
