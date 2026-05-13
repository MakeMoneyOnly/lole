# Lib

Shared utilities and helpers used across features and domains.

## Categories

### Core Utilities

- `utils.ts` - General utility functions
- `constants.tsx` - Shared constants and config
- `animations.ts` - Animation helpers

### Data & API

- `supabase.ts` - Supabase client setup
- `react-query.ts` - React Query configuration
- `fetchUtils.ts` - Fetch wrapper utilities
- `rate-limit.ts` - Rate limiting utilities

### Error Handling

- `errors.ts` - Error classes and types
- `errorHandler.ts` - Global error handling
- `logger.ts` - Logging utilities

### Security

- `audit.ts` - Audit logging
- `auditLogger.ts` - Audit trail
- `csrf.ts` - CSRF protection
- `webhook.ts` - Webhook utilities

### Other

- `upsellEngine.ts` - Upsell logic

## Creating a New Utility

Utilities should be:

- **Generic** - not domain or feature specific
- **Well-tested** - include unit tests
- **Documented** - JSDoc comments

```typescript
/**
 * Formats a number as currency
 * @param amount - The amount to format
 * @param currency - The currency code (default: USD)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
    }).format(amount);
}
```

## References

- [Architecture Documentation](../../docs/architecture/README.md)
