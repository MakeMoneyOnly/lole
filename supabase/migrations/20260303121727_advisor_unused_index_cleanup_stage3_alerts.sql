-- ============================================================================
-- Advisor Unused Index Cleanup Stage 3 — Alerts
-- Date: 2026-03-03
-- Purpose: Drops unused indexes on alert_events and alert_rules tables
--          identified by Supabase advisor.
-- Impact: idx_alert_events_rule_id, idx_alert_events_entity,
--         idx_alert_events_open_restaurant, idx_alert_events_restaurant_severity_status,
--         idx_alert_rules_created_at, idx_alert_rules_restaurant_enabled
-- Rollback: Recreate dropped indexes with CREATE INDEX statements matching original definitions.
-- ============================================================================

drop index if exists public.idx_alert_events_rule_id;
drop index if exists public.idx_alert_events_entity;
drop index if exists public.idx_alert_events_open_restaurant;
drop index if exists public.idx_alert_events_restaurant_severity_status;
drop index if exists public.idx_alert_rules_created_at;
drop index if exists public.idx_alert_rules_restaurant_enabled;
