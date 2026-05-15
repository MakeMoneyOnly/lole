-- =========================================================
-- FORCE RLS and NULLS NOT DISTINCT Migration
-- Date: 2026-03-21
-- Purpose: Apply remaining FORCE ROW LEVEL SECURITY to tenant tables
--          and add NULLS NOT DISTINCT to unique constraints where appropriate
--
-- Background:
-- - FORCE RLS prevents table owners from bypassing RLS policies
-- - PostgreSQL 15+ NULLS NOT DISTINCT ensures unique constraints treat NULL as single value
-- =========================================================

BEGIN;

-- =========================================================
-- PART 1: Apply FORCE ROW LEVEL SECURITY to tenant tables
-- =========================================================

-- Core P0 Tables (orders, payments, table sessions)
ALTER TABLE IF EXISTS public.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.refunds FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payouts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reconciliation_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_sessions FORCE ROW LEVEL SECURITY;

-- Core Menu & Category Tables
ALTER TABLE IF EXISTS public.categories FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.menu_items FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tables FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.restaurant_staff FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_requests FORCE ROW LEVEL SECURITY;

-- Guest & Loyalty Tables
ALTER TABLE IF EXISTS public.guests FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.guest_visits FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.loyalty_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.loyalty_programs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.loyalty_transactions FORCE ROW LEVEL SECURITY;

-- Gift Card Tables
ALTER TABLE IF EXISTS public.gift_cards FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gift_card_transactions FORCE ROW LEVEL SECURITY;

-- Marketing & Campaigns
ALTER TABLE IF EXISTS public.campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.campaign_deliveries FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.segments FORCE ROW LEVEL SECURITY;

-- Team Operations
ALTER TABLE IF EXISTS public.time_entries FORCE ROW LEVEL SECURITY;

-- External Orders & Delivery
ALTER TABLE IF EXISTS public.external_orders FORCE ROW LEVEL SECURITY;

-- Operations & Inventory
ALTER TABLE IF EXISTS public.recipes FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recipe_ingredients FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_movements FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.supplier_invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.purchase_orders FORCE ROW LEVEL SECURITY;

-- KDS Tables
ALTER TABLE IF EXISTS public.kds_order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.kds_item_events FORCE ROW LEVEL SECURITY;

-- Order Events & Table Sessions
ALTER TABLE IF EXISTS public.order_events FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.table_sessions FORCE ROW LEVEL SECURITY;

-- Split Check Tables
ALTER TABLE IF EXISTS public.order_check_splits FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_check_split_items FORCE ROW LEVEL SECURITY;

-- Guest Session & Attribution Tables
ALTER TABLE IF EXISTS public.guest_menu_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_guest_attributions FORCE ROW LEVEL SECURITY;

-- Hardware & Devices
ALTER TABLE IF EXISTS public.hardware_devices FORCE ROW LEVEL SECURITY;

-- Modifier Tables
ALTER TABLE IF EXISTS public.modifier_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.modifier_options FORCE ROW LEVEL SECURITY;

-- Notification & Metrics
ALTER TABLE IF EXISTS public.notification_metrics FORCE ROW LEVEL SECURITY;

-- Delivery & Analytics
ALTER TABLE IF EXISTS public.delivery_zones FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.upsell_analytics FORCE ROW LEVEL SECURITY;

-- Offline Sync
ALTER TABLE IF EXISTS public.sync_idempotency_keys FORCE ROW LEVEL SECURITY;

-- =========================================================
-- PART 2: Add NULLS NOT DISTINCT to unique constraints
-- 
-- PostgreSQL 15+ feature: NULLS NOT DISTINCT ensures that
-- unique constraints treat NULL values as a single value,
-- rather than allowing multiple NULL rows.
--
-- Applied to unique constraints where:
-- - The column CAN be NULL
-- - We want exactly ONE row with NULL (semantic: "unset" is unique)
-- =========================================================

-- Note: Unique constraints with NOT NULL columns don't need NULLS NOT DISTINCT
-- as they already enforce single-value constraint by definition.

-- For tables with nullable columns in unique constraints that need NULLS NOT DISTINCT:
-- Examples (if they exist in your schema):
-- 
-- ALTER TABLE public.some_table DROP CONSTRAINT IF EXISTS some_unique_constraint;
-- ALTER TABLE public.some_table ADD CONSTRAINT some_unique_constraint 
--     UNIQUE (column_name) NULLS NOT DISTINCT;

-- =========================================================
-- PART 3: RLS Performance Monitoring Guidance
-- =========================================================

-- Add comment for monitoring RLS policy performance
-- This helps DBAs identify slow RLS policies using EXPLAIN ANALYZE

COMMENT ON COLUMN public.orders.restaurant_id IS 
    'Indexed for RLS policy performance - see docs/implementation/performance-slos.md';

COMMENT ON COLUMN public.order_items.order_id IS 
    'Indexed for RLS policy performance - see docs/implementation/performance-slos.md';

COMMENT ON COLUMN public.payments.order_id IS 
    'Indexed for RLS policy performance - see docs/implementation/performance-slos.md';

COMMENT ON COLUMN public.restaurant_staff.user_id IS 
    'Indexed for RLS policy performance - see docs/implementation/performance-slos.md';

COMMENT ON COLUMN public.guests.restaurant_id IS 
    'Indexed for RLS policy performance - see docs/implementation/performance-slos.md';

COMMENT ON COLUMN public.loyalty_accounts.restaurant_id IS 
    'Indexed for RLS policy performance - see docs/implementation/performance-slos.md';

COMMENT ON COLUMN public.audit_logs.restaurant_id IS 
    'Indexed for RLS policy performance - see docs/implementation/performance-slos.md';

-- =========================================================
-- Verification Query (for documentation/audit purposes)
-- =========================================================

-- Query to list all tables with FORCE RLS status:
-- SELECT 
--     schemaname,
--     tablename,
--     rowsecurity
-- FROM pg_tables 
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- Query to identify potential RLS performance issues:
-- EXPLAIN ANALYZE SELECT * FROM orders WHERE restaurant_id = 'uuid-here';

COMMIT;

-- =========================================================
-- Rollback Note:
-- To rollback FORCE RLS, run:
-- ALTER TABLE table_name NO FORCE ROW LEVEL SECURITY;
--
-- Note: This is generally NOT recommended as it reduces security.
-- FORCE RLS should only be disabled after careful security review.
-- =========================================================
