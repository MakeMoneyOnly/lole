-- ============================================================================
-- Advisor Unused Index Cleanup Stage 5 — Audit Logs
-- Date: 2026-03-03
-- Purpose: Drops unused index on audit_logs(restaurant) identified by
--          Supabase advisor.
-- Impact: idx_audit_logs_restaurant
-- Rollback: Recreate with CREATE INDEX idx_audit_logs_restaurant ON public.audit_logs(restaurant_id);
-- ============================================================================

drop index if exists public.idx_audit_logs_restaurant;
