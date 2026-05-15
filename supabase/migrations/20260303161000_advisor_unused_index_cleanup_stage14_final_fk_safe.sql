-- ============================================================================
-- Advisor Unused Index Cleanup Stage 14 — Final FK-Safe Batch
-- Date: 2026-03-03
-- Purpose: Drops final batch of 14 unused indexes across categories, menu_items,
--          orders, payments, payouts, reconciliation_entries, and tables that are
--          safe to remove without breaking FK integrity.
-- Impact: idx_categories_section, idx_menu_items_category_available,
--         idx_orders_fingerprint_created, idx_orders_kitchen_status,
--         idx_orders_restaurant_fire_mode_course, idx_payments_restaurant_split,
--         idx_payments_restaurant_status, idx_payouts_restaurant_status,
--         idx_reconciliation_entries_ledger, idx_reconciliation_entries_restaurant_source,
--         idx_reconciliation_entries_restaurant_status, idx_tables_active,
--         idx_tables_restaurant, idx_tables_restaurant_status_active
-- Rollback: Recreate dropped indexes with CREATE INDEX statements matching original definitions.
-- ============================================================================

drop index if exists public.idx_categories_section;
drop index if exists public.idx_menu_items_category_available;
drop index if exists public.idx_orders_fingerprint_created;
drop index if exists public.idx_orders_kitchen_status;
drop index if exists public.idx_orders_restaurant_fire_mode_course;
drop index if exists public.idx_payments_restaurant_split;
drop index if exists public.idx_payments_restaurant_status;
drop index if exists public.idx_payouts_restaurant_status;
drop index if exists public.idx_reconciliation_entries_ledger;
drop index if exists public.idx_reconciliation_entries_restaurant_source;
drop index if exists public.idx_reconciliation_entries_restaurant_status;
drop index if exists public.idx_tables_active;
drop index if exists public.idx_tables_restaurant;
drop index if exists public.idx_tables_restaurant_status_active;
