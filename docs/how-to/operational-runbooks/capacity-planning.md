# lole — Capacity Planning Guide

**Version 1.0 · March 2026**

> This document tells you exactly when your current infrastructure will start hurting, what the symptoms are before it breaks, and what to upgrade before the break happens. Read this quarterly. Act on it before you see a problem, not after.

---

## Planning Philosophy

**Upgrade when you hit 60% of a limit, not when you hit 100%.**

Infrastructure upgrades during a crisis (restaurants in service, owner calling, POS throwing errors) are dangerous and stressful. An upgrade at 60% load is calm, planned, and reversible. At 100%, you are firefighting.

**The three questions this document answers:**

1. What are the limits of our current infrastructure?
2. What are the signals that we are approaching those limits?
3. What exactly do we upgrade and when?

---

## Baseline: Current Infrastructure (March 2026)

| Service                 | Current Plan | Monthly Cost (USD) | Key Limits                                                                          |
| ----------------------- | ------------ | ------------------ | ----------------------------------------------------------------------------------- |
| Supabase                | Pro          | $25                | 8GB database, 60 direct connections, 200GB bandwidth                                |
| Vercel                  | Pro          | $20                | 1TB bandwidth, 1000 serverless function executions/day (Hobby limit removed on Pro) |
| Upstash Redis           | Pay-per-use  | ~$5–15             | 10,000 commands/day free, then $0.20/100k; 256MB memory                             |
| Upstash QStash          | Pay-per-use  | ~$0–10             | 500 messages/day free tier                                                          |
| Railway (Apollo Router) | Starter      | $10–15             | 512MB RAM, shared CPU, 500GB bandwidth                                              |
| PowerSync               | Developer    | $0                 | 1M sync operations/month                                                            |
| Cloudflare              | Free         | $0                 | Unlimited bandwidth (Workers: 100k req/day free)                                    |
| Cloudflare R2           | Free tier    | $0                 | 10GB storage free                                                                   |
| **Total**               |              | **~$60–85/month**  |                                                                                     |

---

## Milestone-Based Scaling Plan

### Milestone 1 — Launch (0 → 25 restaurants)

**Status: Current infrastructure handles this comfortably.**

**Estimated load:**

- Orders: ~500–2,000/day across 25 restaurants
- DB connections: 5–20 concurrent (well within 60 limit)
- Supabase DB size: <500MB
- Redis operations: <5,000/day

**No infrastructure changes needed at this milestone.**

**Watch metrics:**

```
Supabase connection pool:   < 20 connections (alert at 40)
Supabase DB size:           < 2GB (alert at 6GB)
Vercel function duration:   < 3s P99 (alert at 5s)
Redis memory:               < 50MB (alert at 180MB)
Railway CPU:                < 30% avg (alert at 70%)
```

---

### Milestone 2 — 25 → 100 Restaurants

**Estimated load:**

- Orders: 2,000–10,000/day
- DB connections: 20–60 concurrent (approaching the 60 limit)
- Supabase DB size: 500MB–2GB
- Redis operations: 10,000–50,000/day
- QStash messages: 500–5,000/day

**Trigger for action:** Connection pool hits 40 concurrent connections during peak hours.

**Actions at this milestone:**

```
1. Enable Supabase pgBouncer connection pooler (if not already done — do it now)
   Effect: multiplexes hundreds of app connections into 60 DB connections
   Setting: DATABASE_URL must use the pooler URL:
   postgresql://postgres.[project-ref]:[password]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
   DATABASE_DIRECT_URL stays reserved for infra-only direct access:
   postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

2. Enable Supabase Read Replica ($60–80/month add-on)
   Use for: all analytics queries from /merchant/analytics
   Keep primary for: all writes, all POS queries
   Code change: analytics repository uses SUPABASE_ANALYTICS_URL (read replica)

3. Upgrade Upstash QStash to Pro ($10/month) if hitting 500 message/day free limit
   Pro: 1M messages/month — sufficient until 500+ restaurants

4. Consider Cloudflare Workers paid plan ($5/month, 10M requests)
   if menu cache requests exceed 100k/day free tier (easily hit at 100 restaurants)
```

**Projected cost at 100 restaurants:** $130–160/month

---

### Milestone 3 — 100 → 200 Restaurants

**Estimated load:**

- Orders: 10,000–25,000/day
- DB connections: 60–150 concurrent (exceeds Pro limit — pgBouncer required)
- Supabase DB size: 2GB–5GB
- Redis memory: 100–256MB (approaching 256MB Upstash limit)

**Trigger for action:** pgBouncer pool saturation during Friday/Saturday peak. Analytics queries taking >500ms P99.

**Actions at this milestone:**

```
1. Upgrade Supabase to Team plan ($150–200/month)
   Gains: unlimited connections (via pgBouncer), PITR extended to 14 days, better support SLA
   PITR upgrade critical: at 200 restaurants, 14-day recovery window is important

2. Enable TimescaleDB continuous aggregates (Sprint 7 — already planned)
   These eliminate the analytics slow query problem entirely
   hourly_sales materialized view refreshes every 30 min
   Analytics queries go from full table scan → aggregate lookup: 10ms vs 300ms

3. Upgrade Upstash Redis to Pro plan (~$30–50/month, 1GB memory)
   Redis memory needed for: menu caches × 200 restaurants, session state, rate limiting
   200 restaurants × ~1MB menu cache = 200MB minimum, plus session overhead

4. Extract Orders service to Railway dedicated NestJS container (if latency warrants)
   Trigger: orders API P99 > 300ms despite query optimization
   Not automatically needed — evaluate actual metrics before extracting

5. Upgrade Cloudflare Workers to $5/month paid plan (10M requests)
   100+ restaurants with active guest QR ordering will exceed free tier easily
```

**Projected cost at 200 restaurants:** $250–350/month

---

### Milestone 4 — 200 → 500 Restaurants

**Estimated load:**

- Orders: 25,000–75,000/day
- Concurrent connections: 150–400 (pgBouncer manages this)
- Supabase DB size: 5GB–15GB
- Redis memory: 400–800MB

**Trigger for action:** Supabase query latency P99 > 200ms. DB size > 10GB.

**Actions at this milestone:**

```
1. Evaluate Neon Serverless Postgres as Supabase replacement ($300–500/month)
   Why: Neon autoscales compute on demand — handles burst traffic without pre-provisioning
   How: migration is straightforward (same Postgres) — test on staging first
   Keep Supabase for Auth (or migrate Auth to a separate provider)

   Neon advantages at this scale:
   - Autoscaling computes (0.25 to 7 vCPU on demand)
   - Branching for staging environments (no separate Supabase project needed)
   - Better cost curve at high write volume

2. Add Neon read replicas ($100–150/month) for analytics + reporting
   Primary: all POS writes, order creation, payment capture
   Replica 1: merchant dashboard queries, analytics
   Replica 2: guest ordering reads (menu, session lookups)

3. Upgrade Upstash Redis to 2GB memory tier (~$80–120/month)

4. Redis Streams consumer groups at scale:
   At 500 restaurants × 100 orders/day = 50,000 events/day on the event bus
   Single consumer group is fine. Add consumer group partitioning only if queue depth > 1000 sustained.

5. Apollo Router horizontal scaling (Railway Pro, 2 replicas)
   Trigger: Apollo Router CPU > 60% average or memory > 400MB
   Action: Railway → scale to 2 instances with load balancing

6. CDN strategy review:
   At 500 restaurants, Cloudflare Workers are caching ~500 unique menus
   Workers KV storage for menu cache becomes necessary (current in-memory cache resets on Worker restart)
   Workers KV: $0.50/million reads after free tier — negligible at this scale
```

**Projected cost at 500 restaurants:** $500–700/month

---

### Milestone 5 — 500 → 2,000 Restaurants

This milestone requires architectural decisions that cannot be fully planned in advance. The decisions depend on which services are showing strain at Milestone 4. Principles:

```
Principle 1: Extract the service that is causing pain first.
  → If the Orders API is slow: extract to dedicated NestJS service
  → If payments are the bottleneck: extract to dedicated payment service
  → If analytics is slow: move to ClickHouse or a dedicated OLAP database
  Do not pre-emptively extract everything — extract what hurts.

Principle 2: Shard by restaurant_id at 1,000+ restaurants.
  → Neon database branching enables per-region sharding
  → All Ethiopian restaurants → Neon EU West (Frankfurt, closest to Addis)
  → Nairobi restaurants → Neon US East or dedicated Neon project
  → restaurant_id is already the partition key — no schema changes needed

Principle 3: Move from Supabase Realtime to Redis pub/sub for KDS at scale.
  → Supabase Realtime has known limits at very high connection counts
  → 2,000 restaurants × 5 KDS stations × 2 tablets = 20,000 concurrent WebSocket connections
  → Migrate KDS subscriptions to Redis pub/sub channels (already on Upstash)
  → This is a non-breaking change: the subscription interface is abstracted

Principle 4: Hire infrastructure help before this milestone, not during.
  → A dedicated DevOps/infrastructure engineer joins by 1,000 restaurants
  → Solo AI-assisted builder cannot safely manage Neon+Redis+Railway+Cloudflare at 2,000 restaurants
```

**Projected cost at 2,000 restaurants:** $1,500–3,500/month (gross margin still >70% at this scale)

---

## Current Infrastructure Limits Cheat Sheet

Use this table during any incident or capacity review. The "Action" column is what to do when the alert fires.

| Resource                | Current Limit               | 60% Alert Threshold | Action When Alert Fires                                          |
| ----------------------- | --------------------------- | ------------------- | ---------------------------------------------------------------- |
| Supabase DB connections | 60 (Pro)                    | 36 concurrent       | Enable pgBouncer immediately. Plan upgrade to Team.              |
| Supabase DB storage     | 8GB                         | 5GB                 | Upgrade to Team plan ($150/mo) or enable TimescaleDB compression |
| Supabase bandwidth      | 200GB/month                 | 120GB               | Upgrade plan or enable Cloudflare aggressive caching             |
| Redis memory            | 256MB (Upstash Pay-per-use) | 150MB               | Upgrade to Upstash Pro (1GB, ~$30/mo)                            |
| Redis commands          | 10,000/day (free)           | 6,000/day           | Upgrade to Upstash Pro (unlimited)                               |
| QStash messages         | 500/day (free)              | 300/day             | Upgrade to QStash Pro ($10/mo, 1M messages)                      |
| Cloudflare Workers      | 100k req/day (free)         | 60k req/day         | Upgrade to Workers Paid ($5/mo, 10M req)                         |
| Railway container RAM   | 512MB                       | 300MB               | Upgrade Railway to Pro (4GB) or add replica                      |
| R2 storage              | 10GB free                   | 6GB                 | Enable R2 paid ($0.015/GB/mo — very cheap)                       |
| PowerSync sync ops      | 1M/month (Dev plan)         | 600k/month          | Upgrade to PowerSync Pro ($49/mo)                                |
| Vercel function timeout | 10s (Pro)                   | —                   | Optimize slow functions — do not increase timeout                |

---

## Monitoring Queries

Run these weekly as part of the capacity review.

### Supabase Connection Pool

```sql
-- Check current connection count
SELECT count(*) as total_connections,
       count(*) FILTER (WHERE state = 'active') as active,
       count(*) FILTER (WHERE state = 'idle') as idle,
       count(*) FILTER (WHERE wait_event_type = 'Lock') as waiting
FROM pg_stat_activity
WHERE datname = 'postgres';

-- Alert if: active > 36
```

### Database Size Growth Rate

```sql
-- Database size and growth trend
SELECT
  pg_size_pretty(pg_database_size('postgres')) as total_size,
  pg_size_pretty(pg_total_relation_size('orders')) as orders_table,
  pg_size_pretty(pg_total_relation_size('order_items')) as order_items_table,
  pg_size_pretty(pg_total_relation_size('payments')) as payments_table;

-- Orders growth rate (rows per day, last 7 days)
SELECT
  DATE(created_at) as day,
  COUNT(*) as orders,
  SUM(total_price) / 100.0 as revenue_etb
FROM orders
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY day;
```

### Slow Query Detection

```sql
-- Top 10 slowest queries (requires pg_stat_statements extension)
SELECT
  LEFT(query, 100) as query_preview,
  calls,
  round(mean_exec_time::numeric, 2) as avg_ms,
  round(total_exec_time::numeric, 2) as total_ms
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Alert if: any query avg_ms > 200 on the primary (write) path
-- Acceptable: analytics queries up to 500ms (these move to read replica)
```

### Missing Indexes (Performance Regression Detection)

```sql
-- Tables with sequential scans that should have index scans
SELECT
  relname as table_name,
  seq_scan,
  idx_scan,
  n_live_tup as live_rows,
  round(seq_scan::numeric / NULLIF(seq_scan + idx_scan, 0) * 100, 1) as seq_scan_pct
FROM pg_stat_user_tables
WHERE seq_scan + idx_scan > 100  -- only tables with meaningful traffic
  AND seq_scan > idx_scan        -- more seq than index scans = missing index
ORDER BY seq_scan DESC;

-- Any table appearing here with high seq_scan_pct = investigate and add index
```

### Redis Memory Trend

```bash
# Via Upstash dashboard API (add to weekly cron)
curl -s "https://api.upstash.com/v2/redis/$REDIS_ID" \
  -H "Authorization: Bearer $UPSTASH_MGMT_TOKEN" | \
  jq '.used_memory, .maxmemory, (.used_memory / .maxmemory * 100 | round)'
# Alert if: usage > 60%
```

---

## Cost Model by Scale

Use this to project infrastructure costs for fundraising and budgeting.

| Scale      | Restaurants | Monthly Orders | Infra Cost (USD) | Infra as % of Revenue (at 60% Pro) |
| ---------- | ----------- | -------------- | ---------------- | ---------------------------------- |
| Pre-launch | 0           | 0              | $65              | —                                  |
| Beta       | 25          | 12,500         | $85              | ~5%                                |
| Launch     | 50          | 25,000         | $110             | ~4%                                |
| Growth     | 100         | 50,000         | $160             | ~3.5%                              |
| Scale      | 200         | 100,000        | $300             | ~3%                                |
| Expansion  | 500         | 250,000        | $600             | ~2.5%                              |
| Dominance  | 2,000       | 1,000,000      | $2,500           | ~2%                                |

**Infrastructure cost as a percentage of revenue decreases as scale increases.** This is the hallmark of a healthy SaaS infrastructure model. At 2,000 restaurants paying an average of 1,500 ETB/month (~$27 USD), revenue is ~$54,000/month. Infrastructure at $2,500/month is 4.6% of revenue — well within acceptable SaaS margins.

---

## Quarterly Capacity Review Checklist

Run this the first Monday of every quarter (January, April, July, October):

```
Database health
[ ] Run all monitoring queries above
[ ] DB size growth rate — on track with projections?
[ ] Connection pool peak — below 60% of limit?
[ ] Slow query list — any new queries > 200ms?
[ ] TimescaleDB compression — running? How much space saved?

Application health
[ ] Vercel function P99 — below 3 seconds?
[ ] Apollo Router memory — below 300MB?
[ ] QStash dead-letter queue — any persistent failures?
[ ] Sentry error rate trend — flat or decreasing?

Business metrics alignment
[ ] Current restaurant count vs. milestone projections
[ ] Actual infra cost vs. budget
[ ] Any surprise cost increases from any provider?
[ ] Any provider pricing changes announced?

Upgrade decisions
[ ] Any metric crossing 60% threshold → schedule upgrade this quarter
[ ] Any provider at end-of-life or changing pricing → evaluate alternatives
[ ] New services that should be added to dependency map?
```

---

_lole Capacity Planning Guide v1.0 · March 2026_
