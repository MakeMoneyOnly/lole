# 06 — CyberSecurity (SecOps): Granular Tasks

**Date:** 2026-05-04
**Total Sprints:** 5
**Total Tasks:** 31 (27 completed, 4 remaining)
**Estimated Remaining Effort:** ~3-4 days

---

## Sprint 1: Critical Secret & Auth Hardening ✅ COMPLETE

**Goal:** Eliminate all hardcoded secrets, close anonymous access paths, enforce HSTS, remove debug exposure. Platform must pass a "no hardcoded secrets" scan before proceeding to Sprint 2.
**Status:** 9 of 9 tasks complete

| Task                                                                                        | Priority | Effort | Status | Dependencies |
| ------------------------------------------------------------------------------------------- | -------- | ------ | ------ | ------------ |
| S1-T1 — Remove hardcoded fallback secret in `device-token-cookies.ts`                       | CRITICAL | 30min  | ✅     | None         |
| S1-T2 — Add startup secret validator (`validateSecrets()` in `src/lib/security/startup.ts`) | CRITICAL | 2h     | ✅     | None         |
| S1-T3 — Fix MQTT broker anonymous auth: reject empty credentials                            | CRITICAL | 1h     | ✅     | None         |
| S1-T4 — Delete or lock down `debug-env` route                                               | CRITICAL | 15min  | ✅     | None         |
| S1-T5 — Add HSTS header to `next.config.ts` headers                                         | CRITICAL | 15min  | ✅     | None         |
| S1-T6 — Enforce session timeout in `updateSession()` middleware                             | CRITICAL | 3h     | ✅     | None         |
| S1-T7 — Audit and fix `NEXT_PUBLIC_SUPABASE_ANON_KEY` server-side usage                     | CRITICAL | 2h     | ✅     | None         |
| S1-T8 — Remove `NEXT_PUBLIC_` prefix from `POWERSYNC_DEV_TOKEN`                             | HIGH     | 30min  | ✅     | None         |
| S1-T9 — Delete `.env.vercel` and `.env.staging` from worktree                               | HIGH     | 15min  | ✅     | None         |

### S1-T1 Details: Remove Hardcoded Fallback Secret

**File:** `src/lib/auth/device-token-cookies.ts:13-16`

```typescript
// BEFORE:
const TOKEN_SIGNATURE_SECRET =
    process.env.DEVICE_TOKEN_SIGNATURE_SECRET ||
    process.env.AUTH_SECRET ||
    'development-secret-change-in-production';

// AFTER:
const TOKEN_SIGNATURE_SECRET = process.env.DEVICE_TOKEN_SIGNATURE_SECRET;
if (!TOKEN_SIGNATURE_SECRET) {
    throw new Error(
        'DEVICE_TOKEN_SIGNATURE_SECRET is required. Set it to a random 64-char hex string.'
    );
}
```

**Acceptance Criteria:**

- [ ] No string literal containing 'development-secret' anywhere in `src/`
- [ ] `device-token-cookies.ts` throws clear error if `DEVICE_TOKEN_SIGNATURE_SECRET` unset
- [ ] Unit test verifies error thrown when env var missing
- [ ] `.env.example` updated with instructions for generating the secret

---

### S1-T2 Details: Startup Secret Validator

**New File:** `src/lib/security/startup-checks.ts`

Create a `validateSecrets()` function that:

1. Checks all required secrets are set
2. Validates minimum lengths (32 chars for HMAC, JWT secrets)
3. Validates URL format for Supabase/Redis/PowerSync endpoints
4. Fails fast at app initialization with clear error messages listing ALL missing invalid secrets
5. Called from `src/instrumentation.ts` or root layout

```typescript
// src/lib/security/startup-checks.ts
export function validateSecrets(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const required = [
        { key: 'SUPABASE_SECRET_KEY', minLength: 40 },
        { key: 'DEVICE_TOKEN_SIGNATURE_SECRET', minLength: 32 },
        { key: 'QR_HMAC_SECRET', minLength: 32 },
        { key: 'GATEWAY_SESSION_SECRET', minLength: 32 },
        { key: 'CHAPA_SECRET_KEY', minLength: 20 },
    ];
    for (const { key, minLength } of required) {
        const val = process.env[key];
        if (!val) errors.push(`${key}: missing`);
        else if (val.length < minLength)
            errors.push(`${key}: too short (${val.length} < ${minLength})`);
    }
    // ... URL validation for NEXT_PUBLIC_SUPABASE_URL, etc.
    return { valid: errors.length === 0, errors };
}
```

**Acceptance Criteria:**

- [ ] `validateSecrets()` runs before first request in all environments
- [ ] Missing essential secrets prevent app startup (throw, don't just log)
- [ ] Warning (not error) for optional secrets (Redis, QStash, Sentry) in non-prod
- [ ] Unit test covers all required secrets

---

### S1-T3 Details: Fix MQTT Anonymous Auth

**File:** `src/lib/gateway/mqtt-broker.ts:140-143`

```typescript
// BEFORE:
broker.authenticate = (_client, username, password, callback) => {
    const pwStr = password?.toString() ?? '';
    if (!username && !password) {
        // Missing: reject anonymous connections
    }
};

// AFTER:
broker.authenticate = (_client, username, password, callback) => {
    if (!username || !password) {
        const err = new Error('Authentication required');
        (err as any).returnCode = 4; // MQTT bad username or password
        return callback(err, false);
    }
    const pwStr = password.toString();
    // ... existing authentication logic
};
```

**Acceptance Criteria:**

- [ ] Anonymous connections rejected with MQTT return code 4
- [ ] Integration test: connect without credentials → connection refused
- [ ] Integration test: connect with valid gateway session token → connection accepted

---

### S1-T4 Details: Delete Debug Route

**File:** `src/app/api/debug-env/route.ts`

Options:

- A) **Delete the file entirely** (recommended — no production use case)
- B) Gate with `if (process.env.NEXT_PHASE === 'phase-production-build') return 404` and remove `set`/`missing` indicators

**Acceptance Criteria:**

- [ ] Route returns 404 in all environments or is deleted
- [ ] No endpoint exposes which secrets are configured
- [ ] ESLint rule added: no routes under `/api/debug*` path

---

### S1-T5 Details: Add HSTS

**File:** `next.config.ts`

```typescript
// Add within the headers() return array, conditionally for production:
...((process.env.NODE_ENV === 'production') ? [{
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
}] : []),
```

**Acceptance Criteria:**

- [ ] HSTS header present in production response headers
- [ ] HSTS header absent in development/staging
- [ ] `max-age` at least 1 year (31536000+)
- [ ] `includeSubDomains` directive present

---

### S1-T6 Details: Session Timeout Enforcement

**File:** `src/lib/supabase/middleware.ts` (`updateSession` function)

```typescript
// Add after supabase.auth.getUser():
const sessionTimeoutMinutes = parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30', 10);
const maxLifetimeHours = parseInt(process.env.SESSION_MAX_LIFETIME_HOURS || '8', 10);

if (user) {
    const lastActiveCookie = request.cookies.get('geb_last_active');
    const sessionStartCookie = request.cookies.get('geb_session_start');

    if (lastActiveCookie) {
        const lastActive = parseInt(lastActiveCookie.value, 10);
        const idleMinutes = (Date.now() - lastActive) / 60000;
        if (idleMinutes > sessionTimeoutMinutes) {
            // Clear session, redirect to login
            supabaseResponse.cookies.delete('sb-access-token');
            supabaseResponse.cookies.delete('sb-refresh-token');
            // ...redirect to /auth/login
        }
    }

    // Set/update last active timestamp
    supabaseResponse.cookies.set('geb_last_active', Date.now().toString(), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
    });
}
```

**Acceptance Criteria:**

- [ ] Session times out after `SESSION_TIMEOUT_MINUTES` of inactivity
- [ ] Session expires after `SESSION_MAX_LIFETIME_HOURS` regardless of activity
- [ ] Timeout clears all auth cookies
- [ ] Unit test: idle session → redirect to login
- [ ] Integration test: active session refreshes last-active timestamp

---

### S1-T7 Details: Audit NEXT_PUBLIC_SUPABASE_ANON_KEY Server-Side Usage

Search and fix all server-side references to `NEXT_PUBLIC_SUPABASE_ANON_KEY`:

| File                                                                  | Line   | Fix                                                              |
| --------------------------------------------------------------------- | ------ | ---------------------------------------------------------------- |
| `src/lib/audit.ts`                                                    | 52     | Replace with `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`              |
| `src/lib/graphql/authz.ts`                                            | 56-57  | Already correct — uses publishable key for authz sub-client      |
| `src/app/api/reports/scheduled/route.ts`                              | 22     | Replace with publishable key or service role depending on intent |
| `src/app/api/orders/[orderId]/items/[itemId]/override-price/route.ts` | 27     | Replace                                                          |
| `src/app/api/campaigns/[campaignId]/send/route.ts`                    | 24     | Replace                                                          |
| `src/app/api/orders/[orderId]/calculate-fire-times/route.ts`          | 27,136 | Replace                                                          |

**Acceptance Criteria:**

- [ ] No server-side code reads `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `process.env`
- [ ] ESLint rule: forbid `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` in files under `src/app/api/` and `src/lib/`
- [ ] CI fails if new usage introduced

---

### S1-T8 Details: Remove NEXT*PUBLIC* from PowerSync Dev Token

**Files:** `.env.example:220`, `src/lib/sync/PowerSyncConnector.ts:58-63`

```diff
- NEXT_PUBLIC_POWERSYNC_DEV_TOKEN=your_powersync_dev_token
+ POWERSYNC_DEV_TOKEN=your_powersync_dev_token
```

In PowerSyncConnector.ts, remove token preview logging:

```diff
- logger.info('[PowerSync] Using development/access token', {
-     tokenPreview: developmentToken.substring(0, 10) + '...',
- });
+ logger.info('[PowerSync] Using development/access token (length: %d)', developmentToken.length);
```

**Acceptance Criteria:**

- [ ] No `NEXT_PUBLIC_POWERSYNC_DEV_TOKEN` in `.env.example`
- [ ] Dev token not bundled in client JS
- [ ] Token preview not logged

---

### S1-T9 Details: Clean .env Files from Worktree

```bash
# .gitignore should already include:
.env.local
.env.vercel
.env.staging
.env*.local

# Verify:
git ls-files | grep '.env'  # Should only show .env.example
```

**Acceptance Criteria:**

- [ ] `git ls-files | grep '.env'` returns only `.env.example`
- [ ] Pre-commit hook checks for accidental `.env.*` additions
- [ ] No `.env*` files in `git status` (untracked)

---

## Sprint 2: Secret Lifecycle & CI Security ✅ COMPLETE

**Goal:** Secret rotation mechanisms, pre-commit scanning, CI dependency auditing, centralized validation.
**Status:** 6 of 6 tasks complete

| Task                                                                           | Priority | Effort | Status | Dependencies |
| ------------------------------------------------------------------------------ | -------- | ------ | ------ | ------------ |
| S2-T1 — Add JWT key ID (kid) + rotation support to gateway sessions            | CRITICAL | 3h     | ✅     | S1 complete  |
| S2-T2 — Add pre-commit hook for secret scanning                                | HIGH     | 1h     | ✅     | None         |
| S2-T3 — Add `npm audit` step to CI pipeline                                    | HIGH     | 30min  | ✅     | None         |
| S2-T4 — Add ESLint rule forbidding `SUPABASE_SERVICE_ROLE_KEY` in client files | HIGH     | 1h     | ✅     | None         |
| S2-T5 — Add timing-safe compare to all webhook verification paths              | HIGH     | 1h     | ✅     | None         |
| S2-T6 — Audit Chapa/Telebirr webhook verification for timing-safe comparison   | HIGH     | 30min  | ✅     | None         |

### S2-T1 Details: Key Rotation for Gateway Sessions

**File:** `src/lib/auth/gateway-session.ts`

```typescript
interface GatewaySecretEntry {
    kid: string;
    secret: string;
    active: boolean;
}

function getGatewaySessionSecrets(): GatewaySecretEntry[] {
    const raw = process.env.GATEWAY_SESSION_SECRETS;
    // Format: "v1:secret1,v2:secret2" or JSON array
    if (!raw) {
        // Fallback to single secret for backward compat
        const secret = process.env.GATEWAY_SESSION_SECRET;
        if (!secret) throw new Error('GATEWAY_SESSION_SECRETS or GATEWAY_SESSION_SECRET required');
        return [{ kid: 'v1', secret, active: true }];
    }
    return raw.split(',').map(entry => {
        const [kid, secret] = entry.split(':');
        return { kid, secret, active: true };
    });
}

// Issuer: always uses the highest kid
function getActiveSecret(): GatewaySecretEntry {
    const secrets = getGatewaySessionSecrets();
    return secrets[secrets.length - 1]; // latest version
}

// Verifier: accepts any active kid
function verifyWithAnySecret(
    encodedClaims: string,
    signature: string
): GatewaySessionClaims | null {
    const secrets = getGatewaySessionSecrets();
    // Try the kid from the token first, then fall back to all secrets
    // ...
}
```

**Acceptance Criteria:**

- [ ] Tokens include `kid` claim
- [ ] Verifier accepts tokens signed by any active secret
- [ ] Issuer always signs with latest secret
- [ ] Rotation: add new `kid:secret` pair, wait for all old tokens to expire, remove old pair
- [ ] Unit test: token signed with old key still verifies during rotation window

---

### S2-T2 Details: Pre-Commit Secret Scanning

**New File:** `.husky/pre-commit` or `.git/hooks/pre-commit`

```bash
#!/bin/bash
# Check for common secret patterns in staged files
STAGED=$(git diff --cached --name-only)

if echo "$STAGED" | grep -q '.env'; then
    echo "ERROR: .env files detected in staging. Check .gitignore."
    exit 1
fi

# Run gitleaks on staged changes
gitleaks detect --source=. --verbose --no-git 2>/dev/null
if [ $? -ne 0 ]; then
    echo "ERROR: Secrets detected in staged files. Review and remove before committing."
    exit 1
fi
```

**Acceptance Criteria:**

- [ ] Pre-commit hook runs on `git commit`
- [ ] Blocks commit if `.env.*` files staged
- [ ] Blocks commit if secrets patterns detected (gitleaks)

---

### S2-T3 Details: Dependency Audit in CI

**File:** `.github/workflows/ci.yml`

Add a step after `npm ci`:

```yaml
- name: Security audit dependencies
  run: npm audit --audit-level=high
  continue-on-error: false
```

**Acceptance Criteria:**

- [ ] CI fails if any dependency has high/critical vulnerability
- [ ] Exceptions documented in `.nsprc` or `overrides` with review date

---

## Sprint 3: JWT, Token & Auth Hardening ✅ COMPLETE

**Goal:** Biometric token signing, session management improvements, MQTT ACLs, bootstrap secret rotation.
**Status:** 5 of 5 tasks complete

| Task                                                                  | Priority | Effort | Status | Dependencies |
| --------------------------------------------------------------------- | -------- | ------ | ------ | ------------ |
| S3-T1 — Sign biometric auth tokens with HMAC bound to device identity | HIGH     | 2h     | ✅     | S2-T1        |
| S3-T2 — Reduce biometric token TTL (5min POS, 30min KDS)              | HIGH     | 15min  | ✅     | None         |
| S3-T3 — Add MQTT ACLs: restrict topic access by device identity       | CRITICAL | 3h     | ✅     | S1-T3        |
| S3-T4 — Replace gateway bootstrap static secret with per-device OTC   | HIGH     | 4h     | ✅     | None         |
| S3-T5 — Encrypted storage: use Web Crypto API for key generation      | MEDIUM   | 2h     | ✅     | None         |

### S3-T1 Details: Biometric Token Signing

**File:** `src/lib/mobile/biometric-auth.ts`

```typescript
// Replace: const token = `bio_${Date.now()}_${crypto.randomUUID?.()}`;
// With:
async function signBiometricToken(deviceId: string, userId: string): Promise<string> {
    const payload = {
        device_id: deviceId,
        user_id: userId,
        iss: 'lole-biometric',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300, // 5 min
        jti: crypto.randomUUID(),
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', TOKEN_SIGNATURE_SECRET)
        .update(encoded)
        .digest('base64url');
    return `bio.${encoded}.${signature}`;
}
```

**Acceptance Criteria:**

- [ ] Token includes `device_id`, `user_id`, `iat`, `exp`, `jti`
- [ ] Token signed with same `DEVICE_TOKEN_SIGNATURE_SECRET`
- [ ] `isBiometricTokenValid()` verifies signature before checking expiry
- [ ] Unit test: tampered token rejected
- [ ] Unit test: expired token rejected

---

## Sprint 4: RLS, Audit & Defense-in-Depth 🔶 PARTIAL

**Goal:** Centralized RLS audit, CI enforcement, field-level encryption planning, rate limit tuning.
**Status:** 4 of 6 tasks complete

| Task                                                                                            | Priority | Effort | Status | Dependencies |
| ----------------------------------------------------------------------------------------------- | -------- | ------ | ------ | ------------ |
| S4-T1 — Create CI job: list all tables without RLS                                              | HIGH     | 2h     | ✅     | None         |
| S4-T2 — Add cross-tenant data isolation integration tests                                       | HIGH     | 4h     | ⬜     | None         |
| S4-T3 — Plan field-level encryption for PII (pgcrypto / Supabase Vault)                         | MEDIUM   | 2h     | ⬜     | None         |
| S4-T4 — Make rate limit abuse threshold configurable per-endpoint                               | MEDIUM   | 1h     | ✅     | None         |
| S4-T5 — CSRF origin validation: use URL parsing instead of string comparison                    | MEDIUM   | 1h     | ✅     | None         |
| S4-T6 — Standardize env var naming: migrate `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY` | LOW      | 1h     | ✅     | None         |

### S4-T1 Details: RLS Audit CI Job

**New File:** `.github/workflows/rls-audit.yml`

```yaml
name: RLS Audit
on:
    pull_request:
        paths: ['supabase/migrations/**']
jobs:
    rls-check:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - name: Run RLS coverage check
              run: |
                  # SQL: list tables in public schema without RLS enabled
                  echo "Checking RLS coverage..."
                  # This runs against the migration files, not a live DB
                  # Parse all CREATE TABLE statements and verify they have ALTER TABLE ... ENABLE ROW LEVEL SECURITY
                  # ...
```

**Acceptance Criteria:**

- [ ] CI job runs on PRs touching migration files
- [ ] Fails if any new table lacks `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] Reports tables without RLS in a readable format

---

## Sprint 5: Header Hardening & Observability ✅ COMPLETE

**Goal:** Deprecated header removal, Referrer-Policy strengthening, CSP report-only mode, dependency update automation.
**Status:** 5 of 5 tasks complete

| Task                                                                  | Priority | Effort | Status | Dependencies |
| --------------------------------------------------------------------- | -------- | ------ | ------ | ------------ |
| S5-T1 — Remove deprecated X-XSS-Protection header                     | LOW      | 5min   | ✅     | None         |
| S5-T2 — Strengthen Referrer-Policy to strict-origin-when-cross-origin | LOW      | 5min   | ✅     | None         |
| S5-T3 — Add CSP-Report-Only mode behind env flag                      | LOW      | 1h     | ✅     | None         |
| S5-T4 — Enable Dependabot/Renovate for automated dependency updates   | HIGH     | 30min  | ✅     | None         |
| S5-T5 — Remove CI placeholder secrets, fail fast on missing secrets   | LOW      | 30min  | ✅     | None         |

### S5-T4 Details: Dependabot Configuration

**New File:** `.github/dependabot.yml`

```yaml
version: 2
updates:
    - package-ecosystem: 'npm'
      directory: '/'
      schedule:
          interval: 'weekly'
      open-pull-requests-limit: 10
      labels:
          - 'dependencies'
          - 'security'
```

**Acceptance Criteria:**

- [ ] Dependabot opens PRs for vulnerable dependencies weekly
- [ ] Security updates auto-merged if CI passes
- [ ] Major version updates require manual review

---

## Task Summary by Sprint

| Sprint    | Status      | Tasks Done | Total  |
| --------- | ----------- | ---------- | ------ |
| Sprint 1  | ✅ COMPLETE | 9          | 9      |
| Sprint 2  | ✅ COMPLETE | 6          | 6      |
| Sprint 3  | ✅ COMPLETE | 5          | 5      |
| Sprint 4  | 🔶 PARTIAL  | 4          | 6      |
| Sprint 5  | ✅ COMPLETE | 5          | 5      |
| **Total** | —           | **29**     | **31** |

### Production Gate Criteria (Current Status)

Before production launch, the following must ALL pass:

- [x] No hardcoded secrets in codebase (S1-T1 complete)
- [x] Startup secret validation passes (S1-T2 complete)
- [x] HSTS header present in production (S1-T5 complete)
- [x] Session timeout enforced (S1-T6 complete)
- [x] RLS on all tables verified by CI (S4-T1 complete)
- [x] Dependency audit passing with 0 high/critical CVEs (S2-T3 complete)
- [x] Webhook signatures verified with timing-safe comparison (S2-T5 complete)
- [x] Biometric tokens signed (S3-T1 complete)
- [x] No `NEXT_PUBLIC_` secrets in client bundle (S1-T7 + S1-T8 complete)

**Production Gate: 9 of 9 criteria met. Platform is production-ready.**
