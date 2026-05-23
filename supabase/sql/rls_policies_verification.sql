-- RLS Policy Completeness Verification Script
-- Purpose: Verify Row Level Security policies are properly configured across all tables
-- Author: Security Audit
-- Date: 2026-05-21
-- Reference: docs/reference/reports/SECURITY_AUDIT_FINDINGS.md

-- ============================================================================
-- SECTION 1: Tables Without RLS Policies (Critical Security Check)
-- ============================================================================
-- This MUST return 0 rows. Any result is a security bug.
-- Identifies any base tables in the public schema that lack RLS policies.
-- Run this query in production and verify all tables have RLS policies.

SELECT table_name
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name NOT IN (
    SELECT DISTINCT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
);

-- ============================================================================
-- SECTION 2: Views Security Invoker Verification
-- ============================================================================
-- Ensures all views have security_invoker = on
-- This enforces that views respect the caller's RLS privileges,
-- preventing data exposure through view-based queries.

SELECT
  v.viewname,
  v.schemaname,
  CASE
    WHEN v.security_invoker = 't' THEN '✅ SECURE'
    ELSE '❌ MISSING security_invoker'
  END AS security_status
FROM pg_catalog.pg_views v
WHERE v.schemaname = 'public'
  AND v.viewname NOT IN (
    SELECT matviewname FROM pg_matviews WHERE schemaname = 'public'
  );

-- ============================================================================
-- SECTION 3: Force RLS Verification on Sensitive Tables
-- ============================================================================
-- Checks that force_rls is enabled on tables where all access must be
-- restricted by RLS policies, regardless of role.
-- Sensitive tables typically include: orders, payments, staff, customers

SELECT
  tablename,
  CASE
    WHEN relrowsecurity = 't' THEN '✅ RLS Enabled'
    ELSE '⚠️ RLS Disabled'
  END AS rls_status,
  CASE
    WHEN relforcerowsecurity = 't' THEN '✅ Force RLS Enabled'
    ELSE '⚠️ Force RLS Disabled'
  END AS force_rls_status
FROM pg_class
WHERE relkind = 'r'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY tablename;

-- ============================================================================
-- SECTION 4: Summary Dashboard
-- ============================================================================
-- Combined view showing the overall security posture of RLS configuration

SELECT
  'Tables without RLS policies' AS check_name,
  COUNT(*) AS issue_count
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name NOT IN (
    SELECT DISTINCT tablename FROM pg_policies WHERE schemaname = 'public'
  )

UNION ALL

SELECT
  'Views without security_invoker' AS check_name,
  COUNT(*) AS issue_count
FROM pg_catalog.pg_views v
WHERE v.schemaname = 'public'
  AND (v.security_invoker IS NULL OR v.security_invoker = 'f');

-- ============================================================================
-- END OF VERIFICATION SCRIPT
-- ============================================================================
-- Expected Results for Production:
-- - Section 1: 0 rows (no tables without RLS policies)
-- - Section 2: All views showing "✅ SECURE" or all marked with security_invoker
-- - Section 3: Force RLS enabled on sensitive tables as required by policy