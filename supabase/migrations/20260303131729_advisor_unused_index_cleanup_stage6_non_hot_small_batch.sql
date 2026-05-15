-- ============================================================================
-- Advisor Unused Index Cleanup Stage 6 — Non-Hot Small Batch
-- Date: 2026-03-03
-- Purpose: Drops unused indexes on delivery_partners, support_tickets, and guests
--          tables identified by Supabase advisor (non-hot-path small batch).
-- Impact: idx_delivery_partners_restaurant_status,
--         idx_support_tickets_restaurant_status_created, idx_guests_restaurant_ltv
-- Rollback: Recreate dropped indexes with CREATE INDEX statements matching original definitions.
-- ============================================================================

drop index if exists public.idx_delivery_partners_restaurant_status;
drop index if exists public.idx_support_tickets_restaurant_status_created;
drop index if exists public.idx_guests_restaurant_ltv;
