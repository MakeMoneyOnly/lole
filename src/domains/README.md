# Domains

Business logic layer following the **repository-service pattern**.

## Structure

Each domain contains:

- `service.ts` - Business logic and use cases
- `repository.ts` - Data persistence and external API integration
- `resolvers.ts` - GraphQL/resolver logic (if applicable)
- `index.ts` - Public exports
- `__tests__/` - Domain-specific tests

## Creating a New Domain

```typescript
// domains/new-domain/service.ts
export const newDomainService = {
    async someBusinessOperation(input: Input): Promise<Output> {
        // Business logic here
        return newDomainRepository.save(data);
    },
};

// domains/new-domain/repository.ts
export const newDomainRepository = {
    async save(data: Data): Promise<Result> {
        // Persistence logic
    },
};

// domains/new-domain/index.ts
export { newDomainService } from './service';
export { newDomainRepository } from './repository';
```

## Available Domains

- `cart` - Shopping cart management
- `staff` - Staff management
- `orders` - Order processing
- `menu` - Menu management
- `guests` - Guest management
- `payments` - Payment processing

## References

- [Architecture Documentation](../../docs/architecture/README.md)
- [ADR-001: Repository-Service Pattern](../../docs/architecture/adr/001-domain-repository-pattern.md)
