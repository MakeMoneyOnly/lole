# lole — Developer & Partner API Guide

**Version 1.0 · March 2026**
**Confidential — Shared with Technology Partners Under NDA**

> This guide is for technology partners building on top of lole's data and workflows — accountants, HR platforms, ERP systems, food suppliers, loyalty aggregators, and analytics tools. If you are a delivery platform, see the Delivery Partner Integration Guide instead. This guide covers read-access to restaurant data, not real-time order injection.

---

## Who This Guide Is For

| Partner type                                           | What they build                                 | Key APIs used                   |
| ------------------------------------------------------ | ----------------------------------------------- | ------------------------------- |
| **Accounting software** (Quickbooks-like for Ethiopia) | Sync daily sales, expenses, tax summaries       | /sales, /payments, /vat-summary |
| **Food cost / inventory tool**                         | Pull stock movements, recipe costing            | /inventory, /stock-movements    |
| **HR / payroll system**                                | Pull staff hours, tips, shift data              | /staff, /time-entries           |
| **Loyalty aggregator**                                 | Read loyalty balances, earn events, redemptions | /loyalty                        |
| **Analytics / BI tool**                                | Read aggregated transaction data                | /analytics                      |
| **ERP integration**                                    | Full sync of all the above on a schedule        | All endpoints                   |

This API is a **data-out API**. It gives partners read access (and limited write access where relevant) to a restaurant's lole data, with the restaurant's explicit permission. It is not the same as the delivery partner API, which injects orders in real time.

---

## Architecture Overview

```
Partner Application
        │
        │  HTTPS + API Key (per restaurant consent)
        ▼
  api.lole.app/partner/v1
        │
        │  Apollo Router validates API key → restaurant_id scope
        ▼
  lole PostgreSQL (Supabase)
        │
  RLS enforces: partner sees only data for the restaurant they were granted access to
```

Every API key is scoped to:

1. A specific **restaurant** (a partner cannot query across restaurants they were not granted access to)
2. A specific **permission scope** (a partner with `read:sales` cannot read `staff` data)

---

## Authentication

### API Key Structure

API keys are issued by lole and granted by the restaurant. They look like:

```
gbp_live_<your-64-character-hex-key>
└──┘ └──┘ └───────────────────────────────────────────────────────────────┘
 1    2                              3
 1: prefix "gbp" = lole Partner
 2: environment "live" or "test"
 3: 64-character hex key
```

Pass the API key in every request header:

```http
Authorization: Bearer gbp_live_ca3f8e7b...
Content-Type: application/json
```

### Permission Scopes

Each API key is granted one or more scopes by the restaurant. Request only the scopes your application requires — restaurants grant access scope by scope.

| Scope               | Access granted                                                |
| ------------------- | ------------------------------------------------------------- |
| `read:sales`        | Daily sales totals, order history, revenue reports            |
| `read:payments`     | Payment records by method, transaction IDs, settlement status |
| `read:vat`          | VAT extraction breakdowns, ERCA submission history            |
| `read:inventory`    | Stock levels, stock movements, low-stock events               |
| `read:staff`        | Staff list, roles, clock-in/out times, hours worked           |
| `read:loyalty`      | Loyalty programme config, point balances, earn/redeem history |
| `read:analytics`    | Aggregated analytics (top items, peak hours, cover counts)    |
| `write:inventory`   | Update stock levels (for supplier integrations)               |
| `write:menu_prices` | Update item prices (for dynamic pricing tools)                |

### Key Rotation

API keys do not expire automatically. The restaurant can revoke a key at any time from their dashboard (Settings → Partner Access). Your application should handle `401 UNAUTHORISED` responses gracefully — surface a clear message that the restaurant has revoked access.

---

## Pagination

All list endpoints use cursor-based pagination. Do not use offset pagination — it breaks on concurrent writes.

```json
// Request with cursor
GET /partner/v1/orders?limit=100&cursor=eyJpZCI6InV1aWQtMTIzIn0

// Response
{
  "data": [ ... ],
  "pagination": {
    "has_more": true,
    "next_cursor": "eyJpZCI6InV1aWQtMjIzIn0",
    "count": 100
  }
}
```

Cursors are opaque base64 strings. Do not parse or construct them. To paginate to the end, keep following `next_cursor` until `has_more` is `false`.

---

## API Reference

**Base URL:** `https://api.lole.app/partner/v1`

---

### GET /restaurant

Fetch the restaurant profile for the authenticated key. Always call this first to confirm the key is valid and to get the `restaurant_id` and timezone for correct date handling.

```http
GET /partner/v1/restaurant
```

**Response:**

```json
{
    "restaurant_id": "uuid-here",
    "slug": "cafe-lucia",
    "name_en": "Café Lucia",
    "name_am": "ካፌ ሉቺያ",
    "address": "Bole Road, Addis Ababa",
    "timezone": "Africa/Addis_Ababa",
    "currency": "ETB",
    "vat_registered": true,
    "tin_number": "0012345678",
    "vat_number": "VAT-ET-0012345678",
    "plan": "pro",
    "granted_scopes": ["read:sales", "read:payments", "read:vat"],
    "key_created_at": "2026-03-01T09:00:00Z",
    "key_last_used_at": "2026-03-07T14:30:00Z"
}
```

---

### GET /sales

Daily sales summaries. The primary endpoint for accounting integrations.

**Scope required:** `read:sales`

```http
GET /partner/v1/sales?from=2026-03-01&to=2026-03-07&granularity=day
```

**Parameters:**

| Parameter     | Type              | Required | Description                                           |
| ------------- | ----------------- | -------- | ----------------------------------------------------- |
| `from`        | date (YYYY-MM-DD) | Yes      | Start date, inclusive, in restaurant's local timezone |
| `to`          | date (YYYY-MM-DD) | Yes      | End date, inclusive. Max range: 366 days              |
| `granularity` | string            | No       | `day` (default), `week`, `month`                      |

**Response:**

```json
{
    "restaurant_id": "uuid-here",
    "currency": "ETB",
    "from": "2026-03-01",
    "to": "2026-03-07",
    "granularity": "day",
    "data": [
        {
            "period": "2026-03-01",
            "gross_revenue_santim": 284500,
            "discount_total_santim": 12000,
            "net_revenue_santim": 272500,
            "order_count": 87,
            "cover_count": 143,
            "average_ticket_santim": 3132,
            "payment_breakdown": {
                "cash_santim": 112000,
                "telebirr_santim": 134500,
                "chapa_santim": 38000,
                "cbe_birr_santim": 0
            },
            "refund_count": 1,
            "refund_total_santim": 8500
        }
    ],
    "totals": {
        "gross_revenue_santim": 1876000,
        "net_revenue_santim": 1804000,
        "order_count": 598,
        "cover_count": 982,
        "refund_total_santim": 42500
    }
}
```

**Important date handling:** All dates are in the restaurant's local timezone (`Africa/Addis_Ababa`, UTC+3). Day boundaries are midnight EAT, not midnight UTC. An order placed at 11:45PM EAT on March 7th belongs to March 7th, not March 8th. Your application must handle this correctly — do not convert to UTC before querying.

---

### GET /orders

Full order history with line items. Used for detailed reconciliation.

**Scope required:** `read:sales`

```http
GET /partner/v1/orders?from=2026-03-01&to=2026-03-01&status=completed&limit=100
```

**Parameters:**

| Parameter | Type     | Description                                                                      |
| --------- | -------- | -------------------------------------------------------------------------------- |
| `from`    | datetime | ISO 8601. Filters on `completed_at` for completed orders                         |
| `to`      | datetime | ISO 8601                                                                         |
| `status`  | string   | `completed`, `cancelled`, `all` (default: `completed`)                           |
| `source`  | string   | `dine_in`, `qr_guest`, `delivery_beu`, `delivery_addis` — filter by order source |
| `limit`   | integer  | 1–500 (default: 100)                                                             |
| `cursor`  | string   | Pagination cursor                                                                |

**Response:**

```json
{
    "data": [
        {
            "order_id": "uuid-here",
            "order_number": "042",
            "source": "dine_in",
            "table_name": "A3",
            "status": "completed",
            "created_at": "2026-03-01T12:34:00+03:00",
            "completed_at": "2026-03-01T13:02:00+03:00",
            "waiter_name": "Tigist M.",
            "gross_total_santim": 34500,
            "discount_santim": 0,
            "net_total_santim": 34500,
            "payment_method": "telebirr",
            "payment_reference": "TLB-20260301-88721",
            "items": [
                {
                    "item_id": "uuid",
                    "name_en": "Doro Wat",
                    "name_am": "ዶሮ ወጥ",
                    "quantity": 2,
                    "unit_price_santim": 15000,
                    "line_total_santim": 30000,
                    "modifiers": [],
                    "special_instructions": null
                },
                {
                    "item_id": "uuid",
                    "name_en": "Macchiato",
                    "name_am": "ማኪያቶ",
                    "quantity": 2,
                    "unit_price_santim": 2250,
                    "line_total_santim": 4500,
                    "modifiers": [],
                    "special_instructions": "Extra sugar"
                }
            ]
        }
    ],
    "pagination": {
        "has_more": true,
        "next_cursor": "eyJjb21wbGV0ZWRfYXQiOiIyMDI2LTAzLTAxVDEzOjAyOjAwWiIsImlkIjoidXVpZCJ9",
        "count": 100
    }
}
```

---

### GET /payments

Payment transaction records. Used for bank reconciliation and settlement tracking.

**Scope required:** `read:payments`

```http
GET /partner/v1/payments?from=2026-03-01&to=2026-03-07&method=telebirr
```

**Response:**

```json
{
    "data": [
        {
            "payment_id": "uuid",
            "order_id": "uuid",
            "order_number": "042",
            "method": "telebirr",
            "status": "captured",
            "amount_santim": 34500,
            "currency": "ETB",
            "provider_transaction_id": "TLB-20260301-88721",
            "provider_reference": "ET123456789",
            "initiated_at": "2026-03-01T13:00:00+03:00",
            "captured_at": "2026-03-01T13:00:45+03:00",
            "refunded_at": null,
            "refund_amount_santim": null
        }
    ],
    "pagination": { "has_more": false, "next_cursor": null, "count": 47 },
    "summary": {
        "total_captured_santim": 1648500,
        "total_refunded_santim": 8500,
        "net_settled_santim": 1640000,
        "by_method": {
            "cash": { "count": 34, "total_santim": 712000 },
            "telebirr": { "count": 48, "total_santim": 836500 },
            "chapa": { "count": 12, "total_santim": 100000 },
            "cbe_birr": { "count": 0, "total_santim": 0 }
        }
    }
}
```

---

### GET /vat-summary

VAT extraction and ERCA submission records. For accounting and tax reporting.

**Scope required:** `read:vat`

```http
GET /partner/v1/vat-summary?from=2026-03-01&to=2026-03-31
```

**Response:**

```json
{
    "period": { "from": "2026-03-01", "to": "2026-03-31" },
    "vat_registered": true,
    "tin_number": "0012345678",
    "vat_number": "VAT-ET-0012345678",
    "vat_rate_percent": 15,
    "extraction_method": "inclusive",
    "summary": {
        "gross_revenue_santim": 8450000,
        "vat_collected_santim": 1102174,
        "net_revenue_santim": 7347826,
        "vat_formula": "price × 15 ÷ 115 (tax-inclusive)"
    },
    "erca_submissions": [
        {
            "submission_id": "uuid",
            "order_id": "uuid",
            "order_number": "042",
            "submitted_at": "2026-03-01T13:01:05+03:00",
            "erca_reference": "ERCA-2026-0301-042",
            "status": "accepted",
            "gross_santim": 34500,
            "vat_santim": 4500,
            "net_santim": 30000
        }
    ],
    "failed_submissions": [],
    "pagination": { "has_more": true, "next_cursor": "..." }
}
```

**VAT formula note:** Ethiopia uses tax-inclusive pricing. VAT is extracted from the gross price using the formula `VAT = price × 15 ÷ 115`, not `price × 0.15`. Your accounting software must implement this correctly to match lole's calculations and the ERCA submission records.

---

### GET /inventory

Current stock levels and inventory summary.

**Scope required:** `read:inventory`

```http
GET /partner/v1/inventory?low_stock_only=false
```

**Response:**

```json
{
    "data": [
        {
            "item_id": "uuid",
            "name_en": "Teff Flour",
            "name_am": "ጤፍ ዱቄት",
            "unit": "kg",
            "current_stock": 24.5,
            "reorder_threshold": 10.0,
            "is_low_stock": false,
            "cost_per_unit_santim": 8500,
            "last_updated": "2026-03-07T08:00:00+03:00"
        },
        {
            "item_id": "uuid",
            "name_en": "Berbere Spice",
            "name_am": "በርበሬ",
            "unit": "kg",
            "current_stock": 2.1,
            "reorder_threshold": 5.0,
            "is_low_stock": true,
            "cost_per_unit_santim": 32000,
            "last_updated": "2026-03-06T22:00:00+03:00"
        }
    ]
}
```

---

### GET /stock-movements

Stock in/out history. Used for food cost analysis and supplier reconciliation.

**Scope required:** `read:inventory`

```http
GET /partner/v1/stock-movements?from=2026-03-01&to=2026-03-07&type=deduction
```

**Parameters:**

| Parameter | Type   | Description                                                                                   |
| --------- | ------ | --------------------------------------------------------------------------------------------- |
| `type`    | string | `deduction` (from orders), `restock` (purchase orders received), `adjustment` (manual), `all` |
| `item_id` | UUID   | Filter to a specific inventory item                                                           |

**Response:**

```json
{
    "data": [
        {
            "movement_id": "uuid",
            "item_id": "uuid",
            "item_name_en": "Teff Flour",
            "type": "deduction",
            "quantity_change": -0.5,
            "unit": "kg",
            "stock_after": 24.5,
            "reason": "order_fulfilled",
            "order_id": "uuid",
            "order_number": "042",
            "recorded_at": "2026-03-01T13:02:00+03:00",
            "recorded_by": "system_trigger"
        },
        {
            "movement_id": "uuid",
            "item_id": "uuid",
            "item_name_en": "Teff Flour",
            "type": "restock",
            "quantity_change": 50.0,
            "unit": "kg",
            "stock_after": 72.0,
            "reason": "purchase_order_received",
            "purchase_order_id": "uuid",
            "supplier_name": "Addis Grain Suppliers",
            "recorded_at": "2026-03-03T09:15:00+03:00",
            "recorded_by": "Almaz T."
        }
    ]
}
```

---

### GET /staff

Staff roster and basic profile. Used by HR and scheduling tools.

**Scope required:** `read:staff`

```http
GET /partner/v1/staff?is_active=true
```

**Response:**

```json
{
    "data": [
        {
            "staff_id": "uuid",
            "full_name": "Tigist Mekonnen",
            "role": "waiter",
            "is_active": true,
            "hired_at": "2025-11-01",
            "hourly_rate_santim": null
        }
    ]
}
```

**Note:** PINs are never returned via the API. Staff PINs are device-local security credentials.

---

### GET /time-entries

Clock-in/clock-out records. Used for payroll calculation.

**Scope required:** `read:staff`

```http
GET /partner/v1/time-entries?from=2026-03-01&to=2026-03-15&staff_id=uuid
```

**Response:**

```json
{
    "data": [
        {
            "entry_id": "uuid",
            "staff_id": "uuid",
            "staff_name": "Tigist Mekonnen",
            "clocked_in_at": "2026-03-01T10:00:00+03:00",
            "clocked_out_at": "2026-03-01T18:30:00+03:00",
            "duration_minutes": 510,
            "shift_note": null
        }
    ],
    "summary": {
        "total_staff": 6,
        "total_hours_worked": 284.5,
        "by_staff": [
            {
                "staff_id": "uuid",
                "name": "Tigist Mekonnen",
                "hours_worked": 51.0,
                "shifts_worked": 6
            }
        ]
    }
}
```

---

### GET /loyalty

Loyalty programme configuration and member activity.

**Scope required:** `read:loyalty`

```http
GET /partner/v1/loyalty/summary?from=2026-03-01&to=2026-03-31
```

**Response:**

```json
{
    "programme": {
        "name_en": "Lucia Rewards",
        "name_am": "ሉቺያ ሽልማቶች",
        "points_per_etb": 1,
        "redemption_rate": 100,
        "tiers": ["Bronze", "Silver", "Gold"]
    },
    "summary": {
        "total_members": 847,
        "new_members_this_period": 43,
        "points_earned_this_period": 284500,
        "points_redeemed_this_period": 12000,
        "outstanding_liability_santim": 87200
    }
}
```

`outstanding_liability_santim` represents unredeemed points expressed as their ETB redemption value — this is a real liability on the restaurant's books and should appear in accounting exports.

---

### GET /analytics

Aggregated operational analytics. Used by BI tools and benchmarking platforms.

**Scope required:** `read:analytics`

```http
GET /partner/v1/analytics?from=2026-03-01&to=2026-03-31&metrics=top_items,peak_hours,cover_count
```

**Response:**

```json
{
    "period": { "from": "2026-03-01", "to": "2026-03-31" },
    "top_items": [
        {
            "item_id": "uuid",
            "name_en": "Doro Wat",
            "name_am": "ዶሮ ወጥ",
            "quantity_sold": 847,
            "revenue_santim": 12705000,
            "rank": 1
        }
    ],
    "peak_hours": [
        { "hour": 12, "avg_order_count": 18.4, "day_type": "weekday" },
        { "hour": 13, "avg_order_count": 22.1, "day_type": "weekday" },
        { "hour": 19, "avg_order_count": 31.7, "day_type": "weekend" }
    ],
    "cover_count": {
        "total": 9820,
        "average_per_day": 327,
        "by_weekday": {
            "friday": 512,
            "saturday": 589,
            "sunday": 478,
            "monday": 201,
            "tuesday": 198,
            "wednesday": 218,
            "thursday": 246
        }
    }
}
```

---

### PATCH /inventory/stock-level (write endpoint)

Update stock levels. Used by supplier integrations to record deliveries.

**Scope required:** `write:inventory`

```json
{
    "item_id": "uuid",
    "quantity_change": 50.0,
    "unit": "kg",
    "reason": "supplier_delivery",
    "supplier_name": "Addis Grain Suppliers",
    "purchase_order_reference": "PO-2026-0312",
    "notes": "Delivered at 9am by Haile"
}
```

`quantity_change` is always a delta (positive = restock, negative = waste/adjustment). lole records this as a stock movement with `type: adjustment` or `type: restock` depending on sign and reason.

---

### PATCH /menu/prices (write endpoint)

Bulk update item prices. Used by dynamic pricing or menu management tools.

**Scope required:** `write:menu_prices`

```json
{
    "updates": [
        {
            "item_id": "uuid",
            "new_price_santim": 17500,
            "reason": "cost_increase",
            "effective_from": "2026-03-08T00:00:00+03:00"
        }
    ]
}
```

`effective_from` can be set to a future timestamp for scheduled price changes. Maximum 50 items per request.

**Important:** Price changes take effect immediately for new orders (or at `effective_from` if set). In-flight orders already sent to the kitchen retain the price at time of order — price changes never retroactively modify past orders.

---

## Webhooks

Register a webhook endpoint in the partner portal to receive real-time push events instead of polling.

### Available Events

| Event                         | Scope            | Description                                                     |
| ----------------------------- | ---------------- | --------------------------------------------------------------- |
| `order.completed`             | `read:sales`     | Fired when an order is marked completed and payment is captured |
| `order.refunded`              | `read:payments`  | Fired when a payment is refunded                                |
| `inventory.low_stock`         | `read:inventory` | Fired when an item falls below its reorder threshold            |
| `inventory.stock_updated`     | `read:inventory` | Fired on any stock level change                                 |
| `loyalty.points_earned`       | `read:loyalty`   | Fired when a guest earns points                                 |
| `loyalty.points_redeemed`     | `read:loyalty`   | Fired when a guest redeems points                               |
| `erca.submission_failed`      | `read:vat`       | Fired when an ERCA submission fails after all retries           |
| `restaurant.settings_changed` | Any              | Fired when the restaurant changes name, hours, or VAT status    |

### Webhook Payload Format

```json
{
    "event": "order.completed",
    "restaurant_id": "uuid",
    "restaurant_slug": "cafe-lucia",
    "timestamp": "2026-03-07T19:02:00+03:00",
    "data": {
        // event-specific payload — same structure as the corresponding GET response object
    }
}
```

### Webhook Security

Webhooks are signed using the same HMAC-SHA256 scheme as the delivery partner integration. Verify the `X-lole-Signature` header using your API key secret before processing any event.

### Webhook Reliability

- lole retries failed webhook deliveries with exponential backoff: 30s, 2m, 10m, 30m, 2h
- If all retries fail, the event is moved to your partner portal dead-letter queue (visible in the dashboard)
- Your endpoint must return HTTP `200` within 10 seconds
- Your endpoint must be idempotent — lole may deliver the same event more than once. Use the `event_id` field to deduplicate.

---

## Error Reference

All errors follow this format:

```json
{
    "error": {
        "code": "INVALID_DATE_RANGE",
        "message": "Date range exceeds maximum of 366 days",
        "field": "to",
        "request_id": "req_01jq2m5p8vk4xw9..."
    }
}
```

Include `request_id` in any support ticket.

| HTTP Status | Code                   | Common cause                                             |
| ----------- | ---------------------- | -------------------------------------------------------- |
| 400         | `INVALID_DATE_RANGE`   | Range exceeds 366 days or `from` > `to`                  |
| 400         | `INVALID_GRANULARITY`  | Unknown `granularity` value                              |
| 400         | `INVALID_CURSOR`       | Cursor is malformed or expired                           |
| 401         | `INVALID_API_KEY`      | Key is wrong format or does not exist                    |
| 401         | `KEY_REVOKED`          | Restaurant revoked this key                              |
| 403         | `SCOPE_DENIED`         | Key does not have required scope                         |
| 404         | `RESTAURANT_NOT_FOUND` | The restaurant associated with this key is deleted       |
| 422         | `PRICE_OUT_OF_RANGE`   | Price update exceeds allowed range (±200% of current)    |
| 429         | `RATE_LIMITED`         | See rate limits below                                    |
| 500         | `INTERNAL_ERROR`       | lole internal error. Include `request_id` in bug report. |
| 503         | `MAINTENANCE`          | Scheduled maintenance. Retry after `Retry-After` header. |

---

## Rate Limits

All limits are per API key.

| Endpoint group                               | Limit        | Window   |
| -------------------------------------------- | ------------ | -------- |
| GET /restaurant                              | 60 requests  | per hour |
| GET /sales, /orders, /payments, /vat-summary | 120 requests | per hour |
| GET /inventory, /stock-movements             | 60 requests  | per hour |
| GET /staff, /time-entries                    | 60 requests  | per hour |
| GET /loyalty, /analytics                     | 60 requests  | per hour |
| PATCH (write endpoints)                      | 30 requests  | per hour |
| All endpoints combined                       | 600 requests | per hour |

Rate limit headers on every response:

```http
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 118
X-RateLimit-Reset: 1741309200
Retry-After: 3540    (only on 429 responses)
```

---

## Changelog & Versioning

The API is versioned at the URL path (`/partner/v1`). We commit to:

- **No breaking changes** within a major version (`v1`)
- **12 months notice** before deprecating a major version
- **Additive changes** (new fields, new endpoints, new event types) are non-breaking and may ship without notice
- **Breaking changes** (removed fields, changed data types, renamed endpoints) require a new major version

Subscribe to API change notifications at: integrations@lole.app

**API Changelog:**

| Version | Date       | Changes         |
| ------- | ---------- | --------------- |
| v1.0    | March 2026 | Initial release |

---

## SDK Status

Official SDKs are on the roadmap. Current status:

| Language             | Status         | Notes           |
| -------------------- | -------------- | --------------- |
| TypeScript / Node.js | In development | Target: Q2 2026 |
| Python               | Planned        | Target: Q3 2026 |
| PHP                  | Planned        | Target: Q3 2026 |

Until SDKs are available, use the reference implementations in this guide. The signing functions are the most critical piece — everything else is standard REST.

---

## Support & Onboarding

| Topic                                   | Contact                                                   |
| --------------------------------------- | --------------------------------------------------------- |
| API access request and credential setup | integrations@lole.app                                     |
| Technical questions during integration  | integrations@lole.app                                     |
| Production issues                       | Telegram: @loleIntegrations (6am–11pm EAT)                |
| Security disclosures                    | security@lole.app                                         |
| Feature requests                        | integrations@lole.app with subject: "API Feature Request" |

**To request production API access:**

1. Email integrations@lole.app with your company name, use case, and which scopes you require
2. We verify that the intended restaurants consent to the integration
3. Credentials are issued within 2 business days
4. You receive: `lole_API_KEY` (partner-level), plus per-restaurant keys after restaurant opt-in

---

_lole Developer & Partner API Guide v1.0 · March 2026 · Confidential — Shared Under NDA_
