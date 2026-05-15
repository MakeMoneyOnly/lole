# Payment Gateway Outages Runbook

**Version 1.0 · March 2026 · For the Builder**

> This runbook covers the detection, response, and recovery procedures for payment gateway outages affecting Telebirr, Chapa, and other payment providers in lole.

---

## Overview

lole integrates with multiple payment providers for the Ethiopian market:

- **Telebirr** - QR-based mobile money (primary)
- **Chapa** - Card and bank transfers (secondary)
- **Cash** - Always available fallback

This runbook ensures business continuity when payment providers experience outages.

---

## Payment Provider Status Monitoring

### Real-time Status Checks

| Provider      | Status Page                 | API Health Endpoint   |
| ------------- | --------------------------- | --------------------- |
| Telebirr      | No public page              | Internal health check |
| Chapa         | https://chapa.co/status     | `/api/health/chapa`   |
| Supabase (DB) | https://status.supabase.com | `/api/health`         |

### Internal Health Monitoring

```bash
# Check all payment provider health
curl https://lole.app/api/health

# Check specific provider
curl https://lole.app/api/health/telebirr
curl https://lole.app/api/health/chapa
```

---

## Outage Detection

### Automated Alerts

The system monitors payment failures and triggers alerts when:

- Payment initiation failure rate > 10% over 5 minutes
- Webhook verification failures > 5% over 5 minutes
- Provider API timeout rate > 15%

### Manual Detection Signs

- Customer complaints about payment failures
- Spike in "Payment Failed" errors in Sentry
- Payment status stuck in "pending" for > 5 minutes
- Webhook queue backlog in QStash

---

## Response Procedures

### Telebirr Outage

**Severity Assessment:**

- **Sev2** if during peak hours (12-2 PM, 7-9 PM EAT)
- **Sev3** if during off-peak hours

**Immediate Response:**

1. **Verify the outage:**

    ```bash
    # Test Telebirr API connectivity
    curl -X POST $TELEBIRR_API_BASE_URL/api/v1/merchant/order
    ```

2. **Check Telebirr status channels:**
    - Ethio Telecom social media
    - Local tech community reports

3. **Activate fallback protocol:**

    ```
    Step 1 — COMMUNICATE (2 min)
      Telegram to affected restaurants:
      "Telebirr አጭር ጊዜ የማይሰራ ሊሆን ይችላል። እባክዎ ጥሬ ገንዘብ ወይም Chapa ይጠቀሙ።"
      "Telebirr may be temporarily unavailable. Please use cash or Chapa."

    Step 2 — ENABLE FALLBACK (1 min)
      Dashboard → Restaurant Settings → Payment Methods
      - Ensure "Cash" is enabled
      - Ensure "Chapa" is enabled (if not already)

    Step 3 — MONITOR (ongoing)
      Watch for recovery signals
      Test payment initiation every 5 minutes
    ```

4. **Queue retry for pending payments:**

    ```sql
    -- Find stuck pending Telebirr payments
    SELECT id, order_id, created_at
    FROM payments
    WHERE provider = 'telebirr'
    AND status = 'pending'
    AND created_at < NOW() - INTERVAL '5 minutes';

    -- Mark for retry (handled by QStash job)
    UPDATE payments
    SET metadata = jsonb_set(metadata, '{retry_after}', to_jsonb(NOW() + INTERVAL '1 hour'))
    WHERE provider = 'telebirr'
    AND status = 'pending'
    AND created_at < NOW() - INTERVAL '5 minutes';
    ```

---

### Chapa Outage

**Severity Assessment:**

- **Sev3** - Chapa is secondary provider, Telebirr and cash remain available

**Immediate Response:**

1. **Verify the outage:**

    ```bash
    # Test Chapa API
    curl https://api.chapa.co/v1/transaction/initialize
    ```

2. **Check Chapa status:**
    - https://chapa.co/status
    - Chapa Twitter/X account

3. **Activate fallback:**

    ```
    Step 1 — COMMUNICATE (2 min)
      "Chapa ሊፈታ አልቻለም። Telebirr ወይም ጥሬ ገንዘብ ይጠቀሙ።"
      "Chapa is temporarily unavailable. Please use Telebirr or cash."

    Step 2 — MONITOR
      Check Chapa status page every 5 minutes
    ```

---

### All Payment Providers Down

**Severity:** **Sev1** - Critical business impact

**Immediate Response:**

1. **Activate cash-only mode:**

    ```
    Step 1 — COMMUNICATE (immediate)
      Telegram broadcast to ALL restaurants:
      "የክፍያ ስርዓት ችግር! ጥሬ ገንዘብ ብቻ ይቀበሉ።"
      "PAYMENT SYSTEM ISSUE! Accept CASH ONLY."

    Step 2 — VERIFY CASH OPERATIONS
      - POS continues to work offline
      - Orders queue locally and sync when connection restores
      - KDS continues normal operation

    Step 3 — ESCALATE
      - Notify engineering lead immediately
      - Open incident channel in Slack/Telegram
      - Begin incident documentation
    ```

2. **Data integrity protection:**
    ```sql
    -- Monitor for orphaned payments
    SELECT p.id, p.order_id, p.status, p.created_at
    FROM payments p
    LEFT JOIN orders o ON o.id = p.order_id
    WHERE p.status = 'pending'
    AND p.created_at < NOW() - INTERVAL '10 minutes'
    ORDER BY p.created_at DESC;
    ```

---

## Recovery Procedures

### Provider Recovery

When a payment provider comes back online:

1. **Verify recovery:**

    ```bash
    # Test payment initiation with small amount
    curl -X POST https://lole.app/api/payments/test-initiate \
      -H "Content-Type: application/json" \
      -d '{"provider": "telebirr", "amount": 1}'
    ```

2. **Process queued payments:**

    ```bash
    # Trigger retry job for pending payments
    curl -X POST https://lole.app/api/admin/retry-pending-payments
    ```

3. **Communicate recovery:**
    ```
    "የክፍያ ስርዓት ተስተካክሏል! ሁሉም የክፍያ ዘዴዎች ይገኛሉ።"
    "Payment system restored! All payment methods are available."
    ```

### Reconciliation

After any payment outage, run reconciliation:

```sql
-- Find orders with missing payments
SELECT o.id, o.order_number, o.total_amount, o.status
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id
WHERE o.status IN ('confirmed', 'preparing', 'ready', 'completed')
AND p.id IS NULL
AND o.created_at > NOW() - INTERVAL '4 hours';

-- Find payments without corresponding orders
SELECT p.id, p.order_id, p.amount, p.status
FROM payments p
LEFT JOIN orders o ON o.id = p.order_id
WHERE o.id IS NULL
AND p.created_at > NOW() - INTERVAL '4 hours';

-- Verify payment totals match order totals
SELECT
    o.id as order_id,
    o.order_number,
    o.total_amount as order_total,
    COALESCE(SUM(p.amount), 0) as payment_total,
    o.total_amount - COALESCE(SUM(p.amount), 0) as discrepancy
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id AND p.status = 'completed'
WHERE o.created_at > NOW() - INTERVAL '24 hours'
GROUP BY o.id, o.order_number, o.total_amount
HAVING o.total_amount != COALESCE(SUM(p.amount), 0);
```

---

## Webhook Failure Handling

### Missed Webhooks

When webhooks fail, payments may be completed but not marked:

1. **Check provider dashboard:**
    - Telebirr merchant portal
    - Chapa dashboard

2. **Manual verification:**

    ```bash
    # Verify specific payment with provider
    curl https://lole.app/api/payments/verify/{payment_id}
    ```

3. **Batch verification:**
    ```bash
    # Verify all pending payments older than 10 minutes
    curl -X POST https://lole.app/api/payments/batch-verify \
      -H "Content-Type: application/json" \
      -d '{"older_than_minutes": 10}'
    ```

---

## Prevention Measures

### Redundancy

- Multiple payment providers configured
- Automatic fallback to cash
- Offline order queueing

### Monitoring

- Real-time payment success rate dashboard
- Alert on provider-specific failure rates
- Webhook delivery monitoring

### Testing

- Weekly payment provider health checks
- Monthly failover drills
- Quarterly full outage simulation

---

## Incident Record Template

```markdown
## Payment Outage Incident

**Date:** YYYY-MM-DD
**Duration:** X minutes
**Provider(s) Affected:** [Telebirr/Chapa/All]
**Severity:** [Sev1/Sev2/Sev3]

### Timeline

- HH:MM - Outage detected via [alert/user report]
- HH:MM - Confirmed provider issue
- HH:MM - Fallback activated
- HH:MM - Provider recovered
- HH:MM - All systems normal

### Impact

- Number of affected orders: X
- Revenue impact: ETB X
- Number of affected restaurants: X

### Root Cause

[Provider's explanation]

### Actions Taken

1. [Action 1]
2. [Action 2]

### Follow-ups

- [ ] [Action item] - Owner - Due date
```

---

## Contacts and Escalation

| Role             | Contact                    | Escalation Time |
| ---------------- | -------------------------- | --------------- |
| On-call Engineer | PagerDuty rotation         | Immediate       |
| Engineering Lead | @engineering-lead          | 10 minutes      |
| Operations Lead  | @ops-lead                  | 15 minutes      |
| Telebirr Support | [merchant support contact] | As available    |
| Chapa Support    | support@chapa.co           | As available    |

---

## Related Documents

- [Disaster Recovery Plan](../05-infrastructure/disaster-recovery.md)
- [Incident Triage Rubric](./incident-triage-rubric.md)
- [Engineering Runbook](../01-foundation/engineering-runbook.md)
