# Threat Model - Lole Restaurant OS

**Document:** STRIDE Threat Analysis  
**Date:** 2026-05-20  
**Project:** Lole Restaurant Operating System  
**Classification:** Internal

---

## 1. System Overview

Lole is a Restaurant Operating System that manages:

- Restaurant operations (orders, kitchen display, table management)
- Staff management and PIN-based authentication
- Payment processing (Telebirr integration)
- Inventory and menu management
- Multi-tenant SaaS architecture

---

## 2. Asset Classification

| Asset                 | Sensitivity | Confidentiality | Integrity | Availability |
| --------------------- | ----------- | --------------- | --------- | ------------ |
| Customer PII          | High        | Critical        | Critical  | Medium       |
| Payment data          | High        | Critical        | Critical  | High         |
| Restaurant financials | High        | Critical        | Critical  | High         |
| Menu/inventory data   | Medium      | High            | High      | High         |
| Staff authentication  | Critical    | Critical        | Critical  | High         |
| Business intelligence | Medium      | High            | High      | Medium       |

---

## 3. STRIDE Threat Analysis

### 3.1 Spoofing

| Threat ID | Description                                          | Affected Component         | Risk   | Mitigation                                                               |
| --------- | ---------------------------------------------------- | -------------------------- | ------ | ------------------------------------------------------------------------ |
| SPO-01    | Attacker impersonates restaurant staff via PIN theft | PIN authentication system  | High   | bcrypt hashing with work factor ≥10, rate limiting, PIN attempts lockout |
| SPO-02    | Attacker creates fake restaurant tenant              | Tenant creation flow       | Medium | Email verification, domain validation, SMS verification                  |
| SPO-03    | Attacker spoofs payment provider webhooks            | Telebirr webhook handler   | High   | HMAC signature verification, webhook secret validation, idempotency      |
| SPO-04    | Session hijacking via stolen tokens                  | Next.js session management | High   | HTTP-only secure cookies, session timeout, CSRF tokens                   |

### 3.2 Tampering

| Threat ID | Description                               | Affected Component  | Risk     | Mitigation                                                  |
| --------- | ----------------------------------------- | ------------------- | -------- | ----------------------------------------------------------- |
| TAM-01    | Order prices modified during cart session | Order creation flow | High     | Server-side price validation, signed cart data              |
| TAM-02    | Menu items modified by unauthorized users | Menu management     | Medium   | RLS policies, role-based access control                     |
| TAM-03    | Payment status tampered in database       | Payment table       | Critical | Write-once ledger pattern, audit trail, transaction logging |
| TAM-04    | KDS display data manipulated              | Realtime updates    | Medium   | Realtime message signing, sequence numbers                  |

### 3.3 Repudiation

| Threat ID | Description                         | Affected Component | Risk   | Mitigation                                                |
| --------- | ----------------------------------- | ------------------ | ------ | --------------------------------------------------------- |
| REP-01    | Staff denies performing actions     | Audit logging      | High   | Immutable audit logs, user context in all operations      |
| REP-02    | Customer denies placing order       | Order execution    | Medium | Digital receipt, email confirmation, signed order records |
| REP-03    | Payment provider claims non-receipt | Webhook handling   | High   | Idempotency keys, local transaction logging               |

### 3.4 Information Disclosure

| Threat ID | Description                          | Affected Component | Risk     | Mitigation                                              |
| --------- | ------------------------------------ | ------------------ | -------- | ------------------------------------------------------- |
| INF-01    | Cross-tenant data exposure via views | Supabase views     | Critical | `security_invoker = on` on all views, RLS policies      |
| INF-02    | PIN enumeration via timing attacks   | PIN verification   | High     | Constant-time comparison, response delay normalization  |
| INF-03    | GraphQL schema introspection         | GraphQL endpoint   | Medium   | Depth limiting, complexity analysis, field whitelisting |
| INF-04    | Session replay exposes PII           | Client storage     | Medium   | Session encryption, minimal data in localStorage        |

### 3.5 Denial of Service

| Threat ID | Description                          | Affected Component   | Risk   | Mitigation                                               |
| --------- | ------------------------------------ | -------------------- | ------ | -------------------------------------------------------- |
| DOS-01    | KDS overload with duplicate messages | Realtime system      | High   | Message deduplication, rate limiting, circuit breaker    |
| DOS-02    | Connection pool exhaustion           | Database connections | High   | PgBouncer pooling, connection limits, retry with backoff |
| DOS-03    | Large menu sync blocks UI            | Sync operations      | Medium | Pagination, incremental sync, background processing      |
| DOS-04    | GraphQL query complexity attack      | GraphQL server       | High   | Query depth limiting, complexity analysis, timeouts      |

### 3.6 Elevation of Privilege

| Threat ID | Description                                   | Affected Component | Risk     | Mitigation                                      |
| --------- | --------------------------------------------- | ------------------ | -------- | ----------------------------------------------- |
| ELE-01    | Staff PIN brute force grants admin access     | Authentication     | High     | Account lockout, bcrypt, MFA consideration      |
| ELE-02    | Tenant admin escalates to super-admin         | Role management    | High     | Role hierarchy enforcement, permission scoping  |
| ELE-03    | User modifies URL to access other restaurants | Tenant isolation   | Critical | Strict `restaurant_id` filtering in all queries |

---

## 4. Attack Surfaces

### 4.1 External Interfaces

| Interface         | Protocol | Authentication | Security Controls                     |
| ----------------- | -------- | -------------- | ------------------------------------- |
| Web Application   | HTTPS    | Session tokens | CSP, HSTS, rate limiting              |
| API (GraphQL)     | HTTPS    | JWT/Bearer     | Query complexity limits, depth limits |
| Telebirr Webhooks | HTTPS    | HMAC signature | Signature verification, idempotency   |
| Supabase Realtime | WSS      | JWT            | Connection filtering by restaurant_id |

### 4.2 Internal Components

| Component       | Trust Boundary   | Security Controls                        |
| --------------- | ---------------- | ---------------------------------------- |
| PIN Service     | Application      | bcrypt, rate limiting, lockout           |
| Payment Service | Payment boundary | PCI-DSS considerations, no card storage  |
| Sync Engine     | Client-server    | Message signing, compression, encryption |
| Notifications   | Messaging        | Rate limiting, template validation       |

---

## 5. Security Controls Mapping

| STRIDE Category | Controls Implemented | Implementation Location        |
| --------------- | -------------------- | ------------------------------ |
| All             | Input validation     | Zod schemas in all resolvers   |
| All             | Error handling       | GraphQL error formatter        |
| All             | Logging              | `src/lib/monitoring/`          |
| Spoofing        | bcrypt               | `src/domains/staff/service.ts` |
| Tampering       | Server validation    | All mutation resolvers         |
| Repudiation     | Audit logs           | Supabase `audit_log` table     |
| Info Disclosure | RLS                  | All tables                     |
| Info Disclosure | security_invoker     | All views                      |
| DoS             | Rate limiting        | Middleware                     |
| Elevation       | Role checking        | `src/domains/staff/`           |

---

## 6. Residual Risks

| Risk ID | Description                                               | Likelihood | Impact   | Mitigation Status          |
| ------- | --------------------------------------------------------- | ---------- | -------- | -------------------------- |
| RES-01  | Advanced persistent threat against high-value restaurants | Low        | Critical | Monitoring alerts pending  |
| RES-02  | Insider threat from staff with legitimate access          | Medium     | High     | Audit logging implemented  |
| RES-03  | Supply chain compromise via npm dependencies              | Medium     | High     | Dependabot, lockfiles      |
| RES-04  | Physical access to POS terminals                          | Low        | Medium   | Industry standard controls |

---

## 7. Security Testing Requirements

- [ ] Annual penetration testing
- [ ] Quarterly dependency vulnerability scans
- [ ] Monthly access control reviews
- [ ] Continuous monitoring via Sentry
- [ ] PCI-DSS compliance audit (if storing card data)

---

## 8. References

- OWASP Top 10 2021
- STRIDE Threat Modeling
- Supabase Security Best Practices
- Next.js Security Guidelines
