-- ============================================================================
-- Advisor Unused Index Cleanup Stage 1
-- Date: 2026-03-03
-- Purpose: Drops unused indexes identified by Supabase advisor in the first batch,
--          covering audit, orders, categories, and order_items tables.
-- Impact: idx_audit_restaurant, idx_orders_guest_fingerprint,
--         idx_categories_restaurant_id, idx_order_items_order_id
-- Rollback: Recreate dropped indexes with CREATE INDEX statements matching original definitions.
-- ============================================================================

drop index if exists public.idx_audit_restaurant;
drop index if exists public.idx_orders_guest_fingerprint;
drop index if exists public.idx_categories_restaurant_id;
drop index if exists public.idx_order_items_order_id;
