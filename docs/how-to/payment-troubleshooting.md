# How to Troubleshoot Payment Issues

**Version 1.0 · May 2026 · Goal-Oriented Guide**

> This guide provides step-by-step troubleshooting for payment issues in lole, including failed transactions, webhook problems, and reconciliation errors.

---

## Overview

Payment reliability is critical for restaurant operations. This guide covers:

- Failed payment transactions
- Webhook delivery failures
- Payment status mismatches
- Refund and reconciliation issues

---

## Problem: Payment Failed During Transaction

### Diagnosis Steps

#### Step 1: Check Payment Record

```sql
-- Find the specific payment
SELECT
  p.id,
  p.order_id,
  p.amount,
  p.method,
  p.provider,
  p.status,
  p.provider_transaction_id,
  p.created_at,
  p.captured_at
FROM payments p
WHERE p.id = '<payment_id>'
OR p.provider_transaction_id = '<provider_tx_id>';
```

#### Step 2: Check Order Status

```sql
-- Verify order exists and total matches
SELECT
  o.id,
  o.order_number,
  o.total_price,
  p.amount as payment_amount
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id
WHERE o.id = '<order_id>';
```

**Amount must match exactly.** If different:

- Order was modified after payment attempt
- Order total changed due to item updates

#### Step 3: Check Provider Response

```sql
-- Get full payment error details
SELECT
  metadata->>'error_code' as error_code,
  metadata->>'error_message' as error_message,
  metadata->>'provider_response' as provider_response
FROM payments
WHERE id = '<payment_id>';
```

### Resolution

#### For Cash Payments

No processing - verify staff collected cash correctly.

#### For Telebirr Payments

```sql
-- Retry failed Telebirr payment
UPDATE payments
SET status = 'pending',
    metadata = jsonb_set(
      metadata,
      '{retry_count}',
      to_jsonb(COALESCE((metadata->>'retry_count')::INTEGER, 0) + 1)
    ),
    metadata = jsonb_set(
      metadata,
      '{last_retry_at}',
      to_jsonb(NOW())
    ),
    updated_at = NOW()
WHERE id = '<payment_id>'
AND provider = 'telebirr'
AND status = 'failed';

-- Trigger retry via QStash
SELECT http('POST', 'https://api.qstash.sh/v1/publish',
  headers => jsonb_build_object(
    'Authorization', 'Bearer ' || current_setting('app.qstash_key'),
    'Content-Type', 'application/json'
  ),
  body => jsonb_build_object(
    'url', 'https://lole.app/api/payments/retry/' || '<payment_id>',
    'delay', '60s'
  )
);
```

#### For Chapa Payments

Same process, change `provider = 'chapa'`.

---

## Problem: Payment Status Pending (Not Captured)

### Diagnosis

```sql
-- Find stuck pending payments
SELECT
  p.id,
  o.order_number,
  p.amount,
  p.provider,
  p.created_at,
  NOW() - p.created_at as age
FROM payments p
JOIN orders o ON o.id = p.order_id
WHERE p.status = 'pending'
AND p.created_at < NOW() - INTERVAL '10 minutes'
AND p.provider IN ('telebirr', 'chapa');
```

Payments pending > 10 minutes need verification.

### Resolution

#### Option A: Manual Verification

```bash
# Verify with provider directly
curl -X GET 'https://api.chapa.co/v1/transaction/verify/<tx_ref>' \
  -H 'Authorization: Bearer <CHAPA_SECRET_KEY>'

# For Telebirr (internal endpoint)
curl -X POST 'https://lole.app/api/payments/verify/<payment_id>' \
  -H 'Authorization: Bearer <INTERNAL_KEY>'
```

#### Option B: Force Capture (if provider confirms)

```sql
BEGIN;
-- Update payment to captured
UPDATE payments
SET status = 'captured',
    captured_at = NOW(),
    updated_at = NOW()
WHERE id = '<payment_id>'
AND status = 'pending';

-- Create reconciliation entry
INSERT INTO reconciliation_entries (
  id, restaurant_id, source_type, source_id,
  amount, status, reconciled_at
) VALUES (
  gen_random_uuid(),
  '<restaurant_id>',
  'payment',
  '<payment_id>',
  '<amount>',
  'reconciled',
  NOW()
);
COMMIT;
```

---

## Problem: Webhook Not Received or Processed

### Diagnosis Steps

#### Step 1: Check Webhook Logs

```sql
-- Check webhook delivery attempts
SELECT
  id,
  provider,
  payload->>'event' as event,
  payload->>'transaction_id' as transaction_id,
  status,
  response_code,
  created_at
FROM webhook_receipts
WHERE payload->>'transaction_id' = '<provider_tx_id>'
ORDER BY created_at DESC;
```

#### Step 2: Check QStash Queue

```bash
# Check for queued retries
curl 'https://api.qstash.sh/v1/messages' \
  -H 'Authorization: Bearer <QSTASH_TOKEN>'
```

#### Step 3: Check Provider Webhook Status

```bash
# Chapa webhook check
curl 'https://api.chapa.co/v1/webhooks' \
  -H 'Authorization: Bearer <CHAPA_SECRET_KEY>'

# Check specific webhook
curl 'https://lole.app/api/webhooks/status/<webhook_id>'
```

### Resolution

#### Re-process Missed Webhook

```sql
-- Find payment needing webhook processing
SELECT
  p.id,
  p.provider_transaction_id,
  p.status as payment_status
FROM payments p
WHERE p.provider_transaction_id = '<provider_tx_id>'
AND p.status = 'pending';

-- Manually trigger webhook handler
SELECT http('POST', 'https://lole.app/api/webhooks/' || '<provider>',
  headers => jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Webhook-Timestamp', NOW()::TEXT
  ),
  body => jsonb_build_object(
    'transaction_id', '<provider_tx_id>',
    'status', 'success',
    'amount', '<amount>',
    'original_request_metadata', '{}'
  )
);
```

---

## Problem: Payment Shows in Provider But Not in lole

### Diagnosis

#### Step 1: Search by Provider Transaction ID

```sql
-- Check if payment exists
SELECT
  p.id,
  p.order_id,
  p.status,
  p.provider_transaction_id
FROM payments p
WHERE p.provider_transaction_id = '<provider_tx_id>';
```

#### Step 2: Check Provider Dashboard

1. Log into Telebirr merchant portal
2. Find transaction by reference
3. Note the transaction details

### Resolution

#### Create Missing Payment Record

```sql
-- Insert payment from provider data
INSERT INTO payments (
  id, restaurant_id, order_id, amount, currency_code,
  method, provider, provider_transaction_id,
  status, captured_at, idempotency_key, created_at
) VALUES (
  gen_random_uuid(),  -- or use known ID
  '<restaurant_id>',
  '<order_id>',
  '<amount>',  -- in santim
  'ETB',
  '<method>',  -- telebirr, chapa, etc.
  '<provider>',
  '<provider_tx_id>',
  'captured',
  NOW(),
  '<unique_idempotency_key>',
  NOW()
);

-- Create reconciliation entry
INSERT INTO reconciliation_entries (
  id, restaurant_id, source_type, source_id,
  amount, status, reconciled_at
) VALUES (
  gen_random_uuid(),
  '<restaurant_id>',
  'payment',
  (SELECT id FROM payments WHERE provider_transaction_id = '<provider_tx_id>'),
  '<amount>',
  'reconciled',
  NOW()
);
```

---

## Quick Reference Commands

```sql
-- Find unreconciled payments
SELECT p.id, o.order_number, p.amount
FROM payments p
JOIN orders o ON o.id = p.order_id
LEFT JOIN reconciliation_entries re ON re.source_id = p.id
WHERE p.status = 'captured' AND re.id IS NULL;

-- Fix missing reconciliation
INSERT INTO reconciliation_entries (
  id, restaurant_id, source_type, source_id,
  amount, status, reconciled_at
)
SELECT gen_random_uuid(), p.restaurant_id, 'payment', p.id,
  p.amount, 'reconciled', p.captured_at
FROM payments p
LEFT JOIN reconciliation_entries re ON re.source_id = p.id
WHERE p.status = 'captured' AND re.id IS NULL;
```

---

## Related Documentation

- [Payment Gateway Outages Runbook](../operations/runbooks/payment-gateway-outages.md)
- [Order Troubleshooting Guide](./order-troubleshooting.md)
- [Telebirr Chapa Integration](../operations/runbooks/telebirr-chapa-integration.md)
