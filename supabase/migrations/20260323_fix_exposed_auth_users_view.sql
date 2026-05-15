-- =========================================================
-- CRIT-001: Fix Exposed auth.users in Public View
-- Security fix for pre-production remediation
-- =========================================================
-- Issue: The view restaurant_staff_with_users exposes auth.users 
-- table in a public schema view without security_invoker=on.
-- This allows any authenticated user to potentially access 
-- sensitive authentication data.
-- =========================================================

BEGIN;

-- Drop the existing view first
DROP VIEW IF EXISTS public.restaurant_staff_with_users;

-- Recreate the view with security_invoker=on
-- This ensures RLS policies are enforced when accessing the view
CREATE OR REPLACE VIEW public.restaurant_staff_with_users AS
SELECT 
    rs.id,
    rs.user_id,
    rs.restaurant_id,
    rs.role,
    rs.is_active,
    rs.created_at,
    u.email,
    u.raw_user_meta_data->>'full_name' AS full_name,
    u.raw_user_meta_data->>'name' AS name,
    u.raw_user_meta_data->>'first_name' AS first_name,
    u.raw_user_meta_data->>'last_name' AS last_name
FROM public.restaurant_staff rs
LEFT JOIN auth.users u ON rs.user_id = u.id;

-- Set security_invoker=on to enforce RLS policies
-- This is critical for Postgres 15+ to ensure the view runs 
-- with the privileges of the caller, not the view owner
ALTER VIEW public.restaurant_staff_with_users SET (security_invoker = on);

-- Revoke all permissions and re-grant with proper restrictions
REVOKE ALL ON public.restaurant_staff_with_users FROM PUBLIC;
REVOKE ALL ON public.restaurant_staff_with_users FROM authenticated;
REVOKE ALL ON public.restaurant_staff_with_users FROM anon;

-- Grant SELECT only to authenticated users
-- RLS on restaurant_staff will filter what they can see
GRANT SELECT ON public.restaurant_staff_with_users TO authenticated;

-- Service role needs explicit grant for admin operations
GRANT SELECT ON public.restaurant_staff_with_users TO service_role;

-- Add comment for documentation
COMMENT ON VIEW public.restaurant_staff_with_users IS 
'Secure view of restaurant_staff joining with auth.users. Uses security_invoker=on to enforce RLS policies. Users can only see staff records for restaurants they belong to via restaurant_staff RLS policies.';

COMMIT;
