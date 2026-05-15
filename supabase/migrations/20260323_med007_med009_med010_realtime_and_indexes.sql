-- MED-007, MED-009, MED-010: Realtime Configuration, Composite Indexes, and GIN Indexes
-- Date: 2026-03-23
-- Description:
--   1. Add critical tables to realtime publication for KDS and order tracking
--   2. Add composite indexes for common query patterns
--   3. Add GIN indexes for frequently queried JSONB columns

BEGIN;

-- ============================================================================
-- MED-007: Add tables to realtime publication
-- ============================================================================

-- Add kds_order_items for KDS real-time updates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'kds_order_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE kds_order_items;
    END IF;
END $$;

-- Add table_sessions for session tracking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'table_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE table_sessions;
    END IF;
END $$;

-- Add service_requests for staff notifications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'service_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE service_requests;
    END IF;
END $$;

-- Add guests for guest profile updates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'guests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE guests;
    END IF;
END $$;

-- ============================================================================
-- MED-009: Composite indexes for common queries
-- ============================================================================

-- Orders: Common query pattern for dashboard (restaurant + status + created_at)
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_created
    ON public.orders(restaurant_id, status, created_at DESC);

-- Orders: Query for active orders by restaurant
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_active
    ON public.orders(restaurant_id, created_at DESC)
    WHERE status NOT IN ('completed', 'cancelled');

-- Order items: Query by order with status
CREATE INDEX IF NOT EXISTS idx_order_items_order_status
    ON public.order_items(order_id, status);

-- Menu items: Query by restaurant with availability
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_available
    ON public.menu_items(restaurant_id, is_available);

-- Menu items: Query by restaurant and category
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_category
    ON public.menu_items(restaurant_id, category_id);

-- Tables: Query by restaurant with status
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_status
    ON public.tables(restaurant_id, status);

-- KDS order items: Query by restaurant, station, status
CREATE INDEX IF NOT EXISTS idx_kds_order_items_restaurant_station_status
    ON public.kds_order_items(restaurant_id, station, status);

-- Payments: Query by restaurant and status
CREATE INDEX IF NOT EXISTS idx_payments_restaurant_status
    ON public.payments(restaurant_id, status);

-- Guests: Query by restaurant with phone (for lookup)
CREATE INDEX IF NOT EXISTS idx_guests_restaurant_phone
    ON public.guests(restaurant_id, phone);

-- Table sessions: Query by restaurant with active status
CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant_active
    ON public.table_sessions(restaurant_id, ended_at)
    WHERE ended_at IS NULL;

-- Service requests: Query by restaurant with pending status
CREATE INDEX IF NOT EXISTS idx_service_requests_restaurant_pending
    ON public.service_requests(restaurant_id, status, created_at DESC)
    WHERE status = 'pending';

-- ============================================================================
-- MED-010: GIN indexes for JSONB columns
-- ============================================================================

-- Orders: items JSONB column (for querying order item details)
CREATE INDEX IF NOT EXISTS idx_orders_items_gin
    ON public.orders USING GIN (items jsonb_path_ops);

-- Menu items: dietary_tags JSONB array (for filtering by dietary preferences)
CREATE INDEX IF NOT EXISTS idx_menu_items_dietary_tags_gin
    ON public.menu_items USING GIN (dietary_tags jsonb_path_ops);

-- Menu items: name JSONB for translations (for searching by name)
CREATE INDEX IF NOT EXISTS idx_menu_items_name_gin
    ON public.menu_items USING GIN (name);

-- Categories: name JSONB for translations
CREATE INDEX IF NOT EXISTS idx_categories_name_gin
    ON public.categories USING GIN (name);

-- Restaurants: settings JSONB (for querying by configuration)
CREATE INDEX IF NOT EXISTS idx_restaurants_settings_gin
    ON public.restaurants USING GIN (settings jsonb_path_ops);

-- Guests: preferences JSONB (for querying guest preferences)
CREATE INDEX IF NOT EXISTS idx_guests_preferences_gin
    ON public.guests USING GIN (preferences jsonb_path_ops);

COMMIT;

-- ============================================================================
-- Documentation
-- ============================================================================
--
-- MED-007 Fix: Added critical tables to supabase_realtime publication:
--   - kds_order_items: Real-time KDS updates for kitchen staff
--   - table_sessions: Session tracking for table management
--   - service_requests: Staff notifications for service requests
--   - guests: Guest profile updates
--
-- MED-009 Fix: Added composite indexes for common query patterns:
--   - Dashboard queries (orders by restaurant + status + created_at)
--   - Active order queries (filtered by status)
--   - Menu queries (by restaurant + category + availability)
--   - KDS queries (by restaurant + station + status)
--   - Payment queries (by restaurant + status)
--   - Guest lookup (by restaurant + phone)
--
-- MED-010 Fix: Added GIN indexes for JSONB columns:
--   - orders.items: For querying order item details
--   - menu_items.dietary_tags: For filtering by dietary preferences
--   - menu_items.name, categories.name: For translation searches
--   - restaurants.settings: For configuration queries
--   - guests.preferences: For preference-based queries
--
-- Note: Using jsonb_path_ops for containment queries which is more compact
-- and faster for specific use cases like "does this array contain X"
