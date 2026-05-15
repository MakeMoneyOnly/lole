# lole — Security Policy & Threat Model

**Version 1.0 · March 2026 · Confidential**

---

## Purpose

This document defines lole's security posture, maps every attack surface across the platform, and specifies the controls in place or required for each threat. It serves three audiences:

1. **The engineering team** — what to implement and why
2. **Enterprise restaurant clients** — evidence that their data and revenue are protected
3. **Investors / auditors** — proof that security is built in, not bolted on

---

## Security Principles

| Principle                 | Implementation                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| **Defense in depth**      | 6 independent security layers — breach one, the others hold                                    |
| **Least privilege**       | Every role (staff, guest, partner, admin) gets only what they need                             |
| **Zero trust**            | Every request is authenticated. Internal requests are not implicitly trusted.                  |
| **Fail closed**           | On signature verification failure, return 401 and stop. Never proceed on ambiguity.            |
| **Server-side authority** | All payment logic, pricing, and status transitions live on the server. Clients are untrusted.  |
| **Audit by default**      | Every mutation has a `created_by` or `staff_id` trail. Nothing is anonymous inside the system. |

---

## Attack Surface Map

### Surface 1: Guest QR Code

**What it protects:** Table access, order attribution, preventing guests from accessing other restaurants' menus.

| Threat                 | Risk                                                                 | Control                                                                                             | Status  |
| ---------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------- |
| QR code forgery        | Guest crafts URL for a table they don't have access to               | HMAC-SHA256 signature with `lole_QR_HMAC_SECRET` — server rejects any URL whose `sig` doesn't match | ✅ Live |
| QR code replay         | Guest reuses an old QR code from a previous visit                    | 24-hour expiry embedded in `exp` parameter and verified server-side                                 | ✅ Live |
| Timing attack on HMAC  | Attacker probes response times to guess the HMAC secret byte-by-byte | `crypto.timingSafeEqual()` — constant-time comparison regardless of where strings diverge           | ✅ Live |
| Table enumeration      | Attacker enumerates all table IDs for a restaurant                   | HMAC signature covers `{slug}:{tableNumber}:{exp}` — table number alone is not sufficient           | ✅ Live |
| QR interception (MITM) | Attacker intercepts QR URL on open WiFi                              | HTTPS enforced everywhere. Cloudflare terminates TLS. No HTTP.                                      | ✅ Live |
| Bulk QR brute force    | Attacker tries to forge valid QR codes exhaustively                  | `lole_QR_HMAC_SECRET` is 256-bit random — computationally infeasible to brute force                 | ✅ Live |

**Secret rotation procedure:**

```
If lole_QR_HMAC_SECRET is compromised:
1. Generate new 32-byte random secret:  openssl rand -hex 32
2. Update Vercel env var immediately
3. Deploy:  vercel --prod  (takes ~60 seconds)
4. All existing QR codes become invalid immediately
5. Regenerate QR codes for all tables:  /merchant/tables → Regenerate All
6. Document the incident with timestamp and affected restaurant IDs
```

---

### Surface 2: Payment Webhooks

**What it protects:** Payment confirmation integrity — prevents fraudulent order confirmation without real payment.

| Threat                     | Risk                                                                     | Control                                                                                      | Status       |
| -------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------ |
| Fake webhook injection     | Attacker sends forged "payment success" to confirm orders without paying | HMAC-SHA256 verification on every webhook. Invalid sig → 401, log, stop. No exceptions.      | Sprint 1     |
| Webhook timing attack      | Attacker probes response time to guess webhook secret                    | `crypto.timingSafeEqual()` used for all webhook HMAC comparison                              | Sprint 1     |
| Webhook replay             | Attacker captures and resends a legitimate webhook                       | `idempotency_key UNIQUE` on payments — duplicate `provider_transaction_id` rejected silently | Sprint 1     |
| Double payment via retry   | Provider retries webhook → two payments recorded                         | `idempotency_key TEXT UNIQUE NOT NULL` — second insert fails at DB constraint level          | ✅ DB schema |
| Webhook body manipulation  | Attacker modifies amount in body                                         | HMAC covers raw body bytes — any modification invalidates signature                          | Sprint 1     |
| Internal endpoint spoofing | Attacker calls `/api/webhooks/chapa` directly                            | HMAC secret is only in Vercel env and Chapa dashboard — not in client code, not in Git       | Sprint 1     |

**Critical implementation rule:**

```typescript
// CORRECT — raw body must be read BEFORE parsing
export async function POST(req: Request) {
  const raw = await req.text();                    // read raw bytes first
  const sig = req.headers.get('Chapa-Signature');
  if (!verifyHMAC(raw, sig, secret)) return new Response(null, { status: 401 });
  const payload = JSON.parse(raw);                 // safe to parse now
}

// WRONG — raw body consumed by json(), HMAC will always fail
export async function POST(req: Request) {
  const payload = await req.json();  // ← raw body is gone after this
  verifyHMAC(???, sig, secret);      // nothing to verify against
}
```

---

### Surface 3: Staff Authentication

**What it protects:** Dashboard, POS, KDS — all restaurant management surfaces.

| Threat                       | Risk                                                  | Control                                                                                            | Status       |
| ---------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------ |
| Credential stuffing          | Attacker uses leaked email/password lists             | Supabase Auth built-in rate limiting + lockout. Cloudflare WAF adds IP-level blocking.             | ✅           |
| Session hijacking            | Attacker steals session cookie                        | `@supabase/ssr` uses `httpOnly` + `Secure` + `SameSite=Lax` cookies — inaccessible to JavaScript   | ✅           |
| JWT tampering                | Attacker modifies JWT claims to escalate privileges   | JWT is RS256 signed by Supabase — verified against JWKS endpoint on every request                  | ✅           |
| Stale JWT after deactivation | Staff member is deactivated but their JWT still works | Role resolved from `restaurant_staff` table on every request — not from JWT claim                  | ✅ By design |
| PIN brute force on POS       | Attacker cycles 0000–9999 against POS                 | Rate limit on `/api/staff/verify-pin`: 5 attempts per 10 min per `restaurant_id`                   | Sprint 1     |
| Cross-restaurant access      | Manager at Restaurant A accesses Restaurant B's data  | RLS filters by `restaurant_id` derived from `restaurant_staff.user_id` — JWT claim cannot override | ✅ DB RLS    |
| Privilege escalation         | Waiter calls a manager-only mutation                  | Role checked in resolver from `restaurant_staff.role` — never from client-supplied input           | ✅           |

**RLS as the final layer:**

```sql
-- Even if every layer above fails, this catches it
CREATE POLICY "staff_restaurant_isolation" ON orders
  FOR ALL TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM restaurant_staff
      WHERE user_id = auth.uid()
        AND is_active = true  -- deactivated staff cannot access anything
    )
  );
-- auth.uid() is cryptographically verified by Supabase
-- It cannot be spoofed from the application layer
```

---

### Surface 4: Guest Ordering & Privacy

**What it protects:** Guest privacy, order attribution, cross-table data isolation.

| Threat                      | Risk                                                                 | Control                                                                                               | Status    |
| --------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------- |
| Order spoofing via tracker  | Guest modifies order ID in tracker URL to view another table's order | Tracker URL is HMAC-signed — same pattern as QR code                                                  | ✅ Live   |
| Guest data enumeration      | Attacker iterates guest IDs to scrape all profiles                   | RLS: guests can only see their own profile. Staff see only guests for their restaurant.               | ✅ DB RLS |
| Session fixation            | Attacker pre-generates session ID and tricks guest into using it     | Sessions generated server-side on QR validation — client cannot supply session IDs                    | ✅        |
| Cross-table order injection | Guest at Table A places order for Table B                            | `table_id` and `restaurant_id` extracted from server-side HMAC validation, not from client body       | ✅        |
| Anonymous guest tracking    | Guest fingerprinted without consent                                  | `guest_fingerprint` is session-scoped only. Disclosed in privacy policy. Not persisted after session. | ✅        |

---

### Surface 5: GraphQL API

**What it protects:** The entire data model — all restaurant data across all tenants.

| Threat                            | Risk                                                           | Control                                                                                                      | Status           |
| --------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------- |
| Introspection abuse               | Attacker maps schema to find vulnerable fields                 | Introspection disabled in production Apollo Router config                                                    | Sprint 5         |
| Deeply nested query DoS           | `{ order { items { order { items { ... } } } } }` exhausts CPU | `max_depth: 10` enforced by Apollo Router                                                                    | Sprint 5         |
| Batch query abuse                 | 1,000 aliases in one request to bypass rate limits             | `max_aliases: 30`, `max_tokens: 10000` enforced by Apollo Router                                             | Sprint 5         |
| IDOR via GraphQL args             | Client passes another restaurant's ID as a query argument      | Every resolver extracts `restaurant_id` from JWT, not from query args. RLS double-enforces.                  | ✅               |
| Rate limit bypass via IP rotation | Attacker rotates IPs to reset rate limits                      | Rate limiting keyed on `restaurant_id` (from JWT), not IP                                                    | Sprint 5         |
| SQL injection                     | Malicious string in GraphQL arguments                          | Supabase client uses parameterized queries exclusively. String interpolation in SQL is a failed code review. | ✅ By convention |

---

### Surface 6: Payment Data & PCI Scope

**What it protects:** Cardholder data, payment credentials, financial integrity.

| Threat                      | Risk                                                | Control                                                                                                  | Status       |
| --------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------ |
| Payment API key exposure    | `CHAPA_SECRET_KEY` leaked via client bundle or logs | All payment keys in server-side Vercel env only. `NEXT_PUBLIC_` prefix forbidden. Bundle analysis in CI. | ✅           |
| Card data storage           | lole inadvertently stores raw card numbers          | lole never handles raw card data. Chapa tokenize all card data on their side.                            | ✅ By design |
| Payment amount manipulation | Client sends modified amount to payment endpoint    | Payment amount always calculated server-side from `orders.total_price`. Client input rejected.           | ✅           |
| Refund fraud                | Staff member processes unauthorized refunds         | Refunds require `manager` or `admin` role. Every refund logged with `initiated_by` staff ID.             | ✅           |
| Unsourced payment capture   | Payment marked captured without verified webhook    | `status = 'captured'` only set by webhook handler after HMAC verification. No manual override.           | Sprint 1     |

**PCI-DSS Scope note:**
lole is **outside PCI-DSS scope** for card data because lole never transmits, processes, or stores primary account numbers (PAN). All card tokenization occurs inside Chapa's PCI-compliant environments. lole stores only opaque `provider_transaction_id` tokens.

---

### Surface 7: Infrastructure & Network

| Threat                                    | Risk                                                   | Control                                                                               | Status      |
| ----------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- | ----------- |
| DDoS attack                               | Volumetric traffic takes down POS for all restaurants  | Cloudflare absorbs DDoS at edge before reaching Vercel origin                         | ✅ Sprint 7 |
| WAF bypass                                | Malformed requests exploit application vulnerabilities | Cloudflare WAF with OWASP Core Rule Set                                               | Sprint 7    |
| Direct Vercel access bypassing Cloudflare | Attacker finds Vercel origin IP and attacks directly   | Vercel trusted proxies configured to accept traffic from Cloudflare IP ranges only    | Sprint 7    |
| Dependency supply chain attack            | Malicious npm package introduced                       | Dependabot alerts enabled. `npm audit` in CI. No automatic dependency merges to main. | Ongoing     |
| Secret committed to Git                   | Developer accidentally commits API key                 | `gitleaks` pre-commit hook. GitHub secret scanning enabled on repo.                   | Sprint 1    |

**Cloudflare configuration (required before first restaurant goes live):**

```
DNS:           All A/CNAME records proxied (orange cloud — NOT grey)
WAF:           Managed rules → OWASP Core Rule Set → enabled
Bot Fight:     On
HTTPS:         Always Use HTTPS → On
HSTS:          max-age=31536000; includeSubDomains
Min TLS:       1.2
Brotli:        On (compression for Addis 4G users)
Rocket Loader: Off (breaks Next.js hydration)
```

---

### Surface 8: Multi-Tenancy Isolation

The most critical security property. Cross-tenant data leakage destroys the product permanently.

| Threat                      | Risk                                             | Control                                                                                   | Status       |
| --------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------ |
| Application-layer data leak | Bug in resolver returns cross-tenant data        | RLS enforces `restaurant_id` isolation at DB level — application bugs cannot override     | ✅           |
| Shared cache pollution      | Restaurant A's menu served to Restaurant B       | Redis cache keys namespaced as `menu:{restaurant_id}` — never cross-tenant                | ✅ By design |
| Event bus cross-tenant      | Event for Restaurant A processed by Restaurant B | Every event payload includes `restaurant_id`. Consumers always filter by own ID.          | By design    |
| PowerSync cross-tenant sync | POS tablet receives another restaurant's data    | PowerSync schema scoped by `restaurant_id`. Supabase JWT restricts WAL access per tenant. | ✅           |

**The mandatory RLS completeness test — run after every schema change:**

```sql
-- This MUST return 0 rows. Any result is a security bug.
SELECT table_name
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name NOT IN (
    SELECT DISTINCT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  );
```

---

## Security Review Checklist (Pre-Deploy)

```
Authentication & Authorization
[ ] New routes have Next.js middleware authentication applied
[ ] New mutations check role from restaurant_staff table, not JWT claim
[ ] New tables appear in zero rows from the RLS completeness query above
[ ] RLS policies tested with two different restaurant_id values

Data Handling
[ ] No monetary values stored as FLOAT or DECIMAL
[ ] No payment API keys use NEXT_PUBLIC_ prefix
[ ] No raw card data touched, logged, or stored anywhere
[ ] New user-facing entities have name_am (Amharic) column

Input Validation
[ ] GraphQL inputs validated for type and range in resolvers
[ ] No raw string interpolation in SQL queries (use Supabase parameterized client)
[ ] Uploaded files (menu images) validated for MIME type and max size before R2

Webhooks
[ ] New webhook endpoints verify HMAC before any processing
[ ] Webhook handlers publish to event bus and return 200 immediately
[ ] Idempotency key present on all payment and order mutations

Secrets
[ ] .env.example contains only key names, never values
[ ] gitleaks passes: git log --all -- '*.env' returns nothing sensitive
[ ] No NEXT_PUBLIC_ prefix on server-only secrets
[ ] New secrets added to Vercel env + documented in this file's surface map
```

---

## Vulnerability Disclosure

**Contact:** security@lole.app  
**Response SLA:** Acknowledge within 24 hours. Patch P0/P1 within 72 hours.  
**Scope:** All _.lole.app and _.lolemenu.com endpoints  
**Out of scope:** Social engineering, physical device access, third-party services (Supabase, Chapa, Telebirr infrastructure)

---

## Incident Response

| Severity      | Definition                             | Example                                    | Response Time |
| ------------- | -------------------------------------- | ------------------------------------------ | ------------- |
| P0 — Critical | Active exploit or confirmed breach     | Cross-tenant data exposure                 | 15 min        |
| P1 — High     | Exploit path exists, not yet triggered | Webhook HMAC bypass discovered             | 1 hour        |
| P2 — Medium   | Control degraded, no active exploit    | WAF accidentally disabled                  | 4 hours       |
| P3 — Low      | Hardening opportunity                  | Missing rate limit on low-traffic endpoint | Next sprint   |

**P0 Response (first 30 minutes):**

```
1. Isolate   — Rotate compromised secret OR disable affected route via feature flag
2. Assess    — Which restaurants affected? What data? How long was window open?
3. Contain   — Deploy hotfix. Revoke active sessions if account compromise suspected.
4. Notify    — Telegram message to affected restaurant owners within 30 min
5. Document  — Incident report within 24h: root cause, timeline, impact, resolution, prevention
```

---

_lole Security Policy & Threat Model v1.0 · March 2026 · Confidential_
