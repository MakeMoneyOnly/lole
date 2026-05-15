# lole — Data Privacy & Protection Policy

**Version 1.0 · March 2026**

> This policy covers what data lole collects, why, how it is stored, who can access it, how long it is kept, and the rights of both restaurant operators and their guests. It is written to be readable by a restaurant owner, not just a lawyer.

---

## Legal Framework

lole operates under the following legal instruments relevant to Ethiopia:

| Instrument                                             | Relevance                                                                                                                                                            |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Computer Crime Proclamation No. 958/2016**           | Prohibits unauthorized access to computer systems and data. lole's RLS architecture and webhook HMAC verification directly address these obligations.                |
| **Electronic Transactions Proclamation No. 1072/2018** | Governs electronic payments and digital records. lole's payment audit trail and idempotency records satisfy e-transaction record-keeping requirements.               |
| **ERCA Proclamation No. 983/2016**                     | Requires VAT-registered businesses to maintain transaction records. lole's `reconciliation_entries` and ERCA e-invoice submission satisfy this.                      |
| **NBE Directives on Digital Payments**                 | National Bank of Ethiopia requirements for merchant payment processing via Telebirr, Chapa. lole processes payments through licensed payment service providers only. |
| **International standard (reference)**                 | GDPR principles are used as best-practice reference for data minimization and retention, even though GDPR does not directly apply in Ethiopia.                       |

---

## Data We Collect

### From Restaurant Operators (B2B Data)

| Data                               | Purpose                             | Where Stored                               | Retention                                |
| ---------------------------------- | ----------------------------------- | ------------------------------------------ | ---------------------------------------- |
| Restaurant name (EN + Amharic)     | Display, receipts, QR menu branding | `restaurants` table                        | While account is active + 7 years (ERCA) |
| Restaurant address                 | Receipts, ERCA invoices             | `restaurants` table                        | Same as above                            |
| Owner name + email                 | Authentication, EOD reports         | Supabase Auth + `restaurant_staff`         | While account is active                  |
| Owner Telegram ID                  | EOD report delivery                 | `restaurants.owner_telegram_id`            | While account is active                  |
| TIN number                         | ERCA e-invoice submission           | `restaurants.tin_number`                   | 7 years (ERCA obligation)                |
| VAT number                         | ERCA e-invoice submission           | `restaurants.vat_number`                   | 7 years (ERCA obligation)                |
| Staff names + PINs                 | POS authentication, audit trail     | `restaurant_staff`                         | While employed + 2 years                 |
| Menu items + prices                | Menu display, order processing      | `menu_items`, `categories`                 | While active                             |
| Payment API keys (Chapa, Telebirr) | Payment initiation                  | Vercel server-side env (encrypted at rest) | Until revoked                            |

**What we do NOT collect from restaurant operators:**

- Bank account numbers (payouts handled by Chapa/Telebirr directly)
- Owner's national ID
- Physical copies of any document

---

### From Dine-In Guests (B2C Data)

We collect different data depending on whether the guest is **anonymous** or **authenticated**.

#### Anonymous Guests (used Skip to Menu)

| Data                                       | Purpose                                   | Where Stored               | Retention                   |
| ------------------------------------------ | ----------------------------------------- | -------------------------- | --------------------------- |
| `guest_fingerprint` (device hash)          | Order attribution within a single session | `orders.guest_fingerprint` | 90 days, then anonymized    |
| IP address (Cloudflare log)                | Security, rate limiting                   | Cloudflare (not Supabase)  | 7 days (Cloudflare default) |
| Order contents (items, modifiers, amounts) | Order processing, restaurant analytics    | `orders`, `order_items`    | 2 years                     |
| Payment method (not card details)          | Reconciliation, analytics                 | `payments.method`          | 7 years (ERCA)              |

**What we do NOT collect from anonymous guests:**

- Name, phone, or email
- Any personally identifiable information
- Persistent device identifiers beyond the session

#### Authenticated Guests (created an account)

| Data                             | Purpose                                 | Where Stored                               | Retention              |
| -------------------------------- | --------------------------------------- | ------------------------------------------ | ---------------------- |
| Full name                        | Display, receipts                       | `guests.full_name`                         | Until account deletion |
| Phone number                     | Account recovery, loyalty notifications | `guests.phone`                             | Until account deletion |
| Email                            | Authentication, notifications           | Supabase Auth + `guests.email`             | Until account deletion |
| Order history                    | Loyalty earning, personal analytics     | `orders` linked to `guest_id`              | 2 years                |
| Loyalty points balance + history | Loyalty program                         | `loyalty_accounts`, `loyalty_transactions` | Until account deletion |
| Lifetime spending (ETB)          | Loyalty tier calculation                | `guests.lifetime_value_santim`             | Until account deletion |
| Business TIN (optional)          | B2B VAT invoicing                       | `guests.tin_number`                        | 7 years if provided    |

---

## What We Do NOT Collect (Ever)

- **Raw card numbers (PAN)** — never transmitted through lole infrastructure
- **Telebirr account passwords** — payments initiated via tokenized flows
- **Biometrics** — no fingerprint, face, or voice data
- **Location data** — no GPS tracking of guests or staff
- **Social media data** — no Facebook, Google, or TikTok SDK on any lole surface
- **Advertising identifiers** — no ad tracking, no remarketing pixels
- **Children's data** — no features target users under 18; no COPPA-equivalent compliance required

---

## How Data Is Protected

### At Rest

- **PostgreSQL (Supabase):** AES-256 encryption of disk volumes (Supabase Pro and above)
- **Redis (Upstash):** Encrypted at rest by Upstash
- **Object Storage (Cloudflare R2):** Encrypted at rest by Cloudflare
- **Payment API keys:** Stored only in Vercel encrypted environment variables — never in database or code

### In Transit

- **All client-server traffic:** TLS 1.2+ enforced by Cloudflare
- **Supabase connections:** TLS enforced on all connections
- **Internal service communication:** TLS between Vercel and Railway (Apollo Router)

### Access Control

- **Multi-tenant isolation:** Row Level Security on every table — Restaurant A cannot see Restaurant B's data under any circumstances
- **Staff roles:** 6 roles (owner, admin, manager, kitchen, bar, waiter) with least-privilege access at resolver and database level
- **No shared credentials:** Every staff member has their own Supabase Auth account or PIN-based session

### Anonymization

- Anonymous guest fingerprints are hashed using a one-way hash (SHA-256) from session context — the original device identifier cannot be recovered
- After 90 days, `guest_fingerprint` is overwritten with a null value in all `orders` records

---

## Data Retention Schedule

| Data Category                                                | Retention Period                    | Basis                                      |
| ------------------------------------------------------------ | ----------------------------------- | ------------------------------------------ |
| ERCA-required financial records (orders, payments, invoices) | 7 years                             | ERCA Proclamation obligation               |
| Staff records (time entries, schedules)                      | 2 years after leaving               | Ethiopian Labour Proclamation reference    |
| Order history (operational)                                  | 2 years                             | Operational analytics + dispute resolution |
| Guest accounts (authenticated)                               | Until deletion request + 30 days    | User right to deletion                     |
| Anonymous guest fingerprints                                 | 90 days                             | Minimum needed for session attribution     |
| Sentry error logs                                            | 90 days                             | Debugging operational issues               |
| Axiom application logs                                       | 30 days (raw), 90 days (aggregated) | Security audit trail                       |
| Cloudflare access logs                                       | 7 days                              | Security monitoring                        |
| Authentication audit logs                                    | 1 year                              | Security compliance                        |
| Telegram message logs                                        | Not stored by lole                  | Telegram stores in their infrastructure    |

---

## Data Access — Who Can See What

### Inside lole (Staff Access)

| Role               | What They Can See                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Owner              | All data for their restaurant(s). Cannot see other restaurants.                                                 |
| Admin              | Same as Owner for their restaurant                                                                              |
| Manager            | Orders, staff (own restaurant), analytics, inventory. Not payment API keys.                                     |
| Waiter             | Active orders for their tables. Menu.                                                                           |
| Kitchen / Bar      | KDS order items for their station only                                                                          |
| lole Platform Team | Anonymized aggregate metrics only. Never individual restaurant data without support ticket and written consent. |

### Third-Party Access

| Party                                                                     | What They Receive                                                                                      | Legal Basis                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| **Chapa**                                                                 | Payment initiation data (amount, order reference). Provider processes payment, returns transaction ID. | Contract (Chapa merchant agreement)       |
| **Telebirr (EthioTelecom)**                                               | Payment initiation data. Provider processes payment, returns transaction ID.                           | Contract (Telebirr merchant agreement)    |
| **ERCA**                                                                  | E-invoice data (TIN, items, VAT amounts) for VAT-registered restaurants only                           | Legal obligation (ERCA Proclamation)      |
| **Delivery partners (beU Delivery, Deliver Addis, klik, Zmall Delivery)** | Menu items, order status. No guest personal data.                                                      | Contract (delivery integration agreement) |
| **Supabase**                                                              | All database content (as cloud database provider). Supabase processes on lole's behalf.                | Data Processing Agreement                 |
| **Vercel**                                                                | Application code, server-side env vars, access logs                                                    | Data Processing Agreement                 |
| **Cloudflare**                                                            | IP addresses, request metadata, edge-cached menu data                                                  | Data Processing Agreement                 |
| **Sentry**                                                                | Error logs, tagged with restaurant_id. No payment data in error context.                               | Data Processing Agreement                 |
| **Telegram**                                                              | EOD report content (revenue, top items, order count). No guest PII.                                    | Telegram Bot Terms                        |

**We never sell data.** lole's business model is subscription revenue from restaurants. Guest data is never sold, rented, or shared with advertisers.

---

## Guest Rights

Guests who have created an authenticated account have the following rights:

### Right to Access

Guests can request a copy of all personal data lole holds about them. Email: privacy@lole.app. Response within 14 days.

### Right to Deletion

Guests can request account deletion. This deletes:

- Supabase Auth account (email, hashed password)
- `guests` profile record (name, phone, email)
- `loyalty_accounts` record

This does **not** delete:

- `orders` and `order_items` records (retained 7 years for ERCA financial obligation) — these records are anonymized (guest_id set to null) but the order data itself is retained
- Payment records (`payments` table) — retained 7 years per ERCA

To request deletion: email privacy@lole.app or use the account deletion option in the guest profile screen (Phase 2 feature).

### Right to Correction

Guests can update their name, phone, and email via the guest profile screen.

### Right to Portability

Guests can request an export of their order history and loyalty transactions in JSON or CSV format. Response within 14 days.

---

## Restaurant Operator Rights

Restaurant operators have these additional rights:

### Menu and Business Data

Operators own their menu data, pricing, and business information. Upon account closure, operators receive a full data export within 7 days.

### Financial Records Export

Operators can export all payment, order, and reconciliation data in CSV format from `/merchant/finance` at any time.

### Staff Data

Operators control all staff records. Staff members can request their own time entries and schedule data by contacting the restaurant operator.

### Account Closure

Upon account closure: all operational data (menu, staff, settings) is deleted within 30 days. Financial records are retained 7 years per ERCA. A full data export is provided before deletion.

---

## Data Breach Notification

If a data breach occurs that affects personal data:

1. **Internal assessment within 24 hours** of discovery
2. **Affected restaurant operators notified within 72 hours** via email and Telegram
3. **Content of notification:**
    - What data was affected
    - When the breach occurred (estimated)
    - What action lole has taken
    - What action the operator should take (e.g., reset staff passwords)
4. **Regulatory notification** to relevant Ethiopian authorities if legally required

---

## Contact

**Privacy questions:** privacy@lole.app  
**Data deletion requests:** privacy@lole.app (subject: "Data Deletion Request")  
**Data export requests:** privacy@lole.app (subject: "Data Export Request")  
**Response SLA:** 14 business days for all privacy requests

---

## Changelog

| Version | Date       | Change         |
| ------- | ---------- | -------------- |
| 1.0     | March 2026 | Initial policy |

---

_lole Data Privacy & Protection Policy v1.0 · March 2026_
