-- lole: Fix RLS Medium Findings (M1, M2, M3)
-- Date: 2026-05-04
-- Description: BKND-032 follow-up. Addresses 3 medium RLS findings:
--   M1: Add FORCE RLS to 4 operational tables (system_health, system_health_monitor,
--       rate_limit_logs, workflow_audit_logs)
--   M2: Add RLS to tenants table (contains api_key) with service_role-only policy
--   M3: Remove 5 redundant TO service_role policies from Ethiopian compliance tables
--       (service_role bypasses RLS by default)

BEGIN;

-- ==========================================================================
-- M1: Add FORCE RLS to operational monitoring tables
-- ==========================================================================

ALTER TABLE public.system_health FORCE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_monitor FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_audit_logs FORCE ROW LEVEL SECURITY;

-- ==========================================================================
-- M2: Add RLS to tenants table
-- ==========================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;

-- tenants contains api_key. Access is service_role only (server-side).
CREATE POLICY "Service role can manage tenants"
    ON public.tenants
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ==========================================================================
-- M3: Remove redundant service_role policies from Ethiopian compliance tables
--     (service_role bypasses RLS by default — these policies are no-ops)
-- ==========================================================================

DROP POLICY IF EXISTS "Service role can manage merchant_tax_config" ON public.merchant_tax_config;
DROP POLICY IF EXISTS "Service role can manage merchant_vat_ledger" ON public.merchant_vat_ledger;
DROP POLICY IF EXISTS "Service role can manage merchant_wht_receipts" ON public.merchant_wht_receipts;
DROP POLICY IF EXISTS "Service role can manage merchant_bank_accounts" ON public.merchant_bank_accounts;
DROP POLICY IF EXISTS "Service role can manage merchant_fiscal_days" ON public.merchant_fiscal_days;

COMMIT;
