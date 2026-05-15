# GraphQL Federation - Apollo GraphOS Publishing Guide

## Overview

This document describes how to publish the lole subgraph schemas to Apollo GraphOS.

## Prerequisites

1. **Apollo GraphOS Account**: Already created (`lole-production-tj1sjiw@current`)
2. **Apollo API Key**: Get from https://studio.apollographql.com/settings/api-keys
3. **Rover CLI**: Installed and configured

## Option 1: Using Rover CLI (Recommended)

### Step 1: Install Rover

**Windows (PowerShell):**

```powershell
iwr 'https://rover.apollo.dev/win/latest' | iex
```

**macOS/Linux:**

```bash
curl -sSL https://rover.apollo.dev/nix/latest | sh
```

### Step 2: Authenticate

```bash
rover config auth YOUR_APOLLO_KEY
```

### Step 3: Publish Subgraphs

Run from the project root:

```bash
# Set environment variables
$env:APOLLO_KEY = "your-key-here"
$env:GRAPH_REF = "lole-production-tj1sjiw@current"

# Or use the script
.\scripts\publish-subgraphs.ps1
```

## Option 2: Using GitHub Actions (CI/CD)

The repository already includes a GitHub Actions workflow for schema publishing.

### Setup:

1. Go to GitHub repository Settings → Secrets and variables → Actions
2. Add a new repository secret:
    - Name: `APOLLO_KEY`
    - Value: Your Apollo API key
3. The workflow will publish subgraphs on every push to `src/domains/*/schema.graphql`

## Option 3: Manual Upload via Apollo Studio

1. Go to https://studio.apollographql.com/graph/lole-production-tj1sjiw
2. Navigate to your graph's "Subgraphs" tab
3. Click "Add Subgraph" for each subgraph:
    - Name: orders, menu, payments, guests, staff
    - Routing URL: https://lole.app/api/graphql
    - Schema: Upload the corresponding `.graphql` file from `src/domains/`

## Subgraph Schemas

| Subgraph | File                                  | Description                       |
| -------- | ------------------------------------- | --------------------------------- |
| Orders   | `src/domains/orders/schema.graphql`   | Orders, order items, KDS          |
| Menu     | `src/domains/menu/schema.graphql`     | Menu items, categories, modifiers |
| Payments | `src/domains/payments/schema.graphql` | Transactions, Chapa, Telebirr     |
| Guests   | `src/domains/guests/schema.graphql`   | Guests, loyalty accounts          |
| Staff    | `src/domains/staff/schema.graphql`    | Staff, shifts, time entries       |

## Verify Published Schemas

After publishing, check in Apollo Studio:

1. Go to your graph's "Schema" tab
2. Verify all types are visible
3. Check "Subgraphs" to confirm all 5 subgraphs are registered

## Next Steps

After successful publishing:

1. Deploy Apollo Router to Railway (see `router/`)
2. Configure environment variables in Railway:
    - `APOLLO_KEY`: Your Apollo API key
    - `APOLLO_GRAPH_REF`: `lole-production-tj1sjiw@current`
3. Update DNS to point to the router

## Troubleshooting

### Error: Unknown type JSON

Add `scalar JSON` to your schema with `@specifiedBy` directive:

```graphql
scalar JSON @specifiedBy(url: "https://graphql.org/learn/schemas/")
```

### Error: Unknown directive "@external"

Simplify your schema to only use `@key` directive initially:

```graphql
extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])
```

### Error: Graph not found

Verify your graph reference is correct: `graph-name@variant`
