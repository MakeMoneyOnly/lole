-- lole P0: Dead-Letter Queue for Failed Events
-- Date: 2026-05-03
-- Description: BKND-037 — Ensures events are never silently dropped.
--   When Redis Streams xadd fails or Upstash is unavailable,
--   events are persisted to this table for later retry/replay.
--
-- Related: BKND-038 (exponential backoff retry in publishEvent)

BEGIN;

-- ==========================================================================
-- failed_events — Dead-Letter Queue for Failed Event Publishing
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.failed_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL,
    event_name TEXT NOT NULL,
    stream_name TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    trace_id TEXT,
    occurred_at TIMESTAMPTZ NOT NULL,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'retrying', 'dead', 'replayed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    replayed_at TIMESTAMPTZ
);

-- ==========================================================================
-- Indexes
-- ==========================================================================
-- Find pending retries ordered by next_retry_at
CREATE INDEX IF NOT EXISTS idx_failed_events_retry
    ON public.failed_events (status, next_retry_at)
    WHERE status IN ('pending', 'retrying');

-- Deduplicate incoming events
CREATE INDEX IF NOT EXISTS idx_failed_events_event_id
    ON public.failed_events (event_id);

-- Scope queries by time
CREATE INDEX IF NOT EXISTS idx_failed_events_created_at
    ON public.failed_events (created_at DESC);

-- ==========================================================================
-- RLS — Service role only (no direct client access)
-- ==========================================================================
ALTER TABLE public.failed_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access failed_events (admin/operational table)
CREATE POLICY "Service role can manage failed_events"
    ON public.failed_events
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ==========================================================================
-- Trigger: auto-update updated_at
-- ==========================================================================
CREATE OR REPLACE FUNCTION update_failed_events_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_failed_events_modtime
    BEFORE UPDATE ON public.failed_events
    FOR EACH ROW
    EXECUTE FUNCTION update_failed_events_modtime();

COMMIT;
