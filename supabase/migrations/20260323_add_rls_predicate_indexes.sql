-- =============================================================================
-- Migration: Add Missing Indexes for RLS Predicates
-- Issue: HIGH-017 - Missing indexes on columns used by RLS policies
-- Created: 2026-03-23
-- =============================================================================

-- RLS policies frequently query restaurant_staff for tenant isolation.
-- This composite index covers the most common RLS predicate pattern:
-- WHERE user_id = auth.uid() AND is_active = true

-- Composite index for RLS tenant isolation checks
-- Covers: user_id + restaurant_id + is_active (common RLS pattern)
CREATE INDEX IF NOT EXISTS idx_restaurant_staff_user_restaurant_active
    ON public.restaurant_staff(user_id, restaurant_id, is_active);

-- Additional index for restaurant-scoped RLS checks
-- Covers: restaurant_id + is_active (for staff listing within restaurant)
CREATE INDEX IF NOT EXISTS idx_restaurant_staff_restaurant_active
    ON public.restaurant_staff(restaurant_id, is_active);

-- =============================================================================
-- Indexes for orders table RLS predicates
-- =============================================================================

-- Orders are frequently filtered by restaurant_id + status in RLS policies
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status
    ON public.orders(restaurant_id, status);

-- Orders RLS also checks by guest_fingerprint for guest access
CREATE INDEX IF NOT EXISTS idx_orders_guest_fingerprint
    ON public.orders(guest_fingerprint)
    WHERE guest_fingerprint IS NOT NULL;

-- =============================================================================
-- Indexes for order_items table RLS predicates
-- =============================================================================

-- Order items inherit tenant scope from orders via order_id
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON public.order_items(order_id);

-- =============================================================================
-- Indexes for menu_items table RLS predicates
-- =============================================================================

-- Menu items are frequently filtered by restaurant_id + availability
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_available
    ON public.menu_items(restaurant_id, is_available);

-- =============================================================================
-- Indexes for tables table RLS predicates
-- =============================================================================

-- Tables are filtered by restaurant_id + active status
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_active
    ON public.tables(restaurant_id, is_active);

-- =============================================================================
-- Indexes for payments table RLS predicates
-- =============================================================================

-- Payments are filtered by restaurant_id via order relationship
CREATE INDEX IF NOT EXISTS idx_payments_order_id
    ON public.payments(order_id);

-- Payments by restaurant (denormalized for RLS performance)
CREATE INDEX IF NOT EXISTS idx_payments_restaurant_id
    ON public.payments(restaurant_id);

-- =============================================================================
-- Indexes for kds_order_items table RLS predicates
-- =============================================================================

-- KDS items filtered by station and restaurant
CREATE INDEX IF NOT EXISTS idx_kds_order_items_station
    ON public.kds_order_items(station);

-- =============================================================================
-- Indexes for table_sessions table RLS predicates
-- =============================================================================

-- Table sessions filtered by restaurant_id + status
CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant_status
    ON public.table_sessions(restaurant_id, status);

-- Table sessions by table_id for lookup
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id
    ON public.table_sessions(table_id);

-- =============================================================================
-- Indexes for guests table RLS predicates
-- =============================================================================

-- Guests filtered by restaurant_id
CREATE INDEX IF NOT EXISTS idx_guests_restaurant_id
    ON public.guests(restaurant_id);

-- =============================================================================
-- Indexes for audit_logs table (tenant-scoped queries)
-- =============================================================================

-- Audit logs frequently queried by restaurant_id + created_at
CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant_created
    ON public.audit_logs(restaurant_id, created_at DESC);

-- =============================================================================
-- Indexes for device_tokens table RLS predicates
-- =============================================================================

-- Device tokens filtered by user_id
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id
    ON public.device_tokens(user_id);

-- =============================================================================
-- Indexes for notifications table RLS predicates
-- =============================================================================

-- Notifications filtered by user_id + status
CREATE INDEX IF NOT EXISTS idx_notifications_user_status
    ON public.notifications(user_id, status);

-- =============================================================================
-- Comment documenting the purpose of these indexes
-- =============================================================================

COMMENT ON INDEX idx_restaurant_staff_user_restaurant_active IS
'Composite index for RLS tenant isolation checks - covers user_id + restaurant_id + is_active pattern used in RLS policies';

COMMENT ON INDEX idx_restaurant_staff_restaurant_active IS
'Index for restaurant-scoped staff queries within RLS policies';

COMMENT ON INDEX idx_orders_restaurant_status IS
'Index for orders RLS policies filtering by restaurant_id and status';

COMMENT ON INDEX idx_orders_guest_fingerprint IS
'Partial index for guest-scoped order access in RLS policies';

COMMENT ON INDEX idx_menu_items_restaurant_available IS
'Index for menu_items RLS policies filtering by restaurant_id and availability';

COMMENT ON INDEX idx_tables_restaurant_active IS
'Index for tables RLS policies filtering by restaurant_id and active status';

COMMENT ON INDEX idx_payments_restaurant_id IS
'Index for payments RLS policies filtering by restaurant_id';

COMMENT ON INDEX idx_table_sessions_restaurant_status IS
'Index for table_sessions RLS policies filtering by restaurant_id and status';

COMMENT ON INDEX idx_guests_restaurant_id IS
'Index for guests RLS policies filtering by restaurant_id';

COMMENT ON INDEX idx_audit_logs_restaurant_created IS
'Index for audit_logs tenant-scoped queries with temporal ordering';

COMMENT ON INDEX idx_device_tokens_user_id IS
'Index for device_tokens RLS policies filtering by user_id';

COMMENT ON INDEX idx_notifications_user_status IS
'Index for notifications RLS policies filtering by user_id and status';
