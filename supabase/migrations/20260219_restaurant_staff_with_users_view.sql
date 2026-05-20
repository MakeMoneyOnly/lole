-- Restaurant Staff With Users View
-- Date: 2026-02-19
-- Description: Creates a view that joins restaurant_staff with auth.users to provide
--              enriched staff data including email and name from the auth system.

BEGIN;

-- Create view that joins restaurant_staff with auth.users
-- This requires service role access to read from auth.users
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

-- Set security_invoker to ensure view runs with caller's privileges
-- This prevents unauthorized access to auth.users data
ALTER VIEW public.restaurant_staff_with_users SET (security_invoker = on);

-- Grant appropriate permissions
-- Service role can already access this via superuser privileges
-- Regular users should access through the API which uses service role
GRANT SELECT ON public.restaurant_staff_with_users TO authenticated;
GRANT SELECT ON public.restaurant_staff_with_users TO service_role;

-- Add comment for documentation
COMMENT ON VIEW public.restaurant_staff_with_users IS 
'Enriched view of restaurant_staff joining with auth.users. Provides email and name fields from user metadata. Requires service role for full access.';

COMMIT;
