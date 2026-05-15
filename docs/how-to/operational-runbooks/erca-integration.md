# ERCA Integration Runbook

**Version 1.0 · April 2026**

> This runbook covers operational procedures for the ERCA (Ethiopian Revenue and Customs Authority) integration in lole.

---

## Overview

The ERCA integration provides automated VAT compliance for Ethiopian restaurants:

- **VAT Rate**: 15% (tax-inclusive pricing)
- **Invoice Submission**: Real-time to ERCA API
- **Retention Period**: 7 years minimum
- **Compliance**: Ethiopian VAT Regulation 2016

### Key Components

| Component              | Location                                       | Purpose                    |
| ---------------------- | ---------------------------------------------- | -------------------------- |
| ERCA Service           | `src/lib/fiscal/erca-service.ts`               | Core integration logic     |
| MoR Client             | `src/lib/fiscal/mor-client.ts`                 | Fiscal printer integration |
| ERCA Submissions Table | `supabase/migrations/..._erca_submissions.sql` | Audit trail storage        |
| Job Handler            | `src/app/api/jobs/erca/submit/route.ts`        | QStash job processor       |

---

## Configuration

### Environment Variables

```bash
# Required for production
ERCA_API_URL=https://api.erca.gov.et/v1
ERCA_API_KEY=<your-api-key>

# Optional
ERCA_SANDBOX_MODE=false          # Set to true for testing
ERCA_CERTIFICATE_PATH=/path/cert # For digital signatures
```

### Restaurant Setup

For a restaurant to use ERCA integration:

1. Navigate to `/merchant/settings` → Tax & Compliance
2. Enter:
    - **TIN Number**: Taxpayer Identification Number (e.g., `0014-XXXX-XXXXX`)
    - **VAT Registration Number**: VAT certificate number (e.g., `VAT-XXXX-XXXX`)
    - **Legal Business Name**: Registered name in English
    - **Legal Business Name (Amharic)**: Registered name in Amharic

3. When `vat_number` is set, ERCA integration is automatically enabled

---

## VAT Calculation

### Tax-Inclusive Pricing

Ethiopian law requires VAT to be included in displayed prices. lole extracts VAT from the total:

```typescript
// Price displayed to customer: 115 ETB (tax-inclusive)
// VAT portion: 115 × (15/115) = 15 ETB
// Net price: 115 - 15 = 100 ETB

function extractVAT(taxInclusivePriceSantim: number) {
    const vatPortionSantim = Math.round((taxInclusivePriceSantim * 15) / 115);
    const netPriceSantim = taxInclusivePriceSantim - vatPortionSantim;
    return { netPriceSantim, vatPortionSantim };
}
```

### Invoice Number Format

```
{RESTAURANT_PREFIX}-{ORDER_NUMBER}

Example: ABCD1234-0042
- Restaurant ID prefix: First 8 characters of restaurant UUID
- Order number: Sequential order number
```

---

## Invoice Submission Flow

```
Order completed (status → 'served')
        │
        ▼
Check restaurant.vat_number IS NOT NULL
        │
        ├── NULL → Skip (not VAT-registered)
        │
        └── EXISTS → Continue
                │
                ▼
        Check for existing submission
                │
                ├── EXISTS → Return (idempotent)
                │
                └── NOT EXISTS → Build payload
                        │
                        ▼
                Submit to ERCA API
                        │
                        ├── Success → Record in erca_submissions
                        │
                        └── Failure → Record failure, throw for retry
```

---

## Monitoring & Alerting

### Key Metrics

| Metric                  | Threshold                       | Action                 |
| ----------------------- | ------------------------------- | ---------------------- |
| Submission failure rate | > 5%                            | Alert ops team         |
| Pending submissions age | > 1 hour                        | Check ERCA API status  |
| Daily submission count  | 0 for VAT-registered restaurant | Alert - possible issue |

### Health Check Endpoint

```bash
GET /api/health/ready

# Check ERCA connectivity
curl -X GET https://api.erca.gov.et/v1/health \
  -H "Authorization: Bearer $ERCA_API_KEY"
```

### Dashboard

Navigate to `/merchant/finance` → ERCA Compliance tab to view:

- Daily/monthly invoice submission status
- Failed submissions with retry button
- Monthly VAT report download
- Running VAT liability total

---

## Troubleshooting

### Common Issues

#### 1. ERCA API Unavailable

**Symptoms**: High failure rate, network errors in logs

**Resolution**:

1. Check ERCA API status page
2. Verify network connectivity from Vercel/AWS
3. Submissions will auto-retry via QStash (5 retries over 2 hours)
4. If persistent, enable stub mode temporarily:
    ```bash
    vercel env add ERCA_SANDBOX_MODE true
    ```

#### 2. Invalid TIN Number

**Symptoms**: "Invalid TIN" error from ERCA

**Resolution**:

1. Verify TIN format: `XXXX-XXXX-XXXXX`
2. Check TIN is registered with ERCA
3. Update restaurant settings with correct TIN

#### 3. Duplicate Invoice Numbers

**Symptoms**: "Invoice already exists" error

**Resolution**:

1. Check `erca_submissions` table for existing entry
2. If submission exists with status 'success', no action needed
3. If status 'failed', use retry endpoint:
    ```bash
    POST /api/jobs/erca/retry
    { "submissionId": "<uuid>" }
    ```

#### 4. Missing VAT Number

**Symptoms**: Invoices not being submitted

**Resolution**:

1. Check restaurant.vat_number is set
2. If null, restaurant is not VAT-registered - expected behavior
3. If should be registered, update restaurant settings

### Manual Retry

For failed submissions:

```bash
# Via API
POST /api/jobs/erca/retry
{
  "submissionId": "uuid-of-failed-submission"
}

# Via SQL (direct database)
UPDATE erca_submissions
SET status = 'retry', retry_count = retry_count + 1
WHERE id = 'uuid-of-failed-submission';
```

### Manual Submission

If automatic submission fails completely:

1. Generate invoice manually:

    ```typescript
    import { getERCAService } from '@/lib/fiscal/erca-service';

    const ercaService = getERCAService();
    await ercaService.submitInvoice('order-uuid');
    ```

2. Or submit directly to ERCA portal as fallback

---

## Daily Operations

### Morning Checklist

1. Check overnight submission status:

    ```sql
    SELECT status, COUNT(*)
    FROM erca_submissions
    WHERE submitted_at >= CURRENT_DATE - INTERVAL '1 day'
    GROUP BY status;
    ```

2. Review failed submissions:
    ```sql
    SELECT id, order_id, invoice_number, error_message, created_at
    FROM erca_submissions
    WHERE status = 'failed'
    ORDER BY created_at DESC
    LIMIT 10;
    ```

### End-of-Day Report

The EOD report (sent at 19:00 UTC = 10 PM Addis) includes:

```
📊 VAT Summary for DD/MM/YYYY
Invoices submitted: XX
Total revenue (incl. VAT): X,XXX.XX ብር
VAT collected: XXX.XX ብር
✅ All invoices submitted to ERCA
```

---

## Monthly Operations

### VAT Report Generation

Generate monthly report for accountant:

```typescript
import { getERCAService } from '@/lib/fiscal/erca-service';

const ercaService = getERCAService();
const report = await ercaService.generateMonthlyVATReport(
    'restaurant-uuid',
    2026,
    4 // April
);

console.log(report);
// {
//   restaurant_id: '...',
//   period: { year: 2026, month: 4 },
//   total_invoices: 450,
//   total_revenue_etb: '125000.00',
//   total_vat_etb: '16304.35',
//   daily_summaries: [...]
// }
```

### Data Retention

ERCA submissions are retained for 7 years per Ethiopian law:

- No automatic deletion
- Archive older records to cold storage if needed
- Ensure backup includes `erca_submissions` table

---

## Security Considerations

### API Key Management

- Store `ERCA_API_KEY` in Vercel encrypted environment variables
- Never log API keys
- Rotate keys annually or if compromised

### Data Privacy

- `erca_submissions` contains financial data
- RLS policies restrict access to restaurant staff
- Service role has full access for job processing

### Audit Trail

All submissions are logged with:

- Timestamp
- Invoice number
- VAT amount
- ERCA response
- Error details (if failed)

---

## Emergency Procedures

### ERCA API Outage

1. **Immediate**: Monitor submission queue depth
2. **Short-term**: QStash will retry automatically
3. **Extended outage** (>4 hours):
    - Enable stub mode for new submissions
    - Manual batch submission when API restored

### Data Corruption

1. Stop new submissions:

    ```sql
    -- Prevent new submissions temporarily
    ALTER TABLE erca_submissions DISABLE TRIGGER ALL;
    ```

2. Restore from backup
3. Re-enable and verify:
    ```sql
    ALTER TABLE erca_submissions ENABLE TRIGGER ALL;
    ```

### Compliance Audit

If ERCA requests audit data:

1. Export submissions for requested period:

    ```sql
    SELECT *
    FROM erca_submissions
    WHERE restaurant_id = 'requested-restaurant'
    AND submitted_at BETWEEN 'start-date' AND 'end-date'
    ORDER BY submitted_at;
    ```

2. Generate PDF report via `/merchant/finance` → Export

---

## Contact & Support

- **ERCA Helpdesk**: +251-11-XXX-XXXX
- **lole Support**: support@lole.et
- **Internal Escalation**: #ops channel on Slack

---

## Changelog

| Date       | Version | Changes                   |
| ---------- | ------- | ------------------------- |
| 2026-04-05 | 1.0     | Initial runbook (MED-024) |
