-- ============================================================================
-- Restore FK Covering Indexes V2
-- Date: 2026-03-03
-- Purpose: Restores FK covering indexes on staff_invites and support_tickets
--          that were dropped during stage 4 cleanup but are needed for FK lookups.
-- Impact: staff_invites(created_by), support_tickets(created_by)
-- Rollback: DROP INDEX IF EXISTS idx_staff_invites_created_by;
--           DROP INDEX IF EXISTS idx_support_tickets_created_by;
-- ============================================================================

create index if not exists idx_staff_invites_created_by on public.staff_invites(created_by);
create index if not exists idx_support_tickets_created_by on public.support_tickets(created_by);
