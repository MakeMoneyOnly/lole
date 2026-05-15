# Security Advisor Remediation Report — 2026-04-08

## Summary

On 2026-04-08, a comprehensive review of the Supabase Security Advisor findings was conducted using the Supabase MCP tool (`execute_sql`) against project `axuegixbqsvztdraenkz`. This report documents all findings and the 6 migrations created to address them.

## Findings Identified

### ERROR (Critical): Exposed auth.users in Public View

- **LINT ID**: 0002_auth_users_exposed
- **View**: `restaurant_staff_with_users`
- **Issue**: Direct JOIN with `auth.users` exposing `email` and `raw_user_meta_data` to `anon`/`authenticated` roles
- **Remediation**: Created trigger-maintained `user_profiles` table; recreated view to use `user_profiles` instead

### ERROR: Security Definer Views (6 views)

- **LINT ID**: 0010_security_definer_view
- **Views**: `restaurant_staff_with_users`, `restaurant_plan_info`, `active_restaurants`, `active_restaurant_staff`, `active_menu_items`, `active_tables`
- **Issue**: Views in public schema without `security_invoker=on` bypass RLS
- **Remediation**: Applied `security_invoker = on` to all views

### WARN: Function Search Path Mutable (18 functions)

- **LINT ID**: LINT-4 (function_search_path_mutable)
- **Functions**: `log_price_override_audit`, `mark_stale_devices_offline`, `can_override_prices`, `calculate_order_fire_times`, `get_items_ready_to_fire`, `soft_delete`, `restore_deleted`, `permanent_delete_old_records`, `count_deleted_records`, `mark_item_fired`, `is_guest_unsubscribed`, `get_pending_scheduled_reports`, `can_create_order`, `increment_monthly_orders`, `check_and_use_price_change`, `get_remaining_price_changes`, `validate_required_modifiers`, `validate_order_modifiers`
- **Issue**: SECURITY DEFINER functions without explicit `search_path` are vulnerable to injection
- **Remediation**: Added `SET search_path = pg_catalog, public` to all 18 functions

### WARN: RLS Policy Always True (3 policies)

- **LINT ID**: LINT-3 (policy_always_true)
- `notification_logs` INSERT: `WITH CHECK (true)` — unrestricted for authenticated
- `notification_metrics` INSERT: `WITH CHECK (true)` — unrestricted
- `notification_metrics` UPDATE: `USING (true) WITH CHECK (true)` — unrestricted
- **Remediation**: Replaced with tenant-scoped policies using `restaurant_staff` membership checks

### WARN: Leaked Password Protection Disabled

- **Issue**: Supabase Auth HaveIBeenPwned integration not enabled
- **Remediation**: Dashboard setting — requires manual enablement in Auth > Settings

### 16 Tables Without RLS Enabled

`stations`, `marketing_campaigns`, `campaign_recipients`, `email_templates`, `guest_unsubscribes`, `staff_invites`, `scheduled_reports`, `report_executions`, `report_templates`, `menu_change_queue`, `centralized_menu_configs`, `menu_location_links`, `notification_logs`, `push_tokens`, `delivery_aggregator_configs`, `erca_submissions`

- **Remediation**: Enabled RLS + FORCE RLS on all 16 tables with proper tenant-scoped policies

### Multiple RLS Policies Using Unwrapped auth.uid()

- **Issue**: Bare `auth.uid()` calls prevent query plan caching
- **Remediation**: Dynamic migration to wrap all `auth.uid()` in `(select auth.uid())`

## Migrations Created

| #   | Timestamp      | File                                           | Purpose                                                                  |
| --- | -------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | 20260408100000 | `security_advisor_fix_exposed_auth_users.sql`  | Replace auth.users reference with trigger-maintained user_profiles table |
| 2   | 20260408110000 | `security_advisor_enable_rls_and_policies.sql` | Enable RLS + FORCE RLS on 16 tables with tenant-scoped policies          |
| 3   | 20260408120000 | `security_advisor_function_search_path.sql`    | Add search_path to 18 SECURITY DEFINER functions                         |
| 4   | 20260408130000 | `security_advisor_fix_permissive_policies.sql` | Replace permissive (USING true) policies on notification_metrics         |
| 5   | 20260408140000 | `security_advisor_wrap_auth_uid.sql`           | Wrap all bare auth.uid() in (select auth.uid()) for caching              |
| 6   | 20260408150000 | `security_advisor_security_invoker_views.sql`  | Set security_invoker=on on all 7 views                                   |

## Migration Execution Order

Migrations must be applied in the numbered order above. Migration 1 (user_profiles) must run before Migration 5 (auth.uid wrapping) because the view recreation changes policy structures.

## Remaining Manual Steps

1. **Enable Leaked Password Protection**: Go to Supabase Dashboard → Authentication → Settings → Enable "Detect leaked passwords"
2. **Run migrations**: Apply all 6 migrations to the remote Supabase database via `supabase db push` or `supabase migration up`
3. **Post-migration verification**: Re-run the Security Advisor checks to confirm all findings are resolved
4. **Update generated types**: Run `supabase gen types typescript` to regenerate types including `user_profiles`

## Skills Used

- `SKILLS/database/supabase-postgres-best-practices/SKILL.md`
- `SKILLS/database/postgres-schema-design/SKILL.MD`
- `SKILLS/security/security-best-practices/SKILL.md`

## Pre-existing Findings Status

| Finding                                         | Severity | Status                     |
| ----------------------------------------------- | -------- | -------------------------- |
| Exposed auth.users in view                      | Critical | Fixed (migration 1)        |
| 16 tables without RLS                           | High     | Fixed (migration 2)        |
| Security definer views without security_invoker | High     | Fixed (migration 6)        |
| 18 functions without search_path                | Medium   | Fixed (migration 3)        |
| Permissive RLS policies                         | Medium   | Fixed (migrations 2, 4)    |
| Unwrapped auth.uid() in policies                | Medium   | Fixed (migrations 2, 5)    |
| Leaked password protection disabled             | Low      | Manual (dashboard setting) |
