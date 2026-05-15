# lole — Testing Strategy

**Version 1.0 · March 2026**

> At 50 restaurants, a broken deploy affecting payment processing or order creation is a business-threatening event. This document defines what gets tested, how, at what layer, and what must pass before any code reaches production. It is designed for a solo AI-assisted builder — every test must earn its place by preventing a real category of failure.

---

## Testing Philosophy

**Test what breaks restaurants. Skip what doesn't.**

The test suite is not a coverage trophy. It is a safety net with exactly the right holes. A test that takes 10 minutes to write and prevents one payment double-charge is worth 100 tests that check whether a button label is capitalised.

**The four failure categories that testing must prevent:**

| Category          | Example                                        | Test layer that catches it             |
| ----------------- | ---------------------------------------------- | -------------------------------------- |
| Revenue loss      | Payment confirmed twice from duplicate webhook | Unit test on idempotency key logic     |
| Data corruption   | Santim calculation produces floating point     | Unit test on all monetary computations |
| Cross-tenant leak | Restaurant A sees Restaurant B's orders        | Integration test on RLS policies       |
| Silent regression | KDS stops updating after GraphQL schema change | E2E test on critical order flow        |

Everything else is secondary.

---

## Test Architecture

```
Layer 4 — E2E Tests (Playwright)
  Runs against: staging environment
  Frequency: every PR + nightly on main
  Coverage target: all critical user journeys (10 scenarios)
  Runtime target: < 5 minutes

Layer 3 — Integration Tests (Vitest + Supabase local)
  Runs against: local Supabase instance (supabase start)
  Frequency: every PR
  Coverage target: all API routes, RLS policies, database triggers
  Runtime target: < 3 minutes

Layer 2 — Unit Tests (Vitest)
  Runs against: no external dependencies (pure functions only)
  Frequency: every commit (pre-commit hook)
  Coverage target: all business logic functions
  Runtime target: < 30 seconds

Layer 1 — Type Checking (TypeScript)
  Runs against: codebase only
  Frequency: every commit
  Coverage: all TypeScript files
  Runtime target: < 20 seconds
```

---

## Layer 1 — Type Checking

TypeScript is the first line of defence. It catches an entire class of bugs before any test runs.

### Configuration

```json
// tsconfig.json — strict mode, no exceptions
{
    "compilerOptions": {
        "strict": true,
        "noUncheckedIndexedAccess": true,
        "noImplicitReturns": true,
        "exactOptionalPropertyTypes": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true
    }
}
```

### Rules enforced by type system

```typescript
// ENFORCED: monetary values are always integers (santim), never floats
type Santim = number & { readonly _brand: 'Santim' };
// Any function that accepts money must accept Santim, not plain number
// This prevents: price * 0.15 returning a float that gets stored in the DB

// ENFORCED: restaurant_id is always passed explicitly to service functions
// A function that accepts any UUID for restaurant_id is a type error
type RestaurantId = string & { readonly _brand: 'RestaurantId' };

// ENFORCED: GraphQL codegen types are used — never any or unknown in resolvers
// graphql-code-generator regenerates types on every schema change
```

### Running type checks

```bash
# Pre-commit (Husky hook — runs automatically)
npx tsc --noEmit

# CI (GitHub Actions — blocks merge if fails)
npm run type-check
```

---

## Layer 2 — Unit Tests

Unit tests cover pure business logic functions. No database, no HTTP, no external calls.

**The rule for unit tests:** if the function has no side effects and its output depends only on its inputs, it gets a unit test. If it touches a database or makes an HTTP call, it belongs in integration tests.

### Critical unit test suites

#### Suite 1: Monetary Calculations (MANDATORY — no exceptions)

Every single monetary function in the codebase must have unit tests. One floating-point error in a monetary calculation is a financial bug.

```typescript
// src/lib/money/__tests__/money.test.ts
import { describe, it, expect } from 'vitest';
import {
    extractVAT,
    formatETB,
    santimToETB,
    etbToSantim,
    splitBillEvenly,
    splitBillByAmount,
    applyDiscount,
    calculateModifierTotal,
} from '../money';

describe('VAT extraction (tax-inclusive prices)', () => {
    it('extracts 15% VAT from tax-inclusive price', () => {
        const result = extractVAT(11500); // ETB 115.00 inclusive
        expect(result.vatPortionSantim).toBe(1500); // ETB 15.00
        expect(result.netPriceSantim).toBe(10000); // ETB 100.00
        expect(result.vatPortionSantim + result.netPriceSantim).toBe(11500);
    });

    it('rounds to nearest santim, never produces a float', () => {
        const result = extractVAT(10000); // ETB 100.00
        expect(Number.isInteger(result.vatPortionSantim)).toBe(true);
        expect(Number.isInteger(result.netPriceSantim)).toBe(true);
    });

    it('handles small amounts without floating point error', () => {
        const result = extractVAT(115); // ETB 1.15
        expect(result.vatPortionSantim + result.netPriceSantim).toBe(115);
    });
});

describe('ETB formatting', () => {
    it('formats santim as ETB string', () => {
        expect(formatETB(150000)).toBe('1,500.00 ብር');
        expect(formatETB(50)).toBe('0.50 ብር');
        expect(formatETB(0)).toBe('0.00 ብር');
    });

    it('never exposes santim as a decimal to display layer', () => {
        // 4550 santim = ETB 45.50 — NOT ETB 4550.00
        expect(formatETB(4550)).toBe('45.50 ብር');
    });
});

describe('Split bill — even', () => {
    it('splits evenly and covers full total', () => {
        const result = splitBillEvenly(29900, 3); // ETB 299.00 / 3 people
        // 29900 / 3 = 9966.66... → rounds to 9967, 9967, 9966 (or similar)
        expect(result.shares.reduce((s, v) => s + v, 0)).toBe(29900); // must sum to total
        expect(result.shares).toHaveLength(3);
        result.shares.forEach(s => expect(Number.isInteger(s)).toBe(true)); // all integers
    });

    it('handles amounts not divisible by guest count', () => {
        const result = splitBillEvenly(100, 3); // 33.33... per person
        expect(result.shares.reduce((s, v) => s + v, 0)).toBe(100);
        // One person pays 34 santim, two pay 33 santim
    });
});

describe('Discounts', () => {
    it('applies percentage discount correctly', () => {
        const result = applyDiscount(10000, { type: 'percentage', value: 1000 }); // 10% off 100 ETB
        expect(result.discountedTotalSantim).toBe(9000);
        expect(result.discountAmountSantim).toBe(1000);
    });

    it('applies fixed ETB discount correctly', () => {
        const result = applyDiscount(10000, { type: 'fixed_amount', value: 2000 }); // ETB 20 off
        expect(result.discountedTotalSantim).toBe(8000);
    });

    it('never produces negative total from discount larger than order', () => {
        const result = applyDiscount(5000, { type: 'fixed_amount', value: 10000 });
        expect(result.discountedTotalSantim).toBe(0); // floor at zero
        expect(result.discountedTotalSantim).toBeGreaterThanOrEqual(0);
    });
});
```

#### Suite 2: HMAC Security Functions

```typescript
// src/lib/security/__tests__/hmac.test.ts
import { describe, it, expect } from 'vitest';
import { generateQRSignature, validateQRSignature } from '../hmac';

const SECRET = 'test-secret-32-bytes-exactly-here';

describe('QR HMAC signing', () => {
    it('validates a freshly generated signature', () => {
        const { url, sig, exp } = generateQRSignature('cafe-lucia', 'A3', SECRET);
        expect(validateQRSignature('cafe-lucia', 'A3', sig, exp, SECRET)).toBe(true);
    });

    it('rejects expired signatures', () => {
        const expiredExp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
        const sig = generateQRSignature('cafe-lucia', 'A3', SECRET, expiredExp).sig;
        expect(validateQRSignature('cafe-lucia', 'A3', sig, expiredExp, SECRET)).toBe(false);
    });

    it('rejects tampered slug', () => {
        const { sig, exp } = generateQRSignature('cafe-lucia', 'A3', SECRET);
        expect(validateQRSignature('different-cafe', 'A3', sig, exp, SECRET)).toBe(false);
    });

    it('rejects tampered table number', () => {
        const { sig, exp } = generateQRSignature('cafe-lucia', 'A3', SECRET);
        expect(validateQRSignature('cafe-lucia', 'B7', sig, exp, SECRET)).toBe(false);
    });

    it('rejects wrong secret', () => {
        const { sig, exp } = generateQRSignature('cafe-lucia', 'A3', SECRET);
        expect(validateQRSignature('cafe-lucia', 'A3', sig, exp, 'wrong-secret')).toBe(false);
    });
});
```

#### Suite 3: Feature Flag Logic

```typescript
// src/lib/flags/__tests__/feature-flags.test.ts
describe('Feature flag percentage rollout', () => {
    it('deterministically assigns same restaurant to same bucket', () => {
        const id = 'restaurant-uuid-stable';
        const result1 = hashRestaurantId(id) % 100;
        const result2 = hashRestaurantId(id) % 100;
        expect(result1).toBe(result2); // stable — same restaurant always same bucket
    });

    it('distributes restaurants roughly evenly across buckets', () => {
        const ids = Array.from({ length: 1000 }, (_, i) => `restaurant-${i}`);
        const buckets = ids.map(id => hashRestaurantId(id) % 100);
        const inBucket0to10 = buckets.filter(b => b < 10).length;
        expect(inBucket0to10).toBeGreaterThan(80); // roughly 10% of 1000
        expect(inBucket0to10).toBeLessThan(120);
    });
});
```

#### Suite 4: Idempotency Key Generation

```typescript
describe('Idempotency keys', () => {
    it('generates unique keys for different orders', () => {
        const key1 = generateIdempotencyKey('order', 'restaurant-1', Date.now());
        const key2 = generateIdempotencyKey('order', 'restaurant-1', Date.now() + 1);
        expect(key1).not.toBe(key2);
    });

    it('generates deterministic key for same inputs (for retry safety)', () => {
        const ts = 1741305600000;
        const key1 = generateIdempotencyKey('payment', 'order-uuid', ts);
        const key2 = generateIdempotencyKey('payment', 'order-uuid', ts);
        expect(key1).toBe(key2); // same input → same key → safe to retry
    });
});
```

### Running unit tests

```bash
# Pre-commit hook (Husky — runs automatically, blocks commit if failing)
npx vitest run --testPathPattern='__tests__'

# Watch mode during development
npx vitest --watch

# With coverage report
npx vitest run --coverage
```

---

## Layer 3 — Integration Tests

Integration tests verify that the application works correctly with a real database (local Supabase) and real API routes. These tests catch RLS policy bugs, trigger errors, and schema mismatches that pure unit tests cannot.

### Test database setup

```bash
# Start local Supabase (runs Postgres, Auth, Realtime in Docker)
npx supabase start

# Local URLs (set in .env.test):
# SUPABASE_URL=http://localhost:54321
# SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> (printed by supabase start)
```

### Critical integration test suites

#### Suite 5: RLS Multi-Tenancy (MANDATORY — security critical)

```typescript
// src/__tests__/integration/rls.test.ts
import { createClient } from '@supabase/supabase-js';

describe('Row Level Security — multi-tenant isolation', () => {
    let restaurantAClient: any;
    let restaurantBClient: any;
    let restaurantAId: string;
    let restaurantBId: string;

    beforeAll(async () => {
        // Create two test restaurants with separate authenticated sessions
        ({ restaurantAClient, restaurantAId } = await setupTestRestaurant('Restaurant A'));
        ({ restaurantBClient, restaurantBId } = await setupTestRestaurant('Restaurant B'));

        // Create test orders for both restaurants
        await createTestOrder(restaurantAClient, restaurantAId);
        await createTestOrder(restaurantBClient, restaurantBId);
    });

    it('Restaurant A cannot read Restaurant B orders', async () => {
        const { data } = await restaurantAClient
            .from('orders')
            .select('*')
            .eq('restaurant_id', restaurantBId);
        expect(data).toHaveLength(0); // RLS must block this
    });

    it('Restaurant B cannot read Restaurant A menu items', async () => {
        const { data } = await restaurantBClient
            .from('menu_items')
            .select('*')
            .eq('restaurant_id', restaurantAId);
        expect(data).toHaveLength(0);
    });

    it('Restaurant A cannot modify Restaurant B staff', async () => {
        const { error } = await restaurantAClient
            .from('restaurant_staff')
            .update({ role: 'owner' })
            .eq('restaurant_id', restaurantBId);
        expect(error).not.toBeNull(); // must produce an RLS error
    });

    it('Deactivated staff cannot query any data', async () => {
        // Deactivate the staff member mid-session
        await adminClient
            .from('restaurant_staff')
            .update({ is_active: false })
            .eq('user_id', restaurantAStaffUserId);

        const { data } = await restaurantAClient.from('orders').select('*');
        expect(data).toHaveLength(0); // RLS checks is_active = true
    });

    // Run this check after every test suite to confirm no table is missing RLS
    afterAll(async () => {
        const { data: unprotectedTables } = await adminClient.rpc('get_tables_without_rls');
        expect(unprotectedTables).toHaveLength(0); // MUST be zero
    });
});
```

#### Suite 6: Payment Webhook Idempotency

```typescript
// src/__tests__/integration/webhooks.test.ts
describe('Payment webhook idempotency', () => {
    it('processes a valid Chapa webhook exactly once', async () => {
        const payload = buildChapaWebhookPayload(orderId, 'charge.success');
        const sig = signChapaPayload(payload, testChapaSecret);

        // Send the same webhook twice
        const res1 = await POST('/api/webhooks/chapa', payload, sig);
        const res2 = await POST('/api/webhooks/chapa', payload, sig);

        expect(res1.status).toBe(200);
        expect(res2.status).toBe(200); // must return 200 even on duplicate

        // But only one payment record created
        const payments = await db
            .from('payments')
            .select('*')
            .eq('order_id', orderId)
            .eq('status', 'captured');
        expect(payments.data).toHaveLength(1); // exactly one, not two
    });

    it('rejects webhook with invalid HMAC signature', async () => {
        const payload = buildChapaWebhookPayload(orderId, 'charge.success');
        const res = await POST('/api/webhooks/chapa', payload, 'invalid-signature');
        expect(res.status).toBe(401);

        // No payment record created
        const payments = await db
            .from('payments')
            .select('*')
            .eq('order_id', orderId)
            .eq('status', 'captured');
        expect(payments.data).toHaveLength(0);
    });

    it('reads raw body before parsing — HMAC verification uses raw bytes', async () => {
        // This test ensures the common mistake (req.json() before HMAC) is caught
        const payload = '{"event":"charge.success","data":{"tx_ref":"test-123"}}';
        const sig = computeHMAC(payload, testChapaSecret);

        // Payload with extra whitespace — JSON.parse normalises it, raw bytes differ
        const payloadWithWhitespace = '{"event": "charge.success","data": {"tx_ref": "test-123"}}';
        const res = await POST('/api/webhooks/chapa', payloadWithWhitespace, sig);

        // Must be 401 — signature was for original payload, not whitespace version
        // If server uses req.json() first and re-serialises, this would incorrectly pass
        expect(res.status).toBe(401);
    });
});
```

#### Suite 7: Database Triggers

```typescript
// src/__tests__/integration/triggers.test.ts
describe('Database trigger: inventory deduction', () => {
    it('deducts stock when order status changes to confirmed', async () => {
        // Set up: menu item with recipe using 0.5kg of ingredient
        const { itemId, ingredientId } = await setupMenuItemWithRecipe(restaurantId, {
            ingredientQty: 0.5,
            unit: 'kg',
        });
        await db
            .from('inventory_items')
            .update({ current_stock: 10.0 }) // 10kg in stock
            .eq('id', ingredientId);

        // Create and confirm an order with 2 of this item
        const order = await createTestOrder(restaurantId, [{ itemId, quantity: 2 }]);
        await db.from('orders').update({ status: 'confirmed' }).eq('id', order.id);

        // Verify: 2 × 0.5kg = 1.0kg deducted → 9.0kg remaining
        const { data: inv } = await db
            .from('inventory_items')
            .select('current_stock')
            .eq('id', ingredientId)
            .single();
        expect(inv.current_stock).toBe(9.0);
    });
});

describe('Database trigger: reconciliation entry on payment capture', () => {
    it('creates reconciliation entry when payment is captured', async () => {
        const payment = await createTestPayment(orderId, 5000); // 50 ETB
        await db.from('payments').update({ status: 'captured' }).eq('id', payment.id);

        const { data: entries } = await db
            .from('reconciliation_entries')
            .select('*')
            .eq('source_id', payment.id)
            .eq('source_type', 'payment');
        expect(entries).toHaveLength(1);
        expect(entries[0].amount).toBe(5000);
        expect(entries[0].status).toBe('reconciled');
    });
});
```

#### Suite 8: ERCA VAT Calculation

```typescript
// src/__tests__/integration/erca.test.ts
describe('ERCA invoice generation', () => {
    it('correctly extracts VAT from tax-inclusive prices', async () => {
        const order = await createCompletedOrder(restaurantId, [
            { itemId: tibs_id, quantity: 2, unitPrice: 15000 }, // ETB 150 each, tax-inclusive
        ]);
        const payload = await buildERCAPayload(order.id);

        // ETB 150 tax-inclusive:
        // VAT = 150 × 15/115 = 19.565... → rounds to ETB 19.57 → 1957 santim
        // Net = 150 - 19.57 = 130.43 → 13043 santim
        expect(payload.items[0].vat_amount_santim).toBe(1957 * 2); // 2 items
        expect(payload.items[0].unit_price_santim).toBe(13043);
        expect(payload.grand_total_santim).toBe(30000); // 2 × ETB 150 = ETB 300 total
        expect(payload.vat_total_santim + payload.subtotal_santim).toBe(payload.grand_total_santim);
    });

    it('skips ERCA submission for non-VAT-registered restaurants', async () => {
        await db.from('restaurants').update({ vat_number: null }).eq('id', restaurantId);
        const ercaService = new ERCAService();
        await expect(ercaService.submitInvoice(orderId)).resolves.toBeUndefined(); // no throw, no submission
    });
});
```

### Running integration tests

```bash
# Requires: supabase start (local instance running)
npx vitest run --testPathPattern='integration'

# In CI (GitHub Actions spins up Supabase automatically):
# see .github/workflows/ci.yml
```

---

## Layer 4 — End-to-End Tests (Playwright)

E2E tests run the complete user journey in a real browser against the staging environment. They are the most expensive tests to write and maintain, so they cover only the critical paths that would cause immediate revenue loss if broken.

### Critical E2E scenarios (all 10 must pass before any production deploy)

```typescript
// src/__tests__/e2e/critical-flows.spec.ts

// SCENARIO 1: Complete dine-in order flow (the most important test)
test('waiter can take order, send to KDS, and process cash payment', async ({ page }) => {
    await page.goto('/pos/waiter');
    await enterPIN(page, '1234');
    await page.getByText('A3').click(); // open table A3
    await page.getByText('ቁርስ').click(); // breakfast category
    await page.getByText('ፉል').click(); // add Ful item
    await page.getByRole('button', { name: 'ወደ ኩሽናው ላክ' }).click(); // send to kitchen
    await expect(page.getByText('ትዕዛዙ ተላከ')).toBeVisible(); // confirmation

    // Verify KDS received the order
    const kdsPage = await page.context().newPage();
    await kdsPage.goto('/kds/kds');
    await expect(kdsPage.getByText('ፉል')).toBeVisible({ timeout: 3000 }); // appears within 3s

    // Process cash payment
    await page.getByRole('button', { name: 'ሂሳቡን ስጡ' }).click();
    await page.getByRole('button', { name: 'ጥሬ ገንዘብ' }).click();
    await page.getByLabel('Amount').fill('100');
    await page.getByRole('button', { name: 'ክፍያ' }).click();
    await expect(page.getByText('ደረሰኝ አትም')).toBeVisible(); // payment confirmed
});

// SCENARIO 2: Telebirr payment auto-confirmation via webhook
test('Telebirr payment confirms automatically via webhook', async ({ page, request }) => {
    // Create an order and initiate Telebirr payment
    await initiateOrder(page, 'A5', 'ቡና');
    await page.getByRole('button', { name: 'ቴሌብር' }).click();
    await expect(page.getByTestId('telebirr-qr')).toBeVisible();

    // Simulate Telebirr webhook (staging webhook simulator)
    const orderId = await page.getByTestId('order-id').textContent();
    await simulateTelebirrWebhook(request, orderId!, 'success');

    // Order should auto-confirm without any manual action
    await expect(page.getByText('ክፍያ ተረጋግጧል')).toBeVisible({ timeout: 5000 });
});

// SCENARIO 3: QR guest ordering
test('guest can scan QR, order, and track their order', async ({ page }) => {
    const qrUrl = await generateTestQRUrl('test-slug', 'B2');
    await page.goto(qrUrl);
    await expect(page.getByText('Skip to Menu')).toBeVisible();
    await page.getByText('Skip to Menu').click();
    await page.getByText('ምሳ').click();
    await page.getByText('ዶሮ ወጥ').click();
    await page.getByRole('button', { name: 'ትዕዛዝ' }).click();

    // Guest should see tracker
    await expect(page).toHaveURL(/\/tracker/);
    await expect(page.getByText('ትዕዛዙ ተቀበለ')).toBeVisible(); // pending confirmation
});

// SCENARIO 4: Split bill evenly
test('waiter can split bill evenly across 3 guests', async ({ page }) => {
    await createTestOrderOnTable(page, 'C1', 29900); // ETB 299 order
    await page.getByRole('button', { name: 'ሂሳቡን ክፈፍ' }).click();
    await page.getByRole('button', { name: 'በእኩል ክፍፍል' }).click();
    await page.getByLabel('Guests').fill('3');
    const shareTexts = await page.getByTestId('guest-share').allTextContents();
    const shares = shareTexts.map(t => parseFloat(t.replace(/[^0-9.]/g, '')));
    expect(shares.reduce((s, v) => s + v, 0)).toBeCloseTo(299, 1);
});

// SCENARIO 5: KDS station routing
test('kitchen items appear on kitchen KDS, drinks on bar KDS', async ({ page }) => {
    await createOrderWithMixedItems(page, 'A1', ['ዶሮ ወጥ', 'ቢራ']);
    // Kitchen KDS: food item visible
    const kitchenPage = await page.context().newPage();
    await kitchenPage.goto('/kds/kds');
    await expect(kitchenPage.getByText('ዶሮ ወጥ')).toBeVisible({ timeout: 3000 });
    await expect(kitchenPage.getByText('ቢራ')).not.toBeVisible(); // NOT on kitchen

    // Bar KDS: drink visible, food not visible
    const barPage = await page.context().newPage();
    await barPage.goto('/kds/bar');
    await expect(barPage.getByText('ቢራ')).toBeVisible({ timeout: 3000 });
    await expect(barPage.getByText('ዶሮ ወጥ')).not.toBeVisible(); // NOT on bar
});

// SCENARIO 6: Offline POS — order queues and syncs
test('offline order queues and syncs when connection restores', async ({ page, context }) => {
    await context.setOffline(true);
    await page.goto('/pos/waiter'); // loads from PWA cache
    await enterPIN(page, '1234');
    await createOrder(page, 'D4', 'ፈሲሊ');
    await page.getByRole('button', { name: 'ወደ ኩሽናው ላክ' }).click();
    await expect(page.getByText('ትዕዛዙ ተቀምጧል')).toBeVisible(); // queued, not sent

    await context.setOffline(false);
    await expect(page.getByText('ሁሉም ተቀምጧል')).toBeVisible({ timeout: 10000 }); // synced
});

// SCENARIO 7: Amharic UI — all POS surfaces in Amharic by default
test('POS defaults to Amharic locale', async ({ page }) => {
    await page.goto('/pos/waiter');
    // Key UI strings must be in Amharic
    await expect(page.getByText('ፒን ያስገቡ')).toBeVisible(); // Enter PIN
    await expect(page.getByText('ወደ ኩሽናው ላክ')).toBeVisible(); // Send to Kitchen (once in order)
});

// SCENARIO 8: Invalid QR code rejected
test('expired QR code returns error', async ({ page }) => {
    const expiredUrl = generateExpiredQRUrl('test-slug', 'A1'); // exp in the past
    await page.goto(expiredUrl);
    await expect(page.getByText('QR ኮድ ጊዜው አልፏል')).toBeVisible(); // "QR code expired"
    await expect(page).not.toHaveURL(/\/menu/); // must not proceed to menu
});

// SCENARIO 9: Modifier required-field enforcement
test('order cannot be sent without completing required modifier', async ({ page }) => {
    await page.goto('/pos/waiter');
    await enterPIN(page, '1234');
    await page.getByText('A6').click();
    await page.getByText('ስቴክ').click(); // Steak has required "Cooking Level" modifier
    // Do not select cooking level
    await page.getByRole('button', { name: 'ወደ ኩሽናው ላክ' }).click();
    await expect(page.getByText('ማሻሻያ ያስፈልጋል')).toBeVisible(); // "Modifier required"
    // Order was NOT sent
    await expect(page.getByTestId('kds-order-steak')).not.toBeVisible();
});

// SCENARIO 10: Dashboard analytics load correctly
test('owner can view revenue analytics for last 30 days', async ({ page }) => {
    await loginAsOwner(page);
    await page.goto('/merchant/analytics');
    await expect(page.getByTestId('revenue-total')).not.toBeEmpty(); // not blank
    await expect(page.getByTestId('top-items-list')).toBeVisible();
    await expect(page.getByTestId('hourly-heatmap')).toBeVisible();
});
```

### Running E2E tests

```bash
# Against staging environment (set PLAYWRIGHT_BASE_URL)
PLAYWRIGHT_BASE_URL=https://staging.lole.app npx playwright test

# Headed mode for debugging
npx playwright test --headed --slowMo=500

# Single test file
npx playwright test src/__tests__/e2e/critical-flows.spec.ts
```

---

## CI/CD Integration

```yaml
# .github/workflows/ci.yml
name: lole CI

on:
    push:
        branches: [main]
    pull_request:
        branches: [main]

jobs:
    quality:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with: { node-version: '20' }
            - run: npm ci

            # Layer 1: TypeScript
            - name: Type check
              run: npx tsc --noEmit

            # Layer 1: Lint
            - name: ESLint
              run: npx eslint src/ --max-warnings 0

            # Layer 1: Secret scanning
            - name: Gitleaks
              uses: gitleaks/gitleaks-action@v2

    unit-tests:
        runs-on: ubuntu-latest
        needs: quality
        steps:
            - uses: actions/checkout@v4
            - run: npm ci
            - name: Unit tests
              run: npx vitest run --testPathPattern='__tests__/(unit|money|security|flags)'
            - name: Coverage check
              run: npx vitest run --coverage --coverage.thresholds.lines=80

    integration-tests:
        runs-on: ubuntu-latest
        needs: quality
        services:
            supabase:
                image: supabase/supabase-local:latest
                # (Supabase local Docker setup for CI)
        steps:
            - uses: actions/checkout@v4
            - run: npm ci
            - run: npx supabase db push --local
            - name: Integration tests
              run: npx vitest run --testPathPattern='integration'
              env:
                  SUPABASE_URL: http://localhost:54321
                  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.CI_SUPABASE_SERVICE_ROLE_KEY }}

    e2e-tests:
        runs-on: ubuntu-latest
        needs: [unit-tests, integration-tests]
        if: github.ref == 'refs/heads/main' # E2E only on main — not every PR
        steps:
            - uses: actions/checkout@v4
            - run: npm ci
            - run: npx playwright install chromium
            - name: E2E critical flows
              run: npx playwright test
              env:
                  PLAYWRIGHT_BASE_URL: https://staging.lole.app

    deploy:
        runs-on: ubuntu-latest
        needs: [unit-tests, integration-tests]
        if: github.ref == 'refs/heads/main'
        steps:
            - uses: actions/checkout@v4
            - run: npm ci
            - name: Deploy to Vercel
              run: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
            - name: Deploy Apollo Router to Railway
              run: railway up --service apollo-router
              env:
                  RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

---

## Coverage Targets

| Layer                           | Metric                | Target | Enforcement                                   |
| ------------------------------- | --------------------- | ------ | --------------------------------------------- |
| TypeScript                      | Files covered         | 100%   | CI blocks on any type error                   |
| Unit tests — monetary functions | Line coverage         | 100%   | CI fails below 100% for money/ module         |
| Unit tests — security functions | Line coverage         | 100%   | CI fails below 100% for security/ module      |
| Unit tests — overall            | Line coverage         | 80%    | CI warns below 80%                            |
| Integration tests — RLS         | All tables            | 100%   | afterAll check queries for unprotected tables |
| Integration tests — webhooks    | All payment providers | 100%   | Explicit test per provider                    |
| E2E tests — critical flows      | All 10 scenarios      | 100%   | CI blocks deploy if any of 10 fail            |

---

## What We Deliberately Do NOT Test

| Area                                                  | Reason                                                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Amharic text translations                             | Correct Amharic is validated during training session with native speakers — not in test suite |
| UI pixel-perfect visual regression                    | Too brittle for a rapidly evolving UI, too slow to run on every PR                            |
| Third-party provider APIs (Telebirr/Chapa live calls) | Use webhook simulators in tests instead                                                       |
| Load / stress testing                                 | Addressed in Capacity Planning doc — not in per-PR testing                                    |
| Accessibility (a11y)                                  | Phase 3 — after core product is stable                                                        |

---

_lole Testing Strategy v1.0 · March 2026_
