# KDS Printer Bridge Webhook Contract

Event: `kds.ticket.print.v1`

This endpoint is called by lole when KDS printer fallback dispatches to `print_policy.provider = webhook`.

## Request

- Method: `POST`
- Content-Type: `application/json`

### Headers

- `x-lole-event`: `kds.ticket.print.v1`
- `x-lole-event-id`: UUID event id
- `x-lole-idempotency-key`: UUID idempotency key (same as event id)
- `x-lole-signature-version`: `v1`
- `x-lole-signature-timestamp`: ISO-8601 timestamp
- `x-lole-signature-nonce`: UUID nonce
- `x-lole-body-sha256`: hex SHA-256 hash of raw request body
- `x-lole-signature-sha256`: hex HMAC-SHA256 signature
- `x-lole-attempt`: attempt number (`1..max_attempts`)

### Body

```json
{
    "event": "kds.ticket.print.v1",
    "event_id": "uuid",
    "occurred_at": "2026-03-01T18:00:00.000Z",
    "idempotency_key": "uuid",
    "copies": 1,
    "payload": {
        "restaurantId": "uuid",
        "orderId": "uuid",
        "orderNumber": "ORD-123",
        "tableNumber": "T-10",
        "firedAt": "2026-03-01T18:00:00.000Z",
        "reason": "manual_kds_print",
        "items": [
            {
                "name": "Doro Wat",
                "quantity": 1,
                "station": "kitchen",
                "notes": "extra spicy",
                "status": "queued"
            }
        ]
    }
}
```

## Signature Verification

Shared secret: `KDS_PRINTER_WEBHOOK_SECRET` (fallback: `HMAC_SECRET`).

1. Compute `body_sha256 = sha256(raw_body_bytes).hex`.
2. Verify it equals `x-lole-body-sha256`.
3. Compute canonical string:

`v1.{x-lole-signature-timestamp}.{x-lole-signature-nonce}.{x-lole-body-sha256}`

4. Compute expected signature:

`hmac_sha256(secret, canonical).hex`

5. Compare with `x-lole-signature-sha256` using constant-time comparison.

## Idempotency and Retries

- Deduplicate by `x-lole-idempotency-key` (or `event_id`).
- lole retries with exponential backoff + jitter for retryable failures:
    - HTTP `408`, `409`, `425`, `429`, and `5xx`
    - network/timeouts
- Non-retryable: other `4xx`.

## Expected Response

- Success: any `2xx`.
- Failure:
    - retryable: return `429` or `5xx`
    - non-retryable: return `4xx` (except retryable list above)
