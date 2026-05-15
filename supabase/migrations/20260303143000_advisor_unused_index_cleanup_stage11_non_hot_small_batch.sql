-- ============================================================================
-- Advisor Unused Index Cleanup Stage 11 — Non-Hot Small Batch
-- Date: 2026-03-03
-- Purpose: Drops unused indexes on guests (GIN), restaurant_staff, and
--          stock_movements tables identified by Supabase advisor.
-- Impact: idx_guests_tags_gin, idx_restaurant_staff_restaurant,
--         idx_stock_movements_restaurant_created
-- Rollback: Recreate dropped indexes with CREATE INDEX statements matching original definitions.
-- ============================================================================

drop index if exists public.idx_guests_tags_gin;
drop index if exists public.idx_restaurant_staff_restaurant;
drop index if exists public.idx_stock_movements_restaurant_created;
