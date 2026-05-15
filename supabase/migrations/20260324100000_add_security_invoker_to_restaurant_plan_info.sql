-- ============================================================================
-- CRIT-001 Follow-up: Add security_invoker to restaurant_plan_info view
-- Date: 2026-03-24
-- Purpose: Apply security_invoker=on to restaurant_plan_info view
-- to ensure RLS policies on restaurants table are properly enforced
-- ============================================================================

-- PostgreSQL 15+ views are SECURITY DEFINER by default
-- This means they run with the privileges of the view owner
-- Setting security_invoker=on makes them run with the privileges
-- of the user querying the view, enforcing RLS policies

-- ============================================================================
-- Apply security_invoker to restaurant_plan_info view
-- ============================================================================

-- This view was created in 20260323150000_p0_subscription_plan_column.sql
-- without security_invoker=on. It exposes restaurant data including
-- plan information which should be tenant-scoped via RLS.

ALTER VIEW public.restaurant_plan_info SET (security_invoker = on);

-- ============================================================================
-- Update comment for documentation
-- ============================================================================

COMMENT ON VIEW public.restaurant_plan_info IS 
'View of restaurants providing plan information and feature flags. Uses security_invoker=on to enforce RLS policies. Users can only see restaurant plan info for restaurants they have access to via restaurants RLS policies.';

-- ============================================================================
-- Verify permissions are appropriate
-- ============================================================================

-- The view already has grants to authenticated and anon from the original migration
-- With security_invoker=on, RLS on restaurants table will filter what they can see
-- No need to change grants - they remain as-is

-- Note: anon access is appropriate here because guest users may need to check
-- if a restaurant has pro features enabled (e.g., for displaying badges in UI)
