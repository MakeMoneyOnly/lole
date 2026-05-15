# GraphQL Federation Migration Guide

## Overview

This document outlines the migration path from the current ad-hoc REST API surface to a GraphQL Federation architecture using Apollo GraphOS and Railway.

## Current State

- **API Surface**: Ad-hoc REST routes in `src/app/api/*`
- **Contract**: None — no schema, no versioning, no breaking change detection
- **Scale Risk**: P0 — when delivery partners integrate, refactoring breaks their integrations silently

## Target State

- **API Surface**: GraphQL Federation via Apollo Router
- **Contract**: GraphQL schema with codegen, CI contract checks
- **Scale Ready**: Zero client changes when extracting services

---

## Quick Start: Complete Apollo GraphOS Setup

### Prerequisites

1. **Apollo GraphOS Account**: [studio.apollographql.com](https://studio.apollographql.com/)
2. **Railway Account**: [railway.app](https://railway.app)
3. **GitHub Repository**: Code pushed to GitHub

---

### Step 1: Install Rover CLI

Run in PowerShell (as Administrator):

```powershell
iwr 'https://rover.apollo.dev/win/latest' | iex
```

Verify:

```powershell
rover --version
```

---

### Step 2: Create Graph in GraphOS

1. Go to [Apollo GraphOS Studio](https://studio.apollographql.com/)
2. Sign up and create an Organization (e.g., "lole")
3. Click **New Graph**
4. Name: `lole-production`
5. Graph type: **Cloud**
6. Copy your **Graph Ref**: `lole-production@current`

---

### Step 3: Get Apollo API Key

1. In GraphOS Studio: **Settings** → **API Keys**
2. Create **Personal API Key**
3. Copy the key

---

### Step 4: Authenticate Rover

```powershell
rover config auth
# Paste your API key when prompted
```

---

### Step 5: Publish Subgraphs

Run the publish script:

```powershell
$env:APOLLO_KEY = "your-apollo-key"
$env:GRAPH_REF = "lole-production@current"
$env:ROUTING_URL = "https://lole.app/api/graphql"

# Run each command (note: Rover syntax may vary by version):
# For newer versions, use the subgraph publish format:
rover subgraph publish lole-production@current --schema ./src/domains/orders/schema.graphql --routing-url https://lole.app/api/graphql

# OR use the legacy format:
rover graph publish lole-production@current --schema ./src/domains/orders/schema.graphql
```

Or use the script:

```powershell
./scripts/publish-subgraphs.ps1
```

---

### Step 6: Deploy to Railway

**Option A: GitHub Integration (Recommended)**

1. Push code to GitHub
2. Go to [Railway](https://railway.app)
3. Click **"Deploy on Railway"**
4. Connect your GitHub repository
5. Add environment variables:
    - `APOLLO_KEY` = your Apollo API key
    - `APOLLO_GRAPH_REF` = `lole-production@current`
6. Railway builds automatically from `router/Dockerfile`

**Option B: Railway CLI**

```powershell
npm install -g @railway/cli
railway login
railway init
railway variables set APOLLO_KEY=your-apollo-key
railway variables set APOLLO_GRAPH_REF=lole-production@current
railway up
```

---

### Step 7: Verify Deployment

1. Get Railway URL (e.g., `https://lole-router.up.railway.app`)
2. Test GraphQL:

```graphql
query {
    __schema {
        types {
            name
        }
    }
}
```

---

## Migration Phases

### Phase 1: GraphQL Foundation ✅ (Complete)

1. ✅ Domain directory structure: `src/domains/{domain}/*`
2. ✅ Subgraph schemas (Orders, Menu, Payments, Guests, Staff)
3. ✅ Apollo Server endpoint: `/api/graphql`
4. ✅ Codegen: `codegen.yml`
5. ✅ CI contract check workflow

### Phase 2: Parallel Operation

1. Add new features to GraphQL only
2. Migrate existing endpoints to GraphQL
3. Update frontend clients incrementally
4. Deprecate REST endpoints

### Phase 3: Full GraphOS

1. Publish all subgraphs to GraphOS
2. Deploy Apollo Router with GraphOS config
3. Remove static subgraph configs

---

## GraphQL Schema Governance

### Breaking Changes

| Change                   | Impact   |
| ------------------------ | -------- |
| Remove type              | Breaking |
| Remove field             | Breaking |
| Change field type        | Breaking |
| Make nullable → non-null | Breaking |
| Remove enum value        | Breaking |
| Remove input field       | Breaking |

### Non-Breaking

- Add new type
- Add new field
- Add enum value
- Make non-null → nullable

---

## Configuration Files

### Router Files

| File                         | Purpose                |
| ---------------------------- | ---------------------- |
| `router/Dockerfile`          | Container for Railway  |
| `router/router.graphos.yaml` | GraphOS-based config   |
| `router/router.yaml`         | Static config (legacy) |

---

## Environment Variables

### For Publishing

```env
APOLLO_KEY=your-api-key
GRAPH_REF=lole-production@current
ROUTING_URL=https://lole.app/api/graphql
```

### For Railway

```env
APOLLO_KEY=your-api-key
APOLLO_GRAPH_REF=lole-production@current
```

---

## Rollback Plan

1. **Router fails**: Point clients to `/api/graphql` directly
2. **Schema issues**: Revert schema changes, CI blocks merge
3. **Performance**: Keep REST endpoints running in parallel
