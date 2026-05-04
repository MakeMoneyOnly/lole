-- lole P1: Service Role Audit Log Retention
-- Date: 2026-05-03
-- Description: BKND-035 — Archives audit_logs older than 90 days to TimescaleDB
--   hypertable for efficient long-term storage with automatic compression.
--
-- Requires: TimescaleDB extension (already enabled in 20260324000000_timescale_analytics.sql)

BEGIN;

-- ==========================================================================
-- audit_logs_archive — TimescaleDB hypertable for historical audit logs
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs_archive (
    id UUID NOT NULL,
    restaurant_id UUID,
    user_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable (24-hour chunks)
SELECT create_hypertable('public.audit_logs_archive', 'archived_at',
    chunk_time_interval => INTERVAL '24 hours',
    if_not_exists => TRUE
);

-- Enable compression on audit archives (compress chunks older than 7 days)
SELECT add_compression_policy('public.audit_logs_archive',
    INTERVAL '7 days',
    if_not_exists => TRUE
);

-- ==========================================================================
-- Indexes
-- ==========================================================================
CREATE INDEX IF NOT EXISTS idx_audit_archive_restaurant_time
    ON public.audit_logs_archive (restaurant_id, archived_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_archive_entity
    ON public.audit_logs_archive (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_archive_action
    ON public.audit_logs_archive (action, archived_at DESC);

-- ==========================================================================
-- RLS — Service role only (no direct client access)
-- ==========================================================================
ALTER TABLE public.audit_logs_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage audit_logs_archive"
    ON public.audit_logs_archive
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ==========================================================================
-- archive_old_audit_logs() — Moves logs older than N days to archive table
-- Run via cron: SELECT public.archive_old_audit_logs(90);
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.archive_old_audit_logs(retention_days integer DEFAULT 90)
RETURNS TABLE(archived_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    moved bigint;
BEGIN
    WITH moved_rows AS (
        INSERT INTO public.audit_logs_archive
            (id, restaurant_id, user_id, action, entity_type, entity_id,
             old_value, new_value, metadata, created_at, archived_at)
        SELECT
            id, restaurant_id, user_id, action, entity_type, entity_id,
            old_value, new_value, metadata, created_at, NOW()
        FROM public.audit_logs
        WHERE created_at < (NOW() - (retention_days || ' days')::INTERVAL)
        RETURNING id
    )
    SELECT COUNT(*) INTO moved FROM moved_rows;

    -- Delete archived rows from main table
    DELETE FROM public.audit_logs
    WHERE created_at < (NOW() - (retention_days || ' days')::INTERVAL);

    RETURN QUERY SELECT moved;
END;
$$;

-- Grant access to service role only
REVOKE ALL ON FUNCTION public.archive_old_audit_logs(integer) FROM PUBLIC, anon, authenticated;

COMMIT;
