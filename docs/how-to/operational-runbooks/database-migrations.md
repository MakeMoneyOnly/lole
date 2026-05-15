# Database Migrations Runbook

**Version 1.0 · March 2026 · For the Builder**

> This runbook covers the safe execution of database migrations for lole's Supabase PostgreSQL database, including rollback procedures and emergency response.

---

## Overview

Database migrations in lole are managed through Supabase CLI and stored in `supabase/migrations/`. All migrations must follow the idempotency and safety guidelines defined in `AGENTS.md`.

---

## Pre-Migration Checklist

- [ ] Migration file reviewed by second engineer
- [ ] Migration tested locally with `supabase db reset`
- [ ] Rollback plan documented
- [ ] Backup verified (automatic via Supabase)
- [ ] Migration scheduled during low-traffic window (recommended: 2-4 AM EAT)
- [ ] Affected tables identified and stakeholders notified

---

## Standard Migration Procedure

### Step 1: Create Migration

```bash
# Create new migration file
supabase migration new <descriptive_name>

# Example: supabase migration new add_discount_tables
```

### Step 2: Write Migration SQL

Follow these patterns for safe migrations:

```sql
-- Idempotent table creation
CREATE TABLE IF NOT EXISTS new_table (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now()
);

-- Idempotent index creation
CREATE INDEX IF NOT EXISTS idx_table_column
ON table_name (column_name);

-- Idempotent policy creation
DROP POLICY IF EXISTS policy_name ON table_name;
CREATE POLICY policy_name ON table_name
    FOR SELECT USING (condition);

-- Safe column addition (nullable first, then backfill, then constraint)
ALTER TABLE table_name
ADD COLUMN IF NOT EXISTS new_column text;

-- For NOT NULL columns, use phased approach:
-- Phase 1: Add nullable column
-- Phase 2: Backfill data in batches
-- Phase 3: Add NOT NULL constraint
```

### Step 3: Test Locally

```bash
# Reset local database and apply all migrations
supabase db reset

# Verify migration applied correctly
supabase db diff --schema public

# Run tests
pnpm test
```

### Step 4: Deploy to Production

```bash
# Push migration to linked Supabase project
supabase db push --linked

# Verify migration status
supabase migration list
```

---

## Rollback Procedures

### Immediate Rollback (within 5 minutes)

1. **Identify the migration to revert:**

    ```bash
    supabase migration list
    ```

2. **Create a reversal migration:**

    ```bash
    supabase migration new revert_<original_name>
    ```

3. **Write reversal SQL:**

    ```sql
    -- Reverse table creation
    DROP TABLE IF EXISTS new_table CASCADE;

    -- Reverse column addition
    ALTER TABLE table_name DROP COLUMN IF EXISTS new_column;

    -- Reverse index creation
    DROP INDEX IF EXISTS idx_table_column;
    ```

4. **Apply reversal:**
    ```bash
    supabase db push --linked
    ```

### Point-in-Time Recovery (PITR)

For critical data loss scenarios, use Supabase's PITR:

1. Navigate to Supabase Dashboard → Database → Backups
2. Select "Point-in-Time Recovery"
3. Choose timestamp before the problematic migration
4. Initiate recovery (this creates a new branch)
5. Verify data integrity on the new branch
6. Promote branch to production

---

## Emergency Response

### Migration Stuck or Hanging

**Symptoms:**

- Migration command doesn't return
- High database CPU/lock wait
- Application timeouts

**Response:**

```sql
-- Check for blocking queries
SELECT pid, query, state, wait_event_type, wait_event
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;

-- If necessary, terminate blocking query (use with caution)
SELECT pg_cancel_backend(<pid>);

-- For stuck DDL operations
SELECT pg_terminate_backend(<pid>);
```

### Migration Failed Partially

**Symptoms:**

- Error message during migration
- Schema in inconsistent state

**Response:**

1. **Assess the damage:**

    ```sql
    -- Check if table/index exists
    SELECT * FROM pg_tables WHERE tablename = 'expected_table';
    SELECT * FROM pg_indexes WHERE indexname = 'expected_index';
    ```

2. **Manual cleanup if needed:**

    ```sql
    -- Remove partially created objects
    DROP TABLE IF EXISTS partially_created_table CASCADE;
    ```

3. **Re-run migration after cleanup:**
    ```bash
    supabase db push --linked
    ```

---

## Large Table Migration Strategy

For tables with >100,000 rows, use phased migrations:

### Phase 1: Add Nullable Column

```sql
ALTER TABLE large_table
ADD COLUMN IF NOT EXISTS new_column text;
```

### Phase 2: Backfill in Batches

```sql
-- Backfill in batches of 10,000
DO $$
DECLARE
    batch_size int := 10000;
    updated int;
BEGIN
    LOOP
        UPDATE large_table
        SET new_column = computed_value
        WHERE new_column IS NULL
        AND id IN (
            SELECT id FROM large_table
            WHERE new_column IS NULL
            LIMIT batch_size
        );

        GET DIAGNOSTICS updated = ROW_COUNT;
        EXIT WHEN updated = 0;

        COMMIT;
    END LOOP;
END $$;
```

### Phase 3: Add Constraints

```sql
-- After backfill complete
ALTER TABLE large_table
ALTER COLUMN new_column SET NOT NULL;
```

---

## Common Issues and Solutions

### Issue: "relation already exists"

**Cause:** Migration re-run without `IF NOT EXISTS`

**Solution:**

```sql
-- Use IF NOT EXISTS for all CREATE statements
CREATE TABLE IF NOT EXISTS table_name (...);
CREATE INDEX IF NOT EXISTS idx_name ON table (...);
```

### Issue: "lock wait timeout"

**Cause:** Long-running query blocking DDL

**Solution:**

1. Identify and terminate blocking query
2. Schedule migration during low-traffic window
3. Use `SET lock_timeout = '10s';` at start of migration

### Issue: "permission denied"

**Cause:** Missing grants after schema change

**Solution:**

```sql
-- Re-grant permissions after DDL
GRANT ALL ON table_name TO authenticated;
GRANT SELECT ON table_name TO anon;
```

---

## Monitoring and Verification

### Post-Migration Verification

```sql
-- Verify table structure
\d table_name

-- Verify indexes
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'table_name';

-- Verify RLS policies
SELECT policyname, cmd, qual FROM pg_policies
WHERE tablename = 'table_name';

-- Check for table bloat after large updates
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Performance Validation

```sql
-- Run EXPLAIN ANALYZE on affected queries
EXPLAIN ANALYZE SELECT * FROM table_name WHERE column = 'value';

-- Check for sequential scans
SELECT relname, seq_scan, idx_scan
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan;
```

---

## Contacts and Escalation

| Role             | Contact             | Escalation Time |
| ---------------- | ------------------- | --------------- |
| Primary DBA      | On-call rotation    | Immediate       |
| Engineering Lead | @engineering-lead   | 15 minutes      |
| Supabase Support | support@supabase.io | As needed       |

---

## Related Documents

- [Engineering Runbook](../explanation/engineering-runbook.md)
- [Disaster Recovery Plan](./disaster-recovery.md)
- [Incident Triage Rubric](./incident-triage-rubric.md)
