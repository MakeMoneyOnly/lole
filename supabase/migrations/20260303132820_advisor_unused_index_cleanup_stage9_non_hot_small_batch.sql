-- ============================================================================
-- Advisor Unused Index Cleanup Stage 9 — Non-Hot Small Batch
-- Date: 2026-03-03
-- Purpose: Drops unused indexes on rate_limit_logs, stations, and shifts tables
--          identified by Supabase advisor (non-hot-path small batch).
-- Impact: idx_rate_limit_logs_fingerprint, idx_stations_restaurant_id,
--         idx_shifts_active_status
-- Rollback: Recreate dropped indexes with CREATE INDEX statements matching original definitions.
-- ============================================================================

drop index if exists public.idx_rate_limit_logs_fingerprint;
drop index if exists public.idx_stations_restaurant_id;
drop index if exists public.idx_shifts_active_status;
