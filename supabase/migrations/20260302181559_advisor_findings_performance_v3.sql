-- Persisted from remote migration history for parity across environments.
-- Safe/idempotent cleanup aligned with advisor remediation.

drop index if exists public.idx_audit_log_created_at;
alter table if exists public.orders drop constraint if exists orders_idempotency_key_key;
