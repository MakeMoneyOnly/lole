-- lole P0: Fix RLS for failed_events and audit_logs_archive
-- Date: 2026-05-04
-- Description: BKND-032 — RLS audit found 2 HIGH findings:
--   1. failed_events: FOR ALL USING (true) missing TO service_role + no FORCE RLS
--   2. audit_logs_archive: Same unscoped policy + no FORCE RLS
--   Both tables were created 2026-05-03 and missed hardening.

BEGIN;

-- ==========================================================================
-- 1. Fix failed_events RLS
-- ==========================================================================

-- Drop the unscoped policy
DROP POLICY IF EXISTS "Service role can manage failed_events" ON public.failed_events;

-- Recreate with explicit service_role scope
CREATE POLICY "Service role can manage failed_events"
    ON public.failed_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Force RLS on failed_events
ALTER TABLE public.failed_events FORCE ROW LEVEL SECURITY;

-- ==========================================================================
-- 2. Fix audit_logs_archive RLS
-- ==========================================================================

-- Drop the unscoped policy
DROP POLICY IF EXISTS "Service role can manage audit_logs_archive" ON public.audit_logs_archive;

-- Recreate with explicit service_role scope
CREATE POLICY "Service role can manage audit_logs_archive"
    ON public.audit_logs_archive
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Force RLS on audit_logs_archive
ALTER TABLE public.audit_logs_archive FORCE ROW LEVEL SECURITY;

COMMIT;
