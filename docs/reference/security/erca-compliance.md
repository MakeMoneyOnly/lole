# lole — ERCA Compliance Guide

**Version 1.0 · March 2026**

> This guide covers two audiences: the **engineering team** (how to implement ERCA integration) and **restaurant operators** (what ERCA means for them and how lole handles it on their behalf).

---

## What Is ERCA?

The **Ethiopian Revenue and Customs Authority (ERCA)** — ኢትዮጵያ ገቢዎች እና ጉምሩክ ባለሥልጣን — is the federal agency responsible for tax collection in Ethiopia. VAT-registered businesses are required to:

1. Issue an electronic invoice (e-invoice) for every taxable transaction
2. Transmit invoice data to ERCA in real-time or near-real-time
3. Maintain records for a minimum of **7 years**
4. Apply the standard VAT rate of **15%** on taxable goods and services

**Most POS systems in Addis Ababa do not handle ERCA.** Restaurant owners with VAT registration currently prepare invoices manually — often at month-end, often inaccurate. This is lole's strongest enterprise sales argument.

---

## Who Needs This

| Restaurant Type                       | VAT Registration Required?            | lole ERCA Feature Needed?                   |
| ------------------------------------- | ------------------------------------- | ------------------------------------------- |
| Small café, <500K ETB/year turnover   | No                                    | No — ERCA feature auto-skipped              |
| Restaurant, 500K–5M ETB/year turnover | Registration optional but recommended | Optional                                    |
| Restaurant, >5M ETB/year turnover     | **Mandatory**                         | Yes — auto-enabled when `vat_number` is set |
| Hotel restaurant, any size            | Mandatory if hotel is VAT-registered  | Yes                                         |
| Chain restaurant (multiple locations) | Mandatory                             | Yes — each location has its own TIN         |

lole detects whether ERCA integration is needed by checking `restaurants.vat_number IS NOT NULL`. If the field is null, no ERCA calls are made for that restaurant.

---

## Part 1: For Restaurant Operators

### What lole Does on Your Behalf

Once you provide your TIN number and VAT registration number in your lole settings, lole will:

1. **Automatically calculate 15% VAT** on every completed order
2. **Generate an ERCA-compliant e-invoice** with your TIN, itemized VAT breakdown, and the correct invoice number format
3. **Submit the invoice to ERCA** automatically when each order is completed — no manual action required
4. **Retry failed submissions** — if ERCA's API is temporarily unavailable, lole retries automatically up to 5 times over 2 hours
5. **Store all submissions** for 7 years (the legally required period) in your finance records
6. **Include a daily VAT summary** in your end-of-day Telegram report

### What You Need to Provide

Go to `/merchant/settings` → Tax & Compliance:

| Field                         | What It Is                              | Where to Find It                   | Example                |
| ----------------------------- | --------------------------------------- | ---------------------------------- | ---------------------- |
| TIN Number                    | Your Taxpayer Identification Number     | Your ERCA registration certificate | `0014-XXXX-XXXXX`      |
| VAT Registration Number       | Your VAT certificate number             | Your VAT registration certificate  | `VAT-XXXX-XXXX`        |
| Legal Business Name           | Your registered business name (English) | Business license                   | `Lucía Restaurant PLC` |
| Legal Business Name (Amharic) | Your registered Amharic name            | Business license                   | `ሉቺያ ምግብ ቤት`           |

### What Your Receipt Shows

Every lole receipt is already ERCA-compliant. It includes:

```
══════════════════════════════
       ሉቺያ ምግብ ቤት
       Lucía Restaurant
       Bole Road, Addis Ababa
══════════════════════════════
ትዕዛዝ / Order: #0042
ጠረጴዛ / Table:  B3
ቀን / Date:    07/03/2026

ዶሮ ወጥ          x2    180.00
ፋሲሊ ሻይ         x2     80.00

ንዑስ ጠቅላላ / Subtotal:  260.00 ብር
VAT (15%):               39.00 ብር
ጠቅላላ / TOTAL:          299.00 ብር

ክፍያ / Payment: Telebirr

TIN: 0014-XXXX-XXXXX
VAT Reg: VAT-XXXX-XXXX
Invoice: 0014XXXX-0042
══════════════════════════════
ስለ ምርጫዎ እናመሰግናለን!
Thank you for your visit!
```

### VAT Calculation on Guest-Facing Prices

**Important:** Ethiopian VAT law requires that VAT is included in the price displayed to customers (tax-inclusive pricing), not added on top. lole handles this correctly:

```
If menu item price = 100 ETB (tax-inclusive):
  VAT portion    = 100 × (15/115) = 13.04 ETB
  Net price      = 100 - 13.04   = 86.96 ETB

If you want to earn 100 ETB net after VAT:
  Display price  = 100 × (115/100) = 115 ETB

lole's receipt shows both the net amount and the VAT portion.
The total displayed to guests already includes VAT.
```

---

## Part 2: Engineering Implementation

### Architecture Overview

```
Order completed (status → 'served')
        │
        ▼
event: order.completed published to Redis Stream
        │
        ▼
QStash job: submitERCAInvoice(orderId)
        │
        ├── restaurant.vat_number IS NULL? → skip, return
        │
        └── restaurant.vat_number EXISTS?
              │
              ▼
              ERCAService.submitInvoice(order)
                    │
                    ├── Build payload (items, VAT, TIN, invoice number)
                    ├── POST to ERCA API
                    ├── On success: record in erca_submissions table
                    └── On failure: throw → QStash retries (5× over 2h)
```

### ERCA Invoice Payload Spec

```typescript
// src/domains/payments/erca-service.ts

interface ERCAInvoicePayload {
    invoice_number: string; // "{restaurant_id_prefix}-{order_number}"
    tin: string; // restaurant.tin_number
    buyer_tin: string | null; // guest.tin_number if B2B
    issue_date: string; // ISO 8601, UTC
    currency: 'ETB';
    items: Array<{
        description: string; // item name in English
        description_am: string; // item name in Amharic
        quantity: number;
        unit_price_santim: number; // price per unit BEFORE VAT, in santim
        vat_rate: 0.15;
        vat_amount_santim: number; // quantity × unit_price × 0.15, in santim
        line_total_santim: number; // quantity × unit_price (before VAT), in santim
    }>;
    subtotal_santim: number; // sum of line totals before VAT
    vat_total_santim: number; // total VAT
    grand_total_santim: number; // subtotal + VAT = order.total_price
}
```

**VAT extraction from tax-inclusive prices (correct formula):**

```typescript
// Prices in lole are tax-INCLUSIVE (as displayed to guest)
// ERCA needs the net price (before VAT) and VAT amount separately

function extractVAT(taxInclusivePriceSantim: number) {
    const vatPortionSantim = Math.round((taxInclusivePriceSantim * 15) / 115);
    const netPriceSantim = taxInclusivePriceSantim - vatPortionSantim;
    return { netPriceSantim, vatPortionSantim };
}

// Example: ETB 115 (11500 santim) tax-inclusive item
// vatPortion = Math.round(11500 × 15 / 115) = 1500 santim (ETB 15.00)
// netPrice   = 11500 - 1500 = 10000 santim (ETB 100.00)
```

### Complete ERCAService Implementation

```typescript
// src/domains/payments/erca-service.ts
import { createClient } from '@supabase/supabase-js';
import { Jobs } from '@/lib/queue/jobs';

export class ERCAService {
    private readonly baseUrl = process.env.ERCA_API_URL!;
    private readonly apiKey = process.env.ERCA_API_KEY!;
    private readonly supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    async submitInvoice(orderId: string): Promise<void> {
        // Fetch order with all needed relations
        const { data: order } = await this.supabase
            .from('orders')
            .select(
                `
        *,
        restaurant:restaurants(tin_number, vat_number, name, name_am),
        items:order_items(
          quantity, unit_price,
          menu_item:menu_items(name, name_am)
        ),
        guest:guests(tin_number)
      `
            )
            .eq('id', orderId)
            .single();

        if (!order) throw new Error(`Order ${orderId} not found`);
        if (!order.restaurant.vat_number) return; // Not VAT-registered — skip

        // Check for duplicate submission (idempotency)
        const { data: existing } = await this.supabase
            .from('erca_submissions')
            .select('id')
            .eq('order_id', orderId)
            .eq('status', 'success')
            .single();

        if (existing) return; // Already submitted successfully

        const payload = this.buildPayload(order);

        try {
            const res = await fetch(`${this.baseUrl}/invoices`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': `lole-${orderId}`, // ERCA-side dedup
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`ERCA API error ${res.status}: ${err}`);
            }

            const result = await res.json();

            // Record successful submission
            await this.supabase.from('erca_submissions').insert({
                order_id: orderId,
                restaurant_id: order.restaurant_id,
                invoice_number: payload.invoice_number,
                vat_amount_santim: payload.vat_total_santim,
                grand_total_santim: payload.grand_total_santim,
                erca_invoice_id: result.invoice_id,
                status: 'success',
                submitted_at: new Date().toISOString(),
            });
        } catch (error) {
            // Record failure for audit trail
            await this.supabase.from('erca_submissions').insert({
                order_id: orderId,
                restaurant_id: order.restaurant_id,
                invoice_number: payload.invoice_number,
                status: 'failed',
                error_message: (error as Error).message,
            });
            throw error; // Re-throw so QStash retries
        }
    }

    private buildPayload(order: any): ERCAInvoicePayload {
        const items = order.items.map((item: any) => {
            const { netPriceSantim, vatPortionSantim } = extractVAT(item.unit_price);
            return {
                description: item.menu_item.name,
                description_am: item.menu_item.name_am ?? item.menu_item.name,
                quantity: item.quantity,
                unit_price_santim: netPriceSantim,
                vat_rate: 0.15 as const,
                vat_amount_santim: vatPortionSantim * item.quantity,
                line_total_santim: netPriceSantim * item.quantity,
            };
        });

        const subtotalSantim = items.reduce((s: number, i: any) => s + i.line_total_santim, 0);
        const vatTotalSantim = items.reduce((s: number, i: any) => s + i.vat_amount_santim, 0);
        const grandTotalSantim = subtotalSantim + vatTotalSantim;

        return {
            invoice_number: `${order.restaurant_id.slice(0, 8)}-${order.order_number}`,
            tin: order.restaurant.tin_number,
            buyer_tin: order.guest?.tin_number ?? null,
            issue_date: new Date().toISOString(),
            currency: 'ETB',
            items,
            subtotal_santim: subtotalSantim,
            vat_total_santim: vatTotalSantim,
            grand_total_santim: grandTotalSantim,
        };
    }
}

function extractVAT(taxInclusiveSantim: number) {
    const vatPortionSantim = Math.round((taxInclusiveSantim * 15) / 115);
    const netPriceSantim = taxInclusiveSantim - vatPortionSantim;
    return { netPriceSantim, vatPortionSantim };
}
```

### ERCA Submissions Table

```sql
CREATE TABLE erca_submissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id         UUID NOT NULL REFERENCES restaurants(id),
  order_id              UUID NOT NULL REFERENCES orders(id),
  invoice_number        TEXT NOT NULL,
  vat_amount_santim     INTEGER,
  grand_total_santim    INTEGER,
  erca_invoice_id       TEXT,           -- ERCA's own reference ID on success
  status                TEXT NOT NULL
    CHECK (status IN ('pending','success','failed','retry')),
  error_message         TEXT,
  submitted_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (order_id)                     -- one submission record per order
);

CREATE INDEX idx_erca_restaurant_date
  ON erca_submissions (restaurant_id, created_at DESC);

CREATE INDEX idx_erca_status
  ON erca_submissions (status) WHERE status IN ('failed','retry');

ALTER TABLE erca_submissions ENABLE ROW LEVEL SECURITY;
```

### QStash Job Handler

```typescript
// src/app/api/jobs/erca-invoice/route.ts
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { ERCAService } from '@/domains/payments/erca-service';

export const POST = verifySignatureAppRouter(async (req: Request) => {
    const { orderId } = await req.json();

    if (!orderId) {
        return Response.json({ error: 'orderId required' }, { status: 400 });
    }

    const ercaService = new ERCAService();
    await ercaService.submitInvoice(orderId);

    return Response.json({ success: true });
});
// QStash retries on any non-2xx response, including thrown errors
// 5 retries with exponential backoff configured in Jobs.submitERCA()
```

### Daily VAT Summary in EOD Report

```typescript
// Included in the nightly EOD report (19:00 UTC = 10PM Addis)
async function generateVATSummary(restaurantId: string, date: string) {
    const { data } = await supabase
        .from('erca_submissions')
        .select('grand_total_santim, vat_amount_santim, status')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'success')
        .gte('submitted_at', `${date}T00:00:00Z`)
        .lt('submitted_at', `${date}T24:00:00Z`);

    const totalRevenueSantim = data?.reduce((s, r) => s + r.grand_total_santim, 0) ?? 0;
    const totalVATSantim = data?.reduce((s, r) => s + r.vat_amount_santim, 0) ?? 0;
    const invoiceCount = data?.length ?? 0;

    return {
        date,
        invoiceCount,
        totalRevenueETB: (totalRevenueSantim / 100).toFixed(2),
        totalVATETB: (totalVATSantim / 100).toFixed(2),
    };
}

// Telegram message format:
// 📊 VAT Summary for 07/03/2026
// Invoices submitted: 47
// Total revenue (incl. VAT): 12,450.00 ብር
// VAT collected: 1,624.35 ብር
// ✅ All invoices submitted to ERCA
```

---

## ERCA Compliance Dashboard (Phase 2)

The `/merchant/finance` screen will include an ERCA compliance tab showing:

- Daily/monthly invoice submission status
- Failed submissions with retry button
- Monthly VAT report download (PDF for accountant)
- Running VAT liability total
- ERCA submission audit log with `erca_invoice_id` references

---

## MoR Fiscal Integration

lole integrates with MoR Fiscal to automate monthly and quarterly revenue reporting to the Ethiopian tax authority. This complements ERCA e-invoicing by aggregating transaction data from `erca_submissions` and `payments` tables into standardized fiscal reports. Reports are generated via QStash CRON jobs and delivered to restaurant operators via Telegram and the finance dashboard.

---

## Failed Submission Handling

```
Submission fails:
  → QStash retries 5× with exponential backoff (5s → 10s → 20s → 40s → 80s)
  → After 5 failures: recorded in erca_submissions.status = 'failed'
  → Telegram alert to owner: "⚠️ ERCA invoice for order #0042 could not be submitted"
  → Owner dashboard shows failed submission count

Manual retry (Phase 2 — dashboard button):
  → Manager clicks "Retry Failed" in /merchant/finance → ERCA tab
  → Triggers new QStash job for each failed submission
  → Re-attempts in correct invoice-number order
```

---

## Testing ERCA Integration

```bash
# ERCA provides a sandbox environment
# Set in .env.local for development:
ERCA_API_URL=https://sandbox.api.erca.gov.et
ERCA_API_KEY=test_key_from_erca_sandbox

# Test a submission manually:
curl -X POST http://localhost:3000/api/jobs/erca-invoice \
  -H "Content-Type: application/json" \
  -d '{"orderId": "your-test-order-id"}'

# Verify submission was recorded:
# SELECT * FROM erca_submissions WHERE order_id = 'your-test-order-id';
```

---

## Frequently Asked Questions (For Restaurant Operators)

**Q: Does every restaurant need to use the ERCA feature?**
A: Only VAT-registered restaurants. If your restaurant is not VAT-registered, this feature is automatically disabled and you will never see ERCA-related settings.

**Q: What if ERCA's system is down when a customer pays?**
A: lole queues the invoice and retries automatically. The customer's payment still goes through and their order is processed normally. The ERCA submission happens in the background.

**Q: What if a submission fails permanently?**
A: You will receive a Telegram alert. You can retry manually from the finance dashboard. You are also legally permitted to submit invoices retroactively when ERCA's system was experiencing downtime — lole stores all order data needed for resubmission.

**Q: Can I see proof that invoices were submitted?**
A: Yes. The `/merchant/finance` screen shows every ERCA submission with the invoice number and ERCA's own reference ID for successful submissions. You can export this as a PDF for your accountant.

**Q: How does lole calculate the VAT amount on my receipts?**
A: Ethiopian VAT is tax-inclusive — the price you display to customers already includes VAT. lole extracts the VAT portion using the formula: VAT = price × 15 ÷ 115. So if an item costs ETB 115, the VAT portion is ETB 15.00 and the net price is ETB 100.00.

**Q: What if I have B2B customers who need a VAT invoice with their TIN?**
A: For regular dine-in guests, this is rare. For corporate accounts (hotel guests, business lunches), the guest can provide their TIN at checkout. The ERCA invoice will include the buyer's TIN. This is configured in the guest profile under "Business Tax Number."

---

_lole ERCA Compliance Guide v1.0 · March 2026_
