-- ============================================================================
-- Restore FK Covering Indexes V3
-- Date: 2026-03-03
-- Purpose: Restores FK covering indexes on guest_visits and rate_limit_logs
--          that were dropped during stages 6-8 cleanup but are needed for FK lookups.
-- Impact: guest_visits(guest_id, visited_at DESC), rate_limit_logs(restaurant_id)
-- Rollback: DROP INDEX IF EXISTS idx_guest_visits_guest_visited;
--           DROP INDEX IF EXISTS idx_rate_limit_logs_restaurant_id;
-- ============================================================================

create index if not exists idx_guest_visits_guest_visited on public.guest_visits(guest_id, visited_at desc);
create index if not exists idx_rate_limit_logs_restaurant_id on public.rate_limit_logs(restaurant_id);
