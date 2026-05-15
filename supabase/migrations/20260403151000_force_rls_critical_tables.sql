-- ============================================================================
-- Security: Add FORCE ROW LEVEL SECURITY to critical tenant tables
-- Date: 2026-04-03
-- Purpose: Ensure RLS policies are enforced even for table owners
-- Reference: AGENTS.md - Platform Guardrails
-- ============================================================================

BEGIN;

-- Force RLS on restaurants (core tenant table)
ALTER TABLE public.restaurants FORCE ROW LEVEL SECURITY;

-- NOTE: hourly_sales and daily_sales tables are created by the reconciliation
-- migration. FORCE RLS for those tables will be applied there.
-- The following statements are kept for documentation but commented out:
-- ALTER TABLE public.hourly_sales FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.daily_sales FORCE ROW LEVEL SECURITY;

-- Add comments documenting the security rationale
COMMENT ON TABLE public.restaurants IS 'Core tenant table. FORCE RLS ensures all queries respect tenant isolation policies.';
-- Comments for TimescaleDB tables will be added in reconciliation migration

COMMIT;
