-- lole P1: Connection Pool Health RPC
-- Date: 2026-05-03
-- Description: BKND-027 — Creates get_pool_stats() RPC for real-time
--   connection pool monitoring via pg_stat_activity.
--
-- Used by checkPoolHealth() in src/lib/supabase/connection-pooling.ts

BEGIN;

-- ==========================================================================
-- get_pool_stats() — Returns active/idle/waiting connection counts
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.get_pool_stats()
RETURNS TABLE(active bigint, idle bigint, waiting bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        COUNT(*) FILTER (WHERE state = 'active') as active,
        COUNT(*) FILTER (WHERE state = 'idle') as idle,
        COUNT(*) FILTER (WHERE wait_event IS NOT NULL) as waiting
    FROM pg_catalog.pg_stat_activity
    WHERE datname = current_database()
      AND pid <> pg_backend_pid();
$$;

-- Grant access to service role only (used by server-side code)
REVOKE ALL ON FUNCTION public.get_pool_stats() FROM PUBLIC, anon, authenticated;

COMMIT;
