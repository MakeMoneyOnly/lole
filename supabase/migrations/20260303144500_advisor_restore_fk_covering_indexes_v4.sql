-- ============================================================================
-- Restore FK Covering Indexes V4
-- Date: 2026-03-03
-- Purpose: Restores the FK covering index on restaurant_staff(restaurant_id, is_active)
--          that was dropped during stage 11 cleanup but is needed for FK lookups.
-- Impact: restaurant_staff(restaurant_id, is_active)
-- Rollback: DROP INDEX IF EXISTS idx_restaurant_staff_restaurant;
-- ============================================================================

create index if not exists idx_restaurant_staff_restaurant on public.restaurant_staff(restaurant_id, is_active);
