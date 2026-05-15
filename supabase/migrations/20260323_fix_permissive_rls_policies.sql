-- =========================================================
-- CRIT-002: Fix Permissive RLS Policies
-- Security fix for pre-production remediation
-- =========================================================
-- Issue: Permissive RLS policy with USING (true) WITH CHECK (true)
-- for service_role on price_overrides table.
-- 
-- Remediation: Remove the permissive policy.
-- Note: Service role already bypasses RLS by default in Supabase,
-- so explicit policies for service_role are unnecessary and 
-- potentially dangerous if the role is accidentally granted to
-- untrusted code paths.
-- =========================================================

BEGIN;

-- Remove the permissive service_role policy from price_overrides
-- Service role bypasses RLS by default in Supabase, so this policy
-- is redundant and creates a security risk if the pattern is copied
-- to other contexts
DROP POLICY IF EXISTS "service_role_full_access_price_overrides" ON price_overrides;

-- Add comment documenting the security decision
COMMENT ON TABLE price_overrides IS 
'Price overrides with audit trail. RLS enabled with tenant-scoped policies. Service role bypasses RLS by default - no explicit policy needed.';

COMMIT;
