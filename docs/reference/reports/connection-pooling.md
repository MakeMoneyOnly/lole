# Supabase Connection Pooling Configuration

## Overview

This document describes the app database lane for Supabase using Supavisor. In lole, pooler and direct are separate lanes:

- `DATABASE_URL` = pooler, default for app/runtime SQL traffic
- `DATABASE_DIRECT_URL` = direct, infra-only for migrations, CI, admin scripts, and PowerSync replication

## Why Connection Pooling?

- **Reduces connection overhead**: Establishing a new database connection is expensive. Connection pooling reuses existing connections.
- **Improves latency**: Connection reuse reduces the time spent on connection setup.
- **Prevents connection exhaustion**: Limits the number of concurrent connections to protect the database.
- **Better serverless performance**: Particularly beneficial for serverless environments like Vercel where functions scale horizontally.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  App SQL Lane   │────▶│  Supavisor     │────▶│  PostgreSQL    │
│  (serverless)   │     │  (Pooler)      │     │  (Supabase)    │
│                 │     │  :6543         │     │  :5432          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Configuration

### Environment Variables

Add the following to your `.env.local`:

| Variable                           | Description                           | Default          | Required |
| ---------------------------------- | ------------------------------------- | ---------------- | -------- |
| `DATABASE_URL`                     | App-safe pooler connection string     | None             | Yes      |
| `DATABASE_DIRECT_URL`              | Infra-only direct connection string   | None             | Yes      |
| `SUPABASE_POOL_MODE`               | Pool mode: `transaction` or `session` | `transaction`    | No       |
| `SUPABASE_POOL_SIZE`               | Connections per pool instance (1-50)  | `10`             | No       |
| `SUPABASE_POOL_MAX_CLIENTS`        | Max clients in pool (1-100)           | `20`             | No       |
| `SUPABASE_POOL_CONNECTION_TIMEOUT` | Connection timeout in seconds (1-300) | `30`             | No       |
| `SUPABASE_POOL_IDLE_TIMEOUT`       | Idle timeout in seconds (60-3600)     | `1800`           | No       |
| `SUPABASE_POOLER_URL`              | Direct pooler connection string       | Auto-constructed | No       |

### Pool Mode Options

#### Transaction Mode (Recommended)

- Connections are borrowed for a single query/transaction
- Best for most web applications
- Supports prepared statements with limitations

#### Session Mode

- Connections persist for the full client session
- Use only when you need:
    - PostgreSQL session features (e.g., `LISTEN`/`NOTIFY`)
    - Temporary tables
    - Prepared statements with global state

### Sizing Guidelines

| Expected Concurrent Users | Recommended Pool Size |
| ------------------------- | --------------------- |
| < 50                      | 5-10                  |
| 50-100                    | 10-20                 |
| 100-500                   | 20-30                 |
| > 500                     | 30-50                 |

**Note**: Each Vercel function instance gets its own pool. Start conservative and monitor.

## Supavisor Setup

### Enable Pooler in Supabase Dashboard

1. Go to **Settings** → **Database**
2. Find **Connection Pooler**
3. Enable the pooler
4. Note the pooler hostname (format: `pooler.[PROJECT-REF].supabase.co`)

### Connection String Format

```
postgresql://postgres:[PASSWORD]@pooler.[PROJECT-REF].supabase.co:6543/postgres
```

**Note**: Pooler uses port **6543** (not 5432).

## Health Check Integration

Connection pool configuration is included in the health check response:

```json
{
    "status": "healthy",
    "checks": {
        "supabase": {
            "status": "pass",
            "latencyMs": 45,
            "poolEnabled": true,
            "poolMode": "transaction",
            "poolSize": 10
        }
    }
}
```

Monitor the `/api/health` endpoint to track:

- `poolEnabled`: Whether pooling is active
- `poolMode`: Current pool mode (transaction/session)
- `poolSize`: Configured pool size

## Code Implementation

### Server Client

The server client automatically applies pool configuration:

```typescript
// src/lib/supabase/server.ts
import { getPoolConfig } from './pool';

return createServerClient<Database>(url, key, {
    cookies: {
        /* ... */
    },
    db: getPoolConfig().enabled
        ? {
              poolMode: getPoolConfig().mode,
              poolConfig: {
                  max: getPoolConfig().poolSize,
                  idleTimeoutMillis: getPoolConfig().idleTimeout * 1000,
                  connectionTimeoutMillis: getPoolConfig().connectionTimeout * 1000,
              },
          }
        : undefined,
});
```

### Pool Configuration Module

The pool configuration module (`src/lib/supabase/pool.ts`) provides:

- `getPoolConfig()`: Get full pool configuration
- `isPoolEnabled()`: Check if pooling is enabled
- `getPoolerUrl()`: Get pooler connection URL

## Monitoring & Troubleshooting

### Key Metrics to Monitor

1. **Connection pool utilization**: Track active/idle connections
2. **Database latency**: Ensure pooling doesn't add latency
3. **Pool exhaustion**: Monitor for connection timeout errors
4. **Error rates**: Track `pool_timeout`, `connection` errors

### Common Issues

| Error                   | Cause                 | Solution                         |
| ----------------------- | --------------------- | -------------------------------- |
| `pool_timeout`          | All connections busy  | Increase pool size               |
| `too many connections`  | Pool too large for DB | Reduce pool size                 |
| `connection refused`    | Pooler not enabled    | Enable in Supabase dashboard     |
| `authentication failed` | Wrong password        | Verify credentials in pooler URL |

## Best Practices

1. **Pooler is default**: Use `DATABASE_URL` for any request-driven SQL traffic
2. **Direct is privileged**: Use `DATABASE_DIRECT_URL` only for infra-only capabilities
3. **Start with transaction mode**: Only use session mode if specifically needed
4. **Conservative pool sizing**: Start small, monitor, then adjust
5. **Monitor in production**: Use health checks and metrics
6. **Set appropriate timeouts**: Balance connection reuse with freshness
7. **Never runtime-switch lanes**: Separation belongs in env and module boundaries, not feature flags

## Related Documentation

- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connection-pooling)
- [Supavisor Documentation](https://github.com/supabase/supavisor)
- [Health Check API](./health-check-api.md)
- [Performance SLOs](./performance-slos.md)
