# lole — Delivery Partner Integration Guide

**Version 1.0 · March 2026**
**Confidential — Shared with Delivery Partners Under NDA**

> This document is the single source of truth for any delivery platform integrating with lole. It defines the exact API surface, webhook contracts, authentication model, error handling expectations, and operational requirements for a production-grade integration. If something is not in this document, ask before building.

---

## Integration Overview

lole is the POS and kitchen operating system inside the restaurant. You are the delivery platform outside it. The integration connects these two worlds so that orders placed on your platform arrive in the restaurant's unified lole order queue — alongside dine-in orders — without requiring a separate tablet, a separate login, or a separate menu management workflow.

### What the Integration Enables

| Capability            | Description                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Menu sync**         | Your platform fetches the restaurant's live menu from lole. One menu update in lole propagates to your app automatically.            |
| **Order injection**   | Delivery orders placed on your platform are pushed into lole's order queue. They appear on the kitchen KDS alongside dine-in orders. |
| **Status callbacks**  | lole pushes real-time order status updates (confirmed, preparing, ready for pickup) to your webhook endpoint.                        |
| **Item availability** | Your platform can mark items as 86'd (unavailable) via lole, or receive push notifications when lole marks an item unavailable.      |
| **Operating hours**   | Your platform reads restaurant operating hours from lole to gate ordering when the restaurant is closed.                             |

### What Is Out of Scope

| Capability                 | Status                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Payment processing         | lole does not process delivery payments — you do. lole receives the order as already-paid.                            |
| Delivery logistics         | lole has no knowledge of driver assignment, GPS tracking, or delivery routing.                                        |
| Customer identity          | lole receives only what is needed to fulfill the order (items, special notes, your order reference). No customer PII. |
| Pricing override           | lole's menu prices are the restaurant's prices. You may apply your own delivery surcharge on your side.               |
| Reservations or scheduling | Not supported. lole processes orders in real time only.                                                               |

---

## Supported Partners

The following partners have been issued credentials or are in the integration queue:

| Partner                 | Status                      | Protocol     | Notes                       |
| ----------------------- | --------------------------- | ------------ | --------------------------- |
| beU (ቤዩ)                | Integration spec agreed     | Webhook push | Ethiopian-first             |
| Deliver Addis           | Integration spec agreed     | Webhook push | Ethiopian-first             |
| Zmall Delivery Delivery | Pending credential issuance | Webhook push | —                           |
| klik                    | Pending integration spec    | Webhook push | Ethiopian delivery platform |

To request integration credentials for a new platform, contact: integrations@lole.app

---

## Authentication

### Credential Types

Every delivery partner receives two credentials:

```
lole_PARTNER_ID      A stable UUID identifying your platform across all restaurants
lole_PARTNER_SECRET  A 64-character hex secret used to sign your requests and verify lole's webhooks
```

These credentials are **platform-level**, not restaurant-level. One set of credentials covers all restaurants you are integrated with on lole.

Keep `lole_PARTNER_SECRET` in your secret manager. Never expose it in client-side code, logs, or API responses.

### Request Signing

Every API request to lole must include these headers:

```http
X-lole-Partner-ID: {lole_PARTNER_ID}
X-lole-Timestamp: {unix_timestamp_seconds}    # Must be within ±300 seconds of current time
X-lole-Signature: {HMAC-SHA256}
Content-Type: application/json
```

#### Computing the Signature

```
signature = HMAC-SHA256(
  key    = lole_PARTNER_SECRET,
  message = "{lole_PARTNER_ID}\n{timestamp}\n{request_body_sha256}"
)

Where:
  request_body_sha256 = SHA-256 hex digest of the raw request body (or empty string for GET requests)
```

#### Reference Implementation (TypeScript)

```typescript
import crypto from 'crypto';

function signRequest(
    partnerId: string,
    partnerSecret: string,
    body: string | null = null
): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyHash = body ? crypto.createHash('sha256').update(body, 'utf8').digest('hex') : '';

    const message = `${partnerId}\n${timestamp}\n${bodyHash}`;
    const signature = crypto.createHmac('sha256', partnerSecret).update(message).digest('hex');

    return {
        'X-lole-Partner-ID': partnerId,
        'X-lole-Timestamp': timestamp,
        'X-lole-Signature': signature,
        'Content-Type': 'application/json',
    };
}

// Usage:
const body = JSON.stringify({ restaurant_slug: 'cafe-lucia' });
const headers = signRequest(PARTNER_ID, PARTNER_SECRET, body);
const response = await fetch('https://api.lole.app/delivery/v1/menu', {
    method: 'POST',
    headers,
    body,
});
```

#### Reference Implementation (Python)

```python
import hashlib, hmac, time, json

def sign_request(partner_id: str, partner_secret: str, body: str | None = None) -> dict:
    timestamp = str(int(time.time()))
    body_hash = hashlib.sha256(body.encode()).hexdigest() if body else ''
    message = f"{partner_id}\n{timestamp}\n{body_hash}"
    signature = hmac.new(
        partner_secret.encode(), message.encode(), hashlib.sha256
    ).hexdigest()
    return {
        'X-lole-Partner-ID': partner_id,
        'X-lole-Timestamp': timestamp,
        'X-lole-Signature': signature,
        'Content-Type': 'application/json',
    }
```

### Webhook Signature Verification

When lole sends webhooks to your endpoint, we sign them the same way. You must verify our signature before processing any webhook.

```typescript
// Verify lole's webhook signature on your server
function verifyloleWebhook(
    rawBody: string, // Read as raw bytes BEFORE calling JSON.parse
    headers: {
        'x-lole-partner-id': string;
        'x-lole-timestamp': string;
        'x-lole-signature': string;
    },
    partnerSecret: string
): boolean {
    // Replay attack prevention: reject timestamps older than 5 minutes
    const timestamp = parseInt(headers['x-lole-timestamp'], 10);
    if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

    const bodyHash = crypto.createHash('sha256').update(rawBody, 'utf8').digest('hex');
    const message = `${headers['x-lole-partner-id']}\n${timestamp}\n${bodyHash}`;
    const expected = crypto.createHmac('sha256', partnerSecret).update(message).digest('hex');

    // Timing-safe comparison — never use === on HMAC values
    return crypto.timingSafeEqual(
        Buffer.from(headers['x-lole-signature'], 'hex'),
        Buffer.from(expected, 'hex')
    );
}

// CRITICAL: Read raw body BEFORE json.parse()
// Express.js example:
app.post('/lole/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const rawBody = req.body.toString('utf8');
    const valid = verifyloleWebhook(rawBody, req.headers, PARTNER_SECRET);
    if (!valid) return res.status(401).json({ error: 'Invalid signature' });

    const event = JSON.parse(rawBody);
    // process event...
    res.status(200).json({ received: true });
});
```

---

## Restaurant Onboarding via lole

Before your platform can send orders to a restaurant, the restaurant must explicitly grant your platform permission. This is a mutual opt-in — neither lole nor you can activate a restaurant on your platform without the restaurant's knowledge.

### Activation Flow

```
1. Restaurant owner logs in to lole dashboard → Channels → Delivery Partners
2. They tap "Connect [Your Platform Name]"
3. lole sends you a connection webhook:

   POST https://your-platform.com/lole/connect
   {
     "event": "restaurant.connected",
     "restaurant_slug": "cafe-lucia",
     "restaurant_name_en": "Café Lucia",
     "restaurant_name_am": "ካፌ ሉቺያ",
     "lole_restaurant_id": "uuid-here",
     "connected_at": "2026-03-07T18:30:00Z"
   }

4. You acknowledge with HTTP 200
5. The restaurant is now active on both sides
```

### Deactivation Flow

```
When a restaurant disconnects (from either side):

POST https://your-platform.com/lole/connect
{
  "event": "restaurant.disconnected",
  "restaurant_slug": "cafe-lucia",
  "lole_restaurant_id": "uuid-here",
  "disconnected_at": "2026-03-07T19:00:00Z",
  "disconnected_by": "restaurant"  // or "partner" or "lole_admin"
}

On receiving this:
→ Stop accepting new orders for this restaurant
→ Complete any in-flight orders already in your system
→ Remove the restaurant from your active listings
```

---

## API Reference

**Base URL:** `https://api.lole.app/delivery/v1`

All requests must be signed (see Authentication above). All responses are `application/json`. All monetary values are in **Ethiopian Santim (integer)**. Divide by 100 to display in ETB.

---

### GET /menu

Fetch the current live menu for a connected restaurant.

**Request:**

```http
GET /delivery/v1/menu?restaurant_slug=cafe-lucia
X-lole-Partner-ID: {partner_id}
X-lole-Timestamp: {timestamp}
X-lole-Signature: {signature}
```

**Response `200 OK`:**

```json
{
    "restaurant_slug": "cafe-lucia",
    "restaurant_name_en": "Café Lucia",
    "restaurant_name_am": "ካፌ ሉቺያ",
    "currency": "ETB",
    "timezone": "Africa/Addis_Ababa",
    "last_updated": "2026-03-07T14:30:00Z",
    "operating_hours": {
        "monday": { "open": "07:00", "close": "22:00", "closed": false },
        "tuesday": { "open": "07:00", "close": "22:00", "closed": false },
        "wednesday": { "open": "07:00", "close": "22:00", "closed": false },
        "thursday": { "open": "07:00", "close": "22:00", "closed": false },
        "friday": { "open": "07:00", "close": "23:00", "closed": false },
        "saturday": { "open": "08:00", "close": "23:00", "closed": false },
        "sunday": { "open": "09:00", "close": "21:00", "closed": false }
    },
    "categories": [
        {
            "id": "cat-uuid-001",
            "name_en": "Breakfast",
            "name_am": "ቁርስ",
            "sort_order": 1,
            "available_for_delivery": true,
            "items": [
                {
                    "id": "item-uuid-001",
                    "name_en": "Ful with Bread",
                    "name_am": "ፉል ከዳቦ ጋር",
                    "description_en": "Ethiopian fava bean stew with fresh bread",
                    "description_am": "የኢትዮጵያ ፉል ከትኩስ ዳቦ ጋር",
                    "price_santim": 8500,
                    "is_available": true,
                    "available_for_delivery": true,
                    "photo_url": "https://r2.lole.app/menu/cafe-lucia/ful-001.jpg",
                    "preparation_time_minutes": 12,
                    "modifier_groups": [
                        {
                            "id": "mod-group-001",
                            "name_en": "Extras",
                            "name_am": "ተጨማሪ",
                            "required": false,
                            "multi_select": true,
                            "options": [
                                {
                                    "id": "mod-opt-001",
                                    "name_en": "Extra Egg",
                                    "name_am": "ተጨማሪ እንቁላል",
                                    "price_santim": 1500
                                },
                                {
                                    "id": "mod-opt-002",
                                    "name_en": "Extra Bread",
                                    "name_am": "ተጨማሪ ዳቦ",
                                    "price_santim": 500
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}
```

**Error responses:**

| Status | Code                       | Meaning                                          |
| ------ | -------------------------- | ------------------------------------------------ |
| 401    | `INVALID_SIGNATURE`        | Request signature failed verification            |
| 403    | `RESTAURANT_NOT_CONNECTED` | Restaurant has not connected your platform       |
| 404    | `RESTAURANT_NOT_FOUND`     | Unknown restaurant slug                          |
| 429    | `RATE_LIMITED`             | Exceeded 60 menu fetches per restaurant per hour |

**Caching guidance:** Cache the menu response for 5 minutes. Do not poll more frequently than once per minute. lole sends a `restaurant.menu_updated` webhook whenever the menu changes — use that to invalidate your cache rather than polling.

---

### POST /orders

Submit a delivery order to a connected restaurant.

**Request body:**

```json
{
    "restaurant_slug": "cafe-lucia",
    "partner_order_id": "beU-20260307-004821",
    "estimated_pickup_at": "2026-03-07T19:15:00Z",
    "delivery_note": "Ring the bell twice",
    "items": [
        {
            "menu_item_id": "item-uuid-001",
            "quantity": 2,
            "unit_price_santim": 8500,
            "special_instructions": "No onion please",
            "modifiers": [
                {
                    "modifier_group_id": "mod-group-001",
                    "modifier_option_id": "mod-opt-001"
                }
            ]
        },
        {
            "menu_item_id": "item-uuid-007",
            "quantity": 1,
            "unit_price_santim": 6000,
            "special_instructions": null,
            "modifiers": []
        }
    ],
    "subtotal_santim": 23000,
    "delivery_fee_santim": 3500,
    "total_santim": 26500
}
```

**Field rules:**

- `partner_order_id`: your unique order identifier. lole uses this as an idempotency key — submitting the same `partner_order_id` twice returns the original order response without creating a duplicate.
- `unit_price_santim`: must match the price in the current lole menu. If it does not match, lole rejects the order with `PRICE_MISMATCH`.
- `estimated_pickup_at`: ISO 8601 UTC. Used to sequence the order in the kitchen queue.
- `subtotal_santim + delivery_fee_santim` must equal `total_santim`. lole validates this.
- Payment is assumed to be already collected by your platform. lole does not initiate any payment for delivery orders.

**Response `201 Created`:**

```json
{
    "lole_order_id": "uuid-of-new-order",
    "partner_order_id": "beU-20260307-004821",
    "status": "pending_confirmation",
    "restaurant_name_en": "Café Lucia",
    "estimated_ready_at": "2026-03-07T19:12:00Z",
    "created_at": "2026-03-07T18:52:00Z"
}
```

**Error responses:**

| Status | Code                       | Meaning                                     | Action                                  |
| ------ | -------------------------- | ------------------------------------------- | --------------------------------------- |
| 200    | `ORDER_ALREADY_EXISTS`     | `partner_order_id` already submitted        | Use the returned `lole_order_id`        |
| 400    | `PRICE_MISMATCH`           | `unit_price_santim` does not match menu     | Re-fetch menu and retry                 |
| 400    | `ITEM_UNAVAILABLE`         | One or more items are currently unavailable | Remove items and retry, or cancel order |
| 400    | `TOTAL_MISMATCH`           | Subtotal + fee ≠ total                      | Fix arithmetic and retry                |
| 400    | `RESTAURANT_CLOSED`        | Restaurant is outside operating hours       | Do not submit. Gate on your side.       |
| 403    | `RESTAURANT_NOT_CONNECTED` | Restaurant has not enabled your platform    | Surface in your app — not a retry case  |
| 422    | `INVALID_MODIFIER`         | Modifier option ID not valid for item       | Re-fetch menu and rebuild the order     |
| 503    | `RESTAURANT_PAUSED`        | Restaurant temporarily paused delivery      | Retry after 5 minutes                   |

---

### GET /orders/{lole_order_id}

Poll current status of an order.

```http
GET /delivery/v1/orders/uuid-here
```

**Response:**

```json
{
  "lole_order_id": "uuid-here",
  "partner_order_id": "beU-20260307-004821",
  "status": "preparing",
  "status_updated_at": "2026-03-07T18:54:00Z",
  "estimated_ready_at": "2026-03-07T19:12:00Z",
  "items": [ ... ]
}
```

**Order status values:**

| Status                 | Meaning                                | Driver action                         |
| ---------------------- | -------------------------------------- | ------------------------------------- |
| `pending_confirmation` | Submitted, awaiting kitchen acceptance | Driver en route to restaurant         |
| `confirmed`            | Kitchen accepted the order             | Driver heading to restaurant          |
| `preparing`            | Kitchen is actively preparing          | Driver approaching restaurant         |
| `ready`                | All items ready for pickup             | Driver collects immediately           |
| `picked_up`            | Your platform confirmed pickup         | — (set by you via PATCH /orders/{id}) |
| `cancelled`            | Order was cancelled                    | Driver notified by your system        |

**Do not poll more frequently than every 30 seconds.** Prefer webhook callbacks (below) over polling.

---

### PATCH /orders/{lole_order_id}

Update order status from your side (e.g., driver picked up the order).

```json
{
    "status": "picked_up",
    "picked_up_at": "2026-03-07T19:16:00Z",
    "driver_name": "Bekele A.",
    "driver_phone": "+251911000000"
}
```

**Accepted status transitions from partner:**

- `picked_up` — driver has physically collected the order from the restaurant
- `cancelled` — your platform is cancelling the order (see cancellation policy below)

---

### POST /items/availability

Mark one or more items as unavailable for delivery (86'd) without touching the dine-in menu. The restaurant can also do this from their dashboard.

```json
{
    "restaurant_slug": "cafe-lucia",
    "updates": [
        {
            "menu_item_id": "item-uuid-007",
            "available_for_delivery": false,
            "reason": "sold_out",
            "until": "2026-03-08T06:00:00Z"
        }
    ]
}
```

`until` is optional. If omitted, the item stays unavailable until manually re-enabled.

---

## Webhooks lole Sends to You

Register your webhook endpoint in the partner portal. lole sends events to this single endpoint for all restaurants you are connected to.

All webhooks are signed (see Authentication section). All webhooks expect HTTP `200` within 10 seconds. lole retries with exponential backoff on failure: 30s, 2min, 10min, 30min, 2h.

### Event: `order.confirmed`

Kitchen has accepted the order. Prepare driver dispatch.

```json
{
    "event": "order.confirmed",
    "lole_order_id": "uuid-here",
    "partner_order_id": "beU-20260307-004821",
    "restaurant_slug": "cafe-lucia",
    "estimated_ready_at": "2026-03-07T19:12:00Z",
    "confirmed_at": "2026-03-07T18:53:30Z"
}
```

### Event: `order.preparing`

Kitchen has started preparation. ETA is now reliable.

```json
{
    "event": "order.preparing",
    "lole_order_id": "uuid-here",
    "partner_order_id": "beU-20260307-004821",
    "restaurant_slug": "cafe-lucia",
    "estimated_ready_at": "2026-03-07T19:11:00Z",
    "preparing_since": "2026-03-07T18:54:00Z"
}
```

### Event: `order.ready`

All items are ready for pickup. Driver should be at the restaurant now.

```json
{
    "event": "order.ready",
    "lole_order_id": "uuid-here",
    "partner_order_id": "beU-20260307-004821",
    "restaurant_slug": "cafe-lucia",
    "ready_at": "2026-03-07T19:10:00Z"
}
```

### Event: `order.cancelled`

Order was cancelled by the restaurant (kitchen cannot fulfill it).

```json
{
    "event": "order.cancelled",
    "lole_order_id": "uuid-here",
    "partner_order_id": "beU-20260307-004821",
    "restaurant_slug": "cafe-lucia",
    "cancelled_by": "restaurant",
    "reason": "item_unavailable",
    "cancelled_at": "2026-03-07T18:55:00Z"
}
```

On receiving this event: refund the customer, notify the driver, remove from your order queue.

### Event: `restaurant.menu_updated`

The restaurant updated their menu. Invalidate your cache and re-fetch.

```json
{
    "event": "restaurant.menu_updated",
    "restaurant_slug": "cafe-lucia",
    "updated_at": "2026-03-07T15:00:00Z",
    "changes": ["price_change", "item_added"]
}
```

`changes` is informational. Always re-fetch the full menu regardless of change type.

### Event: `item.availability_changed`

An item was marked available or unavailable for delivery.

```json
{
    "event": "item.availability_changed",
    "restaurant_slug": "cafe-lucia",
    "menu_item_id": "item-uuid-007",
    "name_en": "Shiro Wat",
    "available_for_delivery": false,
    "until": "2026-03-08T06:00:00Z",
    "changed_at": "2026-03-07T18:45:00Z"
}
```

### Event: `restaurant.paused_delivery`

Restaurant has temporarily paused all delivery orders (e.g., too busy).

```json
{
    "event": "restaurant.paused_delivery",
    "restaurant_slug": "cafe-lucia",
    "paused_until": "2026-03-07T20:00:00Z",
    "reason": "kitchen_overloaded",
    "paused_at": "2026-03-07T18:30:00Z"
}
```

Stop accepting new orders for this restaurant until `paused_until` or until you receive `restaurant.resumed_delivery`.

---

## Cancellation Policy

### Partner-initiated cancellation

```
Cancellation window: up to 90 seconds after order submission (status = pending_confirmation)
After 90 seconds: cancellation requires restaurant approval

To cancel:
  PATCH /delivery/v1/orders/{lole_order_id}
  { "status": "cancelled", "reason": "customer_request" | "driver_unavailable" | "other" }

If the order is already "preparing" or "ready":
  → Returns 409 CONFLICT
  → Contact the restaurant directly via Telegram
  → lole does not enforce cancellation after kitchen has started — the restaurant decides
```

### Restaurant-initiated cancellation

When a restaurant cancels via lole (e.g., item sold out after order accepted), you receive `order.cancelled` webhook. Refund the customer immediately. lole is not responsible for customer refunds — that is your platform's responsibility.

---

## Rate Limits

All limits are per `lole_PARTNER_ID` across all restaurants.

| Endpoint                 | Limit        | Window                  | Burst    |
| ------------------------ | ------------ | ----------------------- | -------- |
| GET /menu                | 60 requests  | per restaurant per hour | 10 burst |
| POST /orders             | 300 requests | per minute              | 30 burst |
| GET /orders/{id}         | 600 requests | per minute              | —        |
| PATCH /orders/{id}       | 120 requests | per minute              | —        |
| POST /items/availability | 60 requests  | per minute              | —        |

Rate limit headers are included in every response:

```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 287
X-RateLimit-Reset: 1741305660
```

On `429 Too Many Requests`: wait until `X-RateLimit-Reset` timestamp before retrying.

---

## Sandbox Environment

Use the sandbox to build and test your integration without affecting real restaurants.

```
Sandbox base URL:     https://sandbox.api.lole.app/delivery/v1
Sandbox restaurant:   restaurant_slug = "lole-demo-restaurant"
Sandbox credentials:  Issued separately from production credentials

Sandbox behaviours:
  → Orders are never sent to a real KDS
  → Webhook events are simulated: POST /sandbox/simulate/{event_type}
  → Menu is fixed (does not change between tests)
  → Signature verification is enforced (same as production)
  → Rate limits are relaxed (1000 req/min on all endpoints)
```

### Simulating webhook events in sandbox

```bash
# Simulate order.ready webhook for a test order
curl -X POST https://sandbox.api.lole.app/delivery/v1/sandbox/simulate/order.ready \
  -H "X-lole-Partner-ID: $SANDBOX_PARTNER_ID" \
  -H "X-lole-Timestamp: $(date +%s)" \
  -H "X-lole-Signature: $COMPUTED_SIG" \
  -H "Content-Type: application/json" \
  -d '{ "lole_order_id": "sandbox-order-uuid-001" }'
```

lole will send the `order.ready` event to your registered webhook endpoint immediately.

---

## Integration Checklist

Complete every item before requesting production credential activation.

```
Authentication
[ ] Signature generation tested with all three reference implementations (TS, Python, + your language)
[ ] Webhook signature verification implemented using raw body (not parsed JSON)
[ ] Timestamp replay attack check implemented (reject if > 300 seconds old)
[ ] lole_PARTNER_SECRET stored in secret manager (not in code or .env in repo)

Menu
[ ] GET /menu tested in sandbox with demo restaurant
[ ] Menu cache implemented (5-minute TTL minimum)
[ ] restaurant.menu_updated webhook received and cache invalidated correctly
[ ] item.availability_changed webhook removes item from ordering UI correctly
[ ] operating_hours read and ordering gated when restaurant is closed

Order submission
[ ] POST /orders tested with single item, multiple items, and items with modifiers
[ ] partner_order_id idempotency tested (same ID submitted twice → same order returned)
[ ] PRICE_MISMATCH error handled (re-fetch menu and retry)
[ ] ITEM_UNAVAILABLE error handled (remove item, notify customer)
[ ] RESTAURANT_CLOSED error handled (do not submit, gate on your side)
[ ] RESTAURANT_PAUSED webhook handled (stop accepting orders until resume)

Order status
[ ] order.confirmed webhook received and driver dispatch triggered
[ ] order.ready webhook received and driver notified
[ ] order.cancelled webhook received, customer refunded, driver notified
[ ] PATCH /orders picked_up sent after driver confirms collection

Cancellation
[ ] Partner-initiated cancel tested within 90-second window
[ ] 409 CONFLICT handled when cancelling after "preparing" status

Reliability
[ ] Webhook endpoint returns 200 within 10 seconds (lole retries on failure)
[ ] Idempotent webhook processing (same event received twice → processed once)
[ ] Retry logic for transient 5xx errors from lole API (exponential backoff)
[ ] Alert configured if webhook endpoint error rate > 1%

Sandbox sign-off
[ ] Full order lifecycle tested in sandbox: submit → confirmed → preparing → ready → picked_up
[ ] Cancellation flow tested in sandbox
[ ] Menu update cycle tested in sandbox
```

---

## Support

| Topic                                      | Contact                                              |
| ------------------------------------------ | ---------------------------------------------------- |
| Integration questions, credential requests | integrations@lole.app                                |
| Production incidents                       | Telegram: @loleIntegrations (monitored 6am–11pm EAT) |
| Security vulnerabilities                   | security@lole.app — do not disclose publicly         |
| SLA disputes                               | support@lole.app with incident timeline              |

**Partner SLA:** lole guarantees 99.5% uptime on the delivery API, measured monthly. Planned maintenance windows are communicated 48 hours in advance via email to the registered partner contact.

---

_lole Delivery Partner Integration Guide v1.0 · March 2026 · Confidential — Shared Under NDA_
