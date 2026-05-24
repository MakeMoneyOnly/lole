# lole - Restaurant Operating System

A modern restaurant management platform built with Next.js, TypeScript, GraphQL federation, and Supabase. Designed for enterprise-grade reliability with offline-first capabilities, multi-channel ordering, and real-time kitchen display systems.

## Tech Stack

| Category       | Technology                                                  |
| -------------- | ----------------------------------------------------------- |
| **Frontend**   | [Next.js 16](https://nextjs.org/) • React 19 • TypeScript 5 |
| **Backend**    | GraphQL Federation • Supabase (PostgreSQL) • Apollo Router  |
| **Testing**    | Vitest • React Testing Library • Playwright                 |
| **Deployment** | Vercel/Edge Runtime • Railway (Apollo Router)               |
| **Offline**    | PowerSync • Capacitor • MQTT                                |

## Quick Start

### Prerequisites

- **Node.js** 22.0.0 or higher
- **pnpm** 10.0.0 or higher
- **Supabase** account (for database)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd lole

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Configure your Supabase credentials in .env.local
# Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY

# Start development server
pnpm dev
```

Open [http://localhost:4000](http://localhost:4000) to view the application.

## Available Scripts

| Script               | Description                           |
| -------------------- | ------------------------------------- |
| `pnpm dev`           | Start development server on port 4000 |
| `pnpm build`         | Build production application          |
| `pnpm build:analyze` | Build with bundle analyzer            |
| `pnpm start`         | Start production server               |
| `pnpm test`          | Run unit tests with Vitest            |
| `pnpm test:coverage` | Run tests with coverage report        |
| `pnpm test:e2e`      | Run end-to-end tests with Playwright  |
| `pnpm lint`          | Run ESLint                            |
| `pnpm type-check`    | Run TypeScript type checking          |
| `pnpm format`        | Format code with Prettier             |
| `pnpm codegen`       | Generate GraphQL types                |

## Project Structure

```
lole/
├── src/
│   ├── app/                # Next.js App Router pages and layouts
│   ├── features/           # Feature-slice organized modules
│   │   ├── merchant/       # Merchant profile & settings
│   │   ├── orders/         # Order management
│   │   ├── menu/           # Menu management
│   │   ├── kds/            # Kitchen Display System
│   │   └── ...             # Additional features
│   ├── shared/             # Cross-cutting concerns
│   │   ├── components/     # Reusable components
│   │   ├── hooks/          # Generic hooks
│   │   ├── lib/            # Shared utilities
│   │   └── types/          # Shared types
│   ├── components/         # Legacy/shared components
│   ├── lib/                # Core libraries and utilities
│   │   ├── graphql/        # GraphQL schema and resolvers
│   │   ├── supabase/       # Supabase client and types
│   │   └── utils/          # Helper functions
│   ├── hooks/              # Custom React hooks
│   ├── store/              # State management (Zustand)
│   └── styles/             # Global styles and Tailwind config
├── docs/                   # Project documentation
│   └── architecture/       # Architecture decision records
├── graphql/                # GraphQL federation subgraphs
├── tests/                  # Test files (unit, e2e, load)
├── public/                 # Static assets
└── config/                 # Grafana dashboards, configuration
```

## Feature Structure

Each feature in `src/features/[feature]/` is self-contained:

```
features/orders/
├── components/      # Order-specific UI components
├── hooks/           # Order-related hooks (useOrders, useOrderStatus)
├── lib/             # Order business logic and utilities
├── types/           # Order TypeScript types
└── index.ts         # Public API exports
```

See [ADR-001: Feature-Slice Architecture](docs/architecture/adr-001-feature-slice-architecture.md) for details.

## Documentation

The `docs/` folder contains comprehensive project documentation:

- **[Architecture](docs/01-foundation/architecture.md)** - System architecture and design decisions
- **[Product Roadmap](docs/03-product/roadmap.md)** - Feature roadmap and planning
- **[GraphQL Federation](docs/10-reference/graphql-federation-architecture.md)** - API federation design
- **[Database Schema](docs/01-foundation/database-schema.md)** - Database structure and ERD
- **[Operations](docs/04-operations/)** - Runbooks, monitoring, and procedures
- **[Security](docs/02-security/)** - Security policies and compliance
- **[Integration Guides](docs/06-integrations/)** - Third-party integrations

## Features

- **Multi-channel Ordering** - POS, KDS, mobile, web, and delivery integrations
- **Offline-First** - PowerSync for offline operation with CRDT conflict resolution
- **Real-time Updates** - GraphQL subscriptions via MQTT/WebSocket
- **Ethiopian Compliance** - ERCA e-invoicing and tax reporting support
- **Payment Gateways** - Chapa, Telebirr, and delivery partner integrations

## License

Private - lole Restaurant Operating System
