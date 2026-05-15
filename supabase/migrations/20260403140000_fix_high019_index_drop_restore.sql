-- HIGH-019: Fix Index Drop Without Immediate Restore
-- Purpose: Ensure critical hot-path indexes are properly maintained
-- This migration combines index operations into atomic transactions
-- to prevent performance degradation during deployments.

BEGIN;

-- ============================================================================
-- Orders Hot Path Indexes
-- ============================================================================

-- Ensure orders has proper tenant scoping index
-- This was dropped in 20260309114500 and restored in 20260309120500
-- We ensure it exists here with proper covering columns
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_created
    ON public.orders (restaurant_id, status, created_at DESC);

-- Ensure order_items has item_id index for menu item lookups
CREATE INDEX IF NOT EXISTS idx_order_items_item_id
    ON public.order_items (item_id);

-- Ensure order_events has proper indexes for event queries
CREATE INDEX IF NOT EXISTS idx_order_events_order_id
    ON public.order_events (order_id);

-- ============================================================================
-- KDS Hot Path Indexes
-- ============================================================================

-- KDS items by restaurant and status for kitchen queue
CREATE INDEX IF NOT EXISTS idx_kds_order_items_restaurant_status
    ON public.kds_order_items (restaurant_id, status, created_at DESC);

-- KDS items by order for order-level queries
CREATE INDEX IF NOT EXISTS idx_kds_order_items_order_id
    ON public.kds_order_items (order_id);

-- ============================================================================
-- Guests Hot Path Indexes
-- ============================================================================

-- Guests by restaurant for CRM queries
CREATE INDEX IF NOT EXISTS idx_guests_restaurant_id
    ON public.guests (restaurant_id);

-- Guests by phone hash for contact verification
CREATE INDEX IF NOT EXISTS idx_guests_phone_hash
    ON public.guests (restaurant_id, phone_hash)
    WHERE phone_hash IS NOT NULL;

-- ============================================================================
-- Tables Hot Path Indexes
-- ============================================================================

-- Tables by restaurant for POS device queries
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_id
    ON public.tables (restaurant_id);

-- ============================================================================
-- Payments Hot Path Indexes
-- ============================================================================

-- Payments by order for order payment status
CREATE INDEX IF NOT EXISTS idx_payments_order_id
    ON public.payments (order_id);

-- ============================================================================
-- Menu Hot Path Indexes
-- ============================================================================

-- NOTE: menu_items does NOT have restaurant_id column directly.
-- Menu items are scoped to restaurants via category_id -> categories.restaurant_id
-- The idx_menu_items_category_only index already exists for this relationship.

-- Categories by restaurant (already exists, idempotent)
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id
    ON public.categories (restaurant_id);

COMMIT;

-- ============================================================================
-- Advisory Note: Index Strategy
-- ============================================================================
-- The following indexes were intentionally dropped as unused by advisor:
-- - idx_categories_restaurant_order (redundant with idx_categories_restaurant_id)
-- - idx_guest_visits_guest_visited (low traffic)
-- - idx_hardware_devices_restaurant_last_active (low traffic)
-- - idx_kds_item_events_* (event log indexes, not hot path)
-- - idx_reviews_* (low traffic)
-- - idx_staff_invites_created_by (low traffic)
-- - idx_stock_movements_item_created (low traffic)
-- - idx_supplier_invoices_purchase_order (low traffic)
-- - idx_support_tickets_created_by (low traffic)
--
-- These remain dropped as they were flagged as unused by the advisor.
-- Only hot-path indexes critical for P0 flows are restored above.
