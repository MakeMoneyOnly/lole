# Living Blueprint - Cognitive Orchestration Layer

**Version:** 1.1.0  
**Last Updated:** 2026-04-30  
**Source:** Codebase Analysis + `.env.example`

---

## North Star Goal

**Vision:** lole as the definitive Restaurant Operating System (ROS) for the Ethiopian market

**Primary Objectives:**

1. **Offline-first resilience** for Addis Reality (PowerSync + Capacitor)
2. **ERCA fiscal compliance** with e-Invoice integration
3. **Multi-tenant security** with strict RLS and service-role scoping
4. **Santim integer pattern** for all monetary values (100 santim = 1 ETB)
5. **Local-First Mesh** between POS and KDS devices on restaurant LAN

---

## Codebase State

### Domain Health Map

| Domain   | Status | Tech Debt | RLS Verified | Test Coverage | Notes                       |
| -------- | ------ | --------- | ------------ | ------------- | --------------------------- |
| orders   | stable | medium    | verified     | 78%           | Table Session lifecycle     |
| menu     | stable | low       | verified     | 82%           | Tsom (Fasting) flags        |
| payments | stable | low       | verified     | 91%           | Chapa/Telebirr integrations |
| staff    | stable | medium    | verified     | 65%           | Shift management            |
| guests   | stable | low       | verified     | 72%           | QR Ordering & Loyalty       |

> [!IMPORTANT]
> **Discontinued Domains**: Inventory and Suppliers have been removed from the platform as of 2026-03-23.

### Technology Stack (verified from .env.example)

- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind CSS 4
- **Database**: Supabase (PostgreSQL 15) + Connection Pooling (Supavisor)
- **Offline Sync**: PowerSync (CRDT-based Postgres sync)
- **API**: Apollo Router (Rust) + GraphQL Federation
- **Payments**: Chapa, Telebirr, CBE Birr, Amole
- **Jobs/Events**: Upstash Redis (Streams) + Upstash QStash
- **Infrastructure**: Vercel (Hosting) + Railway (Apollo Router) + Cloudflare (R2/WAF)
- **Compliance**: ERCA e-Invoice API + MoR Fiscal Reporting
- **Native**: CapacitorJS for Android POS/KDS hardware

### Key Architectural Patterns

- **3-file domain pattern**: `resolvers.ts`, `service.ts`, `repository.ts`
- **Santim integer**: All financial values are stored as `Int` (e.g., `amount_santim`)
- **Multi-tenancy**: `restaurant_id` scoping enforced at DB level (RLS) and API level
- **Local-First Always**: Core flows work offline via PowerSync local SQLite

---

## Implementation Ledger

### Decision Log

- **2026-04-30**: Updated COL to match actual codebase state (removed inventory/suppliers)
- **2026-03-23**: Discontinued Inventory & Supplier features to focus on core POS/KDS
- **2026-03-12**: Migrated all monetary fields to Santim integer pattern (CRIT-02)
- **2026-02-15**: Enforced P0 RLS hardening across all tenant tables

### Skill Integration

Managed via `/.agents/skills/`:

- **gstack**: Browser automation & E2E testing
- **volt-agent**: Enterprise compliance & security best practices
- **mattpocock**: Architecture & TDD patterns

---

## Knowledge Graph

### Domain Relationships

```
orders ──creates──► order_items
orders ──creates──► table_sessions
orders ──triggers──► payment.completed (event)
payment.completed ──integrates──► aggregator.payment (Chapa/Telebirr)
staff.shift_started ──updates──► staff.current_status
kds ──receives──► order.tickets (Station Routing)
qr_ordering ──validates──► table.tokens (HMAC)
```

---

## Validation Matrix

### Security Checklist

- [x] RLS policies defined for all tenant tables
- [x] Service role queries include explicit `restaurant_id` filters
- [ ] Tighten `public.tables` SELECT policy (Pending)
- [x] Secrets masked in logs and client-side

### Compliance Checklist

- [x] Santim integer pattern verified in core domains
- [x] ERCA e-Invoice submission logic implemented
- [ ] MoR Fiscal reporting certification (Pending)

---

## Daily Questions

1. Does this change adhere to the Santim integer pattern?
2. Is the `restaurant_id` scoping preserved in this query?
3. Have we considered the offline-first implications of this feature?
4. Is there a corresponding validation in the `repository.ts` layer?
   made toward the North Star Goal?
5. What debt was paid down or accumulated?
6. What decisions need to be recorded?
7. What needs alignment with this blueprint?
