# Deploying to Staging

**Version 1.0 · May 2026 · How-to Guide**

## Prerequisites

- Production credentials configured
- Staging Supabase project created
- Vercel project configured
- Environment variables set:
  - `SUPABASE_ACCESS_TOKEN`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SECRET_KEY`

## Steps

### 1. Build Locally

```bash
pnpm build
```

### 2. Deploy to Vercel Staging

```bash
vercel --prebuilt --env NODE_ENV=production
```

### 3. Run Migrations

```bash
pnpm supabase:cli db push --db-url $STAGING_DATABASE_URL
```

### 4. Verify

- Check https://staging.lole.app health endpoint
- Verify database migrations applied
- Test key user flows
