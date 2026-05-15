# lole — System Architecture

**Version 1.0 · March 2026**

---

## Architecture Philosophy

lole is designed as a **Modular Monolith with Federation Boundaries**. This is not a compromise — it is a deliberate choice that gives a solo AI-assisted builder 80% of the operational benefits of microservices with 10% of the operational cost.

The key insight: a GraphQL Federation boundary means any domain can be extracted to an independent service with **zero client-side changes**. The POS, dashboard, and guest ordering surfaces never know or care whether `orders` is served from the Next.js monolith or a NestJS microservice — Apollo Router abstracts that entirely.

**Build like a monolith. Design like microservices. Extract when it hurts.**

---

## System Diagram

```
╔══════════════════════════════════════════════════════════════════════╗
║                        CLIENT LAYER                                   ║
║                                                                        ║
║  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ ║
║  │  Waiter POS  │  │   KDS x5     │  │  Guest PWA   │  │Dashboard │ ║
║  │  /pos/waiter │  │  /kds/*      │  │  /[slug]     │  │/merchant │ ║
║  │  Android PWA │  │  Android PWA │  │  Mobile Brow.│  │Desktop   │ ║
║  │  Offline-1st │  │  Offline-1st │  │  No install  │  │          │ ║
║  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────┬─────┘ ║
╚═════════╪════════════════╪════════════════╪════════════════╪════════╝
          │                │                │                │
          ▼                ▼                ▼                ▼
╔══════════════════════════════════════════════════════════════════════╗
║                     CLOUDFLARE EDGE LAYER                             ║
║                                                                        ║
║   DNS → WAF → DDoS Protection → Africa CDN (Nairobi PoP)             ║
║                                                                        ║
║   ┌─────────────────────────────────────────────────────────────┐    ║
║   │  Cloudflare Worker: Menu Cache                               │    ║
║   │  Cache GraphQL GetMenuItems for 5 min at edge               │    ║
║   │  Cache-hit: <100ms · Cache-miss: forward to origin          │    ║
║   └─────────────────────────────────────────────────────────────┘    ║
╚══════════════════════════════════════════════════════════════════════╝
          │
          ▼
╔══════════════════════════════════════════════════════════════════════╗
║                     API GATEWAY LAYER (Railway)                       ║
║                                                                        ║
║   ┌─────────────────────────────────────────────────────────────┐    ║
║   │  Apollo Router (Rust binary — always-on container)           │    ║
║   │                                                               │    ║
║   │  • JWT validation (Supabase JWKS endpoint)                   │    ║
║   │  • Rate limiting (1000 req/s capacity via Upstash)           │    ║
║   │  • Query depth limiting (max 10)                             │    ║
║   │  • Schema registry (Apollo Studio)                           │    ║
║   │  • Federated subgraph routing                                │    ║
║   └───────────────────────┬─────────────────────────────────────┘    ║
╚═══════════════════════════╪════════════════════════════════════════╝
                            │ routes to subgraphs
          ┌─────────────────┼──────────────────────┐
          ▼                 ▼                        ▼
╔══════════════════════════════════════════════════════════════════════╗
║              APPLICATION LAYER (Vercel — Next.js 16)                  ║
║                                                                        ║
║  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────────┐ ║
║  │  Orders   │ │   Menu    │ │ Payments  │ │  Staff · Guests       │ ║
║  │  domain   │ │  domain   │ │  domain   │ │  Restaurants · Notif. │ ║
║  │ subgraph  │ │ subgraph  │ │ subgraph  │ │  subgraphs            │ ║
║  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └──────────┬────────────┘ ║
║        │             │              │                   │              ║
║        └─────────────┴──────────────┴───────────────────┘              ║
║                                   │                                    ║
║                    ┌──────────────▼──────────────┐                    ║
║                    │  Event Bus Publisher          │                    ║
║                    │  publishEvent() → Redis XADD │                    ║
║                    └──────────────────────────────┘                    ║
║                                                                        ║
║  ┌───────────────────────────────────────────────────────────────┐    ║
║  │  REST Endpoints (kept as REST — never migrated to GraphQL)    │    ║
║  │  POST /api/webhooks/chapa      (Chapa payment callback)       │    ║
║  │  POST /api/webhooks/telebirr   (Telebirr payment callback)    │    ║
║  │  POST /api/jobs/*              (QStash CRON handlers)         │    ║
║  │  GET  /api/health              (Prometheus health check)   │    ║
║  └───────────────────────────────────────────────────────────────┘    ║
╚══════════════════════════════════════════════════════════════════════╝
                            │
          ┌─────────────────┼──────────────────────┐
          ▼                 ▼                        ▼
╔══════════════════════════════════════════════════════════════════════╗
║                       DATA LAYER                                       ║
║                                                                        ║
║  ┌─────────────────────┐  ┌──────────────┐  ┌─────────────────────┐  ║
║  │  Supabase PostgreSQL │  │Upstash Redis │  │  Cloudflare R2      │  ║
║  │  15 + TimescaleDB   │  │              │  │  Object Storage     │  ║
║  │                     │  │ • Menu cache │  │                     │  ║
║  │ • All transactional │  │ • Sessions   │  │ • Receipt PDFs      │  ║
║  │   data              │  │ • Rate limit │  │ • Menu images       │  ║
║  │ • RLS multi-tenant  │  │ • Redis      │  │ • Export files      │  ║
║  │ • Realtime WAL      │  │   Streams    │  │                     │  ║
║  │   subscriptions     │  │   (event bus)│  │                     │  ║
║  │ • TimescaleDB       │  │ • QStash job │  │                     │  ║
║  │   time-series       │  │   queue      │  │                     │  ║
║  └─────────────────────┘  └──────────────┘  └─────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════╗
║                  MONITORING LAYER                                       ║
║                                                                        ║
║  ┌───────────┐  ┌──────────────┐  ┌─────────────────────┐          ║
║  │  Sentry   │  │  Prometheus  │  │  PagerDuty          │          ║
║  │  Error     │  │  Metrics     │  │  Alerting           │          ║
║  │  Tracking  │  │  Collection  │  │  (P1/P2 incidents) │          ║
║  └───────────┘  └──────────────┘  └─────────────────────┘          ║
╚══════════════════════════════════════════════════════════════════════╝

                             │
           ┌─────────────────┼──────────────────────┐
           ▼                 ▼                        ▼
╔══════════════════════════════════════════════════════════════════════╗
║                  PERIPHERAL LAYER                                      ║
║                                                                        ║
║  ┌─────────────────────┐  ┌──────────────┐  ┌─────────────────────┐  ║
║  │  PowerSync Cloud    │  │Termux Server │  │  External Providers │  ║
║  │  (CRDT sync for POS │  │(Thermal print│  │                     │  ║
║  │   and KDS tablets)  │  │ on POS tablet│  │ • ERCA API          │  ║
║  │                     │  │ localhost:   │  │ • Telebirr          │  ║
║  │ Postgres WAL →      │  │ 3001)        │  │ • Chapa             │  ║
║  │ offline tablets     │  │              │  │ • beU Delivery/Deliver Addis/klik/Zmall Delivery │  ║
║  │ CRDT conflict res.  │  │              │  │ • Telegram Bot API  │  ║
║  └─────────────────────┘  └──────────────┘  └─────────────────────┘  ║
║  ┌─────────────────────┐  ┌──────────────┐  ┌─────────────────────┐  ║
║  │  MQTT Broker        │  │              │  │                     │  ║
║  │  (LAN POS ↔ KDS     │  │              │  │                     │  ║
║  │   real-time sync)    │  │              │  │                     │  ║
║  └─────────────────────┘  └──────────────┘  └─────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## Domain Architecture

Each domain follows a strict three-layer structure. No domain may call another domain's repository directly. Cross-domain communication happens exclusively via GraphQL queries (read) or the event bus (write side effects).

```
src/domains/{name}/
├── schema.graphql      # GraphQL Federation 2 subgraph schema
├── resolvers.ts        # Thin — maps GraphQL fields to service calls
├── service.ts          # Business logic — pure TypeScript, no framework coupling
└── repository.ts       # Database access — Supabase queries only, no business logic
```

### Domain Map

| Domain            | Owns                                                          | Emits Events                                         | Consumes Events                                                            |
| ----------------- | ------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| **orders**        | orders, order_items, order_status                             | order.created, order.status_changed, order.completed | payment.completed                                                          |
| **menu**          | menu_items, categories, modifier_groups, modifier_options     | menu.updated                                         | —                                                                          |
| **payments**      | payments, refunds, reconciliation_entries                     | payment.completed, payment.failed                    | —                                                                          |
| **guests**        | guests, guest_menu_sessions                                   | —                                                    | order.completed (for loyalty)                                              |
| **loyalty**       | loyalty_programs, loyalty_accounts, loyalty_transactions      | loyalty.points_earned                                | order.completed                                                            |
| **staff**         | restaurant_staff, roles, time_entries, schedules              | —                                                    | —                                                                          |
| **restaurants**   | restaurants, tables, settings                                 | table.opened, table.closed                           | —                                                                          |
| **inventory**     | inventory_items, recipes, recipe_ingredients, stock_movements | inventory.low                                        | order.completed                                                            |
| **analytics**     | hourly_sales (TimescaleDB view), analytics_events             | —                                                    | order.completed, payment.completed, table.closed                           |
| **channels**      | delivery_partners, external_orders, online_ordering_settings  | —                                                    | —                                                                          |
| **notifications** | — (stateless)                                                 | —                                                    | order.status_changed, payment.failed, inventory.low, loyalty.points_earned |

---

## Request Lifecycle

### Restaurant Staff Order Flow

```
1. Waiter taps "New Order" on /pos/waiter
2. PowerSync returns menu from local IndexedDB (<5ms, offline-capable)
3. Waiter selects items + modifiers, taps "Send to Kitchen"
4. POST /api/graphql → createOrder mutation
   ├── Verify staff JWT + restaurant_id scope
   ├── Validate all required modifier groups satisfied
   ├── Insert order + order_items to Supabase (in a transaction)
   ├── publishEvent('order.created') → Redis Stream XADD
   └── Return order with idempotencyKey
5. PowerSync receives Postgres WAL change → updates all POS/KDS devices
6. Redis Stream consumer (Supabase Edge Function) → updates KDS in <2s
7. Waiter POS shows "Order sent ✓"
```

### Guest QR Ordering Flow

```
1. Guest scans QR code on table
2. Browser opens https://lolemenu.com/{slug}?table=A3&sig=...&exp=...
3. GET /api/guest/context → HMAC validated server-side → returns restaurantId + tableId
4. Splash screen: Login / Signup / Skip to Menu
5. Skip → POST /api/guest/session → creates guest_menu_sessions record
6. Menu loaded from Cloudflare Worker cache (<100ms hit) or origin (<300ms miss)
   Menu items cached for 5 min at Nairobi PoP
7. Guest adds items, selects modifiers, proceeds to checkout
8. Checkout re-prompt: "Earn X points? Sign up in 10 seconds" (if skipped earlier)
9. Guest selects Telebirr payment
10. POST /api/graphql → createGuestOrder → initiateTelebirrPayment
    └── Returns Telebirr USSD deep link / QR
11. Guest completes payment on their Telebirr app
12. Telebirr sends webhook → POST /api/webhooks/telebirr
    ├── Verify HMAC signature (timing-safe)
    ├── publishEvent('payment.completed') → Redis Stream
    └── Return 200 immediately
13. QStash job consumes payment.completed:
    ├── Update order status → 'confirmed'
    ├── Award loyalty points (if guest authenticated)
    ├── Submit ERCA e-invoice (if restaurant VAT-registered)
    └── Trigger inventory deduction (DB trigger on order status change)
14. Supabase Realtime → tracker page updates to "confirmed"
15. KDS shows new order for kitchen
```

### Payment Webhook Flow (Critical Path)

```
Telebirr/Chapa sends POST /api/webhooks/{provider}
  │
  ├─ 1. req.text() — read raw body (must be before any parsing)
  ├─ 2. Verify HMAC-SHA256 signature (timing-safe comparison)
  │     If invalid → return 401 immediately
  ├─ 3. publishEvent('payment.completed', payload) → Redis XADD
  └─ 4. return Response.json({ received: true }) → 200 in <50ms

QStash consumes Redis Stream:
  ├─ Update payments.status = 'captured'
  ├─ Update orders.status = 'confirmed'
  ├─ Insert reconciliation_entries record
  ├─ Publish to analytics
  └─ Dispatch loyalty award job (if guest_id present)

Rule: The webhook handler does NOTHING except verify + publish + return 200.
      All business logic is in downstream consumers.
      This prevents Telebirr/Chapa from timing out and resending (double payments).
```

---

## Data Flow Diagram

### Event Bus — Publishers and Consumers

```
PUBLISHERS                    STREAM KEY                    CONSUMERS
──────────                    ──────────                    ─────────
orders.service     ──XADD──►  events:order.created    ──►  KDS realtime
                                                       ──►  Analytics counter
                                                       ──►  Notifications (new order)

orders.service     ──XADD──►  events:order.completed  ──►  Loyalty (award points)
                                                       ──►  Analytics (revenue event)
                                                       ──►  ERCA (e-invoice job)
                                                       ──►  Inventory (deduction trigger)

webhook handler    ──XADD──►  events:payment.completed ──►  Orders (confirm status)
                                                        ──►  Finance (reconcile)
                                                        ──►  Analytics
                                                        ──►  Notifications (receipt)

webhook handler    ──XADD──►  events:payment.failed    ──►  QStash (retry job)
                                                        ──►  Notifications (alert staff)

menu.service       ──XADD──►  events:menu.updated      ──►  Redis cache invalidation
                                                        ──►  PowerSync (push to tablets)

inventory trigger  ──XADD──►  events:inventory.low     ──►  Telegram → owner
                                                        ──►  lole Now push notification

loyalty.service    ──XADD──►  events:loyalty.points_earned ──►  Telegram → guest
                                                             ──►  Guest PWA notification
```

---

## Offline Architecture

### PowerSync Sync Zones

```
ONLINE (Postgres WAL) ──────────────────────────────────────────────►
                                                                      │
                     Postgres WAL                                     │
                     (change event)                                   │
                          │                                           │
                          ▼                                           │
                   PowerSync Cloud                                    │
                   (CRDT resolver)                                    │
                          │                                           │
              ┌───────────┼──────────────┐                           │
              ▼           ▼              ▼                            │
         POS Tablet 1  KDS Station   POS Tablet 2                    │
         IndexedDB      IndexedDB     IndexedDB                       │
         (Dexie-like    (Dexie-like   (Dexie-like                    │
          storage)       storage)      storage)                       │
                                                                      │
OFFLINE ZONE (no internet) ◄──────────────────────────────────────────
Tablets continue operating from local IndexedDB
Orders queue locally with idempotency keys
KDS shows orders from local state
Payments: Cash works. Telebirr/Chapa queue for sync.

ON RECONNECT:
PowerSync CRDT merge resolves all conflicts per conflict-resolver.ts rules
No data loss. No duplicate orders. Idempotency keys prevent double-inserts.
```

### Conflict Resolution Rules

| Field                             | Strategy    | Reason                                                |
| --------------------------------- | ----------- | ----------------------------------------------------- |
| `orders.status`                   | Server wins | Server knows if item sold out or cancelled            |
| `orders.notes`                    | Client wins | Waiter has direct knowledge of what guest said        |
| `orders.discount_id`              | Server wins | Discounts are manager-approved — server authoritative |
| `menu_items.price`                | Server wins | Pricing must be authoritative on server               |
| `menu_items.available`            | Server wins | Out-of-stock is server truth                          |
| `kds_actions.*`                   | Merge       | Both events happened — append to log                  |
| `payments.*`                      | Server wins | Financial data: server always wins. No exceptions.    |
| `loyalty_accounts.points_balance` | Server wins | Points balance is server truth                        |

---

## Authentication & Authorization Architecture

```
STAFF AUTH FLOW:
  Email + password → Supabase signInWithPassword()
  → JWT issued with sub = auth.users.id
  → Middleware validates JWT on every request (@supabase/ssr cookie session)
  → Role resolved from restaurant_staff.role WHERE user_id = auth.uid()
  → RLS policies use auth.uid() for all DB queries

  RLS example:
  POLICY "staff_own_restaurant" ON orders
    USING (restaurant_id IN (
      SELECT restaurant_id FROM restaurant_staff
      WHERE user_id = auth.uid() AND is_active = true
    ));

WAITER PIN FLOW:
  Device has authenticated Supabase session (staff account)
  → Enter 4-digit PIN
  → POST /api/staff/verify-pin
  → Verified against restaurant_staff.pin_code WHERE restaurant_id = context.restaurantId
  → Staff name + role returned, stored in localStorage:lole_waiter_context
  [PIN session is device-specific — acceptable for staff POS, never for guest surfaces]

GUEST QR FLOW (stateless, no auth):
  Scan QR → browser opens /{slug}?table=N&sig=HMAC&exp=TIMESTAMP
  → GET /api/guest/context
  → Verify: HMAC-SHA256(slug:table:exp, SECRET) === sig [timing-safe]
  → Verify: exp > Date.now() [24h window]
  → Verify: restaurant.is_active = true AND table.is_active = true
  → Return: { restaurantId, tableId, tableNumber }
  → Create guest_menu_sessions record
  → No auth.users entry created for anonymous guests
  [guest_fingerprint used for anonymous order attribution]

APOLLO ROUTER JWT VALIDATION:
  All GraphQL requests: Authorization: Bearer {supabase_jwt}
  → Apollo Router validates against Supabase JWKS endpoint
  → Forwards restaurant_id claim to subgraphs
  → Subgraphs use restaurant_id for RLS-compatible queries
```

---

## Database Architecture

### Multi-Tenancy Model

```
Every table has restaurant_id.
Every RLS policy filters by restaurant_id.
Even if application code has a bug, the DB will not serve cross-tenant data.

Partition key:    restaurant_id (UUID)
Shard key:        restaurant_id (at 500+ restaurants with Neon)
Index strategy:   Composite index on (restaurant_id, created_at) for time queries
                  Composite index on (restaurant_id, status) for order queue queries
```

### Critical Indexes

```sql
-- Order queue (most frequent POS query)
CREATE INDEX idx_orders_restaurant_status
  ON orders (restaurant_id, status, created_at DESC);

-- Menu display (most frequent guest query — supplemented by Redis cache)
CREATE INDEX idx_menu_items_restaurant_available
  ON menu_items (restaurant_id, is_available, category_id);

-- Amharic full-text search for POS search bar
CREATE INDEX idx_menu_items_am_fts
  ON menu_items USING gin(to_tsvector('simple', COALESCE(name_am, '')));

-- KDS order items by station
CREATE INDEX idx_order_items_order_status
  ON order_items (order_id, status);

-- Analytics queries (TimescaleDB manages time partitions)
CREATE INDEX idx_orders_restaurant_completed
  ON orders (restaurant_id, created_at DESC) WHERE status = 'completed';

-- Payment lookup
CREATE INDEX idx_payments_order
  ON payments (order_id, status);

-- Loyalty account lookup
CREATE INDEX idx_loyalty_accounts_guest
  ON loyalty_accounts (guest_id, restaurant_id) WHERE status = 'active';
```

### TimescaleDB Hypertables

```sql
-- orders → hypertable (partitioned by day)
-- Automatic chunk management, compression after 30 days
-- Continuous aggregate: hourly_sales (refreshed every 30 min)

-- analytics_events → hypertable (partitioned by day)
-- Retention policy: 90 days raw events
-- Used for: item views, payment method selections, session events
```

---

## Phase 2: Service Extraction Plan

### When to Extract

| Signal                                                | Action                                            |
| ----------------------------------------------------- | ------------------------------------------------- |
| Orders domain P99 > 500ms despite query optimisation  | Extract to NestJS on Railway                      |
| Payments domain processing > 10,000 transactions/day  | Extract to NestJS with dedicated connection pool  |
| Analytics queries impacting transactional performance | Move to dedicated read replica or Neon serverless |
| 200+ concurrent KDS connections                       | Move Realtime to dedicated Redis pub/sub channel  |

### How to Extract (Zero Client Changes)

```
Before extraction:
  Apollo Router → Next.js /api/graphql → Orders subgraph (in-process)

After extraction:
  Apollo Router → https://orders.railway.app/graphql (NestJS service)

Client change: None. Apollo Router config is the only thing that changes.
```

### NestJS Extraction Template

```typescript
// apps/orders-service/src/orders.module.ts
// Your domains/orders/service.ts becomes this — zero logic change
@Module({
    imports: [
        GraphQLModule.forRoot<ApolloFederationDriverConfig>({
            driver: ApolloFederationDriver,
            autoSchemaFile: { federation: 2 },
        }),
        BullModule.registerQueue({ name: 'orders' }),
        TypeOrmModule.forFeature([Order, OrderItem]),
    ],
    providers: [OrdersResolver, OrdersService, OrdersRepository],
})
export class OrdersModule {}
// OrdersService is your existing service.ts — no changes
// OrdersRepository wraps your existing Supabase queries
```

---

## Infrastructure Architecture

```
DNS: lole.app → Cloudflare (proxied)
DNS: lolemenu.com → Cloudflare (proxied)

Cloudflare → Vercel (via Cloudflare proxy)
  ↓
Vercel Edge Network → Next.js 16 app
  ↓
Next.js → Apollo Router (Railway) for GraphQL
Next.js → Supabase for direct queries (Server Components, webhooks)
Next.js → Upstash for cache + events

Railway (always-on): Apollo Router container
  ↓
Apollo Router → Next.js subgraph endpoints

Supabase (managed):
  Primary PostgreSQL (writes)
  └── Read Replica (analytics queries) → Phase 2
  └── Supavisor / pgBouncer for app-safe SQL traffic

Upstash (serverless):
  Redis (cache + event bus + rate limiting)
  QStash (job queue + CRON)

PowerSync (managed):
  CRDT sync coordinator
  ← Direct Postgres logical replication from Supabase
  → WebSocket connections to POS/KDS tablets

Current dev note:
  Client bootstrap path is implemented.
  End-to-end cloud replication stays blocked until direct logical replication and
  `powersync` publication are established. See `docs/01-foundation/powersync-supabase-dev-status.md`.
```

---

## Security Architecture

### Defense in Depth

```
Layer 1: Cloudflare WAF
  → Blocks SQL injection, XSS, credential stuffing, known bot patterns
  → DDoS absorption at edge

Layer 2: Apollo Router
  → JWT validation (all GraphQL requests)
  → Rate limiting (1000 req/s per restaurant_id)
  → Query complexity limits (depth 10, tokens 10000)
  → No unauthenticated mutations

Layer 3: Next.js Middleware
  → Session validation on every /merchant and /pos route
  → Guest HMAC validation on every /[slug] route

Layer 4: GraphQL Resolvers
  → restaurant_id extracted from JWT claim
  → All DB queries scoped to restaurant_id

Layer 5: Supabase RLS
  → Every table has RLS policy
  → auth.uid() → restaurant_staff → restaurant_id → row-level filter
  → Bug in Layer 3 or 4 cannot expose cross-tenant data

Layer 6: Payment Security
  → All payment API keys in server environment only
  → No payment keys in client bundles
  → Webhook signatures verified with timing-safe comparison
  → All payment state transitions server-side only
```

### HMAC-SHA256 QR Signing

```
Data signed: "{slug}:{tableNumber}:{expiresAt}"
Signature:   HMAC-SHA256(data, lole_QR_SECRET)
URL param:   ?sig={64-hex-char-signature}&exp={timestamp}
Verification: crypto.timingSafeEqual(computedSig, receivedSig)
Expiry:      24 hours from generation
```

---

## Scalability Architecture

### Horizontal Scaling Readiness

```
Stateless application servers: ✅
  Vercel auto-scales Next.js instances
  Railway can add Apollo Router instances
  No in-memory session state — all sessions in Supabase/Redis

Database read scaling: Phase 2
  Add Supabase read replica for analytics queries
  Route all SELECT from /merchant/analytics to replica

Connection pool management: Now
  DATABASE_URL = pooler lane for app/runtime SQL traffic
  DATABASE_DIRECT_URL = direct lane for migrations, CI, admin scripts, PowerSync replication
  Target: max 20 connections per Vercel instance

Cache hierarchy:
  L1: PowerSync IndexedDB (device-local, <1ms)
  L2: Cloudflare Worker KV (Nairobi edge, <100ms)
  L3: Upstash Redis (50–100ms from Addis)
  L4: Supabase PostgreSQL (30–80ms for indexed queries)
```

### Load Estimates by Scale

| Restaurants | Peak Orders/min | Peak Concurrent Connections | DB Queries/min                  |
| ----------- | --------------- | --------------------------- | ------------------------------- |
| 50          | 500             | 500 (50 × 10 devices)       | 2,500                           |
| 200         | 2,000           | 2,000                       | 8,000                           |
| 500         | 5,000           | 5,000                       | 15,000 (with caching)           |
| 2,000       | 20,000          | 20,000                      | 40,000 (with caching + replica) |

At 500 restaurants, menu caching via Cloudflare Worker eliminates ~60% of DB read load. The remaining 40% is order operations (writes + status updates) which cannot be cached.

---

_lole System Architecture v1.0 · March 2026_
