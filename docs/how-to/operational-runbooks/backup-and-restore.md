# Backup and Restore Procedures

## Overview

lole uses Supabase (PostgreSQL) for all persistent data. This runbook covers backup procedures, restore processes, and disaster recovery.

## Automated Backups

### Supabase Managed Backups

- **Daily automatic backups**: Taken every 24 hours by Supabase
- **Point-in-time Recovery (PITR)**: Available on Pro plan and above
- **7-day retention** on free tier, **30-day retention** on Pro
- **Wal-g** based continuous archiving for PITR

### What's Backed Up

- All tables in the `public` schema
- RLS policies
- Database functions and triggers
- Auth users and sessions
- Storage objects

### What's NOT Automatically Backed Up

- Edge functions (managed by git)
- Realtime subscriptions (transient)
- CDN cache (transient)

## Manual Backup Procedures

### Full Database Backup

```bash
# Using pg_dump via Supabase CLI
supabase db dump --project-id <project-id> > backup_$(date +%Y%m%d_%H%M%S).sql

# Using pg_dump directly
pg_dump "postgresql://postgres:[password]@db.<project-id>.supabase.co:5432/postgres" \
  --clean --if-exists \
  > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Schema-Only Backup

```bash
supabase db dump --project-id <project-id> --schema-only > schema_backup.sql
```

### Data-Only Backup

```bash
pg_dump "postgresql://..." --data-only --no-owner > data_backup.sql
```

### Specific Tables Backup

```bash
pg_dump "postgresql://..." --table=orders --table=order_items --table=payments > critical_tables_backup.sql
```

## Restore Process

### Full Database Restore

```bash
# 1. Stop application traffic (maintenance mode)
# 2. Restore from backup
psql "postgresql://postgres:[password]@db.<project-id>.supabase.co:5432/postgres" < backup_20240115_120000.sql

# 3. Verify data integrity
psql "postgresql://..." -c "SELECT count(*) FROM orders;"
psql "postgresql://..." -c "SELECT count(*) FROM payments;"

# 4. Restart application
```

### Point-in-Time Recovery (PITR)

```bash
# Via Supabase Dashboard
# 1. Go to Database → Backups
# 2. Select "Restore to point in time"
# 3. Choose target timestamp
# 4. Confirm restore

# Via Supabase CLI
supabase db reset --project-id <project-id> --pitr-time "2024-01-15T12:00:00Z"
```

### Partial Table Restore

```bash
# Restore specific tables from a backup
pg_restore --table=orders --table=order_items \
  --dbname="postgresql://..." \
  backup_file.dump
```

## Disaster Recovery

### Recovery Point Objective (RPO)

- **Target RPO**: < 1 hour (with PITR)
- **Maximum RPO**: 24 hours (daily backup)

### Recovery Time Objective (RTO)

- **Target RTO**: < 2 hours
- **Maximum RTO**: < 4 hours

### Severity Levels

| Level | Description              | RPO   | RTO  | Response                |
| ----- | ------------------------ | ----- | ---- | ----------------------- |
| Sev1  | Total data loss          | < 1h  | < 2h | Immediate PITR          |
| Sev2  | Partial data corruption  | < 1h  | < 4h | Selective table restore |
| Sev3  | Single tenant data issue | < 24h | < 8h | Tenant-specific restore |

### Disaster Recovery Steps

1. **Assess** the scope of data loss/corruption
2. **Notify** stakeholders (on-call, engineering lead, affected restaurants)
3. **Stop** application traffic if data integrity is at risk
4. **Identify** the last known good state
5. **Restore** from backup or PITR
6. **Verify** data integrity after restore
7. **Resume** application traffic
8. **Post-mortem** within 24 hours

## Backup Verification

### Weekly Verification (Automated)

```bash
# Restore latest backup to staging and verify
supabase db reset --project-id <staging-project-id>
psql "postgresql://staging..." < latest_backup.sql
psql "postgresql://staging..." -c "SELECT count(*) FROM orders WHERE created_at > now() - interval '7 days';"
```

### Monthly Verification (Manual)

1. Restore backup to staging environment
2. Run full test suite against restored data
3. Verify all P0 flows work (orders, KDS, payments)
4. Verify tenant isolation is intact
5. Document verification results

## Emergency Contacts

| Role             | Contact                    | Escalation        |
| ---------------- | -------------------------- | ----------------- |
| On-call Engineer | #oncall Slack channel      | 15 min response   |
| Engineering Lead | #engineering Slack channel | 30 min response   |
| Supabase Support | support@supabase.io        | 1-4 hour response |

## Supabase Dashboard Backup Access

1. Navigate to: https://app.supabase.com/project/<project-id>/database/backups
2. View available backups and timestamps
3. Click "Restore" on desired backup
4. Confirm the restore action
