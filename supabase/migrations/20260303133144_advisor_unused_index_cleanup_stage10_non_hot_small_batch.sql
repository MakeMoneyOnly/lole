-- ============================================================================
-- Advisor Unused Index Cleanup Stage 10 — Non-Hot Small Batch
-- Date: 2026-03-03
-- Purpose: Drops unused hash indexes on guests table (phone, email, fingerprint)
--          identified by Supabase advisor (non-hot-path small batch).
-- Impact: idx_guests_phone_hash, idx_guests_email_hash, idx_guests_fingerprint_hash
-- Rollback: Recreate dropped indexes with CREATE INDEX statements matching original definitions.
-- ============================================================================

drop index if exists public.idx_guests_phone_hash;
drop index if exists public.idx_guests_email_hash;
drop index if exists public.idx_guests_fingerprint_hash;
