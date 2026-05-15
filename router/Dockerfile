# Apollo Router Dockerfile for GraphOS
# Deploy to Railway - uses GraphOS for supergraph composition
#
# Environment Variables Required:
#   APOLLO_KEY: Your Apollo GraphOS API key
#   APOLLO_GRAPH_REF: graph-name@variant (e.g., lole-production@current)
#
# Build: docker build -t lole-router .
# Run: docker run -p 4000:4000 -e APOLLO_KEY -e APOLLO_GRAPH_REF lole-router

FROM ghcr.io/apollographql/router:v2.1.0

# Set environment variables for GraphOS
ENV APOLLO_ROUTER_CONFIG_PATH=/app/config/router.yaml
ENV APOLLO_ROUTER_HOME=/app

# Copy GraphOS configuration
COPY router.graphos.yaml /app/config/router.yaml

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Start router - it will fetch supergraph from GraphOS
CMD ["--config", "/app/config/router.yaml"]
