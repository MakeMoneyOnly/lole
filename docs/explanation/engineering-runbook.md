# ገበታ lole — Engineering Runbook

**Version 1.0 · March 2026 · For the Builder**

> This is the operational playbook. It covers everything you need to know to deploy, debug, and operate lole in production — without a DevOps team.

---

## Environments

| Environment | URL                                 | Branch        | Purpose          |
| ----------- | ----------------------------------- | ------------- | ---------------- |
| Production  | `lole.app` + `lolemenu.com`         | `main`        | Live restaurants |
| Preview     | Vercel preview URL (auto-generated) | Any PR branch | Feature testing  |
| Local       | `localhost:3000`                    | Any           | Development      |

---

## Environment Variables

### Required for All Environments

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>          # Server-side only — never expose to client
DATABASE_URL=<pooler-url>                 # Default app-safe SQL lane
DATABASE_DIRECT_URL=<direct-url>          # Infra-only: PowerSync replication, migrations, CI, admin scripts
SUPABASE_POOLER_URL=<pooler-url>          # Optional alias
SUPABASE_DB_URL=<direct-url>              # Optional alias

# Upstash
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=AX...
QSTASH_TOKEN=<your-qstash-token>
QSTASH_CURRENT_SIGNING_KEY=sig_...         # Verify QStash webhooks

# Payments
CHAPA_SECRET_KEY=CHASECK_...               # Server-side only
CHAPA_WEBHOOK_SECRET=...                   # For HMAC verification
TELEBIRR_API_BASE_URL=...                  # Testbed or production gateway base URL
TELEBIRR_CHECKOUT_BASE_URL=...             # Matching hosted checkout base URL
TELEBIRR_FABRIC_APP_ID=...                 # Telebirr fabric app ID / X-APP-Key
TELEBIRR_APP_SECRET=...                    # Telebirr app secret
TELEBIRR_MERCHANT_APP_ID=...               # Merchant app ID
TELEBIRR_MERCHANT_CODE=...                 # Merchant short code
TELEBIRR_PRIVATE_KEY=...                   # PEM private key used for request signing
TELEBIRR_WEBHOOK_SECRET=...
CBE_MERCHANT_ID=...                        # Phase 2

# ERCA
ERCA_API_URL=https://api.erca.gov.et       # Production
ERCA_API_KEY=...

# QR Security
lole_QR_HMAC_SECRET=...                 # Must be 32+ random bytes, never reuse

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
TELEGRAM_BOT_TOKEN=...                     # For owner EOD reports
TELEGRAM_ALERT_CHAT_ID=...                 # Your personal Telegram for alerts

# PowerSync
POWERSYNC_URL=https://...powersync.journeyapps.com

# PowerSync replication lane
POWERSYNC_DATABASE_URL=${DATABASE_DIRECT_URL}

# App
NEXT_PUBLIC_APP_URL=https://lole.app
NEXT_PUBLIC_GRAPHQL_URL=https://api.lole.app/graphql
NEXT_PUBLIC_VERSION=1.0.0
```

---

## Deployment Process

## PowerSync Reality Check

Before claiming end-to-end PowerSync is live, verify `docs/01-foundation/powersync-supabase-dev-status.md`.

Current rule:

- client bootstrap/config can be implemented independently
- PowerSync cloud replication is not considered done until direct logical replication is live and the `powersync` publication exists
- transaction pooler is never valid for PowerSync replication

If dev environment cannot satisfy those infra prerequisites yet, keep local-first work moving and leave `ENT-018` blocked.

### Standard Deploy (main branch)

```bash
# Automated via GitHub Actions on push to main:
# 1. Type check:   npx tsc --noEmit
# 2. Lint:         npx eslint src/
# 3. Test:         npx vitest run
# 4. DB migrate:   supabase db push --linked
# 5. Deploy:       vercel --prod
# 6. Apollo Router: railway up --service apollo-router

# Manual deploy if needed:
npx vercel --prod --token=$VERCEL_TOKEN
```

### Database Migration (Supabase)

```bash
# Create new migration
supabase migration new add_discount_tables

# Write SQL in supabase/migrations/{timestamp}_add_discount_tables.sql

# Test locally first
supabase db reset     # applies all migrations from scratch locally

# Push to production (also runs in CI)
supabase db push --linked

# Verify migration applied
supabase db diff --linked
```

### Apollo Router Deploy (Railway)

```bash
# Apollo Router runs as a Docker container on Railway
# Dockerfile in apps/apollo-router/Dockerfile

# Manual redeploy:
railway up --service apollo-router

# Update router.yaml (gateway config):
# 1. Edit apps/apollo-router/router.yaml
# 2. Commit + push to main
# 3. Railway auto-deploys on push
```

---

## Monitoring Checklist

### Daily (takes 2 minutes)

- [ ] Check Sentry for new error groups
- [ ] Review Prometheus status page
- [ ] Check Telegram for any overnight alerts
- [ ] Verify EOD reports sent to Telegram at 10PM

### Weekly

- [ ] Review Supabase dashboard: slow queries, connection pool usage
- [ ] Review Axiom logs: error rate trends, GraphQL query performance
- [ ] Check Upstash: Redis memory usage, QStash job failure rate
- [ ] Check Railway: Apollo Router memory/CPU

### When You Get a New Restaurant

- [ ] Verify Sentry tagging works (order something, check Sentry)
- [ ] Test Telebirr payment end-to-end
- [ ] Test Chapa payment end-to-end
- [ ] Verify ERCA integration (if restaurant is VAT-registered)
- [ ] Confirm EOD Telegram report at 10PM on first day

---

## Incident Runbook

### POS Offline Alert

**Symptom:** Prometheus alert fires, or restaurant calls saying POS is broken.

```
1. Check /api/health endpoint manually
2. Check Supabase status (status.supabase.com)
3. Check PowerSync status
4. Check Vercel status (vercel-status.com)
5. If Supabase down → POS works offline for 24h, tell restaurant
6. If Vercel down → POS static assets may not load, check Railway (Apollo Router)
7. Check Sentry for error spike matching timeframe
```

### Payment Webhook Failing

**Symptom:** Orders show payment initiated but never auto-confirm. Staff must manually confirm.

```
1. Check /api/webhooks/chapa or /api/webhooks/telebirr in Axiom logs
2. Check if webhook is arriving (Axiom: POST /api/webhooks/* in last 1h)
3. If not arriving: check Chapa/Telebirr dashboard webhook config
   - Production webhook URL must be: https://lole.app/api/webhooks/chapa
   - Not a localhost or preview URL
4. If arriving but rejecting: HMAC verification failing
   - Check CHAPA_WEBHOOK_SECRET env var in Vercel production
   - Verify against Chapa dashboard webhook secret
5. If arriving and accepting: check QStash job processing
   - Axiom: filter by "payment.completed" events
   - QStash dashboard: check failed jobs
```

### Database Connection Pool Exhausted

**Symptom:** Supabase pool > 80% alert fires, or 500 errors on POS.

```
1. Verify pgBouncer is enabled in Supabase dashboard
2. Verify request and app SQL traffic uses DATABASE_URL (pooler)
   Pooler URL: <your-pooler-url>
3. Verify infra-only tools use DATABASE_DIRECT_URL
   Direct URL: <your-direct-url>
   PowerSync replication must stay on direct
4. If immediately needed: Supabase Pro allows up to 60 direct connections
   Keep direct reserved for migrations, CI, admin scripts, and PowerSync replication only
4. Long term: upgrade to Supabase Team for more connections
```

### ERCA Submission Backlog

**Symptom:** QStash queue depth > 100 alert. Restaurants not getting VAT receipts.

```
1. Check ERCA API status (ask your ERCA contact)
2. QStash will retry automatically up to 5 times over 2 hours
3. If ERCA API is down longer than 2 hours:
   - Jobs fail and dead-letter
   - Manually requeue from dead-letter queue in QStash dashboard
   - Orders still completed — no revenue impact, only compliance delay
4. Log the incident and notify affected restaurants
```

### High Error Rate on POS

**Symptom:** Sentry shows spike in errors for a specific restaurant_id.

```
1. Filter Sentry by restaurant_id tag matching the affected restaurant
2. Check error type:
   - GraphQL errors → check Apollo Router logs on Railway
   - Supabase RLS errors → check restaurant_staff table for that user
   - Network errors → check device connectivity (Ethio Telecom outage?)
   - PowerSync errors → check PowerSync dashboard for sync failures
3. Check if issue is isolated to one device or all devices at that restaurant
4. If RLS error: staff member may have been deactivated in restaurant_staff
```

---

## Local Development Setup

```bash
# Clone and install
git clone https://github.com/yourorg/lole
cd lole
npm install

# Set up Supabase locally
npx supabase start
# This starts local Postgres, Auth, and Storage containers

# Copy env
cp .env.example .env.local
# Fill in your local Supabase URLs (printed by supabase start)
# You can use test keys for Chapa/Telebirr in development

# Apply migrations
npx supabase db push

# Run dev server
npm run dev

# Optional: run Apollo Router locally (requires Docker)
cd apps/apollo-router
docker build -t apollo-router .
docker run -p 4000:4000 --env-file .env apollo-router
```

---

## Key Commands

```bash
# Type check entire codebase
npm run type-check

# Generate GraphQL TypeScript types from schema
npm run codegen

# Run unit tests
npm run test

# Run Supabase locally
npm run supabase:start
npm run supabase:stop

# Create database migration
npm run migration:new -- {migration_name}

# Push migration to production
npm run migration:push

# View production logs (Axiom)
# Go to: app.axiom.co → lole dataset

# View production errors (Sentry)
# Go to: sentry.io → lole project

# View job queue (QStash)
# Go to: console.upstash.com → QStash

# Debugging the Native Shell (Capacitor)
# 1. Connect Android tablet via USB
# 2. Enable Developer Options -> USB Debugging
# 3. Open Chrome on laptop: chrome://inspect/#devices
# 4. Find the 'com.lole.device' entry and click 'inspect'
# 5. Access the full console and hardware logs directly
```

---

## Security Protocols

### Secret Rotation

Rotate these secrets if you suspect compromise:

| Secret                      | Where Set                       | Rotation Impact                                                               |
| --------------------------- | ------------------------------- | ----------------------------------------------------------------------------- |
| `lole_QR_HMAC_SECRET`       | Vercel env + code               | All existing QR codes expire immediately. Regenerate QR codes for all tables. |
| `CHAPA_WEBHOOK_SECRET`      | Vercel env + Chapa dashboard    | Must match both locations. Old webhooks fail for ~60 seconds during rotation. |
| `TELEBIRR_WEBHOOK_SECRET`   | Vercel env + Telebirr dashboard | Same as Chapa.                                                                |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env only                 | Rotate in Supabase dashboard. Update Vercel env. Redeploy.                    |
| `QSTASH_TOKEN`              | Vercel env only                 | Rotate in Upstash dashboard. Running jobs complete. New jobs use new token.   |

### POS Device Compromise

If a POS tablet is lost or stolen:

```
1. Go to /merchant/staff
2. Deactivate all staff PIN codes that were used on that device
3. In Supabase Auth: revoke the device's session (find session by device fingerprint in guest_menu_sessions)
4. Generate new QR codes for all tables at that location (/merchant/tables → Regenerate All)
5. The old QR codes will fail HMAC verification after regeneration
```

---

## Performance Benchmarks

These are the targets. If real-world measurements exceed them, investigate immediately.

| Metric                           | Target  | Alert Threshold |
| -------------------------------- | ------- | --------------- |
| POS order submission → KDS       | <2s P99 | >3s             |
| Menu load (Cloudflare cache hit) | <100ms  | >300ms          |
| Menu load (origin, cache miss)   | <800ms  | >2s             |
| GraphQL API P99                  | <500ms  | >1s             |
| Webhook response time            | <100ms  | >500ms          |
| Supabase query P99               | <100ms  | >300ms          |
| PowerSync initial sync           | <10s    | >30s            |

---

## On-Call Protocol

As the sole engineer, every alert comes to you. Here is how to triage:

**Severity 1 — Revenue impact (respond in 10 minutes):**

- POS completely offline at active restaurant
- All payments failing
- Orders not reaching KDS

**Severity 2 — Degraded experience (respond in 1 hour):**

- Slow API responses (>2s P99)
- ERCA submission backlog
- EOD reports not sending

**Severity 3 — Non-urgent (respond next business day):**

- Single error spikes without revenue impact
- Analytics query slowness
- Loyalty points not awarding

**Response template (Telegram to affected restaurant):**

```
[lole Support]
ስናካ (Restaurant Name),
ቴክኒካዊ ችግር ተፈጥሯል እናስተካክለዋለን።
We are aware of a technical issue and are working to resolve it.
ETA: 30 minutes
```

---

_lole Engineering Runbook v1.0 · March 2026_
