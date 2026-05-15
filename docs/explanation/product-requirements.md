# lole — Product Requirements Document (PRD)

**Version 1.0 · May 2026 · Authoritative**

---

## 1. Vision & Opportunity

### 1.1 The Problem

Ethiopian restaurants operate in an environment fundamentally incompatible with traditional Western POS systems:

| Challenge                                     | Impact                                           |
| --------------------------------------------- | ------------------------------------------------ |
| Frequent power outages (2-3 times per week)   | Systems crash mid-service; orders lost           |
| Unreliable internet connectivity              | Cloud-only POS becomes unusable                  |
| Local fiscal compliance (ERCA e-invoicing)    | Non-compliance = fines and business closure      |
| Multilingual workforce (English + Amharic)    | Training costs multiply; adoption suffers        |
| Cash-poor economy with mobile money dominance | Credit card terminals irrelevant                 |
| No established POS vendors                    | Restaurants build fragile Google Sheet workflows |

### 1.2 The Solution

**lole** is the Restaurant Operating System designed for Ethiopia's reality. It is:

- **Resilient by design**: Core operations work offline for 24+ hours
- **Fiscally compliant**: Automatic ERCA e-invoice submission
- **Culturally native**: Amharic-first UI with English support
- **Mobile-first**: PWA on any Android tablet, no app store required
- **Affordable**: Subsidized hardware path via consumer tablets

### 1.3 Success Metrics

| Metric             | Horizon 1 Target (12 months) | Horizon 2 Target (30 months) | Horizon 3 Target (60 months) |
| ------------------ | ---------------------------- | ---------------------------- | ---------------------------- |
| Active restaurants | 200                          | 1,000                        | 2,000+                       |
| MRR                | 200,000 ETB                  | 1,500,000 ETB                | 5,000,000 ETB                |
| Monthly churn      | <5%                          | <3%                          | <2%                          |
| NPS                | >45                          | >55                          | >60                          |
| Offline uptime     | 99.9%                        | 99.95%                       | 99.99%                       |

---

## 2. Personas & Jobs-to-be-Done

### 2.1 Restaurant Owner/Operator

**Goals**: Maximize revenue, minimize headaches, stay compliant

| Job-to-be-Done                                  | lole Solution                                        |
| ----------------------------------------------- | ---------------------------------------------------- |
| Track daily sales without manual reconciliation | Real-time dashboard with EOD Telegram reports        |
| Process Telebirr/Chapa payments seamlessly      | One-tap payment initiation with auto-verification    |
| Stay compliant with ERCA taxes                  | Automatic e-invoice generation and submission        |
| Understand what's selling                       | Analytics: top items, peak hours, server performance |
| Manage staff efficiency                         | Time tracking, performance insights                  |

### 2.2 Waiter/Cashier

**Goals**: Take orders quickly, accurately, without tech friction

| Job-to-be-Done                          | lole Solution                              |
| --------------------------------------- | ------------------------------------------ |
| Take complex orders (modifiers, splits) | Intuitive modifier workflow, split bill UI |
| Work in Amharic (primary language)      | Full Amharic UI with minimal English terms |
| Function during power outage            | Offline-first PWA continues working        |
| Authenticate securely but quickly       | 4-digit PIN login (device-specific)        |
| Send orders to kitchen instantly        | PowerSync real-time sync to KDS            |

### 2.3 Kitchen Staff

**Goals**: See orders clearly, prep efficiently, communicate issues

| Job-to-be-Done                      | lole Solution                                         |
| ----------------------------------- | ----------------------------------------------------- |
| View orders by prep station         | KDS with station routing (Kitchen, Bar, Coffee, etc.) |
| Track order timing                  | Elapsed time display, color-coded urgency             |
| Handle modifiers correctly          | Clear modifier display with required indicators       |
| Communicate allergies/special notes | Staff broadcast feature                               |
| Work during internet outage         | Local-first IndexedDB cache                           |

### 2.4 Manager

**Goals**: Oversee operations, analyze performance, manage staff

| Job-to-be-Done                   | lole Solution                             |
| -------------------------------- | ----------------------------------------- |
| View real-time restaurant status | Dashboard with live order counts, revenue |
| Access historical data           | Report generation, export capabilities    |
| Manage inventory levels          | Low stock alerts, purchase order draft    |
| Handle multiple locations        | Multi-location dashboard consolidation    |
| Run end-of-day procedures        | Automated EOD reports at 10PM             |

### 2.5 Dine-in Guest

**Goals**: Order food easily, optionally engage with loyalty program

| Job-to-be-Done                 | lole Solution                                  |
| ------------------------------ | ---------------------------------------------- |
| Scan QR and order immediately  | Anonymous QR ordering with no account required |
| Modify orders intuitively      | Visual modifier selection                      |
| Track order progress           | Real-time order status on phone                |
| Earn loyalty points (optional) | Quick signup during checkout to capture points |
| Pay via mobile money           | Telebirr/Chapa integration                     |

---

## 3. Functional Requirements

### 3.1 Core Ordering System (POS)

| Requirement ID | Description                              | Priority | Status |
| -------------- | ---------------------------------------- | -------- | ------ |
| ORD-001        | Create new order with table assignment   | Must     | ✅     |
| ORD-002        | Add menu items with required modifiers   | Must     | ✅     |
| ORD-003        | Split bill by item or amount             | Must     | ✅     |
| ORD-004        | Transfer order between tables            | Should   | ⏳     |
| ORD-005        | Void/cancel order with reason            | Must     | ✅     |
| ORD-006        | Edit sent order (manager approval)       | Should   | ⏳     |
| ORD-007        | Order notes (allergy, special request)   | Must     | ✅     |
| ORD-008        | Discount application (happy hour, promo) | Must     | ✅     |
| ORD-009        | Tax-inclusive pricing (VAT handling)     | Must     | ✅     |

### 3.2 Kitchen Display System (KDS)

| Requirement ID | Description                          | Priority | Status |
| -------------- | ------------------------------------ | -------- | ------ |
| KDS-001        | Display orders by prep station       | Must     | ✅     |
| KDS-002        | Order timer with color escalation    | Must     | ✅     |
| KDS-003        | Mark items as started/completed      | Must     | ✅     |
| KDS-004        | Rush/urgent order flagging           | Should   | ⏳     |
| KDS-005        | Order course firing (apps → entrees) | Could    | ⏳     |
| KDS-006        | Kitchen staff broadcast messages     | Should   | ⏳     |

### 3.3 Guest Ordering (QR PWA)

| Requirement ID | Description                             | Priority | Status |
| -------------- | --------------------------------------- | -------- | ------ |
| QR-001         | HMAC-signed table linking               | Must     | ✅     |
| QR-002         | Anonymous ordering (no signup)          | Must     | ✅     |
| QR-003         | Loyalty enrollment during checkout      | Should   | ⏳     |
| QR-004         | Real-time order status tracking         | Must     | ✅     |
| QR-005         | Menu browsing with categories           | Must     | ✅     |
| QR-006         | Modifier selection with visual guidance | Must     | ✅     |

### 3.4 Payment Processing

| Requirement ID | Description                        | Priority | Status |
| -------------- | ---------------------------------- | -------- | ------ |
| PAY-001        | Telebirr payment initiation        | Must     | ✅     |
| PAY-002        | Chapa payment initiation           | Must     | ✅     |
| PAY-003        | Cash payment recording             | Must     | ✅     |
| PAY-004        | Webhook verification (HMAC-SHA256) | Must     | ✅     |
| PAY-005        | Refund processing                  | Should   | ⏳     |
| PAY-006        | Payment reconciliation             | Must     | ✅     |
| PAY-007        | ERCA e-invoice submission          | Must     | ⏳     |

### 3.5 Restaurant Management

| Requirement ID | Description                         | Priority | Status |
| -------------- | ----------------------------------- | -------- | ------ |
| MGMT-001       | Menu management (items, categories) | Must     | ✅     |
| MGMT-002       | Staff management (roles, PINs)      | Must     | ✅     |
| MGMT-003       | Table management                    | Must     | ✅     |
| MGMT-004       | Revenue reporting                   | Must     | ✅     |
| MGMT-005       | Inventory tracking                  | Should   | ⏳     |
| MGMT-006       | Multi-location consolidation        | Could    | ⏳     |

### 3.6 Loyalty Program

| Requirement ID | Description                  | Priority | Status |
| -------------- | ---------------------------- | -------- | ------ |
| LTY-001        | Guest account creation       | Should   | ⏳     |
| LTY-002        | Point accumulation per order | Must     | ⏳     |
| LTY-003        | Tier progression logic       | Could    | ⏳     |
| LTY-004        | Reward redemption            | Could    | ⏳     |
| LTY-005        | Guest-facing loyalty PWA     | Should   | ⏳     |

---

## 4. Non-Functional Requirements

### 4.1 Reliability & Resilience

| Category                | Requirement                      | Target                           |
| ----------------------- | -------------------------------- | -------------------------------- |
| **Uptime**              | Core ordering must function      | 99.9% (offline mode)             |
| **Recovery**            | Data sync after outage           | <2s when connectivity restored   |
| **Conflict Resolution** | No duplicate orders on reconnect | CRDT-based with idempotency keys |
| **Backup**              | Daily database backup            | Automated, tested monthly        |

### 4.2 Performance

| Operation                 | Response Target |
| ------------------------- | --------------- |
| Menu load (cached)        | <100ms          |
| Order submission          | <300ms          |
| KDS update propagation    | <2s             |
| Payment webhook response  | <50ms           |
| Offline query (IndexedDB) | <5ms            |

### 4.3 Security

| Control              | Implementation                               |
| -------------------- | -------------------------------------------- |
| **Authentication**   | Supabase Auth with HttpOnly cookies          |
| **Authorization**    | Role-based (owner, manager, waiter, kitchen) |
| **Multi-tenancy**    | Row Level Security on all tables             |
| **Data encryption**  | AES-256 at rest, TLS 1.2+ in transit         |
| **Webhook security** | HMAC-SHA256 timing-safe verification         |
| **Audit trail**      | All mutations logged with staff_id           |

### 4.4 Compliance

| Standard           | Requirement                                                   |
| ------------------ | ------------------------------------------------------------- |
| **ERCA**           | E-invoice submission within 24 hours of order                 |
| **Data retention** | Financial records 7 years, operational logs 2 years           |
| **Privacy**        | No PAN/bank credentials stored, device fingerprinting opt-out |

---

## 5. Technical Architecture Alignment

### 5.1 Data Model (Simplified)

```
restaurants (1) ─── restaurants_staff (N) ─── auth.users
      │
      ├── menu_items (N) ─── categories (N)
      │
      ├── tables (N) ─── orders (N) ─── order_items (N)
      │    │                │
      │    │                └── order_item_modifiers (N)
      │    │
      │    └── revenue_centers (N)
      │
      ├── guests (N) ─── loyalty_accounts (1)
      │
      ├── inventory_items (N) ─── recipes (N)
      │
      ├── payments (N)
      │
      └── analytics/hourly_sales (timescaledb)
```

### 5.2 Offline-First Architecture

| Component       | Online Mode           | Offline Mode                    |
| --------------- | --------------------- | ------------------------------- |
| **Data Source** | Supabase PostgreSQL   | PowerSync CRDT → IndexedDB      |
| **Order Flow**  | Direct API → DB       | Local queue → sync on reconnect |
| **KDS Updates** | Realtime subscription | IndexedDB polling               |
| **Payment**     | Real-time webhook     | Queued for sync                 |

### 5.3 API Contract (GraphQL Federation)

```graphql
# Core domains
type Query {
    # Menu domain
    menuItems(restaurantId: ID!, available: Boolean): [MenuItem!]!

    # Orders domain
    orders(restaurantId: ID!, status: OrderStatus): [Order!]!
    order(id: ID!): Order

    # Guests domain
    guest(id: ID!): Guest
}

type Mutation {
    # Orders
    createOrder(input: CreateOrderInput!): Order!
    updateOrderStatus(id: ID!, status: OrderStatus!): Order!

    # Menu
    createMenuItem(input: CreateMenuItemInput!): MenuItem!

    # Guests
    createGuestSession(input: GuestSessionInput!): GuestSession!
}

# Subscriptions for real-time updates
type Subscription {
    orderUpdated(restaurantId: ID!): Order!
    kdsOrders(station: PrepStation!): [Order!]!
}
```

---

## 6. Go-to-Market Requirements

### 6.1 Pricing Tiers

| Tier           | Price (ETB/month) | Features                              |
| -------------- | ----------------- | ------------------------------------- |
| **Starter**    | 0                 | 1 location, basic POS + KDS           |
| **Pro**        | 1,200             | Multi-station KDS, loyalty, analytics |
| **Business**   | 3,500             | Multi-location, inventory, API access |
| **Enterprise** | Custom            | White-label, dedicated support, ERCA  |

### 6.2 Onboarding Flow

1. Restaurant signs up via web form
2. Manager completes restaurant profile
3. Menu imported/uploaded
4. Staff accounts created with roles
5. QR codes generated for tables
6. Hardware (tablets) provisioned
7. Training session scheduled

### 6.3 Support Structure

| Channel                  | SLA        |
| ------------------------ | ---------- |
| Telegram support         | 2 hours    |
| Email support            | 24 hours   |
| Critical (payments down) | 30 minutes |

---

## 7. Success Criteria & KPIs

### 7.1 Leading Indicators (Real-time)

- Daily active restaurants (target: 200 by Month 12)
- Order success rate (target: >99.9%)
- Feature adoption (loyalty enrollment >20%)
- Support ticket volume (<5 per restaurant per month)

### 7.2 Lagging Indicators (Monthly)

- Churn rate (<5% monthly)
- MRR growth (target: 200,000 ETB by Month 12)
- NPS (>45)
- Payment success rate (>99%)

### 7.3 Technical Health

- Uptime (99.9%)
- Webhook processing latency (<50ms p95)
- Sync latency (<2s)
- Error rate (<0.1%)

---

## 8. Dependencies & Risks

### 8.1 Critical Dependencies

| Dependency         | Risk                     | Mitigation                         |
| ------------------ | ------------------------ | ---------------------------------- |
| **Supabase**       | Platform reliability     | Multi-read replica strategy        |
| **Telebirr/Chapa** | Payment processing       | Dual provider, webhook retry logic |
| **ERCA API**       | Tax compliance           | 5-retry backoff, manual fallback   |
| **PowerSync**      | Offline sync reliability | Local fallback mode, CRDTs         |

### 8.2 Key Assumptions

- Android tablets (100-200 USD) are acceptable price point
- Telegram is primary communication channel for restaurant owners
- Mobile money dominates payment landscape (95%+ share)
- Amharic-first UI accelerates adoption over English-first

---

## 9. Release Phases

### Phase 1: Foundation (Months 1-2)

- [x] Santim (integer) money handling
- [x] Payment webhooks (Telebirr/Chapa)
- [x] Amharic UI implementation
- [ ] PowerSync offline mode
- [ ] Monitoring (Sentry, Prometheus)

### Phase 2: Completeness (Months 3-4)

- [x] Discount engine
- [x] GraphQL federation
- [ ] Loyalty points wired to orders
- [ ] Modifier table migration

### Phase 3: Monetization (Months 4-5)

- [ ] ERCA integration
- [ ] Subscription billing
- [ ] EOD Telegram reports

### Phase 4: Growth (Months 6-12)

- [ ] lole Now mobile app
- [ ] Multi-location support
- [ ] Referral program
- [ ] Kitchen analytics

---

## 10. Document Control

| Version | Date       | Author      | Changes                                              |
| ------- | ---------- | ----------- | ---------------------------------------------------- |
| 1.0     | 2026-05-14 | Engineering | Initial PRD based on system architecture and roadmap |

---

_lole Product Requirements Document v1.0 · May 2026 · Authoritative_
