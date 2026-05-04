# Technical Stack & API Ecosystem

This document serves as the absolute source of truth regarding the Lole Restaurant OS technology stack and third-party integrations. All Lead Agents and Executor Subagents MUST strictly adhere to this stack when planning and writing code. Do not introduce new technologies or APIs without Executive Layer approval.

---

## 1. Core Framework & Runtime

- **Frontend / Fullstack:** Next.js (App Router)
- **Language:** TypeScript
- **State Management:** Zustand (preferred for frontend state)
- **Styling:** CSS Modules / Vanilla CSS (Tailwind allowed only if pre-configured)
- **Deployment:** Vercel

## 2. Database & Authentication

- **Primary Database:** Supabase (PostgreSQL)
    - _Note:_ We use Supavisor for connection pooling (`transaction` mode default, pool size 10).
- **Authentication:** Supabase Auth (JWT)
    - _Strict:_ Client-side uses `sb_publishable_...` keys. Server-side uses `SUPABASE_SECRET_KEY` (service role). Never expose service keys.

## 3. Data Synchronization (Offline-First)

- **Engine:** PowerSync
- **Pattern:** Local SQLite syncing via CRDT conflict resolution for POS/KDS offline durability.
- _Restriction:_ PowerSync replication requires the `DATABASE_DIRECT_URL` (no pooling).

## 4. Federated GraphQL APIs

- **Gateway:** Apollo Router (Hosted on Railway)
- **Schema Management:** Apollo Studio
- _Security:_ GraphQL introspection is disabled by default for security.

## 5. Mobile & Device Native Shell

- **Bridge:** CapacitorJS (Android APK build target `com.lole.device`)
- **Fleet Management (MDM):** Esper (OTA updates, device provisioning)

## 6. Caching, Queues, & Background Jobs

- **Cache & Event Bus:** Upstash Redis
- **Background Jobs / Queues:** Upstash QStash (Used for payment retries, ERCA submissions, loyalty awards)

## 7. Payments & Financial Integration

- **Primary Ethiopian Gateway:** Chapa
- **Mobile Money:** Telebirr
- **Phase 2 Payment Gateways:** CBE Birr, Amole (Dashen Bank)

## 8. Compliance & Government APIs

- **Fiscal Reporting:** MoR Fiscal API (Ministry of Revenue)
- **E-Invoicing:** ERCA e-Invoice API (Requires `.pem` certificate signing)

## 9. Delivery Aggregators (Phase 2)

- **Partners:** BEU, Zmall, Deliver Addis, Esoora, Fidel Delivery
- _Security:_ All delivery webhook incoming requests require HMAC signature verification.

## 10. Observability, Storage & Infrastructure

- **Error Monitoring:** Sentry
- **CDN, WAF, Object Storage:** Cloudflare (R2 Bucket: `lole-storage`)
- **Transactional Email:** Resend
- **SMS Notifications:** Africa's Talking
- **Push Notifications:** Firebase Cloud Messaging (FCM) & VAPID (Web Push)
- **Alerting & EOD Reports:** Telegram Bot API
- **Workflow Automation:** n8n (Webhooks)

---

## API Key Security Law

1. **[PUBLIC]** Keys prefixed with `NEXT_PUBLIC_` (e.g., `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) are safe for client-side JavaScript.
2. **[SECRET]** Any key without the `NEXT_PUBLIC_` prefix (e.g., `SUPABASE_SECRET_KEY`, `CHAPA_SECRET_KEY`, `JWT_SECRET`) MUST NEVER be exposed to the client. They are strictly for server-side execution.
3. **Always Validate:** Use the startup secret validator (`src/lib/security/startup-checks.ts`) to ensure mandatory keys are present before application boot.
