# Technology Stack

**Version:** 1.0  
**Last Updated:** 2026-05-15  
**Status:** Enterprise Standard

---

## Executive Summary

The lole Restaurant Operating System utilizes a modern, resilient technology stack optimized for unreliable infrastructure conditions. This inventory documents all components, versions, and integration points.

---

## Frontend Stack

### Core Framework

| Component    | Technology   | Version | Purpose              | Notes                   |
| ------------ | ------------ | ------- | -------------------- | ----------------------- |
| Framework    | Next.js      | 15.x    | React meta-framework | App Router architecture |
| React        | React        | 19.x    | UI component library | Concurrent features     |
| TypeScript   | TypeScript   | 5.5+    | Type safety          | Strict mode enabled     |
| Tailwind CSS | Tailwind CSS | 4.x     | Utility-first CSS    | Custom design system    |
| Zustand      | Zustand      | 4.5+    | State management     | Lightweight alternative |

### Build & Bundling

| Component       | Technology | Version    | Purpose                 |
| --------------- | ---------- | ---------- | ----------------------- |
| Bundler         | Turbopack  | Next.js 15 | Fast incremental builds |
| Package Manager | npm/pnpm   | 10.x/9.x   | Dependency management   |
| Linting         | ESLint     | 9.x        | Code quality            |
| Formatting      | Prettier   | 3.x        | Code formatting         |

### PWA & Mobile

| Component      | Technology     | Version | Purpose              |
| -------------- | -------------- | ------- | -------------------- |
| PWA Support    | @vite-pwa/next | Latest  | Offline capability   |
| Native Wrapper | CapacitorJS    | 7.x     | Android tablet shell |
| QR Code        | qrcode.react   | 4.x     | Table ordering links |

---

## Backend Stack

### API Layer

| Component  | Technology         | Version | Purpose                 |
| ---------- | ------------------ | ------- | ----------------------- |
| Primary    | Next.js API Routes | 15.x    | Serverless functions    |
| GraphQL    | Apollo Server      | 4.x     | Federated GraphQL       |
| Router     | Apollo Router      | 2.x     | Rust-based federation   |
| Validation | Zod                | 3.x     | Runtime type validation |

### Database & Storage

| Component    | Technology       | Version | Purpose               |
| ------------ | ---------------- | ------- | --------------------- |
| Primary DB   | PostgreSQL       | 15.x    | Main relational store |
| Platform     | Supabase         | Latest  | BaaS with RLS         |
| Extension    | TimescaleDB      | 2.x     | Time-series analytics |
| Offline Sync | PowerSync        | Latest  | CRDT-based sync       |
| Object Store | Supabase Storage | Latest  | File/document storage |

### Caching & State

| Component | Technology       | Version | Purpose            |
| --------- | ---------------- | ------- | ------------------ |
| Cache     | Upstash Redis    | Latest  | Serverless caching |
| Edge KV   | Cloudflare KV    | Latest  | Edge caching       |
| Queue     | Upstash QStash   | Latest  | Background jobs    |
| Session   | HttpOnly Cookies | -       | Secure sessions    |

---

## Infrastructure & Deployment

### Hosting & Edge

| Component    | Technology   | Version  | Purpose               |
| ------------ | ------------ | -------- | --------------------- |
| Platform     | Vercel       | Latest   | Deployment platform   |
| Edge Network | Vercel Edge  | Global   | Edge functions        |
| Image Opt.   | Vercel/Optim | Built-in | Image optimization    |
| CDN          | Vercel CDN   | Global   | Static asset delivery |

### Monitoring & Observability

| Component   | Technology | Version  | Purpose            |
| ----------- | ---------- | -------- | ------------------ |
| Error Track | Sentry     | Latest   | Error monitoring   |
| Logging     | Axiom      | Latest   | Structured logging |
| Analytics   | PostHog    | Latest   | Product analytics  |
| Uptime      | Vercel     | Built-in | Health checks      |

### CI/CD

| Component | Technology     | Version  | Purpose            |
| --------- | -------------- | -------- | ------------------ |
| Pipeline  | GitHub Actions | Latest   | CI/CD automation   |
| Testing   | Playwright     | 1.x      | End-to-end testing |
| Security  | Dependabot     | Built-in | Dependency updates |

---

## Hardware Integration

### Printing Stack

| Component | Technology          | Purpose                   |
| --------- | ------------------- | ------------------------- |
| Protocol  | ESC/POS             | Receipt printing standard |
| Bluetooth | Capacitor Bluetooth | Wireless printing         |
| USB       | WebUSB              | Direct USB connection     |
| Network   | Raw TCP             | Network printers          |

### Tablet Infrastructure

| Component  | Technology  | Purpose                |
| ---------- | ----------- | ---------------------- |
| OS Target  | Android 8+  | Minimum tablet version |
| Screen     | 10" Tablets | Standard POS/KDS size  |
| Resolution | 1920x1200   | Recommended minimum    |

---

## External Integrations

### Payment Gateways

| Provider | Integration Type | Status     | Notes                  |
| -------- | ---------------- | ---------- | ---------------------- |
| Telebirr | Native API       | Production | Primary payment method |
| Chappa   | Webhook API      | Beta       | Credit card processing |
| CBE      | Banking API      | Planned    | Bank transfer support  |

### Communication

| Service  | Integration | Purpose                |
| -------- | ----------- | ---------------------- |
| Courier  | REST API    | SMS/Push notifications |
| Twilio   | SMS API     | International SMS      |
| Firebase | FCM         | Push notifications     |

---

## Development Toolchain

### Local Development

| Tool          | Purpose            | Configuration       |
| ------------- | ------------------ | ------------------- |
| Docker        | Container services | docker-compose.yml  |
| ngrok         | Tunneling          | Dev webhook testing |
| Prisma Studio | DB GUI             | Data inspection     |

### Testing Stack

| Framework             | Purpose         | Coverage Target |
| --------------------- | --------------- | --------------- |
| Jest                  | Unit tests      | 80%+            |
| React Testing Library | Component tests | 70%+            |
| Playwright            | E2E tests       | Critical paths  |
| Storybook             | Component dev   | Design system   |

---

## Version Compatibility Matrix

| Component A | Component B | Compatible Versions | Notes           |
| ----------- | ----------- | ------------------- | --------------- |
| Next.js     | React       | 15.x ↔ 19.x         | Auto-linked     |
| Next.js     | Node.js     | 15.x ↔ 20.x         | LTS requirement |
| TypeScript  | Node.js     | 5.5+ ↔ 20.x         | Target ES2022   |
| PostgreSQL  | Supabase    | 15.x ↔ Latest       | Native support  |
| PowerSync   | Postgres    | Any ↔ 15.x          | Recommended     |

---

## Upgrade Policy

### Critical Updates

| Component        | Update Frequency | SLA      | Process        |
| ---------------- | ---------------- | -------- | -------------- |
| Security Patches | Immediate        | 24 hours | Auto-update    |
| Major Versions   | Quarterly        | 72 hours | Staged rollout |
| Breaking Changes | As needed        | 1 week   | Feature flag   |

### Deprecation Schedule

| Component   | Deprecated Date | Removal Date | Migration Path    |
| ----------- | --------------- | ------------ | ----------------- |
| Legacy APIs | Q2 2026         | Q4 2026      | GraphQL migration |
| Node 18     | Oct 2025        | Apr 2026     | Node 20 upgrade   |

---

## Performance Baselines

### Build Performance

| Metric      | Target  | Measurement   |
| ----------- | ------- | ------------- |
| Build Time  | < 60s   | CI average    |
| Bundle Size | < 200KB | Initial load  |
| Cold Start  | < 100ms | Edge function |

### Runtime Performance

| Metric         | Target  | Measurement   |
| -------------- | ------- | ------------- |
| API Response   | < 200ms | p95           |
| Database Query | < 50ms  | p95           |
| Sync Latency   | < 5s    | Offline-first |

---

## Resource Requirements

### Development

| Resource | Minimum | Recommended |
| -------- | ------- | ----------- |
| CPU      | 4 cores | 8 cores     |
| RAM      | 8GB     | 16GB        |
| Storage  | 20GB    | 50GB        |

### Production (per restaurant)

| Resource     | Estimate   |
| ------------ | ---------- |
| Storage      | 1GB/month  |
| Bandwidth    | 10GB/month |
| Sync Traffic | 100MB/day  |

---

## Security Posture

### Compliance

| Standard | Status       | Audit Date |
| -------- | ------------ | ---------- |
| ERCA     | In Progress  | Q2 2026    |
| GDPR     | Planned      | Q4 2026    |
| PCI-DSS  | For Payments | Q3 2026    |

### Security Tools

| Tool         | Purpose                | Integration |
| ------------ | ---------------------- | ----------- |
| Snyk         | Vulnerability scanning | CI pipeline |
| Clerk        | Authentication         | Built-in    |
| Supabase RLS | Authorization          | Database    |

---

## Disaster Recovery

### Backup Strategy

| Component | Frequency | Retention | Recovery Time |
| --------- | --------- | --------- | ------------- |
| Database  | Hourly    | 30 days   | < 5 min       |
| Files     | Daily     | 90 days   | < 1 hour      |
| Config    | On change | Forever   | < 1 min       |

### Failover

| Scenario      | Recovery     | RTO    | RPO         |
| ------------- | ------------ | ------ | ----------- |
| Region Outage | Multi-region | 15 min | 5 min       |
| Database Fail | Standby      | 5 min  | 0 min       |
| App Failure   | Rollback     | 5 min  | Event-based |

---

## Cost Optimization

### Current Spend (Estimate)

| Service    | Monthly | Notes          |
| ---------- | ------- | -------------- |
| Vercel Pro | $100    | Team plan      |
| Supabase   | $50     | 10GB database  |
| Upstash    | $20     | Redis + QStash |
| Sentry     | $29     | Team plan      |

### Savings Opportunities

| Area          | Potential Savings | Action            |
| ------------- | ----------------- | ----------------- |
| CDN           | 20%               | Edge caching      |
| Image Opt.    | 50%               | Opt-in lazy load  |
| Build Minutes | 30%               | Turbopack caching |

---

## Migration Roadmap

### Phase 1 (2026)

- [x] Next.js 15 migration complete
- [x] TypeScript 5.5 adoption
- [ ] Tailwind 4 stable rollout

### Phase 2 (2027)

- [ ] Apollo Federation 2 upgrade
- [ ] Supabase Postgres 16
- [ ] Node 22 LTS adoption

---

## Related Documentation

- [Architecture Decisions](./decisions/)
- [Deployment Guide](../how-to/deploy-to-staging.md)
- [Local Setup](../tutorials/01-local-setup.md)
