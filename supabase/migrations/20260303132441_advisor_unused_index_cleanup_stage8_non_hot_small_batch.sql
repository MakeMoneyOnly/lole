-- ============================================================================
-- Advisor Unused Index Cleanup Stage 8 — Non-Hot Small Batch
-- Date: 2026-03-03
-- Purpose: Drops unused indexes on guest_visits and rate_limit_logs tables
--          identified by Supabase advisor (non-hot-path small batch).
-- Impact: idx_guest_visits_guest_visited, idx_guest_visits_restaurant_visited,
--         idx_rate_limit_logs_restaurant_id
-- Rollback: Recreate dropped indexes with CREATE INDEX statements matching original definitions.
-- ============================================================================

drop index if exists public.idx_guest_visits_guest_visited;
drop index if exists public.idx_guest_visits_restaurant_visited;
drop index if exists public.idx_rate_limit_logs_restaurant_id;
