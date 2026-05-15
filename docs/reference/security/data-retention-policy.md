# lole — Data Retention Policy

**Version 1.0 · April 2026**

> This is an **operational document** for the lole engineering and operations team. It defines what data we retain, for how long, the legal basis for each retention period, current implementation status, and what still needs to be built. This is NOT a customer-facing document — see `privacy-policy.md` for the public version.

---

## Retention Schedule

| Data Category                   | Retention Period                    | Legal Basis                                | Implementation Status                  |
| ------------------------------- | ----------------------------------- | ------------------------------------------ | -------------------------------------- |
| ERCA-required financial records | 7 years                             | ERCA Proclamation No. 983/2016             | ✅ TimescaleDB `daily_sales` retention |
| Staff records                   | 2 years after leaving               | Ethiopian Labour Proclamation              | ❌ Not automated                       |
| Order history (operational)     | 2 years                             | Operational analytics + dispute resolution | ❌ Not automated                       |
| Guest accounts (authenticated)  | Until deletion request + 30 days    | User right to deletion                     | ❌ Not automated                       |
| Anonymous guest fingerprints    | 90 days                             | Minimum needed for session attribution     | ❌ Not automated                       |
| Sentry error logs               | 90 days                             | Debugging operational issues               | ✅ Configured in Sentry                |
| Axiom application logs          | 30 days (raw), 90 days (aggregated) | Security audit trail                       | ✅ Configured in Axiom                 |
| Cloudflare access logs          | 7 days                              | Security monitoring                        | ✅ Configured in Cloudflare            |
| Authentication audit logs       | 1 year                              | Security compliance                        | ❌ Not automated                       |
| `hourly_sales` (TimescaleDB)    | 90 days                             | Analytics performance                      | ✅ TimescaleDB retention               |
| `daily_sales` (TimescaleDB)     | 3 years (⚠️ should be 7 for ERCA)   | ERCA compliance                            | ⚠️ **MISMATCH** — needs fix            |

---

## Critical Issue: `daily_sales` Retention Mismatch

**Current state:** The TimescaleDB retention policy on `daily_sales` is set to **3 years**.
**Required by policy and ERCA:** **7 years**.

This means that daily sales data older than 3 years will be automatically dropped by TimescaleDB, creating a compliance gap. Financial records required by ERCA must be retained for 7 years.

### Fix Required

```sql
-- Remove the incorrect 3-year policy
SELECT remove_retention_policy('daily_sales');

-- Add the correct 7-year policy
SELECT add_retention_policy('daily_sales', INTERVAL '7 years');
```

**Priority: High.** This must be applied before any `daily_sales` data approaches 3 years of age. Add this to the next migration set.

---

## Implementation Details

### TimescaleDB Retention Policies (Currently Active)

```sql
-- Verify current retention policies
SELECT hypertable_name, retention_interval
FROM timescaledb_information.retention_policies;
```

Expected output after fix:

| Hypertable     | Retention Interval | Status             |
| -------------- | ------------------ | ------------------ |
| `hourly_sales` | 90 days            | ✅ Correct         |
| `daily_sales`  | 7 years            | ⚠️ Needs migration |

### Guest Fingerprint Anonymization

**Current state:** No automated job exists to anonymize guest fingerprints after 90 days. There is no cron job, no QStash scheduled task, and no database trigger implementing this policy.

The `orders.guest_fingerprint` column retains hashed device fingerprints indefinitely. Per the data-privacy policy, these must be set to `NULL` after 90 days.

### Order Archival

**Current state:** No automated archival process exists. Orders older than 2 years remain in the `orders` and `order_items` tables with no cold storage or aggregation strategy.

For the first 2 years this is not an issue. Once the platform has orders older than 2 years, the operational order data should be either moved to cold storage or aggregated into summary records, while retaining the financial/ERCA-required fields in `daily_sales`.

### Staff Record Cleanup

**Current state:** No automated cleanup of staff records 2 years after deactivation. Deactivated staff records persist indefinitely in `restaurant_staff`.

### Auth Audit Log Cleanup

**Current state:** No automated cleanup of authentication audit logs older than 1 year. These logs accumulate without a pruning mechanism.

---

## Automated Retention Jobs Needed

### 1. Guest Fingerprint Anonymization (90-day)

**Schedule:** Daily
**Implementation:** QStash scheduled message or Supabase `pg_cron` job

```sql
-- Option A: pg_cron (preferred if pg_cron extension is available)
SELECT cron.schedule(
  'anonymize-guest-fingerprints',
  '0 3 * * *',  -- 3 AM UTC daily
  $$
  UPDATE orders
  SET guest_fingerprint = NULL
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND guest_fingerprint IS NOT NULL;
  $$
);

-- Option B: Raw SQL run by QStash scheduled task
-- The QStash handler at /api/jobs/retention/fingerprints
-- would execute the same UPDATE statement
```

**Verification:**

```sql
-- Should return 0 (or near-zero if run is in progress)
SELECT COUNT(*)
FROM orders
WHERE created_at < NOW() - INTERVAL '90 days'
  AND guest_fingerprint IS NOT NULL;
```

### 2. Order Archival (2-year)

**Schedule:** Monthly
**Implementation:** QStash scheduled message calling a retention API route

**Strategy options:**

- **Option A — Aggregate and delete:** Summarize order data into existing `daily_sales` / `hourly_sales` records (already present for ERCA), then delete raw `orders` and `order_items` older than 2 years that are not tied to open disputes or legal holds
- **Option B — Move to cold storage:** Export older orders to Cloudflare R2 (Parquet format) and delete from Postgres, with a restore path if needed

**Recommended:** Option A for now. The `daily_sales` hypertable already captures the financial summary needed for ERCA compliance. Raw order details older than 2 years are primarily needed for dispute resolution, which is unlikely after 2 years.

```sql
-- Before deletion, verify daily_sales coverage
SELECT COUNT(*) AS orders_without_daily_sales
FROM orders o
WHERE o.created_at < NOW() - INTERVAL '2 years'
  AND NOT EXISTS (
    SELECT 1 FROM daily_sales ds
    WHERE ds.restaurant_id = o.restaurant_id
      AND ds.date = DATE(o.created_at)
  );

-- Only proceed with archival if count is 0
```

### 3. Staff Record Anonymization (2-year after deactivation)

**Schedule:** Monthly
**Implementation:** QStash scheduled message or `pg_cron`

```sql
UPDATE restaurant_staff
SET
  name = 'ANONYMIZED',
  pin_hash = NULL,
  email = NULL,
  phone = NULL
WHERE deactivated_at < NOW() - INTERVAL '2 years'
  AND name != 'ANONYMIZED';
```

**Note:** Requires adding a `deactivated_at TIMESTAMPTZ` column to `restaurant_staff` if not present. Currently staff deactivation may only set `is_active = false` without a timestamp.

### 4. Auth Audit Log Cleanup (1-year)

**Schedule:** Monthly
**Implementation:** `pg_cron` or QStash

```sql
DELETE FROM auth_audit_log
WHERE created_at < NOW() - INTERVAL '1 year';
```

**Note:** Replace `auth_audit_log` with the actual table name used for auth audit records. If using Supabase's built-in auth logs, retention may need to be configured differently (Supabase dashboard or support).

### 5. Fix `daily_sales` Retention (Immediate)

```sql
SELECT remove_retention_policy('daily_sales');
SELECT add_retention_policy('daily_sales', INTERVAL '7 years');
```

**This should be included in the next migration.**

---

## Verification Procedures

### Checking TimescaleDB Retention Policies

```sql
SELECT hypertable_name, retention_interval, schedule_interval
FROM timescaledb_information.retention_policies
ORDER BY hypertable_name;
```

### Checking Guest Fingerprint Anonymization

```sql
-- Count fingerprints older than 90 days that are NOT yet anonymized
SELECT COUNT(*) AS unanonymized_fingerprints
FROM orders
WHERE created_at < NOW() - INTERVAL '90 days'
  AND guest_fingerprint IS NOT NULL;
```

### Checking Data Age Distribution

```sql
-- Orders by age
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS order_count
FROM orders
GROUP BY 1
ORDER BY 1 DESC
LIMIT 24;

-- Guest fingerprints by age
SELECT
  CASE
    WHEN created_at >= NOW() - INTERVAL '90 days' THEN 'within 90 days'
    ELSE 'older than 90 days'
  END AS age_bucket,
  COUNT(*) AS total,
  COUNT(guest_fingerprint) AS with_fingerprint,
  COUNT(*) - COUNT(guest_fingerprint) AS anonymized
FROM orders
GROUP BY 1;

-- Daily_sales coverage
SELECT
  MIN(date) AS earliest_record,
  MAX(date) AS latest_record,
  COUNT(*) AS total_days
FROM daily_sales;
```

### Checking Staff Records Due for Anonymization

```sql
SELECT COUNT(*) AS staff_due_anonymization
FROM restaurant_staff
WHERE is_active = false
  AND deactivated_at < NOW() - INTERVAL '2 years'
  AND name != 'ANONYMIZED';
```

### Quarterly Audit Schedule

| Quarter | Audit Date | Responsible       | Actions                                         |
| ------- | ---------- | ----------------- | ----------------------------------------------- |
| Q1      | January 15 | Platform Engineer | Run all verification queries, document findings |
| Q2      | April 15   | Platform Engineer | Run all verification queries, document findings |
| Q3      | July 15    | Platform Engineer | Run all verification queries, document findings |
| Q4      | October 15 | Platform Engineer | Run all verification queries, document findings |

**Quarterly audit checklist:**

1. Run TimescaleDB retention policy verification query
2. Run guest fingerprint anonymization verification query — confirm count is 0 or near-0
3. Run data age distribution queries to identify any unexpected data accumulation
4. Verify `daily_sales` retention interval is still 7 years (detect accidental regression)
5. Check Sentry retention settings match policy (90 days)
6. Check Axiom retention settings match policy (30 days raw, 90 days aggregated)
7. Check Cloudflare log retention settings (7 days)
8. Document any discrepancies in a findings report
9. Create tickets for any unimplemented retention policies that have data approaching their limits

---

## Exception Handling

### Legal Hold

When a legal investigation, audit, or regulatory request requires data beyond normal retention:

1. **Legal hold is initiated** by lole's legal counsel or a court order
2. **Affected data is tagged** with a `legal_hold` flag or moved to a separate schema to prevent automated deletion
3. **All automated retention jobs must skip** records under legal hold
4. **Legal hold remains in place** until formally released by legal counsel
5. **After release,** normal retention policies resume from the date of release

**Implementation approach:**

- Add `legal_hold_until TIMESTAMPTZ` column to relevant tables
- Retention jobs add `AND (legal_hold_until IS NULL OR legal_hold_until < NOW())` to their WHERE clauses
- Alternatively, move held records to a `legal_hold` schema that retention jobs do not touch

### Backup Restoration Considerations

- **Supabase automated backups** are retained for 7 days (Pro plan) or 1 day (Free plan)
- **Point-in-time recovery (PITR)** is available on Supabase Pro for the backup retention window
- When data is deleted per retention policy, it will remain in backups for the backup retention window only
- For legal hold situations, ensure held data is exported to R2 before it ages out of any automated backup
- Restoring deleted data from PITR is a Supabase support operation — it is not self-service and restores the entire database to a point in time, not individual records

### Cross-Border Data Transfer

- lole's Supabase instance is hosted on **AWS** in a region selected at account creation
- All data processing occurs within the Supabase infrastructure
- Cloudflare (CDN/WAF) and Vercel (application hosting) may process requests at edge locations globally, but no data is persisted outside the primary database region
- Ethiopian law does not currently impose data localization requirements, but this policy will be updated if such regulations are enacted
- If a data localization requirement is introduced, migration to an AWS Africa (Cape Town) or local Ethiopian cloud provider would need to be evaluated

---

## Summary of Work Items

| Priority   | Item                                                               | Type                           | Effort |
| ---------- | ------------------------------------------------------------------ | ------------------------------ | ------ |
| **High**   | Fix `daily_sales` retention from 3 years to 7 years                | Migration                      | S      |
| **High**   | Build guest fingerprint anonymization job (90-day)                 | QStash/pg_cron job             | M      |
| **Medium** | Add `deactivated_at` column to `restaurant_staff`                  | Migration                      | S      |
| **Medium** | Build staff record anonymization job (2-year)                      | QStash/pg_cron job             | M      |
| **Medium** | Build auth audit log cleanup job (1-year)                          | QStash/pg_cron job             | S      |
| **Low**    | Build order archival strategy (2-year)                             | QStash/pg_cron job + R2 export | L      |
| **Low**    | Build guest account deletion workflow (deletion request + 30 days) | API endpoint + job             | L      |
| **Low**    | Add legal hold mechanism to retention jobs                         | Schema + job updates           | M      |

---

## Changelog

| Version | Date       | Change                        |
| ------- | ---------- | ----------------------------- |
| 1.0     | April 2026 | Initial data retention policy |

---

_lole Data Retention Policy v1.0 · April 2026_
