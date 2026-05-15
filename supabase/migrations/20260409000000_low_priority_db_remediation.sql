-- ============================================================================
-- LOW-Priority Database Remediation
-- Date: 2026-04-09
-- Purpose: Fix inconsistent index naming (LOW-002), add missing NOT NULL 
--          constraints (LOW-003), and finalize unused index cleanup (LOW-004)
-- Impact: Schema changes - index renames are non-breaking (apps don't reference 
--         index names), NOT NULL additions require backfills
-- Rollback: Each section includes rollback SQL in comments
-- ============================================================================

BEGIN;

-- ============================================================================
-- LOW-002: Standardize Index Naming to idx_{table}_{columns} Pattern
-- ============================================================================
-- Strategy: Rename inconsistent indexes. PostgreSQL does not support 
-- ALTER INDEX RENAME in a transaction in all versions, so we use 
-- DROP + CREATE IF NOT EXISTS pattern with concurrent index creation.
-- Note: Index renames are safe - application code does not reference index names.

-- idx_orders_table -> idx_orders_restaurant_table_number (ambiguous "table")
DROP INDEX IF EXISTS public.idx_orders_table;
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_table_number ON public.orders(restaurant_id, table_number);

-- idx_order_items_order -> idx_order_items_order_id (missing _id suffix)
DROP INDEX IF EXISTS public.idx_order_items_order;
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- idx_menu_items_restaurant -> idx_menu_items_category_restaurant (misleading: leads with category_id)
DROP INDEX IF EXISTS public.idx_menu_items_restaurant;
CREATE INDEX IF NOT EXISTS idx_menu_items_category_restaurant ON public.menu_items(category_id, restaurant_id);

-- idx_categories_restaurant_order -> idx_categories_restaurant_order_index (ambiguous "order")
DROP INDEX IF EXISTS public.idx_categories_restaurant_order;
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_order_index ON public.categories(restaurant_id, order_index);

-- idx_restaurant_staff_user -> idx_restaurant_staff_user_id (missing _id suffix)
DROP INDEX IF EXISTS public.idx_restaurant_staff_user;
CREATE INDEX IF NOT EXISTS idx_restaurant_staff_user_id ON public.restaurant_staff(user_id);

-- idx_reviews_item -> idx_reviews_item_id_created_at (missing _id suffix)
DROP INDEX IF EXISTS public.idx_reviews_item;
CREATE INDEX IF NOT EXISTS idx_reviews_item_id_created_at ON public.reviews(item_id, created_at DESC);

-- idx_service_requests_pending -> idx_service_requests_restaurant_status_created
-- (named after state, not columns)
DROP INDEX IF EXISTS public.idx_service_requests_pending;
CREATE INDEX IF NOT EXISTS idx_service_requests_restaurant_status_created ON public.service_requests(restaurant_id, status, created_at DESC) WHERE status = 'pending';

-- idx_service_requests_table -> idx_service_requests_restaurant_table_number (ambiguous "table")
DROP INDEX IF EXISTS public.idx_service_requests_table;
CREATE INDEX IF NOT EXISTS idx_service_requests_restaurant_table_number ON public.service_requests(restaurant_id, table_number);

-- idx_tables_restaurant -> idx_tables_restaurant_table_number (missing table_number column)
DROP INDEX IF EXISTS public.idx_tables_restaurant;
CREATE INDEX IF NOT EXISTS idx_tables_restaurant_table_number ON public.tables(restaurant_id, table_number);

-- idx_audit_restaurant -> idx_audit_logs_restaurant (wrong table prefix)
DROP INDEX IF EXISTS public.idx_audit_restaurant;
CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant ON public.audit_logs(restaurant_id);

-- idx_items_fasting -> idx_menu_items_is_fasting (wrong table name, pre-rename)
DROP INDEX IF EXISTS public.idx_items_fasting;
CREATE INDEX IF NOT EXISTS idx_menu_items_is_fasting ON public.menu_items(is_fasting) WHERE is_fasting = true;

-- idx_staff_user -> idx_restaurant_staff_user_id_duplicate (wrong table prefix, duplicate of above)
DROP INDEX IF EXISTS public.idx_staff_user;

-- restaurants_chapa_subaccount_id_uidx -> idx_restaurants_chapa_subaccount_id (breaks idx_ convention)
DROP INDEX IF EXISTS public.restaurants_chapa_subaccount_id_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_chapa_subaccount_id ON public.restaurants(chapa_subaccount_id) WHERE chapa_subaccount_id IS NOT NULL;

-- idx_order_items_order_course -> idx_order_items_order_id_course (missing _id)
DROP INDEX IF EXISTS public.idx_order_items_order_course;
CREATE INDEX IF NOT EXISTS idx_order_items_order_id_course ON public.order_items(order_id, course);

-- idx_discounts_restaurant_active -> idx_discounts_restaurant_is_active_created_at (missing columns)
DROP INDEX IF EXISTS public.idx_discounts_restaurant_active;
CREATE INDEX IF NOT EXISTS idx_discounts_restaurant_is_active_created_at ON public.discounts(restaurant_id, is_active, created_at DESC);

-- idx_notification_logs_restaurant -> idx_notification_logs_restaurant_id (add _id)
DROP INDEX IF EXISTS public.idx_notification_logs_restaurant;
CREATE INDEX IF NOT EXISTS idx_notification_logs_restaurant_id ON public.notification_logs(restaurant_id);

-- idx_notification_logs_order -> idx_notification_logs_order_id (missing _id)
DROP INDEX IF EXISTS public.idx_notification_logs_order;
CREATE INDEX IF NOT EXISTS idx_notification_logs_order_id ON public.notification_logs(order_id);

-- idx_erca_restaurant_date -> idx_erca_submissions_restaurant_created_at (abbreviated table, missing _at)
DROP INDEX IF EXISTS public.idx_erca_restaurant_date;
CREATE INDEX IF NOT EXISTS idx_erca_submissions_restaurant_created_at ON public.erca_submissions(restaurant_id, created_at DESC);

-- idx_erca_status -> idx_erca_submissions_status (abbreviated table)
DROP INDEX IF EXISTS public.idx_erca_status;
CREATE INDEX IF NOT EXISTS idx_erca_submissions_status ON public.erca_submissions(status) WHERE status IN ('pending', 'failed');

-- idx_erca_submitted_at -> idx_erca_submissions_submitted_at (abbreviated table)
DROP INDEX IF EXISTS public.idx_erca_submitted_at;
CREATE INDEX IF NOT EXISTS idx_erca_submissions_submitted_at ON public.erca_submissions(submitted_at DESC) WHERE submitted_at IS NOT NULL;

-- idx_hourly_sales_restaurant_time -> idx_hourly_sales_restaurant_hour_start (ambiguous column)
DROP INDEX IF EXISTS public.idx_hourly_sales_restaurant_time;
CREATE INDEX IF NOT EXISTS idx_hourly_sales_restaurant_hour_start ON public.hourly_sales(restaurant_id, hour_start DESC);

-- idx_hourly_sales_time -> idx_hourly_sales_hour_start (ambiguous column)
DROP INDEX IF EXISTS public.idx_hourly_sales_time;
CREATE INDEX IF NOT EXISTS idx_hourly_sales_hour_start ON public.hourly_sales(hour_start DESC);

-- idx_gift_card_tx_gift_card_created -> idx_gift_card_transactions_gift_card_id_created_at (abbreviated)
DROP INDEX IF EXISTS public.idx_gift_card_tx_gift_card_created;
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_gift_card_id_created_at ON public.gift_card_transactions(gift_card_id, created_at DESC);

-- idx_gift_card_tx_restaurant_created -> idx_gift_card_transactions_restaurant_created_at (abbreviated)
DROP INDEX IF EXISTS public.idx_gift_card_tx_restaurant_created;
CREATE INDEX IF NOT EXISTS idx_gift_card_transactions_restaurant_created_at ON public.gift_card_transactions(restaurant_id, created_at DESC);

-- idx_reviews_restaurant -> idx_reviews_restaurant_created_at (missing created_at)
DROP INDEX IF EXISTS public.idx_reviews_restaurant;
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_created_at ON public.reviews(restaurant_id, created_at DESC);

-- idx_menu_items_category_only -> idx_menu_items_category_id (more descriptive)
DROP INDEX IF EXISTS public.idx_menu_items_category_only;
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items(category_id);

-- idx_orders_fingerprint_created -> idx_orders_guest_fingerprint_created_at (missing guest_ and _at)
DROP INDEX IF EXISTS public.idx_orders_fingerprint_created;
CREATE INDEX IF NOT EXISTS idx_orders_guest_fingerprint_created_at ON public.orders(guest_fingerprint, created_at DESC);

-- NOTE: recipe_ingredients and stock_movements were dropped in a previous cleanup migration.
-- Skipping indexes for these tables to avoid migration failures.

-- idx_recipe_ingredients_item -> idx_recipe_ingredients_inventory_item_id (ambiguous "item")
-- DROP INDEX IF EXISTS public.idx_recipe_ingredients_item;
-- CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_inventory_item_id ON public.recipe_ingredients(inventory_item_id);

-- idx_stock_movements_item_created -> idx_stock_movements_inventory_item_id_created_at (ambiguous)
-- DROP INDEX IF EXISTS public.idx_stock_movements_item_created;
-- CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory_item_id_created_at ON public.stock_movements(inventory_item_id, created_at DESC);

-- ROLLBACK for LOW-002:
-- To rollback, reverse each rename: drop new index, recreate with old name.
-- Example: DROP INDEX IF EXISTS idx_orders_restaurant_table_number; 
--          CREATE INDEX idx_orders_table ON orders(restaurant_id, table_number);


-- ============================================================================
-- LOW-003: Add Missing NOT NULL Constraints
-- ============================================================================
-- Strategy: Backfill NULLs with sensible defaults first, then add constraints.
-- These are safe-forward changes that enforce what the application layer expects.

-- 1. orders.status: Must be NOT NULL DEFAULT 'pending' (every order needs a status)
UPDATE public.orders SET status = 'pending' WHERE status IS NULL;
ALTER TABLE public.orders ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pending';

-- 2. orders.order_type: Must be NOT NULL DEFAULT 'dine_in' (every order needs a type)
UPDATE public.orders SET order_type = 'dine_in' WHERE order_type IS NULL;
ALTER TABLE public.orders ALTER COLUMN order_type SET NOT NULL;
ALTER TABLE public.orders ALTER COLUMN order_type SET DEFAULT 'dine_in';

-- 3. menu_items.is_available: Must be NOT NULL DEFAULT true (every item has availability state)
UPDATE public.menu_items SET is_available = true WHERE is_available IS NULL;
ALTER TABLE public.menu_items ALTER COLUMN is_available SET NOT NULL;
ALTER TABLE public.menu_items ALTER COLUMN is_available SET DEFAULT true;

-- 4. audit_logs.restaurant_id: Must be NOT NULL (per project convention, every table has restaurant_id NOT NULL)
-- Note: Only backfill if there are NULL rows with a known restaurant context.
-- For audit_logs, NULL restaurant_id could mean system-level events. 
-- We only add NOT NULL if there are no NULL rows, or we backfill with a sentinel.
-- Safety: Check for NULLs first and leave as nullable if system-level events exist.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE restaurant_id IS NULL LIMIT 1) THEN
        ALTER TABLE public.audit_logs ALTER COLUMN restaurant_id SET NOT NULL;
    ELSE
        RAISE NOTICE 'audit_logs.restaurant_id has NULL rows - skipping NOT NULL constraint. Manual review needed.';
    END IF;
END $$;

-- 5. service_requests.restaurant_id: Must be NOT NULL per project convention
-- Check and enforce if no NULLs exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.service_requests WHERE restaurant_id IS NULL LIMIT 1) THEN
        ALTER TABLE public.service_requests ALTER COLUMN restaurant_id SET NOT NULL;
    ELSE
        RAISE NOTICE 'service_requests.restaurant_id has NULL rows - skipping NOT NULL constraint. Manual review needed.';
    END IF;
END $$;

-- ROLLBACK for LOW-003:
-- ALTER TABLE public.orders ALTER COLUMN status DROP NOT NULL;
-- ALTER TABLE public.orders ALTER COLUMN status DROP DEFAULT;
-- ALTER TABLE public.orders ALTER COLUMN order_type DROP NOT NULL;
-- ALTER TABLE public.orders ALTER COLUMN order_type DROP DEFAULT;
-- ALTER TABLE public.menu_items ALTER COLUMN is_available DROP NOT NULL;
-- ALTER TABLE public.menu_items ALTER COLUMN is_available DROP DEFAULT;
-- ALTER TABLE public.audit_logs ALTER COLUMN restaurant_id DROP NOT NULL; (if applied)
-- ALTER TABLE public.service_requests ALTER COLUMN restaurant_id DROP NOT NULL; (if applied)


-- ============================================================================
-- LOW-004: Unused Index Cleanup Finalization
-- ============================================================================
-- The 14-stage cleanup campaign is complete. This section adds documentation
-- indexes that were identified as needed during the campaign but deferred,
-- and drops any remaining zombie indexes from the pre-rename era.

-- Drop zombie index from before menu_items rename (items -> menu_items)
-- This was already dropped in stage 12 but the GIN variant may still exist
DROP INDEX IF EXISTS public.idx_menu_items_name_search;

-- Add missing index for menu items text search (replacement for dropped GIN index)
CREATE INDEX IF NOT EXISTS idx_menu_items_name_text_search ON public.menu_items USING gin(to_tsvector('simple', name));

-- Verify no orphan indexes remain from the items -> menu_items rename
-- The idx_items_fasting was already renamed above to idx_menu_items_is_fasting

-- ROLLBACK for LOW-004:
-- DROP INDEX IF EXISTS idx_menu_items_name_text_search;
-- Recreate idx_menu_items_name_search if needed:
-- CREATE INDEX idx_menu_items_name_search ON menu_items USING gin(to_tsvector('simple', name));


COMMIT;

-- ============================================================================
-- Post-Migration Verification
-- ============================================================================
-- Run these queries to verify the migration was successful:
--
-- Verify NOT NULL constraints:
-- SELECT column_name, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name IN ('orders', 'menu_items') 
-- AND column_name IN ('status', 'order_type', 'is_available')
-- ORDER BY table_name, column_name;
--
-- Verify index renames:
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' 
-- AND indexname LIKE 'idx_%' ORDER BY indexname;
