# Concepts & Explanations

**Understanding the lole platform architecture.**

This section explains the "why" and "how" behind lole's design decisions and core concepts.

---

## Product

- [Product Vision](./product-vision.md) - Core value proposition and target market
- [Product Requirements](./product-requirements.md) - Detailed feature requirements
- [Roadmap](./product/roadmap.md) - Development timeline and priorities
- [Go-to-Market Strategy](./product/go-to-market.md) - Launch and adoption strategy
- [Platform Fee Model](./product/platform-fee-model.md) - Revenue model and pricing
- [Feature Flags](./product/feature-flags.md) - Progressive rollout system
- [Competitive Analysis](./product/competitive-analysis.md) - Market landscape

---

## Architecture

- [System Design](./architecture/system-design.md) - High-level architecture overview
- [Data Flow](./architecture/data-flow.md) - Database schema and data lifecycle
- [GraphQL Federation](./graphql-federation-architecture.md) - API federation design

---

## Engineering

- [Architecture Decisions](./decisions/README.md) - Architecture Decision Records (ADRs)
- [Engineering Runbook](./engineering-runbook.md) - Development practices and standards
- [Local-First Boundary](./local-first-boundary.md) - Offline-first design principles
- [Local Schema](./canonical-local-schema.md) - PowerSync and local state management
- [MQTT LAN Transport](./mqtt-lan-transport.md) - LAN communication protocol
- [WAN Chaos Harness](./wan-chaos-harness.md) - Network resilience testing
- [Split-Brain Scenarios](./split-brain-scenarios.md) - Conflict resolution strategies
- [Kiosk Safe Networking](./kiosk-safe-networking.md) - Secure kiosk deployment

---

## Payments

- [Payments Direction](./payments-direction.md) - Payment flow and integration patterns

---

## Mobile

- [PowerSync Status](./powersync-supabase-dev-status.md) - Offline sync implementation status
- [Capacitor Mobile Summary](./mobile-native-capacitor-executive-summary.md) - Native app strategy

---

## Compliance

- [Fiscal Local Signing](./fiscal-local-signing.md) - Tax and fiscal compliance

---

## Reference

- [Tech Stack](./tech-stack.md) - Technologies and frameworks used
- [Environment Variables](./env-vars.md) - Configuration reference
- [Feature Flags Catalogue](./feature-flags-catalogue.md) - Available feature flags
- [API Specification](./api-spec.yaml) - REST API documentation
- [Database ERD](./database-erd.md) - Entity relationship diagram
- [KDS Printer Webhook Contract](./kds-printer-webhook-contract.md) - Printer integration spec
- [Coding Standards](./coding-standards.md) - Code style guidelines