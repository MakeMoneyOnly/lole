-- ============================================================================
-- Migration: 20260408150000_security_advisor_security_invoker_views.sql
-- ============================================================================
--
-- Purpose:
--   Ensure ALL views in the public schema have security_invoker = on.
--
-- Background:
--   The Supabase Security Advisor flagged 7 views in the public schema that
--   lack security_invoker = on. In PostgreSQL 15+, views default to
--   SECURITY DEFINER, meaning they execute with the creator's privileges
--   rather than the calling user's. This bypasses Row Level Security (RLS)
--   on the underlying base tables — a critical multi-tenant isolation gap.
--
-- Affected views (from live Security Advisor query):
--   1. delivery_partner_integrations
--   2. restaurant_plan_info
--   3. active_menu_items
--   4. active_restaurants
--   5. active_tables
--   6. active_restaurant_staff
--   7. restaurant_staff_with_users
--
-- Prior migration attempts:
--   - 20260323_add_security_invoker_to_views.sql
--       Applied to: active_menu_items, active_restaurants, active_tables,
--                   active_restaurant_staff, delivery_partner_integrations
--   - 20260324100000_add_security_invoker_to_restaurant_plan_info.sql
--       Applied to: restaurant_plan_info
--   - 20260408100000_security_advisor_fix_exposed_auth_users.sql
--       Applied to: restaurant_staff_with_users
--
--   Despite these prior migrations, the live database still shows the views
--   without security_invoker. This can happen if:
--     1. The prior migrations were never applied to the remote database.
--     2. The views were recreated (e.g., by a subsequent migration or
--        manual DDL) which resets the reloptions.
--
--   This migration is fully idempotent and will set security_invoker = on
--   on ALL 7 views regardless of their current state. It can be re-run
--   safely at any time.
--
-- Security impact:
--   Without security_invoker = on, any role with SELECT on these views
--   effectively bypasses RLS on the underlying tables because the view
--   executes as its owner (typically the postgres superuser). In a
--   multi-tenant system, this means a tenant could read data belonging
--   to another tenant. Setting security_invoker = on ensures the view
--   runs as the calling user, respecting all RLS policies.
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. delivery_partner_integrations
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'delivery_partner_integrations' AND c.relkind = 'v'
    ) THEN
        ALTER VIEW public.delivery_partner_integrations SET (security_invoker = on);
    END IF;
END $$;

COMMENT ON VIEW public.delivery_partner_integrations IS 'Integrations between restaurants and delivery partners. security_invoker=on ensures RLS is enforced on underlying tables.';

-- ---------------------------------------------------------------------------
-- 2. restaurant_plan_info
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'restaurant_plan_info' AND c.relkind = 'v'
    ) THEN
        ALTER VIEW public.restaurant_plan_info SET (security_invoker = on);
    END IF;
END $$;

COMMENT ON VIEW public.restaurant_plan_info IS 'Restaurant subscription plan details. security_invoker=on ensures RLS is enforced on underlying tables.';

-- ---------------------------------------------------------------------------
-- 3. active_menu_items
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'active_menu_items' AND c.relkind = 'v'
    ) THEN
        ALTER VIEW public.active_menu_items SET (security_invoker = on);
    END IF;
END $$;

COMMENT ON VIEW public.active_menu_items IS 'Currently active menu items for restaurants. security_invoker=on ensures RLS is enforced on underlying tables.';

-- ---------------------------------------------------------------------------
-- 4. active_restaurants
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'active_restaurants' AND c.relkind = 'v'
    ) THEN
        ALTER VIEW public.active_restaurants SET (security_invoker = on);
    END IF;
END $$;

COMMENT ON VIEW public.active_restaurants IS 'Currently active restaurants. security_invoker=on ensures RLS is enforced on underlying tables.';

-- ---------------------------------------------------------------------------
-- 5. active_tables
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'active_tables' AND c.relkind = 'v'
    ) THEN
        ALTER VIEW public.active_tables SET (security_invoker = on);
    END IF;
END $$;

COMMENT ON VIEW public.active_tables IS 'Currently active restaurant tables. security_invoker=on ensures RLS is enforced on underlying tables.';

-- ---------------------------------------------------------------------------
-- 6. active_restaurant_staff
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'active_restaurant_staff' AND c.relkind = 'v'
    ) THEN
        ALTER VIEW public.active_restaurant_staff SET (security_invoker = on);
    END IF;
END $$;

COMMENT ON VIEW public.active_restaurant_staff IS 'Currently active restaurant staff members. security_invoker=on ensures RLS is enforced on underlying tables.';

-- ---------------------------------------------------------------------------
-- 7. restaurant_staff_with_users
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'restaurant_staff_with_users' AND c.relkind = 'v'
    ) THEN
        ALTER VIEW public.restaurant_staff_with_users SET (security_invoker = on);
    END IF;
END $$;

COMMENT ON VIEW public.restaurant_staff_with_users IS 'Restaurant staff joined with user profile data (no direct auth.users exposure). security_invoker=on ensures RLS is enforced on underlying tables.';

-- ---------------------------------------------------------------------------
-- Verification: check for any public-schema views still missing security_invoker
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_rec RECORD;
    v_count INT := 0;
BEGIN
    FOR v_rec IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND c.relkind = 'v'
        AND NOT c.reloptions @> ARRAY['security_invoker=on']
    LOOP
        RAISE WARNING 'View missing security_invoker=on: %', v_rec.relname;
        v_count := v_count + 1;
    END LOOP;

    IF v_count = 0 THEN
        RAISE NOTICE 'Verification passed: all views have security_invoker=on.';
    ELSE
        RAISE WARNING 'Verification found % view(s) without security_invoker=on.', v_count;
    END IF;
END $$;

COMMIT;
