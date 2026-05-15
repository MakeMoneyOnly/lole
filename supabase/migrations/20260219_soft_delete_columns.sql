-- ============================================================================
-- Migration: Add Soft Delete Columns to Key Tables
-- 
-- Addresses PLATFORM_AUDIT finding DB-3: Missing soft delete for some tables
-- 
-- This migration adds `deleted_at` column to key tables for soft delete support.
-- Soft delete allows for:
-- - Data recovery after accidental deletion
-- - Audit trail preservation
-- - Referential integrity maintenance
-- ============================================================================

-- Add deleted_at column to restaurants table
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at column to menu_items table
ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at column to menu_categories table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
        ALTER TABLE public.categories
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

-- Add deleted_at column to tables table
ALTER TABLE public.tables
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at column to staff table
ALTER TABLE public.restaurant_staff
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at column to orders table (for cancelled/expired orders)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at column to guests table
ALTER TABLE public.guests
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at column to guests_visits table
ALTER TABLE public.guest_visits
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at column to alert_rules table
ALTER TABLE public.alert_rules
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at column to delivery_partners table
ALTER TABLE public.delivery_partners
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ============================================================================
-- Create indexes for soft delete queries
-- ============================================================================

-- Index for finding non-deleted records (common query pattern)
CREATE INDEX IF NOT EXISTS idx_restaurants_not_deleted 
ON public.restaurants(id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_not_deleted 
ON public.menu_items(restaurant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tables_not_deleted 
ON public.tables(restaurant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_staff_not_deleted 
ON public.restaurant_staff(restaurant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_not_deleted 
ON public.orders(restaurant_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_guests_not_deleted 
ON public.guests(restaurant_id) WHERE deleted_at IS NULL;

-- Index for finding deleted records (for cleanup/recovery)
CREATE INDEX IF NOT EXISTS idx_restaurants_deleted 
ON public.restaurants(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_deleted 
ON public.menu_items(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_deleted 
ON public.orders(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- Create helper functions for soft delete operations
-- ============================================================================

-- Function to soft delete a record
CREATE OR REPLACE FUNCTION public.soft_delete(
    table_name TEXT,
    record_id UUID,
    deleted_by UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result BOOLEAN;
BEGIN
    EXECUTE format('
        UPDATE public.%I 
        SET deleted_at = NOW() 
        WHERE id = $1 AND deleted_at IS NULL
    ', table_name)
    USING record_id;
    
    GET DIAGNOSTICS result = ROW_COUNT;
    RETURN result > 0;
END;
$$;

-- Function to restore a soft-deleted record
CREATE OR REPLACE FUNCTION public.restore_deleted(
    table_name TEXT,
    record_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result BOOLEAN;
BEGIN
    EXECUTE format('
        UPDATE public.%I 
        SET deleted_at = NULL 
        WHERE id = $1 AND deleted_at IS NOT NULL
    ', table_name)
    USING record_id;
    
    GET DIAGNOSTICS result = ROW_COUNT;
    RETURN result > 0;
END;
$$;

-- Function to permanently delete old soft-deleted records
CREATE OR REPLACE FUNCTION public.permanent_delete_old_records(
    table_name TEXT,
    days_old INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    EXECUTE format('
        DELETE FROM public.%I 
        WHERE deleted_at IS NOT NULL 
        AND deleted_at < NOW() - INTERVAL ''%s days''
    ', table_name, days_old);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Function to count soft-deleted records by table
CREATE OR REPLACE FUNCTION public.count_deleted_records(
    table_name TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    count_result INTEGER;
BEGIN
    EXECUTE format('
        SELECT COUNT(*) FROM public.%I WHERE deleted_at IS NOT NULL
    ', table_name)
    INTO count_result;
    
    RETURN count_result;
END;
$$;

-- ============================================================================
-- Update RLS policies to exclude soft-deleted records by default
-- ============================================================================

-- Note: Existing policies already filter by restaurant_id
-- Adding deleted_at IS NULL conditions would require updating each policy
-- This is done via separate policies for clarity

-- Example: Create a policy that excludes soft-deleted menu items
-- This is additive to existing policies
CREATE POLICY "Soft deleted menu items are not visible"
    ON public.menu_items FOR SELECT
    USING (deleted_at IS NULL);

-- ============================================================================
-- Create views for commonly accessed data excluding soft-deleted records
-- ============================================================================

-- View for active menu items
CREATE OR REPLACE VIEW public.active_menu_items AS
SELECT * FROM public.menu_items
WHERE deleted_at IS NULL;

-- View for active restaurants
CREATE OR REPLACE VIEW public.active_restaurants AS
SELECT * FROM public.restaurants
WHERE deleted_at IS NULL;

-- View for active tables
CREATE OR REPLACE VIEW public.active_tables AS
SELECT * FROM public.tables
WHERE deleted_at IS NULL;

-- View for active staff
CREATE OR REPLACE VIEW public.active_restaurant_staff AS
SELECT * FROM public.restaurant_staff
WHERE deleted_at IS NULL;

-- ============================================================================
-- Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.restaurants.deleted_at IS 'Timestamp when the restaurant was soft deleted. NULL means not deleted.';
COMMENT ON COLUMN public.menu_items.deleted_at IS 'Timestamp when the menu item was soft deleted. NULL means not deleted.';
COMMENT ON COLUMN public.tables.deleted_at IS 'Timestamp when the table was soft deleted. NULL means not deleted.';
COMMENT ON COLUMN public.restaurant_staff.deleted_at IS 'Timestamp when the staff member was soft deleted. NULL means not deleted.';
COMMENT ON COLUMN public.orders.deleted_at IS 'Timestamp when the order was soft deleted (cancelled/expired). NULL means not deleted.';
COMMENT ON COLUMN public.guests.deleted_at IS 'Timestamp when the guest was soft deleted. NULL means not deleted.';

COMMENT ON FUNCTION public.soft_delete(TEXT, UUID, UUID) IS 'Soft deletes a record by setting deleted_at to NOW(). Returns true if successful.';
COMMENT ON FUNCTION public.restore_deleted(TEXT, UUID) IS 'Restores a soft-deleted record by setting deleted_at to NULL. Returns true if successful.';
COMMENT ON FUNCTION public.permanent_delete_old_records(TEXT, INTEGER) IS 'Permanently deletes records that have been soft-deleted for more than the specified days. Returns count of deleted records.';
COMMENT ON FUNCTION public.count_deleted_records(TEXT) IS 'Returns the count of soft-deleted records in the specified table.';

-- ============================================================================
-- Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.soft_delete(TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_deleted(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.permanent_delete_old_records(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_deleted_records(TEXT) TO authenticated;

GRANT SELECT ON public.active_menu_items TO authenticated;
GRANT SELECT ON public.active_restaurants TO authenticated;
GRANT SELECT ON public.active_tables TO authenticated;
GRANT SELECT ON public.active_restaurant_staff TO authenticated;