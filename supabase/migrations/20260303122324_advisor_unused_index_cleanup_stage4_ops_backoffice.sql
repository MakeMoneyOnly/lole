-- ============================================================================
-- Advisor Unused Index Cleanup Stage 4 — Ops & Backoffice
-- Date: 2026-03-03
-- Purpose: Drops unused indexes on audit_logs, staff_invites, and support_tickets
--          tables identified by Supabase advisor.
-- Impact: idx_audit_logs_entity, idx_audit_logs_user,
--         idx_staff_invites_created_by, idx_support_tickets_created_by
-- Rollback: Recreate dropped indexes with CREATE INDEX statements matching original definitions.
-- ============================================================================

drop index if exists public.idx_audit_logs_entity;
drop index if exists public.idx_audit_logs_user;
drop index if exists public.idx_staff_invites_created_by;
drop index if exists public.idx_support_tickets_created_by;
