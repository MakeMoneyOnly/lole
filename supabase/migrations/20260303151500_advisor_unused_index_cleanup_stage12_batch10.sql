-- ============================================================================
-- Advisor Unused Index Cleanup Stage 12 — Batch 10
-- Date: 2026-03-03
-- Purpose: Drops batch of 10 unused indexes across menu items, orders,
--          order_events, order_items, and restaurants tables.
-- Impact: idx_items_fasting, idx_menu_items_popularity, idx_menu_items_name_search,
--         idx_orders_acknowledged_at, idx_orders_chapa_verified_paid_at,
--         idx_orders_order_number, idx_order_events_type_created,
--         idx_order_items_status, idx_order_items_station, idx_restaurants_active
-- Rollback: Recreate dropped indexes with CREATE INDEX statements matching original definitions.
-- ============================================================================

drop index if exists public.idx_items_fasting;
drop index if exists public.idx_menu_items_popularity;
drop index if exists public.idx_menu_items_name_search;
drop index if exists public.idx_orders_acknowledged_at;
drop index if exists public.idx_orders_chapa_verified_paid_at;
drop index if exists public.idx_orders_order_number;
drop index if exists public.idx_order_events_type_created;
drop index if exists public.idx_order_items_status;
drop index if exists public.idx_order_items_station;
drop index if exists public.idx_restaurants_active;
