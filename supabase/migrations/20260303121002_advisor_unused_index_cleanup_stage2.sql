-- ============================================================================
-- Advisor Unused Index Cleanup Stage 2
-- Date: 2026-03-03
-- Purpose: Drops unused indexes identified by Supabase advisor in the second batch,
--          covering global_orders, system_health, tenants, and workflow_audit_logs.
-- Impact: idx_orders_tenant, idx_system_health_service, idx_system_health_status,
--         idx_tenants_api_key, idx_tenants_slug, idx_workflow_audit_logs_tenant_id
-- Rollback: Recreate dropped indexes with CREATE INDEX statements matching original definitions.
-- ============================================================================

drop index if exists public.idx_orders_tenant;
drop index if exists public.idx_system_health_service;
drop index if exists public.idx_system_health_status;
drop index if exists public.idx_tenants_api_key;
drop index if exists public.idx_tenants_slug;
drop index if exists public.idx_workflow_audit_logs_tenant_id;
