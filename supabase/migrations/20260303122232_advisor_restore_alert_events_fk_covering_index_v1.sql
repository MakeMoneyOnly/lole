-- ============================================================================
-- Restore Alert Events FK Covering Index V1
-- Date: 2026-03-03
-- Purpose: Restores the FK covering index on alert_events(rule_id) that was
--          dropped during stage 3 cleanup but is needed for join performance.
-- Impact: alert_events(rule_id)
-- Rollback: DROP INDEX IF EXISTS idx_alert_events_rule_id;
-- ============================================================================

create index if not exists idx_alert_events_rule_id on public.alert_events(rule_id);
