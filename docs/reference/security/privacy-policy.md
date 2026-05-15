# lole — Privacy Policy

**Version 1.0 · May 2026 · Effective Date: June 1, 2026**

---

## Purpose

This Privacy Policy describes how lole ("we", "us", or "our") collects, uses, processes, and protects personal data across our Restaurant Operating System platform. It applies to all users including restaurant operators, staff members, and guests who interact with lole services.

This document serves three audiences:

1. **Restaurant operators** — understanding obligations and guest data handling
2. **Enterprise clients** — evaluating data protection practices for due diligence
3. **Guests** — knowing your rights regarding personal data during dining experiences

---

## 1. Data Collection Practices

### 1.1 Data Collected from Restaurant Operators

Restaurant operators provide business and operational data necessary for platform functionality:

| Data Category         | Specific Data                                                 | Purpose                              | Legal Basis             |
| --------------------- | ------------------------------------------------------------- | ------------------------------------ | ----------------------- |
| Account Information   | Restaurant name (English + Amharic), address, contact details | Service delivery, receipts, branding | Contract performance    |
| Authentication Data   | Owner email, password (hashed), Telegram ID                   | Account access, EOD reporting        | Contract performance    |
| Tax Compliance        | TIN number, VAT registration number                           | ERCA e-invoice submission            | Legal obligation (ERCA) |
| Staff Management      | Staff names, role assignments, PINs                           | POS authentication, audit trails     | Contract performance    |
| Menu Data             | Item names, descriptions, prices, categories                  | Menu display, order processing       | Contract performance    |
| Payment Configuration | Payment provider API keys (server-side only)                  | Payment processing                   | Contract performance    |

### 1.2 Data Collected from Dine-In Guests

#### Anonymous Guests (QR Code Access)

| Data                        | Purpose                   | Collection Method                 | Retention      |
| --------------------------- | ------------------------- | --------------------------------- | -------------- |
| Device fingerprint (hashed) | Order-session attribution | Derived from User-Agent + IP hash | 90 days        |
| IP address                  | Security, rate limiting   | Cloudflare logs                   | 7 days         |
| Order details               | Service fulfillment       | Order placement                   | 7 years (ERCA) |
| Payment method type         | Reconciliation            | Payment selection                 | 7 years (ERCA) |

#### Authenticated Guests (Account Creation)

| Data                    | Purpose                       | Storage Location               | Retention              |
| ----------------------- | ----------------------------- | ------------------------------ | ---------------------- |
| Full name               | Personalization, receipts     | `guests.full_name`             | Until account deletion |
| Phone number            | Account recovery, loyalty     | `guests.phone`                 | Until account deletion |
| Email address           | Authentication, notifications | Supabase Auth + `guests.email` | Until account deletion |
| Order history           | Loyalty, analytics            | `orders` linked to `guest_id`  | 2 years                |
| Loyalty points          | Rewards program               | `loyalty_accounts`             | Until account deletion |
| Business TIN (optional) | B2B VAT invoicing             | `guests.tin_number`            | 7 years if provided    |

### 1.3 Data We Do NOT Collect

lole maintains strict data minimization principles and explicitly does NOT collect:

- **Payment card numbers (PAN)** — Never transmitted; processed via PCI-compliant providers
- **Bank account credentials** — Payouts managed directly by Chapa/Telebirr
- **National ID numbers** — Not required for any lole service
- **Biometric data** — No fingerprint, face, or voice recognition
- **Location/GPS data** — No device location tracking
- **Social media data** — No Facebook, Google, or similar platform SDKs
- **Advertising identifiers** — No ad tracking or remarketing

---

## 2. Data Usage and Processing

### Primary Purposes for Data Processing

| Purpose                         | Data Categories Used                                  | Description                                                    |
| ------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| **Order Processing**            | Order items, guest fingerprint, staff assignments     | Facilitate food/drink ordering from menu to kitchen to payment |
| **Payment Processing**          | Order totals, payment method, tax IDs                 | Process payments via licensed providers; submit ERCA invoices  |
| **Restaurant Operations**       | Menu data, staff roles, table assignments             | Enable POS, KDS, and management dashboards                     |
| **Loyalty Program**             | Guest identity, order history, lifetime value         | Track spending and award points for repeat customers           |
| **Tax Compliance**              | All order/payment data for VAT-registered restaurants | Generate and submit ERCA-compliant e-invoices                  |
| **Analytics & Reporting**       | Aggregated order data, revenue metrics                | Provide operational insights to restaurant operators           |
| **Security & Fraud Prevention** | IP addresses, device fingerprints, access logs        | Detect and prevent unauthorized access attempts                |

### Legal Basis for Processing (Ethiopia)

- Order/payment processing: Contract performance (restaurant agreement)
- ERCA invoice submission: Legal obligation (ERCA Proclamation No. 983/2016)
- Staff authentication/audit logs: Legitimate interest (business security)
- Loyalty program: Contract performance + legitimate interest

---

## 3. Third-Party Sharing and Integrations

### Service Providers (Data Processors)

| Provider             | Data Shared                    | Purpose                          | DPA in Place |
| -------------------- | ------------------------------ | -------------------------------- | ------------ |
| **Supabase**         | All application data           | Database hosting, authentication | Yes          |
| **Vercel**           | Application code, logs         | Hosting, serverless functions    | Yes          |
| **Cloudflare**       | IP addresses, request metadata | CDN, WAF, DDoS protection        | Yes          |
| **Sentry**           | Error logs (restaurant-tagged) | Error monitoring                 | Yes          |
| **QStash (Upstash)** | Job payloads, order IDs        | Background job processing        | Yes          |
| **Telegram**         | EOD reports (revenue, no PII)  | Daily reporting delivery         | Bot Terms    |

### Payment Processors

| Provider     | Data Shared                             | Purpose            | Legal Basis |
| ------------ | --------------------------------------- | ------------------ | ----------- |
| **Chapa**    | Amount, order reference, restaurant TIN | Payment processing | Contract    |
| **Telebirr** | Amount, order reference                 | Payment processing | Contract    |

### Tax Authority

| Authority | Data Shared                    | Trigger                                         | Legal Basis      |
| --------- | ------------------------------ | ----------------------------------------------- | ---------------- |
| **ERCA**  | Invoice data (items, VAT, TIN) | Order completion for VAT-registered restaurants | Legal obligation |

### Delivery Partners

- beU Delivery, Deliver Addis, klik, Zmall: Menu items, order status only (no guest PII)

### Data Sharing Restrictions

- No data selling — subscription revenue model only
- No advertising sharing or behavioral targeting

---

## 4. Data Retention Policies

| Data Category                   | Retention Period | Justification                  |
| ------------------------------- | ---------------- | ------------------------------ |
| ERCA-required financial records | 7 years          | ERCA Proclamation No. 983/2016 |
| Orders and order items          | 7 years          | Financial audit trail          |
| Payment records                 | 7 years          | ERCA + NBE requirements        |
| Staff records (after departure) | 2 years          | Labour Proclamation reference  |
| Guest authenticated accounts    | Until deletion   | User rights                    |
| Guest anonymous fingerprints    | 90 days          | Session attribution only       |
| Authentication audit logs       | 1 year           | Security compliance            |
| Sentry error logs               | 90 days          | Debugging                      |
| Cloudflare access logs          | 7 days           | Default retention              |

---

## 5. User Rights

### Guests (Authenticated Accounts)

- **Right to Access**: Request personal data copy — privacy@lole.app (14 days response)
- **Right to Correction**: Update name, phone, email via profile screen
- **Right to Deletion**: Remove account data except orders retained 7 years for ERCA
- **Right to Portability**: Export order history in JSON/CSV (14 days response)

### Restaurant Operators

- **Data Access**: Full dashboard access at any time
- **Data Export**: Available at `/merchant/finance` in CSV format
- **Account Closure**: Operational data deleted in 30 days; financial records retained 7 years

---

## 6. Security Measures

### Technical Safeguards

| Safeguard              | Implementation                                                  |
| ---------------------- | --------------------------------------------------------------- |
| Encryption at Rest     | AES-256 (Supabase volumes, Cloudflare R2)                       |
| Encryption in Transit  | TLS 1.2+ enforced across all connections                        |
| Multi-Tenant Isolation | Row Level Security on every database table                      |
| Authentication         | Supabase Auth (HttpOnly, Secure, SameSite cookies)              |
| Authorization          | Role-based access (owner, admin, manager, kitchen, bar, waiter) |
| Webhook Verification   | HMAC-SHA256 on all external webhooks                            |
| Rate Limiting          | Per-restaurant limits                                           |
| Input Validation       | Parameterized queries, type validation in resolvers             |

### Organizational Safeguards

- Least privilege access
- Audit trail on all mutations with `created_by`/`staff_id`
- Annual security training for all platform team members
- DPAs executed with all processors; SOC2/ISO certified providers preferred
- 24-hour incident acknowledgment, 72-hour resolution for critical issues

---

## 7. ERCA Compliance

The **Ethiopian Revenue and Customs Authority (ERCA)** requires VAT-registered businesses to:

1. Issue electronic invoices for every taxable transaction
2. Submit invoice data in real-time/near-real-time
3. Maintain records for minimum 7 years
4. Apply 15% VAT rate on taxable goods and services

### lole's Implementation

- Automatic 15% VAT extraction from tax-inclusive prices using formula: VAT = price × 15 ÷ 115
- ERCA-compliant e-invoice generation with TIN, items, VAT breakdown
- Real-time submission via QStash with 5 retries over 2 hours on failure
- All submissions stored in `erca_submissions` table for 7 years
- Complete audit trail with ERCA invoice IDs for verification

### Data Shared with ERCA (VAT-Registered Restaurants Only)

```json
{
    "invoice_number": "prefix-ordernumber",
    "tin": "restaurant TIN",
    "buyer_tin": "guest TIN if B2B",
    "issue_date": "ISO 8601",
    "currency": "ETB",
    "items": [
        {
            "description": "item name",
            "description_am": "Amharic name",
            "quantity": 1,
            "unit_price_santim": 10000,
            "vat_rate": 0.15,
            "vat_amount_santim": 1500,
            "line_total_santim": 10000
        }
    ],
    "subtotal_santim": 10000,
    "vat_total_santim": 1500,
    "grand_total_santim": 11500
}
```

---

## 8. Contact Information

**Privacy questions:** privacy@lole.app  
**Data deletion requests:** privacy@lole.app (subject: "Data Deletion Request")  
**Data export requests:** privacy@lole.app (subject: "Data Export Request")  
**Response SLA:** 14 business days for all privacy requests

**Support:** support@lole.app | Telegram: @lolemenu  
**Mailing Address:** lole Technologies PLC, Bole Subcity, Addis Ababa, Ethiopia

---

## Changes to This Policy

Last updated: May 14, 2026. Material changes notified via email and Telegram. Continued use of the service after changes constitutes acceptance of the revised policy.

---

_lole Privacy Policy v1.0 · May 2026 · Effective: June 1, 2026_
