# Core Features Organization

A reference guide for developers documenting the structure, status, and migration state of core vs operations features.

## Overview

This document distinguishes between **Core Features** (direct `src/features/` with full frontend+backend) and **Operations Features** (nested under `src/features/operations/` with API/operation focused structure).

---

## Core Features (Direct `src/features/`)

These features contain complete implementations including UI components, hooks, and business logic.

| Feature    | Structure                                                                   | Description                                                               | Migration Status        |
| ---------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------- |
| `merchant` | `hooks/`, `components/`, `lib/`, `utils/`                                   | Merchant profile, settings, device management, staff management           | Stable                  |
| `kds`      | `hooks/`, `components/`, `lib/` (with tests)                                | Kitchen Display System UI with realtime updates, stations, expeditor view | Stable                  |
| `orders`   | `api/`, `services/`, `domain/`, `contracts/`, `events/`, `hooks/`, `tests/` | Order management with expanded full feature-slice architecture            | Complete                |
| `auth`     | `components/`, `hooks/`                                                     | Authentication flows and role management                                  | Basic                   |
| `menu`     | `components/`                                                               | Menu management UI                                                        | Basic - needs expansion |

### Detailed Structure

#### `merchant/` - Merchant Profile & Settings

```
merchant/
├── hooks/
│   ├── useStaff.ts
│   ├── useDevices.ts
│   ├── useMerchantActivity.ts
│   ├── useDeviceHeartbeat.ts
│   ├── useManagedDeviceSession.ts
│   └── __tests__/unit/useManagedDeviceSession.test.ts
├── components/          # UI components
├── lib/                 # Business logic utilities
└── utils/
    └── transformActivity.ts
```

#### `kds/` - Kitchen Display System

```
kds/
├── hooks/
│   └── useKDSRealtime.ts
├── components/
│   ├── StationBoard.tsx
│   └── ExpeditorBoard.tsx
└── lib/
    ├── read-adapter.ts
    ├── syncAdapter.ts
    ├── smartQueue.ts
    ├── printer.ts
    ├── printer.test.ts
    ├── handoff-adapter.ts
    ├── prepTimeCalculator.ts
    └── index.ts
    └── __tests__/unit/
        ├── syncAdapter.test.ts
        ├── read-adapter.test.ts
        └── handoff-adapter.test.ts
```

#### `orders/` - Order Management (Full Feature-Slice)

```
orders/
├── api/                 # API route delegates
├── services/            # Orchestration logic
├── domain/              # Re-exports from src/domains/orders/
├── contracts/           # Zod schemas for validation
├── events/              # Event types and handlers
├── hooks/
│   ├── useOrder.ts
│   ├── useOrders.ts
│   └── index.ts
└── tests/
```

#### `auth/` - Authentication

```
auth/
├── components/
│   └── LoginForm.tsx
└── hooks/
    └── useRole.ts
```

#### `menu/` - Menu Management

```
menu/
└── components/          # Basic structure - needs expansion
```

---

## Operations Features (`src/features/operations/`)

Backend-focused operation modules with standardized API and contract patterns. These provide server-side handlers for specific operational domains.

| Sub-feature        | Structure            | Status          | Notes                                       |
| ------------------ | -------------------- | --------------- | ------------------------------------------- |
| `delivery`         | `api/`, `contracts/` | Full structure  | Aggregator order handling, fee calculation  |
| `kds`              | `api/`, `contracts/` | Full structure  | Status updates, queue management, telemetry |
| `orders`           | `api/`, `contracts/` | Full structure  | List, create, cancel, status updates        |
| `payments`         | `api/`, `contracts/` | Basic structure | Session creation, Stripe integration        |
| `waitlist`         | `api/`, `contracts/` | Full structure  | Create entry, list waitlist, notifications  |
| `table-sessions`   | `api/`, `contracts/` | Full structure  | Open/close/transfer sessions                |
| `service-requests` | `api/`, `contracts/` | Full structure  | Create, update, list requests               |
| `tip-pools`        | `api/`, `contracts/` | Full structure  | Allocation, listing                         |

### Shared Utilities (`operations/shared/`)

```
shared/
├── auth-middleware.ts    # Merchant authentication middleware
├── response-utils.ts     # Standard response wrappers
├── audit-helpers.ts      # Audit logging utilities
├── pilot-gate.ts         # Pilot program access control
└── index.ts
```

### Detailed Structure

#### `operations/orders/`

```
orders/
├── api/
│   ├── create-order.ts
│   ├── cancel-order.ts
│   ├── update-status.ts
│   ├── get-order.ts
│   ├── list-orders.ts
│   └── index.ts
├── contracts/
│   ├── schemas.ts
│   └── index.ts
└── index.ts
```

#### `operations/kds/`

```
kds/
├── api/
│   ├── update-status.ts
│   ├── get-queue.ts
│   └── telemetry.ts
├── contracts/
│   ├── schemas.ts
│   └── index.ts
└── index.ts
```

#### `operations/delivery/`

```
delivery/
├── api/
│   ├── aggregator-orders.ts
│   ├── calculate-fee.ts
│   └── index.ts
├── contracts/
│   ├── schemas.ts
│   └── index.ts
└── index.ts
```

#### `operations/waitlist/`

```
waitlist/
├── api/
│   ├── create-entry.ts
│   ├── list-waitlist.ts
│   ├── notify-entry.ts
│   └── index.ts
├── contracts/
│   ├── schemas.ts
│   └── index.ts
└── index.ts
```

#### `operations/table-sessions/`

```
table-sessions/
├── api/
│   ├── open-session.ts
│   ├── close-session.ts
│   ├── transfer-session.ts
│   └── index.ts
├── contracts/
│   ├── schemas.ts
│   └── index.ts
└── index.ts
```

#### `operations/service-requests/`

```
service-requests/
├── api/
│   ├── update-request.ts
│   ├── list-requests.ts
│   └── index.ts
├── contracts/
│   ├── schemas.ts
│   └── index.ts
└── index.ts
```

#### `operations/payments/`

```
payments/
├── api/
│   ├── create-session.ts
│   └── index.ts
├── contracts/
│   ├── schemas.ts
│   └── index.ts
└── index.ts
```

#### `operations/tip-pools/`

```
tip-pools/
├── api/
│   ├── allocate-pools.ts
│   ├── list-pools.ts
│   └── index.ts
├── contracts/
│   ├── schemas.ts
│   └── index.ts
└── index.ts
```

---

## Gap Analysis & Migration Status

### Features Requiring Attention

| Feature    | Gap                                               | Priority | Recommendation                                  |
| ---------- | ------------------------------------------------- | -------- | ----------------------------------------------- |
| `menu`     | Only has `components/` directory                  | Medium   | Add `api/`, `contracts/`, `hooks/`, `services/` |
| `auth`     | Missing `api/`, `lib/`, `tests/`                  | Medium   | Expand with full feature-slice structure        |
| `merchant` | Has legacy structure without `api/`, `contracts/` | Low      | Consider alignment if API expansion needed      |

### Core vs Operations Duplication

The following features exist in both Core and Operations namespaces:

| Feature  | Core Location          | Operations Location               | Notes                                             |
| -------- | ---------------------- | --------------------------------- | ------------------------------------------------- |
| `kds`    | `src/features/kds/`    | `src/features/operations/kds/`    | Core = UI layer, Operations = API handlers        |
| `orders` | `src/features/orders/` | `src/features/operations/orders/` | Core = full feature-slice, Operations = API layer |

**Pattern**: This duplication is intentional - Core features handle the frontend/UI layer while Operations features provide the backend API handlers. They should remain separate for clean separation of concerns.

---

## Directory Conventions

### Core Features Structure (Recommended)

```
features/[feature]/
├── api/            # API route handlers (if needed)
├── services/       # Orchestration logic
├── domain/         # Re-exports from src/domains/[feature]/
├── contracts/      # Zod schemas
├── events/         # Event definitions
├── hooks/          # React hooks
├── components/     # UI components
└── tests/          # Feature tests
```

### Operations Features Structure

```
features/operations/[feature]/
├── api/            # Operation handlers
├── contracts/      # Zod schemas
└── index.ts        # Feature exports
```

---

## References

- [Feature-Slice Architecture ADR](../explanation/decisions/002-feature-slice-design.md)
- [Feature README](../../src/features/README.md)
- [Operations Namespace Restructuring](../explanation/architecture/operations-namespace-restructuring.md)
