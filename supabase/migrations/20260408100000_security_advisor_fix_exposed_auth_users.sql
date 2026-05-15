-- ============================================================================
-- Migration: 20260408100000_security_advisor_fix_exposed_auth_users.sql
-- ============================================================================
--
-- Purpose: Eliminate direct auth.users reference in public schema by introducing
--          a trigger-maintained user_profiles table, resolving Supabase Security
--          Advisor finding LINT-0002 (auth_users_exposed).
--
-- Background: The view public.restaurant_staff_with_users directly joins
--             auth.users, which is flagged by the Supabase Security Advisor as
--             LINT-0002. A prior migration (20260323_fix_exposed_auth_users_view.sql)
--             added security_invoker=on and tightened grants, but the view still
--             references auth.users directly, which violates the AGENTS.md
--             platform guardrail:
--
--               "If a user profile surface is needed, use a dedicated public
--                profile table maintained by trigger."
--
-- Approach:
--   1. Create public.user_profiles table mirroring needed auth.users fields.
--   2. Create a trigger on auth.users that syncs inserts/updates into
--      user_profiles (SECURITY DEFINER with explicit search_path).
--   3. Backfill existing auth.users rows into user_profiles.
--   4. Enable and FORCE RLS on user_profiles with scoped policies.
--   5. Add covering indexes for RLS predicates and lookups.
--   6. Recreate restaurant_staff_with_users to join user_profiles instead
--      of auth.users.
--   7. Set security_invoker=on on the view and apply least-privilege grants.
--
-- Safety guarantees:
--   - Uses IF NOT EXISTS / IF EXISTS throughout for idempotency.
--   - Wrapped in BEGIN/COMMIT transaction block.
--   - Trigger function uses SECURITY DEFINER with SET search_path per AGENTS.md.
--   - RLS is both enabled and FORCED on user_profiles.
--   - ON CONFLICT DO UPDATE makes backfill safe for re-runs.
--   - View is dropped before recreation to avoid dependency errors.
--
-- Per AGENTS.md:
--   - "Never expose auth.users in public/exposed schemas."
--   - "Enable and enforce RLS on all tenant-scoped tables."
--   - "Set explicit search_path in security-sensitive functions."
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- Step 1: Create user_profiles table
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    name TEXT,
    first_name TEXT,
    last_name TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- Step 2: Create trigger function to keep user_profiles in sync with
--         auth.users
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.user_profiles (id, email, full_name, name, first_name, last_name)
        VALUES (
            NEW.id,
            NEW.email,
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            NEW.raw_user_meta_data->>'first_name',
            NEW.raw_user_meta_data->>'last_name'
        )
        ON CONFLICT (id) DO UPDATE SET
            email     = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            name      = EXCLUDED.name,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            updated_at = NOW();
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.email IS DISTINCT FROM NEW.email
            OR OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data
        THEN
            INSERT INTO public.user_profiles (id, email, full_name, name, first_name, last_name)
            VALUES (
                NEW.id,
                NEW.email,
                NEW.raw_user_meta_data->>'full_name',
                NEW.raw_user_meta_data->>'name',
                NEW.raw_user_meta_data->>'first_name',
                NEW.raw_user_meta_data->>'last_name'
            )
            ON CONFLICT (id) DO UPDATE SET
                email      = EXCLUDED.email,
                full_name  = EXCLUDED.full_name,
                name       = EXCLUDED.name,
                first_name = EXCLUDED.first_name,
                last_name  = EXCLUDED.last_name,
                updated_at = NOW();
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------------
-- Step 3: Create triggers on auth.users
-- --------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_sync_user_profile ON auth.users;

CREATE TRIGGER trg_sync_user_profile
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_profile();

-- --------------------------------------------------------------------------
-- Step 4: Backfill existing user_profiles from auth.users
-- --------------------------------------------------------------------------

INSERT INTO public.user_profiles (id, email, full_name, name, first_name, last_name)
SELECT
    u.id,
    u.email,
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'first_name',
    u.raw_user_meta_data->>'last_name'
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = EXCLUDED.full_name,
    name       = EXCLUDED.name,
    first_name = EXCLUDED.first_name,
    last_name  = EXCLUDED.last_name,
    updated_at = NOW();

-- --------------------------------------------------------------------------
-- Step 5: Enable RLS and FORCE RLS on user_profiles
-- --------------------------------------------------------------------------

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- Step 6: Add RLS policies for user_profiles
-- --------------------------------------------------------------------------

-- Users can read their own profile
DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;
CREATE POLICY user_profiles_select_own ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (id = (SELECT auth.uid()));

-- Staff can view profiles of users who belong to the same restaurant
DROP POLICY IF EXISTS user_profiles_select_same_restaurant ON public.user_profiles;
CREATE POLICY user_profiles_select_same_restaurant ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.user_id = (SELECT auth.uid())
              AND rs.is_active = true
              AND rs.user_id IN (
                  SELECT rs2.user_id
                  FROM public.restaurant_staff rs2
                  WHERE rs2.restaurant_id = rs.restaurant_id
                    AND rs2.is_active = true
              )
              AND user_profiles.id IN (
                  SELECT rs3.user_id
                  FROM public.restaurant_staff rs3
                  WHERE rs3.restaurant_id = rs.restaurant_id
                    AND rs3.is_active = true
              )
        )
    );

-- Service role can read all profiles
DROP POLICY IF EXISTS user_profiles_select_service_role ON public.user_profiles;
CREATE POLICY user_profiles_select_service_role ON public.user_profiles
    FOR SELECT
    TO service_role
    USING (true);

-- --------------------------------------------------------------------------
-- Step 7: Add indexes
-- --------------------------------------------------------------------------

-- Primary key on id already provides index for id lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- --------------------------------------------------------------------------
-- Step 8: Recreate restaurant_staff_with_users view using user_profiles
--          instead of auth.users
-- --------------------------------------------------------------------------

DROP VIEW IF EXISTS public.restaurant_staff_with_users;

CREATE VIEW public.restaurant_staff_with_users AS
SELECT
    rs.id,
    rs.user_id,
    rs.restaurant_id,
    rs.role,
    rs.is_active,
    rs.created_at,
    up.email,
    up.full_name,
    up.name,
    up.first_name,
    up.last_name
FROM public.restaurant_staff rs
LEFT JOIN public.user_profiles up ON rs.user_id = up.id;

-- --------------------------------------------------------------------------
-- Step 9: Set security_invoker on the view
-- --------------------------------------------------------------------------

ALTER VIEW public.restaurant_staff_with_users SET (security_invoker = on);

-- --------------------------------------------------------------------------
-- Step 10: Revoke and re-grant permissions
-- --------------------------------------------------------------------------

REVOKE ALL ON public.restaurant_staff_with_users FROM PUBLIC;
REVOKE ALL ON public.restaurant_staff_with_users FROM anon;
GRANT SELECT ON public.restaurant_staff_with_users TO authenticated;
GRANT SELECT ON public.restaurant_staff_with_users TO service_role;

-- --------------------------------------------------------------------------
-- Step 11: Add comments
-- --------------------------------------------------------------------------

COMMENT ON TABLE public.user_profiles IS 'Trigger-maintained profile table. Replaces direct auth.users access in public schema. Synced via trigger on auth.users.';

COMMENT ON VIEW public.restaurant_staff_with_users IS 'Secure view of restaurant_staff with user profile data. Uses trigger-maintained user_profiles instead of direct auth.users reference. security_invoker=on enforces RLS.';

COMMIT;
