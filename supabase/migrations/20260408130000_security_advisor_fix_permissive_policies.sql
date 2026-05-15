-- ============================================================================
-- Migration: 20260408130000_security_advisor_fix_permissive_policies.sql
-- ============================================================================
--
-- Purpose:
--   Fix Supabase Security Advisor finding: "RLS Policy Always True".
--   Replaces permissive policies on notification_metrics that use
--   USING (true) / WITH CHECK (true) with tenant-scoped policies that
--   verify membership via restaurant_staff.
--
-- Context:
--   - A prior migration (20260320_fix_permissive_rls_policies.sql) attempted
--     to fix notification_metrics policies, but the live database still shows
--     permissive policies. This migration ensures they are replaced regardless
--     of whether the prior migration was applied.
--   - Migration 20260408110000_security_advisor_enable_rls_and_policies.sql
--     already fixed notification_logs, so this migration focuses solely on
--     notification_metrics.
--
-- Affected policies (flagged by Security Advisor):
--   1. notification_metrics - "Service role can insert notification metrics"
--      INSERT - WITH CHECK (true) — unrestricted for authenticated
--   2. notification_metrics - "Service role can update notification metrics"
--      UPDATE - USING (true), WITH CHECK (true) — unrestricted
--
-- Strategy:
--   - DROP the permissive policies by both old and new names for idempotency.
--   - CREATE tenant-scoped policies that check restaurant_staff membership.
--   - Add a DELETE policy (previously missing).
--   - Verify no permissive policies remain.
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- notification_metrics: Replace permissive INSERT policy
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Service role can insert notification metrics" ON public.notification_metrics;
DROP POLICY IF EXISTS "Staff can insert notification metrics" ON public.notification_metrics;
DROP POLICY IF EXISTS "Staff can insert notification_metrics" ON public.notification_metrics;

CREATE POLICY "Staff can insert notification_metrics" ON public.notification_metrics
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = notification_metrics.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- ---------------------------------------------------------------------------
-- notification_metrics: Replace permissive UPDATE policy
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Service role can update notification metrics" ON public.notification_metrics;
DROP POLICY IF EXISTS "Staff can update notification metrics" ON public.notification_metrics;
DROP POLICY IF EXISTS "Staff can update notification_metrics" ON public.notification_metrics;

CREATE POLICY "Staff can update notification_metrics" ON public.notification_metrics
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = notification_metrics.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = notification_metrics.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- ---------------------------------------------------------------------------
-- notification_metrics: Add missing DELETE policy
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff can delete notification_metrics" ON public.notification_metrics;

CREATE POLICY "Staff can delete notification_metrics" ON public.notification_metrics
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = notification_metrics.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- ---------------------------------------------------------------------------
-- Verification: Check for remaining permissive RLS policies
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    perm_rec RECORD;
    perm_count INT := 0;
BEGIN
    FOR perm_rec IN
        SELECT schemaname, tablename, policyname, cmd, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        AND (
            qual = 'true' OR qual = '(true)' OR qual = 'TRUE'
            OR with_check = 'true' OR with_check = '(true)' OR with_check = 'TRUE'
            OR qual LIKE '%USING (true)%'
        )
    LOOP
        RAISE WARNING 'Permissive RLS policy found: %.% - % (%)',
            perm_rec.schemaname, perm_rec.tablename, perm_rec.policyname, perm_rec.cmd;
        perm_count := perm_count + 1;
    END LOOP;

    IF perm_count = 0 THEN
        RAISE NOTICE 'Verification passed: no permissive RLS policies found.';
    ELSE
        RAISE WARNING 'Verification found % permissive RLS polic(ies).', perm_count;
    END IF;
END $$;

COMMIT;
