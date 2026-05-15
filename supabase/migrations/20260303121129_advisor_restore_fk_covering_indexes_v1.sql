-- ============================================================================
-- Restore FK Covering Indexes V1
-- Date: 2026-03-03
-- Purpose: Restores foreign-key covering indexes on global_orders and
--          workflow_audit_logs that were dropped during cleanup but are needed for FK integrity.
-- Impact: global_orders(tenant_id), workflow_audit_logs(tenant_id)
-- Rollback: DROP INDEX IF EXISTS idx_orders_tenant; DROP INDEX IF EXISTS idx_workflow_audit_logs_tenant_id;
-- ============================================================================

create index if not exists idx_orders_tenant on public.global_orders(tenant_id);
create index if not exists idx_workflow_audit_logs_tenant_id on public.workflow_audit_logs(tenant_id);
