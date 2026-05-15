-- MED-001 & MED-004: Idempotency and Security Fixes
-- Date: 2026-03-23
-- Description: 
--   1. Add idempotency guards to RLS policies and triggers
--   2. Add explicit search_path to SECURITY DEFINER trigger function

BEGIN;

-- ============================================================================
-- MED-004: Fix trigger function with explicit search_path
-- ============================================================================

-- Recreate the trigger function with explicit search_path for security
CREATE OR REPLACE FUNCTION public.update_table_status_on_order()
RETURNS trigger 
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status IN ('pending', 'acknowledged', 'preparing', 'ready', 'served') THEN
       UPDATE public.tables 
       SET status = 'occupied', active_order_id = NEW.id 
       WHERE table_number = NEW.table_number AND restaurant_id = NEW.restaurant_id;
    ELSIF TG_OP = 'UPDATE' AND NEW.status IN ('completed', 'cancelled') AND OLD.status NOT IN ('completed', 'cancelled') THEN
       -- Check if there are other active orders for this table
       IF NOT EXISTS (
           SELECT 1 FROM public.orders 
           WHERE table_number = NEW.table_number 
             AND restaurant_id = NEW.restaurant_id 
             AND id != NEW.id 
             AND status NOT IN ('completed', 'cancelled')
       ) THEN
           UPDATE public.tables 
           SET status = 'available', active_order_id = NULL 
           WHERE table_number = NEW.table_number AND restaurant_id = NEW.restaurant_id;
       END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MED-001: Add idempotency guards to initial schema policies
-- These policies were created without DROP POLICY IF EXISTS guards
-- ============================================================================

-- Restaurants policies
DROP POLICY IF EXISTS "Public Read Active Restaurants" ON public.restaurants;
CREATE POLICY "Public Read Active Restaurants" ON public.restaurants FOR SELECT USING (is_active = true);

-- Menu items policies  
DROP POLICY IF EXISTS "Public Read Menu" ON public.menu_items;
CREATE POLICY "Public Read Menu" ON public.menu_items FOR SELECT USING (is_available = true);

-- Categories policies
DROP POLICY IF EXISTS "Public Read Categories" ON public.categories;
CREATE POLICY "Public Read Categories" ON public.categories FOR SELECT USING (is_active = true);

-- Orders policies
DROP POLICY IF EXISTS "Anon Insert Orders" ON public.orders;
CREATE POLICY "Anon Insert Orders" ON public.orders FOR INSERT WITH CHECK (true);

-- Order items policies
DROP POLICY IF EXISTS "Anon Insert Order Items" ON public.order_items;
CREATE POLICY "Anon Insert Order Items" ON public.order_items FOR INSERT WITH CHECK (true);

-- ============================================================================
-- MED-001: Add idempotency guards to triggers in initial schema
-- ============================================================================

-- Drop existing triggers before recreating (idempotency)
DROP TRIGGER IF EXISTS update_restaurants_modtime ON public.restaurants;
DROP TRIGGER IF EXISTS update_menu_items_modtime ON public.menu_items;
DROP TRIGGER IF EXISTS update_orders_modtime ON public.orders;

-- Recreate triggers with proper idempotency support
CREATE TRIGGER update_restaurants_modtime 
    BEFORE UPDATE ON public.restaurants 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_menu_items_modtime 
    BEFORE UPDATE ON public.menu_items 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_modtime 
    BEFORE UPDATE ON public.orders 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;

-- ============================================================================
-- Documentation
-- ============================================================================
-- 
-- MED-001 Fix: Added DROP POLICY IF EXISTS and DROP TRIGGER IF EXISTS guards
-- to allow migrations to be re-run without errors.
--
-- MED-004 Fix: Added explicit SET search_path = pg_catalog, public to the
-- SECURITY DEFINER function update_table_status_on_order() to prevent
-- search path injection attacks. This follows the security best practice
-- for SECURITY DEFINER functions as documented in PostgreSQL documentation.
--
-- References:
-- - https://www.postgresql.org/docs/current/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY
-- - AGENTS.md: "Set explicit search_path in security-sensitive functions"
