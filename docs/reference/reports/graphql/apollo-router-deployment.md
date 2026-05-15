# Apollo Router Deployment Guide

## Overview

This document describes how to deploy and operate the Apollo Router for lole's GraphQL Federation architecture.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client Apps   │────▶│  Apollo Router  │────▶│   Subgraphs     │
│  (POS, KDS,     │     │  (Port 4000)    │     │  (Next.js API)  │
│   Guest, etc)   │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  Apollo GraphOS │
                        │  (Schema Mgmt)  │
                        └─────────────────┘
```

## Prerequisites

1. **Apollo GraphOS Account**
    - Create an account at [apollographql.com](https://www.apollographql.com)
    - Create a graph for lole
    - Generate an API key with `Publisher` role

2. **Environment Variables**

    ```bash
    # Required
    APOLLO_KEY=your-apollo-key
    APOLLO_GRAPH_REF=lole-production@current
    NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
    NEXT_PUBLIC_APP_URL=https://api.lole.app

    # Optional
    OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
    LOG_LEVEL=info
    INCLUDE_SUBGRAPH_ERRORS=false
    ```

## Local Development

### Running the Router Locally

1. **Install Rover CLI**

    ```bash
    curl -sSL https://rover.apollo.dev/nix/latest | sh
    ```

2. **Compose Supergraph Locally**

    ```bash
    rover supergraph compose --config graphql/supergraph.yaml > supergraph.graphql
    ```

3. **Run Apollo Router**
    ```bash
    docker run --rm \
      -p 4000:4000 \
      -p 8088:8088 \
      -p 9090:9090 \
      -v $(pwd)/supergraph.graphql:/etc/supergraph.graphql \
      -v $(pwd)/router/router.yaml:/etc/router.yaml \
      -e APOLLO_ROUTER_SUPERGRAPH_PATH=/etc/supergraph.graphql \
      ghcr.io/apollographql/router:v2.1.0
    ```

### Running Subgraphs

Each subgraph runs as a Next.js API route:

- Orders: `http://localhost:3000/api/subgraphs/orders`
- Menu: `http://localhost:3000/api/subgraphs/menu`
- Payments: `http://localhost:3000/api/subgraphs/payments`
- Guests: `http://localhost:3000/api/subgraphs/guests`
- Staff: `http://localhost:3000/api/subgraphs/staff`

## Production Deployment

### Option 1: Docker Container

1. **Build the Router Image**

    ```bash
    docker build -t lole-router -f router/Dockerfile router/
    ```

2. **Run the Container**
    ```bash
    docker run -d \
      --name lole-router \
      -p 4000:4000 \
      -p 8088:8088 \
      -p 9090:9090 \
      -e APOLLO_KEY=${APOLLO_KEY} \
      -e APOLLO_GRAPH_REF=${APOLLO_GRAPH_REF} \
      -e NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
      lole-router
    ```

### Option 2: Kubernetes Deployment

See `k8s/router-deployment.yaml` for Kubernetes configuration.

### Option 3: Managed Cloud

Deploy to Apollo's managed cloud or use a container service (AWS ECS, Google Cloud Run, Azure Container Apps).

## Schema Publishing

### CI/CD Pipeline

The GitHub workflow `.github/workflows/publish-graphql-subgraphs.yml` automatically publishes subgraph schemas on merge to main.

### Manual Publishing

```bash
# Publish a subgraph schema
rover subgraph publish lole-production@current \
  --name orders \
  --schema graphql/subgraphs/orders.graphql \
  --routing-url https://api.lole.app/api/subgraphs/orders
```

### Schema Checks

```bash
# Check for breaking changes before publishing
rover subgraph check lole-production@current \
  --name orders \
  --schema graphql/subgraphs/orders.graphql
```

## Monitoring

### Health Endpoints

- **Health Check**: `http://router:8088/health`
- **Readiness**: `http://router:8088/ready`
- **Metrics**: `http://router:9090/metrics`

### Prometheus Metrics

The router exposes Prometheus metrics at port 9090:

```yaml
# Key metrics to monitor
apollo_router_request_duration_seconds
apollo_router_request_total
apollo_router_cache_hit_count
apollo_router_cache_miss_count
```

### Sentry Integration

Errors are automatically reported to Sentry with context:

- Restaurant ID
- User ID
- Operation name
- Query hash

## Security

### JWT Authentication

The router validates Supabase JWTs using JWKS:

```yaml
authentication:
    router:
        jwt:
            jwks:
                - url: ${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json
```

### Rate Limiting

Rate limits are configured per subgraph:

```yaml
traffic_shaping:
    router:
        rate_limit:
            capacity: 1000
            interval: 1s
    subgraphs:
        payments:
            rate_limit:
                capacity: 100
                interval: 1s
```

### CORS

Allowed origins are explicitly configured:

```yaml
cors:
    origins:
        - 'https://lole.app'
        - 'https://www.lole.app'
```

## Troubleshooting

### Common Issues

1. **Schema Composition Errors**

    ```bash
    # Check schema validity
    rover subgraph check lole-production@current --name orders --schema orders.graphql
    ```

2. **Authentication Failures**
    - Verify JWT secret matches Supabase
    - Check token expiration
    - Verify JWKS endpoint is accessible

3. **High Latency**
    - Check subgraph response times
    - Review router metrics for bottlenecks
    - Consider adding caching

### Logs

View router logs:

```bash
docker logs -f lole-router
```

Structured JSON logs are output for easy parsing by log aggregation systems.

## Rollback

To rollback a schema change:

```bash
# Revert to previous schema
rover subgraph publish lole-production@current \
  --name orders \
  --schema previous-orders.graphql
```

For router configuration changes, redeploy the previous container image.

## Related Documentation

- [GraphQL Subgraph Schemas](../../../graphql/subgraphs/)
- [Router Configuration](../../../router/router.graphos.yaml)
- [CI/CD Workflow](../../../.github/workflows/publish-graphql-subgraphs.yml)
