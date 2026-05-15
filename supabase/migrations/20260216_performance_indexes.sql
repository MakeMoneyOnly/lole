-- Performance Indexes Migration
-- Date: 2026-02-16
-- Purpose: Add critical indexes for frequently queried columns
-- Addresses: COMPREHENSIVE_CODEBASE_AUDIT_REPORT Section 1.2

BEGIN;

-- =========================================================
-- ORDERS TABLE INDEXES
-- =========================================================

-- Index for order listing by restaurant, status, and recency
-- Supports: GET /api/orders, KDS order queue, merchant dashboard
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_created
    ON public.orders(restaurant_id, status, created_at DESC);

-- Index for order lookup by idempotency key (deduplication)
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key
    ON public.orders(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Index for orders by table (table management)
CREATE INDEX IF NOT EXISTS idx_orders_table
    ON public.orders(restaurant_id, table_number)
    WHERE status NOT IN ('served', 'cancelled', 'closed');

-- Index for kitchen status tracking
CREATE INDEX IF NOT EXISTS idx_orders_kitchen_status
    ON public.orders(restaurant_id, kitchen_status)
    WHERE kitchen_status IS NOT NULL;

-- =========================================================
-- MENU ITEMS TABLE INDEXES
-- =========================================================

-- Index for menu items by category and availability
-- Supports: Menu listing, category filtering
CREATE INDEX IF NOT EXISTS idx_menu_items_category_available
    ON public.menu_items(category_id, is_available);

-- Index for menu items by restaurant for quick lookup
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant
    ON public.menu_items(category_id, restaurant_id);

-- Index for popular items (by popularity score)
CREATE INDEX IF NOT EXISTS idx_menu_items_popularity
    ON public.menu_items(restaurant_id, popularity DESC)
    WHERE is_available = true;

-- Index for searching items by name
CREATE INDEX IF NOT EXISTS idx_menu_items_name_search
    ON public.menu_items USING gin(to_tsvector('simple', name));

-- =========================================================
-- CATEGORIES TABLE INDEXES
-- =========================================================

-- Index for categories by restaurant and order
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_order
    ON public.categories(restaurant_id, order_index);

-- Index for categories by section (food/drinks/etc)
CREATE INDEX IF NOT EXISTS idx_categories_section
    ON public.categories(restaurant_id, section)
    WHERE section IS NOT NULL;

-- =========================================================
-- ORDER ITEMS TABLE INDEXES
-- =========================================================

-- Index for order items by order
CREATE INDEX IF NOT EXISTS idx_order_items_order
    ON public.order_items(order_id);

-- Index for order items by status (kitchen workflow)
CREATE INDEX IF NOT EXISTS idx_order_items_status
    ON public.order_items(order_id, status)
    WHERE status IS NOT NULL;

-- Index for station-based filtering (KDS)
CREATE INDEX IF NOT EXISTS idx_order_items_station
    ON public.order_items(station, status)
    WHERE station IS NOT NULL AND status IS NOT NULL;

-- =========================================================
-- SERVICE REQUESTS TABLE INDEXES
-- =========================================================

-- Index for pending service requests
CREATE INDEX IF NOT EXISTS idx_service_requests_pending
    ON public.service_requests(restaurant_id, status, created_at DESC)
    WHERE status = 'pending';

-- Index for service requests by table
CREATE INDEX IF NOT EXISTS idx_service_requests_table
    ON public.service_requests(restaurant_id, table_number);

-- =========================================================
-- TABLES (RESTAURANT TABLES) INDEXES
-- =========================================================

-- Index for tables by restaurant
CREATE INDEX IF NOT EXISTS idx_tables_restaurant
    ON public.tables(restaurant_id, table_number);

-- Index for active tables
CREATE INDEX IF NOT EXISTS idx_tables_active
    ON public.tables(restaurant_id, status)
    WHERE is_active = true;

-- =========================================================
-- RESTAURANTS TABLE INDEXES
-- =========================================================

-- Index for restaurant lookup by slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_slug
    ON public.restaurants(slug);

-- Index for active restaurants
CREATE INDEX IF NOT EXISTS idx_restaurants_active
    ON public.restaurants(is_active)
    WHERE is_active = true;

-- =========================================================
-- AUDIT LOGS TABLE INDEXES
-- =========================================================

-- Index for audit logs by entity
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
    ON public.audit_logs(entity_type, entity_id);

-- Index for audit logs by restaurant
CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant
    ON public.audit_logs(restaurant_id, created_at DESC);

-- Index for audit logs by user
CREATE INDEX IF NOT EXISTS idx_audit_logs_user
    ON public.audit_logs(user_id, created_at DESC);

-- =========================================================
-- RESTAURANT STAFF TABLE INDEXES
-- =========================================================

-- Index for staff by user (auth check)
CREATE INDEX IF NOT EXISTS idx_restaurant_staff_user
    ON public.restaurant_staff(user_id);

-- Index for staff by restaurant
CREATE INDEX IF NOT EXISTS idx_restaurant_staff_restaurant
    ON public.restaurant_staff(restaurant_id, is_active);

-- =========================================================
-- RATE LIMIT LOGS TABLE INDEXES
-- =========================================================

-- Index for rate limit checks
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_fingerprint
    ON public.rate_limit_logs(fingerprint, action, created_at DESC);

-- =========================================================
-- REVIEWS TABLE INDEXES
-- =========================================================

-- Index for reviews by item
CREATE INDEX IF NOT EXISTS idx_reviews_item
    ON public.reviews(item_id, created_at DESC);

-- Index for reviews by restaurant
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant
    ON public.reviews(restaurant_id, created_at DESC);

COMMIT;