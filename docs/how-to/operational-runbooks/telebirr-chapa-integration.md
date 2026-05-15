# Telebirr & Chapa Integration Issues Runbook

**Version 1.0 · March 2026 · For the Builder**

> This runbook covers troubleshooting and resolution procedures for Telebirr and Chapa payment integration issues in lole.

---

## Overview

lole integrates with two primary payment providers for the Ethiopian market:

| Provider     | Type                  | Use Case                                        |
| ------------ | --------------------- | ----------------------------------------------- |
| **Telebirr** | QR-based mobile money | Primary - most popular in Ethiopia              |
| **Chapa**    | Card + Bank transfers | Secondary - international cards, bank transfers |

This runbook addresses common integration issues and their resolution.

---

## Integration Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   lole    │────▶│   Payment   │────▶│  Telebirr/  │
│   App       │     │   Service   │     │  Chapa API  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   ▼                   ▼
       │           ┌─────────────┐     ┌─────────────┐
       │           │   Webhook   │◀────│   Callback  │
       │           │   Handler   │     │   Handler   │
       │           └─────────────┘     └─────────────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌─────────────┐
│   Payment   │     │   Order     │
│   Records   │     │   Status    │
└─────────────┘     └─────────────┘
```

---

## Telebirr Integration Issues

### Issue: QR Code Generation Fails

**Symptoms:**

- "Failed to generate QR code" error
- Payment initiation returns 500
- No QR code displayed on screen

**Diagnosis:**

```bash
# Check Telebirr API connectivity
curl -v $TELEBIRR_API_BASE_URL/health

# Verify credentials
echo "APP_ID: ${TELEBIRR_FABRIC_APP_ID:0:8}..."
echo "MERCHANT_CODE: $TELEBIRR_MERCHANT_CODE"

# Check recent payment attempts
curl https://lole.app/api/admin/payments/recent-failures?provider=telebirr
```

**Resolution:**

1. **Verify credentials:**

    ```bash
    # Test authentication
    curl -X POST $TELEBIRR_API_BASE_URL/api/v1/auth/token \
      -H "Content-Type: application/json" \
      -d "{\"appId\": \"$TELEBIRR_FABRIC_APP_ID\", \"appSecret\": \"$TELEBIRR_APP_SECRET\"}"
    ```

2. **Check certificate validity:**

    ```bash
    # Verify private key
    openssl rsa -in $TELEBIRR_PRIVATE_KEY_PATH -check -noout

    # Check key expiration if applicable
    openssl x509 -in certificate.pem -noout -dates 2>/dev/null || echo "No certificate file"
    ```

3. **Verify request signing:**
    ```typescript
    // Check signature generation in src/lib/payments/telebirr.ts
    // Ensure timestamp format matches Telebirr requirements
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    ```

### Issue: Payment Verification Fails

**Symptoms:**

- Payment completed on Telebirr app but order not confirmed
- Webhook not received
- Payment status stuck in "pending"

**Diagnosis:**

```sql
-- Find pending Telebirr payments
SELECT id, order_id, amount, status, created_at, metadata
FROM payments
WHERE provider = 'telebirr'
AND status = 'pending'
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check webhook logs
SELECT *
FROM audit_logs
WHERE action LIKE '%telebirr%webhook%'
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Resolution:**

1. **Manual verification:**

    ```bash
    # Verify specific transaction
    curl -X GET "$TELEBIRR_API_BASE_URL/api/v1/transaction/{transactionId}" \
      -H "Authorization: Bearer $TOKEN"
    ```

2. **Trigger manual verification:**

    ```bash
    curl -X POST https://lole.app/api/payments/verify \
      -H "Content-Type: application/json" \
      -d '{"payment_id": "<payment_id>", "provider": "telebirr"}'
    ```

3. **Check webhook configuration:**
    - Verify `TELEBIRR_WEBHOOK_SECRET` is configured
    - Check webhook URL is accessible from Telebirr servers
    - Verify webhook endpoint returns 200

### Issue: Signature Verification Fails

**Symptoms:**

- Webhook returns 401/403
- "Invalid signature" in logs
- Payments not completing

**Resolution:**

1. **Verify webhook secret:**

    ```bash
    # Check secret is configured
    echo "Webhook secret length: ${#TELEBIRR_WEBHOOK_SECRET}"

    # Should be at least 32 characters
    ```

2. **Debug signature calculation:**

    ```typescript
    // In src/lib/payments/webhooks.ts
    // Log the raw body and calculated signature
    console.debug('Webhook body:', rawBody);
    console.debug('Expected signature:', calculatedSignature);
    console.debug('Received signature:', receivedSignature);
    ```

3. **Regenerate webhook secret if compromised:**

    ```bash
    # Generate new secret
    openssl rand -hex 32

    # Update in Supabase secrets and Telebirr merchant portal
    ```

---

## Chapa Integration Issues

### Issue: Payment Initialization Fails

**Symptoms:**

- "Failed to initialize payment" error
- Checkout URL not generated
- 400/500 response from Chapa

**Diagnosis:**

```bash
# Test Chapa API
curl -X POST https://api.chapa.co/v1/transaction/initialize \
  -H "Authorization: Bearer $CHAPA_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "100",
    "currency": "ETB",
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "User",
    "tx_ref": "test-'$(date +%s)'",
    "callback_url": "https://lole.app/api/webhooks/chapa",
    "return_url": "https://lole.app/payment/return"
  }'

# Check Chapa status
curl https://api.chapa.co/v1/health
```

**Resolution:**

1. **Verify API key:**

    ```bash
    # Test key validity
    curl -H "Authorization: Bearer $CHAPA_SECRET_KEY" \
      https://api.chapa.co/v1/balance
    ```

2. **Check request format:**
    - Ensure all required fields are present
    - Verify currency is "ETB"
    - Check tx_ref is unique

3. **Verify callback URL:**
    - Must be HTTPS
    - Must be publicly accessible
    - Must return 200 for POST requests

### Issue: Callback Not Received

**Symptoms:**

- Payment completed but order not updated
- No callback logged
- Payment stuck in pending

**Diagnosis:**

```sql
-- Check recent Chapa payments
SELECT id, order_id, amount, status, metadata->>'chapa_tx_ref' as tx_ref
FROM payments
WHERE provider = 'chapa'
AND created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC;

-- Check callback logs
SELECT *
FROM audit_logs
WHERE action = 'chapa.webhook'
AND created_at > NOW() - INTERVAL '2 hours';
```

**Resolution:**

1. **Manual verification:**

    ```bash
    curl -X GET "https://api.chapa.co/v1/verify/{tx_ref}" \
      -H "Authorization: Bearer $CHAPA_SECRET_KEY"
    ```

2. **Trigger manual verification:**
    ```bash
    curl -X POST https://lole.app/api/payments/verify \
      -H "Content-Type: application/json" \
      -d '{"tx_ref": "<tx_ref>", "provider": "chapa"}'
    ```

### Issue: Test Mode vs Production Mode

**Symptoms:**

- Payments work in test but not production
- Different behavior between environments

**Resolution:**

1. **Verify environment variables:**

    ```bash
    # Check which keys are configured
    echo "Chapa key prefix: ${CHAPA_SECRET_KEY:0:10}..."

    # Test keys start with "CHASECK_TEST_"
    # Production keys start with "CHASECK_"
    ```

2. **Switch modes properly:**
    - Update `CHAPA_SECRET_KEY` to production key
    - Update `CHAPA_WEBHOOK_SECRET` to production webhook secret
    - Verify callback URL in Chapa dashboard matches production

---

## Common Integration Issues

### Issue: Duplicate Payments

**Symptoms:**

- Same order has multiple payment records
- Customer charged twice

**Prevention:**

```typescript
// Always use idempotency keys
const idempotencyKey = `${orderId}-${Date.now()}`;

// Check for existing payment before creating new one
const existingPayment = await supabase
    .from('payments')
    .select('id, status')
    .eq('order_id', orderId)
    .eq('provider', provider)
    .in('status', ['pending', 'completed'])
    .single();
```

**Resolution:**

```sql
-- Find duplicate payments
SELECT order_id, COUNT(*) as payment_count
FROM payments
WHERE status = 'completed'
GROUP BY order_id
HAVING COUNT(*) > 1;

-- Refund duplicate (manual process)
-- Contact provider support for refund
```

### Issue: Currency Mismatch

**Symptoms:**

- Payment amount different from order total
- Currency conversion errors

**Resolution:**

```sql
-- Verify all amounts are in ETB
SELECT
  o.id as order_id,
  o.total_amount as order_total,
  p.amount as payment_amount,
  p.currency
FROM orders o
JOIN payments p ON p.order_id = o.id
WHERE o.total_amount != p.amount
OR p.currency != 'ETB';
```

---

## Monitoring and Alerts

### Health Check Endpoints

```bash
# Check all payment providers
curl https://lole.app/api/health

# Check specific provider
curl https://lole.app/api/health/telebirr
curl https://lole.app/api/health/chapa
```

### Key Metrics to Monitor

| Metric                             | Alert Threshold     |
| ---------------------------------- | ------------------- |
| Payment initiation failure rate    | > 5% over 5 minutes |
| Webhook verification failure rate  | > 3% over 5 minutes |
| Average payment processing time    | > 10 seconds        |
| Pending payments older than 10 min | > 10 payments       |

### Alert Configuration

```yaml
# Example alerting rules
alerts:
    - name: payment_failure_spike
      condition: payment_failure_rate > 0.05
      duration: 5m
      severity: warning
      channels: [slack, pagerduty]

    - name: webhook_backlog
      condition: pending_webhooks > 50
      severity: warning
      channels: [slack]
```

---

## Testing Procedures

### Test Payment Flow

```bash
# 1. Test Telebirr QR generation
curl -X POST https://lole.app/api/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "telebirr",
    "amount": 1,
    "order_id": "test-order-id",
    "idempotency_key": "test-'$(date +%s)'"
  }'

# 2. Test Chapa initialization
curl -X POST https://lole.app/api/payments/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "chapa",
    "amount": 1,
    "order_id": "test-order-id",
    "email": "test@example.com",
    "idempotency_key": "test-'$(date +%s)'"
  }'

# 3. Test webhook handling
curl -X POST https://lole.app/api/webhooks/telebirr \
  -H "Content-Type: application/json" \
  -H "X-Telebirr-Signature: test-signature" \
  -d '{"test": true}'
```

---

## Credential Management

### Required Credentials

| Credential              | Environment Variable      | Rotation Frequency |
| ----------------------- | ------------------------- | ------------------ |
| Telebirr App ID         | `TELEBIRR_FABRIC_APP_ID`  | Annual             |
| Telebirr App Secret     | `TELEBIRR_APP_SECRET`     | Quarterly          |
| Telebirr Private Key    | `TELEBIRR_PRIVATE_KEY`    | Annual             |
| Telebirr Webhook Secret | `TELEBIRR_WEBHOOK_SECRET` | Quarterly          |
| Chapa Secret Key        | `CHAPA_SECRET_KEY`        | Quarterly          |
| Chapa Webhook Secret    | `CHAPA_WEBHOOK_SECRET`    | Quarterly          |

### Credential Rotation Procedure

1. Generate new credentials in provider portal
2. Update secrets in Supabase/Vercel
3. Deploy with new credentials
4. Verify payments still work
5. Revoke old credentials

---

## Incident Record Template

```markdown
## Payment Integration Incident

**Date:** YYYY-MM-DD
**Provider:** [Telebirr/Chapa]
**Duration:** X minutes
**Severity:** [Sev1/Sev2/Sev3]

### Timeline

- HH:MM - Issue detected
- HH:MM - Root cause identified
- HH:MM - Fix applied
- HH:MM - Verified working

### Impact

- Number of failed payments: X
- Revenue impact: ETB X
- Affected restaurants: X

### Root Cause

[Technical explanation]

### Resolution

[Steps taken]

### Follow-ups

- [ ] [Action item] - Owner - Due date
```

---

## Contacts and Escalation

| Role                     | Contact            | Escalation Time |
| ------------------------ | ------------------ | --------------- |
| On-call Engineer         | PagerDuty          | Immediate       |
| Payment Integration Lead | @payments-lead     | 10 minutes      |
| Telebirr Support         | [merchant support] | As available    |
| Chapa Support            | support@chapa.co   | As available    |

---

## Related Documents

- [Payment Gateway Outages Runbook](./payment-gateway-outages.md)
- [Disaster Recovery Plan](../05-infrastructure/disaster-recovery.md)
- [API Documentation](../api/endpoints.md)
- [Security Endpoint Checklist](../02-security/security-endpoint-checklist.md)
