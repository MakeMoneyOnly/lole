-- ============================================================================
-- Advisor Unused Index Cleanup Stage 13 — Safe Only
-- Date: 2026-03-03
-- Purpose: Drops a single confirmed-unused index on order_check_split_items
--          that is safe to remove without FK dependency concerns.
-- Impact: idx_order_check_split_items_split
-- Rollback: Recreate with CREATE INDEX matching original definition.
-- ============================================================================

drop index if exists public.idx_order_check_split_items_split;
