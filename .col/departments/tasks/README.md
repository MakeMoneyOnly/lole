# 00-departments: Functional Unit Structure

This directory organizes the lole Restaurant OS into 23 functional units (departments) for systematic development, audit, and task tracking.

---

## Purpose

The department structure enables:

- Sequential processing of enterprise-grade implementation tasks
- Clear ownership boundaries for architecture decisions
- Audit coverage mapping to operational domains
- Risk isolation and compliance tracking

---

## Department Structure

| ID  | Department               | Scope                                                                          |
| --- | ------------------------ | ------------------------------------------------------------------------------ |
| 01  | **Platform Engineering** | Core Runtime & Gateway, local-first infrastructure, gateway deployment         |
| 02  | Network Transport        | MQTT LAN transport, device discovery, session management, certificate rotation |
| 03  | Local Persistence        | PowerSync configuration, SQLite schema, local journal implementation           |
| 04  | Domain Core              | Headless business logic, event contracts, command routing                      |
| 05  | KDS Operations           | Kitchen Display System, station routing, multi-terminal sync                   |
| 06  | Order Management         | Order lifecycle, table sessions, course firing, split-brain resolution         |
| 07  | POS Terminal             | Point-of-sale interface, offline workflows, local authority                    |
| 08  | Payments                 | Local ledger, deferred verification, reconciliation, offline settlement        |
| 09  | Fiscal Compliance        | Local signing, ERCA/EFM integration, legal receipt continuity                  |
| 10  | Print Services           | Gateway-owned spooler, driver abstraction, retry policies                      |
| 11  | Hardware Abstraction     | Printer/scanner/drawer contracts, peripheral management                        |
| 12  | Delivery Integr.         | Aggregator integrations, webhook intake, order injection                       |
| 13  | Staff Management         | PIN auth, session expiry, tip allocation, payroll sync                         |
| 14  | Menu & Catalog           | Menu management, pricing, modifiers, categories                                |
| 15  | Inventory                | Stock tracking, supply chain, waste logging                                    |
| 16  | Pricing Engine           | Dynamic pricing, discounts, promotions                                         |
| 17  | Customer Facing          | Loyalty, feedback, reservations, waitlist                                      |
| 18  | Reporting                | Dashboard metrics, KPI calculation, telemetry export                           |
| 19  | Security                 | Device identity, encryption, offline authz, audit trail                        |
| 20  | Device Mgmt              | Provisioning, Esper MDM, zero-touch enrollment, fleet ops                      |
| 21  | Compliance               | Data retention, ERCA audit, PCI-DSS alignment                                  |
| 22  | Rollout Ops              | Feature flags, deployment rings, progressive rollout                           |
| 23  | Monitoring               | Health checks, metrics, alerting, failover detection                           |

---

## Core Runtime & Gateway (Department 01)

**Primary Artifact:** `01-platform-engineering/01-core-runtime-gateway/`

This department covers the foundational elements for local-first restaurant operations:

- Store Gateway runtime (ADR-001)
- MQTT LAN transport layer
- Local-first boundary compliance
- PowerSync sync configuration
- Local journal implementation (SHA-256 payload hashing)
- Offline payment ledger
- Split-brain conflict resolution
- Security and kiosk-safe networking

### Key Files

- `AUDIT.md` — Comprehensive audit of Core Runtime & Gateway architecture, implementation status, and gaps
- `TASKS.md` — Prioritized implementation tasks derived from audit findings (Critical: MQTT broker deployment, Gateway runtime deployment)

---

## Using the Department Structure

### Sequential Processing Workflow

1. **Identify Department** — Locate the functional unit responsible for your change
2. **Review Audit** — Read `DEPARTMENT/aNN-name/AUDIT.md` for current state and gaps
3. **Check Tasks** — Open `DEPARTMENT/aNN-name/TASKS.md` for prioritized work queue
4. **Implement** — Follow task definitions, reference file:line anchors
5. **Verify** — Run verification commands documented in audit/tasks
6. **Mark Complete** — Update status in TASKS.md, archive old audit findings

### Cross-Department Dependencies

| From                 | To                | Dependency Type                      |
| -------------------- | ----------------- | ------------------------------------ |
| Platform Engineering | Network Transport | Runtime depends on MQTT for LAN      |
| Platform Engineering | Local Persistence | Gateway uses local journal           |
| Network Transport    | Device Management | Device identity required for session |
| Payments             | Fiscal Compliance | Receipt signing after capture        |
| KDS Operations       | Order Management  | KDS items reflect order state        |
| Hardware Abstraction | Print Services    | Spooler uses driver contracts        |

---

## Index

- [01-platform-engineering](./01-platform-engineering/) — Core Runtime & Gateway
- [02-network-transport](./02-network-transport/) — LAN transport, discovery, certificates
- [03-local-persistence](./03-local-persistence/) — PowerSync, SQLite, journal schema
- [04-domain-core](./04-domain-core/) — Business logic, events, commands
- [05-kds-operations](./05-kds-operations/) — Kitchen display, station routing
- [06-order-management](./06-order-management/) — Order lifecycle, table sessions
- [07-pos-terminal](./07-pos-terminal/) — Point-of-sale workflows
- [08-payments](./08-payments/) — Payment ledger, settlement, reconciliation
- [09-fiscal-compliance](./09-fiscal-compliance/) — Offline signing, legal receipts
- [10-print-services](./10-print-services/) — Spooler, driver abstraction
- [11-hardware-abstraction](./11-hardware-abstraction/) — Device contracts
- [12-delivery-integration](./12-delivery-integration/) — Aggregator intake
- [13-staff-management](./13-staff-management/) — Auth, PIN, payroll
- [14-menu-catalog](./14-menu-catalog/) — Menu management
- [15-inventory](./15-inventory/) — Stock tracking
- [16-pricing-engine](./16-pricing-engine/) — Pricing rules
- [17-customer-facing](./17-customer-facing/) — Loyalty, reservations
- [18-reporting](./18-reporting/) — Dashboards, metrics
- [19-security](./19-security/) — Identity, encryption, authz
- [20-device-management](./20-device-management/) — MDM, provisioning
- [21-compliance](./21-compliance/) — Legal, audit, retention
- [22-rollout-ops](./22-rollout-ops/) — Feature flags, deployment rings
- [23-monitoring](./23-monitoring/) — Health, metrics, alerts

---

_Last Updated: 2026-05-02_
