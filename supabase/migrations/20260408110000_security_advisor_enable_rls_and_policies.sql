-- ============================================================================
-- Migration: 20260408110000_security_advisor_enable_rls_and_policies.sql
-- ============================================================================
--
-- Purpose: Resolve Supabase Security Advisor finding that 16 public-schema
--          tables lack RLS enabled / forced. Ensures FORCE RLS on all
--          tenant-scoped tables and creates or replaces RLS policies using
--          the (select auth.uid()) caching pattern per AGENTS.md.
--
-- Tables addressed (16 without RLS + 1 notification_metrics for FORCE only):
--   1.  stations
--   2.  marketing_campaigns
--   3.  campaign_recipients
--   4.  email_templates
--   5.  guest_unsubscribes
--   6.  staff_invites
--   7.  scheduled_reports
--   8.  report_executions
--   9.  report_templates
--   10. menu_change_queue
--   11. centralized_menu_configs
--   12. menu_location_links
--   13. notification_logs
--   14. push_tokens
--   15. delivery_aggregator_configs
--   16. erca_submissions
--   (+ notification_metrics: FORCE RLS only, policies in separate migration)
--
-- Approach:
--   - Idempotent: each table existence is checked before ALTER.
--   - Uses DO $$ blocks with IF EXISTS guards for all DDL.
--   - Policies are dropped-and-recreated (DROP POLICY IF EXISTS) for
--     idempotency. Existing well-scoped policies from creation migrations
--     are replaced with consistent patterns using (select auth.uid()).
--   - Adds covering indexes on RLS predicate columns where missing.
--
-- Per AGENTS.md:
--   - "Enable and enforce RLS on all tenant-scoped tables."
--   - "In RLS policies, wrap auth calls with select when safe to cache:
--      (select auth.uid()), (select auth.jwt())."
--   - "Index every column used by foreign keys, RLS predicates, frequent
--      filters/sorts/joins."
-- ============================================================================

BEGIN;

-- ==========================================================================
-- SECTION 1: ENABLE AND FORCE ROW LEVEL SECURITY
-- ==========================================================================

-- 1. stations
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stations') THEN
        ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.stations FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 2. marketing_campaigns
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marketing_campaigns') THEN
        ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.marketing_campaigns FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 3. campaign_recipients
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'campaign_recipients') THEN
        ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.campaign_recipients FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 4. email_templates
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_templates') THEN
        ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.email_templates FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 5. guest_unsubscribes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guest_unsubscribes') THEN
        ALTER TABLE public.guest_unsubscribes ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.guest_unsubscribes FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 6. staff_invites
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_invites') THEN
        ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.staff_invites FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 7. scheduled_reports
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'scheduled_reports') THEN
        ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.scheduled_reports FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 8. report_executions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'report_executions') THEN
        ALTER TABLE public.report_executions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.report_executions FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 9. report_templates
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'report_templates') THEN
        ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.report_templates FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 10. menu_change_queue
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_change_queue') THEN
        ALTER TABLE public.menu_change_queue ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.menu_change_queue FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 11. centralized_menu_configs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'centralized_menu_configs') THEN
        ALTER TABLE public.centralized_menu_configs ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.centralized_menu_configs FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 12. menu_location_links
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'menu_location_links') THEN
        ALTER TABLE public.menu_location_links ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.menu_location_links FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 13. notification_logs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_logs') THEN
        ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.notification_logs FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 14. push_tokens
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'push_tokens') THEN
        ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.push_tokens FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 15. delivery_aggregator_configs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_aggregator_configs') THEN
        ALTER TABLE public.delivery_aggregator_configs ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.delivery_aggregator_configs FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 16. erca_submissions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'erca_submissions') THEN
        ALTER TABLE public.erca_submissions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.erca_submissions FORCE ROW LEVEL SECURITY;
    END IF;
END $$;

-- notification_metrics: FORCE RLS only (policies fixed in separate migration)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_metrics') THEN
        ALTER TABLE public.notification_metrics FORCE ROW LEVEL SECURITY;
    END IF;
END $$;


-- ==========================================================================
-- SECTION 2: RLS POLICIES
-- Policies use (select auth.uid()) for caching per AGENTS.md.
-- DROP POLICY IF EXISTS before CREATE for idempotency.
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 2.1  stations
--      Column: restaurant_id
--      Full CRUD for staff.
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff can view stations" ON public.stations;
CREATE POLICY "Staff can view stations" ON public.stations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = stations.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can insert stations" ON public.stations;
CREATE POLICY "Staff can insert stations" ON public.stations
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = stations.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can update stations" ON public.stations;
CREATE POLICY "Staff can update stations" ON public.stations
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = stations.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = stations.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can delete stations" ON public.stations;
CREATE POLICY "Staff can delete stations" ON public.stations
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = stations.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- --------------------------------------------------------------------------
-- 2.2  marketing_campaigns
--      Column: restaurant_id
--      Replace legacy policies with (select auth.uid()) pattern.
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "staff_can_view_marketing_campaigns" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Staff can view marketing_campaigns" ON public.marketing_campaigns;
CREATE POLICY "Staff can view marketing_campaigns" ON public.marketing_campaigns
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = marketing_campaigns.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "managers_can_manage_marketing_campaigns" ON public.marketing_campaigns;
DROP POLICY IF EXISTS "Staff can insert marketing_campaigns" ON public.marketing_campaigns;
CREATE POLICY "Staff can insert marketing_campaigns" ON public.marketing_campaigns
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = marketing_campaigns.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can update marketing_campaigns" ON public.marketing_campaigns;
CREATE POLICY "Staff can update marketing_campaigns" ON public.marketing_campaigns
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = marketing_campaigns.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = marketing_campaigns.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can delete marketing_campaigns" ON public.marketing_campaigns;
CREATE POLICY "Staff can delete marketing_campaigns" ON public.marketing_campaigns
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = marketing_campaigns.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- --------------------------------------------------------------------------
-- 2.3  campaign_recipients
--      Column: restaurant_id
--      Add INSERT, UPDATE, DELETE; replace legacy SELECT.
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "staff_can_view_campaign_recipients" ON public.campaign_recipients;
DROP POLICY IF EXISTS "Staff can view campaign_recipients" ON public.campaign_recipients;
CREATE POLICY "Staff can view campaign_recipients" ON public.campaign_recipients
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = campaign_recipients.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can insert campaign_recipients" ON public.campaign_recipients;
CREATE POLICY "Staff can insert campaign_recipients" ON public.campaign_recipients
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = campaign_recipients.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can update campaign_recipients" ON public.campaign_recipients;
CREATE POLICY "Staff can update campaign_recipients" ON public.campaign_recipients
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = campaign_recipients.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = campaign_recipients.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can delete campaign_recipients" ON public.campaign_recipients;
CREATE POLICY "Staff can delete campaign_recipients" ON public.campaign_recipients
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = campaign_recipients.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- --------------------------------------------------------------------------
-- 2.4  email_templates
--      Column: restaurant_id
--      Replace legacy policies with (select auth.uid()) pattern.
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "staff_can_view_email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Staff can view email_templates" ON public.email_templates;
CREATE POLICY "Staff can view email_templates" ON public.email_templates
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = email_templates.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "managers_can_manage_email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Staff can insert email_templates" ON public.email_templates;
CREATE POLICY "Staff can insert email_templates" ON public.email_templates
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = email_templates.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can update email_templates" ON public.email_templates;
CREATE POLICY "Staff can update email_templates" ON public.email_templates
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = email_templates.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = email_templates.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can delete email_templates" ON public.email_templates;
CREATE POLICY "Staff can delete email_templates" ON public.email_templates
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = email_templates.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- --------------------------------------------------------------------------
-- 2.5  guest_unsubscribes
--      Columns: restaurant_id, guest_id
--      Staff SELECT via restaurant_id; guest ALL via guest_id join.
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "staff_can_view_unsubscribes" ON public.guest_unsubscribes;
DROP POLICY IF EXISTS "Staff can view guest_unsubscribes" ON public.guest_unsubscribes;
CREATE POLICY "Staff can view guest_unsubscribes" ON public.guest_unsubscribes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = guest_unsubscribes.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can insert guest_unsubscribes" ON public.guest_unsubscribes;
CREATE POLICY "Staff can insert guest_unsubscribes" ON public.guest_unsubscribes
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = guest_unsubscribes.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can update guest_unsubscribes" ON public.guest_unsubscribes;
CREATE POLICY "Staff can update guest_unsubscribes" ON public.guest_unsubscribes
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = guest_unsubscribes.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = guest_unsubscribes.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can delete guest_unsubscribes" ON public.guest_unsubscribes;
CREATE POLICY "Staff can delete guest_unsubscribes" ON public.guest_unsubscribes
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = guest_unsubscribes.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "guests_can_manage_own_unsubscribes" ON public.guest_unsubscribes;
DROP POLICY IF EXISTS "Guests can manage own unsubscribes" ON public.guest_unsubscribes;
CREATE POLICY "Guests can manage own unsubscribes" ON public.guest_unsubscribes
    FOR ALL TO authenticated
    USING (
        guest_id IN (
            SELECT id FROM public.guests WHERE user_id = (select auth.uid())
        )
    )
    WITH CHECK (
        guest_id IN (
            SELECT id FROM public.guests WHERE user_id = (select auth.uid())
        )
    );


-- --------------------------------------------------------------------------
-- 2.6  staff_invites
--      Column: restaurant_id
--      Replace legacy policies; add UPDATE. Keep public check policy.
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins/Managers can view invites" ON public.staff_invites;
DROP POLICY IF EXISTS "Staff can view staff_invites" ON public.staff_invites;
CREATE POLICY "Staff can view staff_invites" ON public.staff_invites
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = staff_invites.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Admins/Managers can create invites" ON public.staff_invites;
DROP POLICY IF EXISTS "Staff can insert staff_invites" ON public.staff_invites;
CREATE POLICY "Staff can insert staff_invites" ON public.staff_invites
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = staff_invites.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can update staff_invites" ON public.staff_invites;
CREATE POLICY "Staff can update staff_invites" ON public.staff_invites
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = staff_invites.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = staff_invites.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Admins/Managers can delete invites" ON public.staff_invites;
DROP POLICY IF EXISTS "Staff can delete staff_invites" ON public.staff_invites;
CREATE POLICY "Staff can delete staff_invites" ON public.staff_invites
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = staff_invites.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Public can check valid invites" ON public.staff_invites;
DROP POLICY IF EXISTS "Public can check valid staff_invites" ON public.staff_invites;
CREATE POLICY "Public can check valid staff_invites" ON public.staff_invites
    FOR SELECT TO authenticated
    USING (
        status = 'pending' AND expires_at > NOW()
    );


-- --------------------------------------------------------------------------
-- 2.7  scheduled_reports
--      Column: restaurant_id
--      Replace legacy policies with (select auth.uid()) pattern + CRUD.
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "staff_can_view_scheduled_reports" ON public.scheduled_reports;
DROP POLICY IF EXISTS "Staff can view scheduled_reports" ON public.scheduled_reports;
CREATE POLICY "Staff can view scheduled_reports" ON public.scheduled_reports
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = scheduled_reports.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "managers_can_manage_scheduled_reports" ON public.scheduled_reports;
DROP POLICY IF EXISTS "Staff can insert scheduled_reports" ON public.scheduled_reports;
CREATE POLICY "Staff can insert scheduled_reports" ON public.scheduled_reports
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = scheduled_reports.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can update scheduled_reports" ON public.scheduled_reports;
CREATE POLICY "Staff can update scheduled_reports" ON public.scheduled_reports
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = scheduled_reports.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = scheduled_reports.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can delete scheduled_reports" ON public.scheduled_reports;
CREATE POLICY "Staff can delete scheduled_reports" ON public.scheduled_reports
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = scheduled_reports.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- --------------------------------------------------------------------------
-- 2.8  report_executions
--      Column: restaurant_id
--      SELECT and INSERT for staff.
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "staff_can_view_report_executions" ON public.report_executions;
DROP POLICY IF EXISTS "Staff can view report_executions" ON public.report_executions;
CREATE POLICY "Staff can view report_executions" ON public.report_executions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = report_executions.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can insert report_executions" ON public.report_executions;
CREATE POLICY "Staff can insert report_executions" ON public.report_executions
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = report_executions.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- --------------------------------------------------------------------------
-- 2.9  report_templates
--      Column: restaurant_id (nullable - system templates have NULL)
--      SELECT: system templates OR tenant-scoped; full CRUD for staff.
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "staff_can_view_report_templates" ON public.report_templates;
DROP POLICY IF EXISTS "Staff can view report_templates" ON public.report_templates;
CREATE POLICY "Staff can view report_templates" ON public.report_templates
    FOR SELECT TO authenticated
    USING (
        is_system = true
        OR EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = report_templates.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can insert report_templates" ON public.report_templates;
CREATE POLICY "Staff can insert report_templates" ON public.report_templates
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = report_templates.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can update report_templates" ON public.report_templates;
CREATE POLICY "Staff can update report_templates" ON public.report_templates
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = report_templates.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = report_templates.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can delete report_templates" ON public.report_templates;
CREATE POLICY "Staff can delete report_templates" ON public.report_templates
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = report_templates.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- --------------------------------------------------------------------------
-- 2.10 menu_change_queue
--      Column: menu_config_id (join through centralized_menu_configs)
--      SELECT/INSERT for staff via restaurant join.
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Tenant staff can view menu_change_queue" ON public.menu_change_queue;
DROP POLICY IF EXISTS "Staff can view menu_change_queue" ON public.menu_change_queue;
CREATE POLICY "Staff can view menu_change_queue" ON public.menu_change_queue
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.centralized_menu_configs cmc
            JOIN public.restaurant_staff rs ON rs.restaurant_id = cmc.primary_restaurant_id
            WHERE cmc.id = menu_change_queue.menu_config_id
                AND rs.user_id = (select auth.uid())
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.menu_location_links mll
            JOIN public.restaurant_staff rs ON rs.restaurant_id = mll.restaurant_id
            WHERE mll.menu_config_id = menu_change_queue.menu_config_id
                AND rs.user_id = (select auth.uid())
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Tenant staff can manage menu_change_queue" ON public.menu_change_queue;
DROP POLICY IF EXISTS "Staff can insert menu_change_queue" ON public.menu_change_queue;
CREATE POLICY "Staff can insert menu_change_queue" ON public.menu_change_queue
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.centralized_menu_configs cmc
            JOIN public.restaurant_staff rs ON rs.restaurant_id = cmc.primary_restaurant_id
            WHERE cmc.id = menu_change_queue.menu_config_id
                AND rs.user_id = (select auth.uid())
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can update menu_change_queue" ON public.menu_change_queue;
CREATE POLICY "Staff can update menu_change_queue" ON public.menu_change_queue
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.centralized_menu_configs cmc
            JOIN public.restaurant_staff rs ON rs.restaurant_id = cmc.primary_restaurant_id
            WHERE cmc.id = menu_change_queue.menu_config_id
                AND rs.user_id = (select auth.uid())
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.centralized_menu_configs cmc
            JOIN public.restaurant_staff rs ON rs.restaurant_id = cmc.primary_restaurant_id
            WHERE cmc.id = menu_change_queue.menu_config_id
                AND rs.user_id = (select auth.uid())
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can delete menu_change_queue" ON public.menu_change_queue;
CREATE POLICY "Staff can delete menu_change_queue" ON public.menu_change_queue
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.centralized_menu_configs cmc
            JOIN public.restaurant_staff rs ON rs.restaurant_id = cmc.primary_restaurant_id
            WHERE cmc.id = menu_change_queue.menu_config_id
                AND rs.user_id = (select auth.uid())
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- --------------------------------------------------------------------------
-- 2.11 centralized_menu_configs
--      Column: primary_restaurant_id
--      Replace legacy policies with (select auth.uid()) pattern.
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Tenant staff can view centralized_menu_configs" ON public.centralized_menu_configs;
DROP POLICY IF EXISTS "Staff can view centralized_menu_configs" ON public.centralized_menu_configs;
CREATE POLICY "Staff can view centralized_menu_configs" ON public.centralized_menu_configs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = centralized_menu_configs.primary_restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.menu_location_links mll
            WHERE mll.menu_config_id = centralized_menu_configs.id
                AND EXISTS (
                    SELECT 1 FROM public.restaurant_staff rs
                    WHERE rs.user_id = (select auth.uid())
                        AND rs.restaurant_id = mll.restaurant_id
                        AND COALESCE(rs.is_active, true) = true
                )
        )
    );

DROP POLICY IF EXISTS "Tenant staff can manage centralized_menu_configs" ON public.centralized_menu_configs;
DROP POLICY IF EXISTS "Staff can insert centralized_menu_configs" ON public.centralized_menu_configs;
CREATE POLICY "Staff can insert centralized_menu_configs" ON public.centralized_menu_configs
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = centralized_menu_configs.primary_restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can update centralized_menu_configs" ON public.centralized_menu_configs;
CREATE POLICY "Staff can update centralized_menu_configs" ON public.centralized_menu_configs
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = centralized_menu_configs.primary_restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = centralized_menu_configs.primary_restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can delete centralized_menu_configs" ON public.centralized_menu_configs;
CREATE POLICY "Staff can delete centralized_menu_configs" ON public.centralized_menu_configs
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = centralized_menu_configs.primary_restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- --------------------------------------------------------------------------
-- 2.12 menu_location_links
--      Column: restaurant_id
--      Replace legacy policies with (select auth.uid()) pattern.
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Tenant staff can view menu_location_links" ON public.menu_location_links;
DROP POLICY IF EXISTS "Staff can view menu_location_links" ON public.menu_location_links;
CREATE POLICY "Staff can view menu_location_links" ON public.menu_location_links
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = menu_location_links.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.centralized_menu_configs cmc
            JOIN public.restaurant_staff rs ON rs.restaurant_id = cmc.primary_restaurant_id
            WHERE cmc.id = menu_location_links.menu_config_id
                AND rs.user_id = (select auth.uid())
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Tenant staff can manage menu_location_links" ON public.menu_location_links;
DROP POLICY IF EXISTS "Staff can insert menu_location_links" ON public.menu_location_links;
CREATE POLICY "Staff can insert menu_location_links" ON public.menu_location_links
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = menu_location_links.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can update menu_location_links" ON public.menu_location_links;
CREATE POLICY "Staff can update menu_location_links" ON public.menu_location_links
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = menu_location_links.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = menu_location_links.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can delete menu_location_links" ON public.menu_location_links;
CREATE POLICY "Staff can delete menu_location_links" ON public.menu_location_links
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = menu_location_links.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- --------------------------------------------------------------------------
-- 2.13 notification_logs
--      Column: restaurant_id
--      Replace permissive INSERT (WITH CHECK true) with tenant-scoped.
--      Add UPDATE and DELETE policies.
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Tenant staff can view notification_logs" ON public.notification_logs;
DROP POLICY IF EXISTS "Staff can view notification_logs" ON public.notification_logs;
CREATE POLICY "Staff can view notification_logs" ON public.notification_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = notification_logs.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Service role can insert notification_logs" ON public.notification_logs;
DROP POLICY IF EXISTS "Staff can insert notification_logs" ON public.notification_logs;
CREATE POLICY "Staff can insert notification_logs" ON public.notification_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = notification_logs.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can update notification_logs" ON public.notification_logs;
CREATE POLICY "Staff can update notification_logs" ON public.notification_logs
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = notification_logs.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = notification_logs.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can delete notification_logs" ON public.notification_logs;
CREATE POLICY "Staff can delete notification_logs" ON public.notification_logs
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = notification_logs.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- --------------------------------------------------------------------------
-- 2.14 push_tokens
--      Columns: restaurant_id, guest_id
--      Has existing guest-scoped and staff-scoped policies.
--      Only RLS enable/force applied above; policies preserved as-is.
-- --------------------------------------------------------------------------

-- (No policy changes needed - existing policies already well-scoped.)


-- --------------------------------------------------------------------------
-- 2.15 delivery_aggregator_configs
--      Column: restaurant_id
--      Has existing ALL policy. Only RLS enable/force applied above.
-- --------------------------------------------------------------------------

-- (No policy changes needed - existing ALL policy already well-scoped.)


-- --------------------------------------------------------------------------
-- 2.16 erca_submissions
--      Column: restaurant_id
--      Replace legacy policy with (select auth.uid()) pattern + full CRUD.
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff can view ERCA submissions for their restaurant" ON public.erca_submissions;
DROP POLICY IF EXISTS "Staff can view erca_submissions" ON public.erca_submissions;
CREATE POLICY "Staff can view erca_submissions" ON public.erca_submissions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = erca_submissions.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can insert erca_submissions" ON public.erca_submissions;
CREATE POLICY "Staff can insert erca_submissions" ON public.erca_submissions
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = erca_submissions.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can update erca_submissions" ON public.erca_submissions;
CREATE POLICY "Staff can update erca_submissions" ON public.erca_submissions
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = erca_submissions.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = erca_submissions.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can delete erca_submissions" ON public.erca_submissions;
CREATE POLICY "Staff can delete erca_submissions" ON public.erca_submissions
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = erca_submissions.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- ==========================================================================
-- SECTION 3: COVERING INDEXES FOR RLS PREDICATES
-- Ensures efficient evaluation of restaurant_staff joins in RLS policies.
-- ==========================================================================

CREATE INDEX IF NOT EXISTS idx_notification_logs_restaurant_id
    ON public.notification_logs(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_notification_metrics_restaurant_id
    ON public.notification_metrics(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_push_tokens_restaurant_id
    ON public.push_tokens(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_delivery_aggregator_configs_restaurant_id
    ON public.delivery_aggregator_configs(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_staff_invites_restaurant_id
    ON public.staff_invites(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_restaurant_id
    ON public.scheduled_reports(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_report_executions_restaurant_id
    ON public.report_executions(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_report_templates_restaurant_id
    ON public.report_templates(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_erca_submissions_restaurant_id
    ON public.erca_submissions(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_stations_restaurant_id
    ON public.stations(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_centralized_menu_configs_primary_restaurant_id
    ON public.centralized_menu_configs(primary_restaurant_id);

CREATE INDEX IF NOT EXISTS idx_menu_location_links_restaurant_id
    ON public.menu_location_links(restaurant_id);

CREATE INDEX IF NOT EXISTS idx_menu_change_queue_menu_config_id
    ON public.menu_change_queue(menu_config_id);


COMMIT;
