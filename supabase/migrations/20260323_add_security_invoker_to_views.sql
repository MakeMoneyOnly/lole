-- ============================================================================
-- HIGH-006: Add security_invoker to Views
-- Date: 2026-03-23
-- Purpose: Apply security_invoker=on to all views in public schema
-- to ensure RLS policies on base tables are properly enforced
-- ============================================================================

-- PostgreSQL 15+ views are SECURITY DEFINER by default
-- This means they run with the privileges of the view owner
-- Setting security_invoker=on makes them run with the privileges
-- of the user querying the view, enforcing RLS policies

-- ============================================================================
-- Views from 20260219_soft_delete_columns.sql
-- ============================================================================

-- View for active menu items
ALTER VIEW public.active_menu_items SET (security_invoker = on);

-- View for active restaurants
ALTER VIEW public.active_restaurants SET (security_invoker = on);

-- View for active tables
ALTER VIEW public.active_tables SET (security_invoker = on);

-- View for active staff
ALTER VIEW public.active_restaurant_staff SET (security_invoker = on);

-- ============================================================================
-- Views from 20260224150000_omnichannel_schema_alignment.sql
-- ============================================================================

-- View for delivery partner integrations
ALTER VIEW public.delivery_partner_integrations SET (security_invoker = on);

-- ============================================================================
-- Add comments for documentation
-- ============================================================================

COMMENT ON VIEW public.active_menu_items IS 'View of menu_items excluding soft-deleted records. Uses security_invoker for RLS enforcement.';
COMMENT ON VIEW public.active_restaurants IS 'View of restaurants excluding soft-deleted records. Uses security_invoker for RLS enforcement.';
COMMENT ON VIEW public.active_tables IS 'View of tables excluding soft-deleted records. Uses security_invoker for RLS enforcement.';
COMMENT ON VIEW public.active_restaurant_staff IS 'View of restaurant_staff excluding soft-deleted records. Uses security_invoker for RLS enforcement.';
COMMENT ON VIEW public.delivery_partner_integrations IS 'View of delivery_partners for webhook validation. Uses security_invoker for RLS enforcement.';

-- ============================================================================
-- Grant appropriate permissions
-- ============================================================================

-- Ensure authenticated users can read from these views
-- (RLS policies on base tables will still apply due to security_invoker)
GRANT SELECT ON public.active_menu_items TO authenticated;
GRANT SELECT ON public.active_restaurants TO authenticated;
GRANT SELECT ON public.active_tables TO authenticated;
GRANT SELECT ON public.active_restaurant_staff TO authenticated;
GRANT SELECT ON public.delivery_partner_integrations TO authenticated;

-- Service role needs access for internal operations
GRANT SELECT ON public.active_menu_items TO service_role;
GRANT SELECT ON public.active_restaurants TO service_role;
GRANT SELECT ON public.active_tables TO service_role;
GRANT SELECT ON public.active_restaurant_staff TO service_role;
GRANT SELECT ON public.delivery_partner_integrations TO service_role;
