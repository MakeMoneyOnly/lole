# Apollo Router (GraphOS)

Production-ready GraphQL Federation router deployed to Railway.

## Environment Variables

| Variable                      | Required | Description                                            |
| ----------------------------- | -------- | ------------------------------------------------------ |
| `APOLLO_KEY`                  | Yes      | GraphOS API key                                        |
| `APOLLO_GRAPH_REF`            | Yes      | `graph-name@variant` (e.g., `lole-production@current`) |
| `NEXT_PUBLIC_SUPABASE_URL`    | Yes      | Supabase project URL for JWT JWKS                      |
| `LOG_LEVEL`                   | No       | Log level (default: `info`)                            |
| `INCLUDE_SUBGRAPH_ERRORS`     | No       | Include subgraph errors (default: `false`)             |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No       | OpenTelemetry collector endpoint                       |
| `REDIS_URL`                   | No       | Redis connection for entity caching                    |

## Railway Deployment

```bash
# Connect to Railway
railway link

# Deploy
railway up

# Or use the Railway dashboard:
# - Select Dockerfile
# - Set root directory: router/
# - Configure environment variables above
```

## Health Check

- Endpoint: `/health` on port 8088 (configurable in router.graphos.yaml)
- Docker HEALTHCHECK configured for 30s interval
