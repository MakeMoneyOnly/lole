# PowerSync + Supabase Dev Status

Date: 2026-05-24
Status: blocked for end-to-end cloud replication in current dev environment

## Decision

We are not treating PowerSync + Supabase as fully complete yet.

What is done:

- client bootstrap/config path is implemented
- local PowerSync database initialization is wired
- app can surface bootstrap status and operating mode
- local-first gateway work can continue independently
- `powersync` publication migration created (20260521000000_powersync_publication.sql)
- SQL migration ready for `CREATE PUBLICATION powersync FOR ALL TABLES`

What is not done:

- Supabase direct logical replication for PowerSync is not live in dev environment
- end-to-end replay from local journal through PowerSync cloud bridge is not validated yet
- infrastructure variables not configured (DATABASE_DIRECT_URL)

## Why blocked

**Code is complete — only infrastructure remains.**

PowerSync needs database-native replication capabilities:

- direct Postgres connection
- logical replication
- WAL streaming
- replication slots
- publication named `powersync`

Transaction pooler is not valid for this path.

Current dev blocker is infra, not app code:

- Supabase direct replication path for PowerSync is not active in this environment
- `DATABASE_DIRECT_URL` environment variable not configured

## Team policy

Until this is unblocked:

- keep `ENT-005` marked done because bootstrap/config foundation is implemented
- keep `ENT-018` blocked because cloud replay path is not operational
- continue local-first architecture work that does not depend on live PowerSync cloud replication
- do not claim "48h offline with cloud convergence proven" yet

## Interim operating model

During development, treat these as current truth:

- local persistence work continues
- gateway, LAN discovery, local journal, local adapters, offline auth, and operating-mode telemetry continue
- `/api/sync` and local replay abstractions remain interim dev bridge surfaces
- PowerSync cloud replication is deferred until infra prerequisites are available

## Infrastructure Setup Requirements

Before PowerSync replication can be validated:

- `DATABASE_DIRECT_URL` must be configured in environment
- This must point to a direct Postgres connection (not transaction pooler)
- Logical replication must be enabled for the database
- The `20260521000000_powersync_publication.sql` migration must be applied

## Unblock checklist

Only reopen end-to-end PowerSync cloud replication when all are true:

1. `DATABASE_DIRECT_URL` points to real direct Postgres connection.
2. PowerSync replication service uses direct lane, not pooler.
3. Logical replication is enabled for external replication path.
4. SQL succeeds:

```sql
CREATE PUBLICATION powersync FOR ALL TABLES;
```

5. PowerSync instance is configured to trust Supabase JWTs.
6. Device can connect, sync initial snapshot, write locally, disconnect, reconnect, and replay without manual repair.
7. `ENT-018` replay/reconnect smoke test passes in a WAN-disconnected harness.

## Founder recommendation

Do not spend more product velocity right now trying to force paid infra behavior in development if it does not unblock immediate store-local reliability work.

Revisit this before:

- pilot requiring cloud convergence guarantees
- production rollout of multi-device stores
- any claim that PowerSync replication is enterprise-ready end to end
