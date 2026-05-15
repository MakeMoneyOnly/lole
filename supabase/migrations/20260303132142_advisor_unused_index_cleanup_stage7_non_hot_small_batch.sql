-- ============================================================================
-- Advisor Unused Index Cleanup Stage 7 — Non-Hot Small Batch
-- Date: 2026-03-03
-- Purpose: Drops unused indexes on rate_limit and external_orders tables
--          identified by Supabase advisor (non-hot-path small batch).
-- Impact: idx_rate_limit_action, idx_rate_limit_fingerprint,
--         idx_external_orders_restaurant_status
-- Rollback: Recreate dropped indexes with CREATE INDEX statements matching original definitions.
-- ============================================================================

drop index if exists public.idx_rate_limit_action;
drop index if exists public.idx_rate_limit_fingerprint;
drop index if exists public.idx_external_orders_restaurant_status;
