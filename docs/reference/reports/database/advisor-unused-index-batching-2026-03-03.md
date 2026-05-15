# Advisor Unused Index Batching (2026-03-03)

## Scope

Small-batch unused-index cleanup with advisor re-checks after every batch.

## P0/P2 Hot-Path Keep-List (Do Not Drop in this campaign)

- `public.orders`
- `public.order_items`
- `public.order_events`
- `public.kds_order_items`
- `public.kds_item_events`
- `public.table_sessions`
- `public.tables`
- `public.payments`
- `public.refunds`
- `public.payouts`
- `public.reconciliation_entries`
- `public.menu_items`
- `public.categories`
- `public.service_requests`
- `public.restaurants`

## Applied Small Batches

### Stage 1

Dropped:

- `public.idx_audit_restaurant`
- `public.idx_orders_guest_fingerprint`
- `public.idx_categories_restaurant_id`
- `public.idx_order_items_order_id`

### Stage 2

Dropped:

- `public.idx_orders_tenant`
- `public.idx_system_health_service`
- `public.idx_system_health_status`
- `public.idx_tenants_api_key`
- `public.idx_tenants_slug`
- `public.idx_workflow_audit_logs_tenant_id`

Restored (FK coverage):

- `public.idx_orders_tenant`
- `public.idx_workflow_audit_logs_tenant_id`

### Stage 3

Dropped:

- `public.idx_alert_events_rule_id`
- `public.idx_alert_events_entity`
- `public.idx_alert_events_open_restaurant`
- `public.idx_alert_events_restaurant_severity_status`
- `public.idx_alert_rules_created_at`
- `public.idx_alert_rules_restaurant_enabled`

Restored (FK coverage):

- `public.idx_alert_events_rule_id`

### Stage 4

Dropped:

- `public.idx_audit_logs_entity`
- `public.idx_audit_logs_user`
- `public.idx_staff_invites_created_by`
- `public.idx_support_tickets_created_by`

Restored (FK coverage):

- `public.idx_staff_invites_created_by`
- `public.idx_support_tickets_created_by`

### Stage 5

Dropped:

- `public.idx_audit_logs_restaurant`

## Explicit Drop-List (Net New Drops Still in Effect)

- `public.idx_alert_events_entity`
- `public.idx_alert_events_open_restaurant`
- `public.idx_alert_events_restaurant_severity_status`
- `public.idx_alert_rules_created_at`
- `public.idx_alert_rules_restaurant_enabled`
- `public.idx_audit_logs_entity`
- `public.idx_audit_logs_user`
- `public.idx_audit_logs_restaurant`

## Rollback SQL (Explicit)

```sql
create index if not exists idx_alert_events_entity on public.alert_events(entity_type, entity_id);
create index if not exists idx_alert_events_open_restaurant on public.alert_events(restaurant_id, created_at desc) where status = 'open';
create index if not exists idx_alert_events_restaurant_severity_status on public.alert_events(restaurant_id, severity, status, created_at desc);
create index if not exists idx_alert_rules_created_at on public.alert_rules(created_at desc);
create index if not exists idx_alert_rules_restaurant_enabled on public.alert_rules(restaurant_id, enabled);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_user on public.audit_logs(user_id, created_at desc);
create index if not exists idx_audit_logs_restaurant on public.audit_logs(restaurant_id, created_at desc);
```

## Advisor State After Stage 5

- Security: only `auth_leaked_password_protection` remains (dashboard setting, plan-gated).
- Performance: `unused_index` INFO findings remain; no new ERROR findings introduced by these batches.

### Stage 6

Dropped:

- `public.idx_delivery_partners_restaurant_status`
- `public.idx_support_tickets_restaurant_status_created`
- `public.idx_guests_restaurant_ltv`

## Explicit Drop-List (Net New Drops Still in Effect) - Updated

- `public.idx_alert_events_entity`
- `public.idx_alert_events_open_restaurant`
- `public.idx_alert_events_restaurant_severity_status`
- `public.idx_alert_rules_created_at`
- `public.idx_alert_rules_restaurant_enabled`
- `public.idx_audit_logs_entity`
- `public.idx_audit_logs_user`
- `public.idx_audit_logs_restaurant`
- `public.idx_delivery_partners_restaurant_status`
- `public.idx_support_tickets_restaurant_status_created`
- `public.idx_guests_restaurant_ltv`

## Rollback SQL (Explicit) - Additions for Stage 6

```sql
create index if not exists idx_delivery_partners_restaurant_status on public.delivery_partners(restaurant_id, status, updated_at desc);
create index if not exists idx_support_tickets_restaurant_status_created on public.support_tickets(restaurant_id, status, created_at desc);
create index if not exists idx_guests_restaurant_ltv on public.guests(restaurant_id, lifetime_value desc);
```

### Stage 7

Dropped:

- `public.idx_rate_limit_action`
- `public.idx_rate_limit_fingerprint`
- `public.idx_external_orders_restaurant_status`

## Explicit Drop-List (Net New Drops Still in Effect) - Updated

- `public.idx_alert_events_entity`
- `public.idx_alert_events_open_restaurant`
- `public.idx_alert_events_restaurant_severity_status`
- `public.idx_alert_rules_created_at`
- `public.idx_alert_rules_restaurant_enabled`
- `public.idx_audit_logs_entity`
- `public.idx_audit_logs_user`
- `public.idx_audit_logs_restaurant`
- `public.idx_delivery_partners_restaurant_status`
- `public.idx_support_tickets_restaurant_status_created`
- `public.idx_guests_restaurant_ltv`
- `public.idx_rate_limit_action`
- `public.idx_rate_limit_fingerprint`
- `public.idx_external_orders_restaurant_status`

## Rollback SQL (Explicit) - Additions for Stage 7

```sql
create index if not exists idx_rate_limit_action on public.rate_limit_logs(action, created_at desc);
create index if not exists idx_rate_limit_fingerprint on public.rate_limit_logs(fingerprint, created_at desc);
create index if not exists idx_external_orders_restaurant_status on public.external_orders(restaurant_id, normalized_status, created_at desc);
```

### Stage 8

Dropped initially:

- `public.idx_guest_visits_guest_visited`
- `public.idx_guest_visits_restaurant_visited`
- `public.idx_rate_limit_logs_restaurant_id`

Restored (FK coverage):

- `public.idx_guest_visits_guest_visited`
- `public.idx_rate_limit_logs_restaurant_id`

Net drop remaining from stage 8:

- `public.idx_guest_visits_restaurant_visited`

## Explicit Drop-List (Net New Drops Still in Effect) - Updated

- `public.idx_alert_events_entity`
- `public.idx_alert_events_open_restaurant`
- `public.idx_alert_events_restaurant_severity_status`
- `public.idx_alert_rules_created_at`
- `public.idx_alert_rules_restaurant_enabled`
- `public.idx_audit_logs_entity`
- `public.idx_audit_logs_user`
- `public.idx_audit_logs_restaurant`
- `public.idx_delivery_partners_restaurant_status`
- `public.idx_support_tickets_restaurant_status_created`
- `public.idx_guests_restaurant_ltv`
- `public.idx_rate_limit_action`
- `public.idx_rate_limit_fingerprint`
- `public.idx_external_orders_restaurant_status`
- `public.idx_guest_visits_restaurant_visited`

## Rollback SQL (Explicit) - Addition for Stage 8 Net Drop

```sql
create index if not exists idx_guest_visits_restaurant_visited on public.guest_visits(restaurant_id, visited_at desc);
```

### Stage 9

Dropped:

- `public.idx_rate_limit_logs_fingerprint`
- `public.idx_stations_restaurant_id`
- `public.idx_shifts_active_status`

## Explicit Drop-List (Net New Drops Still in Effect) - Updated

- `public.idx_alert_events_entity`
- `public.idx_alert_events_open_restaurant`
- `public.idx_alert_events_restaurant_severity_status`
- `public.idx_alert_rules_created_at`
- `public.idx_alert_rules_restaurant_enabled`
- `public.idx_audit_logs_entity`
- `public.idx_audit_logs_user`
- `public.idx_audit_logs_restaurant`
- `public.idx_delivery_partners_restaurant_status`
- `public.idx_support_tickets_restaurant_status_created`
- `public.idx_guests_restaurant_ltv`
- `public.idx_rate_limit_action`
- `public.idx_rate_limit_fingerprint`
- `public.idx_external_orders_restaurant_status`
- `public.idx_guest_visits_restaurant_visited`
- `public.idx_rate_limit_logs_fingerprint`
- `public.idx_stations_restaurant_id`
- `public.idx_shifts_active_status`

## Rollback SQL (Explicit) - Additions for Stage 9

```sql
create index if not exists idx_rate_limit_logs_fingerprint on public.rate_limit_logs(fingerprint, action, created_at desc);
create index if not exists idx_stations_restaurant_id on public.stations(restaurant_id);
create index if not exists idx_shifts_active_status on public.shifts(restaurant_id, status, shift_date)
where status = any (array['scheduled'::text, 'in_progress'::text]);
```

### Stage 10

Dropped:

- `public.idx_guests_phone_hash`
- `public.idx_guests_email_hash`
- `public.idx_guests_fingerprint_hash`

## Explicit Drop-List (Net New Drops Still in Effect) - Updated

- `public.idx_alert_events_entity`
- `public.idx_alert_events_open_restaurant`
- `public.idx_alert_events_restaurant_severity_status`
- `public.idx_alert_rules_created_at`
- `public.idx_alert_rules_restaurant_enabled`
- `public.idx_audit_logs_entity`
- `public.idx_audit_logs_user`
- `public.idx_audit_logs_restaurant`
- `public.idx_delivery_partners_restaurant_status`
- `public.idx_support_tickets_restaurant_status_created`
- `public.idx_guests_restaurant_ltv`
- `public.idx_rate_limit_action`
- `public.idx_rate_limit_fingerprint`
- `public.idx_external_orders_restaurant_status`
- `public.idx_guest_visits_restaurant_visited`
- `public.idx_rate_limit_logs_fingerprint`
- `public.idx_stations_restaurant_id`
- `public.idx_shifts_active_status`
- `public.idx_guests_phone_hash`
- `public.idx_guests_email_hash`
- `public.idx_guests_fingerprint_hash`

## Rollback SQL (Explicit) - Additions for Stage 10

```sql
create index if not exists idx_guests_phone_hash on public.guests(restaurant_id, phone_hash) where phone_hash is not null;
create index if not exists idx_guests_email_hash on public.guests(restaurant_id, email_hash) where email_hash is not null;
create index if not exists idx_guests_fingerprint_hash on public.guests(restaurant_id, fingerprint_hash) where fingerprint_hash is not null;
```

### Stage 11

Dropped:

- `public.idx_guests_tags_gin`
- `public.idx_restaurant_staff_restaurant`
- `public.idx_stock_movements_restaurant_created`

Restored (FK coverage):

- `public.idx_restaurant_staff_restaurant`

FK coverage notes:

- `idx_restaurant_staff_restaurant` was restored after validation because the remaining index set did not provide full non-partial leading coverage for `restaurant_staff(restaurant_id)`.
- `idx_stock_movements_restaurant_created` remains dropped because `idx_stock_movements_restaurant_type` keeps leading `restaurant_id` coverage.
- `idx_guests_tags_gin` is not FK-covering.

## Explicit Drop-List (Net New Drops Still in Effect) - Updated

- `public.idx_alert_events_entity`
- `public.idx_alert_events_open_restaurant`
- `public.idx_alert_events_restaurant_severity_status`
- `public.idx_alert_rules_created_at`
- `public.idx_alert_rules_restaurant_enabled`
- `public.idx_audit_logs_entity`
- `public.idx_audit_logs_user`
- `public.idx_audit_logs_restaurant`
- `public.idx_delivery_partners_restaurant_status`
- `public.idx_support_tickets_restaurant_status_created`
- `public.idx_guests_restaurant_ltv`
- `public.idx_rate_limit_action`
- `public.idx_rate_limit_fingerprint`
- `public.idx_external_orders_restaurant_status`
- `public.idx_guest_visits_restaurant_visited`
- `public.idx_rate_limit_logs_fingerprint`
- `public.idx_stations_restaurant_id`
- `public.idx_shifts_active_status`
- `public.idx_guests_phone_hash`
- `public.idx_guests_email_hash`
- `public.idx_guests_fingerprint_hash`
- `public.idx_guests_tags_gin`
- `public.idx_stock_movements_restaurant_created`

## Rollback SQL (Explicit) - Additions for Stage 11

```sql
create index if not exists idx_guests_tags_gin on public.guests using gin (tags);
create index if not exists idx_stock_movements_restaurant_created on public.stock_movements(restaurant_id, created_at desc);
```

### Stage 12 (Batch size increased to 10)

Dropped:

- `public.idx_items_fasting`
- `public.idx_menu_items_popularity`
- `public.idx_menu_items_name_search`
- `public.idx_orders_acknowledged_at`
- `public.idx_orders_chapa_verified_paid_at`
- `public.idx_orders_order_number`
- `public.idx_order_events_type_created`
- `public.idx_order_items_status`
- `public.idx_order_items_station`
- `public.idx_restaurants_active`

Selection policy for this stage:

- Zero-scan, non-unique indexes only.
- Excluded FK-only-covering indexes (no drops where FK coverage would be lost).
- Note: This stage intentionally includes hot-path tables to satisfy larger batch size.

## Rollback SQL (Explicit) - Additions for Stage 12

```sql
create index if not exists idx_items_fasting on public.menu_items(is_fasting);
create index if not exists idx_menu_items_popularity on public.menu_items(popularity desc) where is_available = true;
create index if not exists idx_menu_items_name_search on public.menu_items using gin (to_tsvector('simple', name));
create index if not exists idx_orders_acknowledged_at on public.orders(acknowledged_at);
create index if not exists idx_orders_chapa_verified_paid_at on public.orders(chapa_verified, paid_at desc);
create index if not exists idx_orders_order_number on public.orders(order_number);
create index if not exists idx_order_events_type_created on public.order_events(event_type, created_at desc);
create index if not exists idx_order_items_status on public.order_items(status);
create index if not exists idx_order_items_station on public.order_items(station, status) where station is not null and status is not null;
create index if not exists idx_restaurants_active on public.restaurants(is_active) where is_active = true;
```

### Stage 13 (safe-only classifier run)

Dropped:

- `public.idx_order_check_split_items_split`

Selection policy for this stage:

- Used `supabase/sql/index_hygiene_safe_drop_check.sql`.
- Dropped only rows classified as `safe_to_drop`.
- Kept all `must_keep_fk_only_covering` indexes intact.

## Rollback SQL (Explicit) - Additions for Stage 13

```sql
create index if not exists idx_order_check_split_items_split on public.order_check_split_items(split_id);
```

### Stage 14 (final FK-safe advisor cleanup)

Dropped:

- `public.idx_categories_section`
- `public.idx_menu_items_category_available`
- `public.idx_orders_fingerprint_created`
- `public.idx_orders_kitchen_status`
- `public.idx_orders_restaurant_fire_mode_course`
- `public.idx_payments_restaurant_split`
- `public.idx_payments_restaurant_status`
- `public.idx_payouts_restaurant_status`
- `public.idx_reconciliation_entries_ledger`
- `public.idx_reconciliation_entries_restaurant_source`
- `public.idx_reconciliation_entries_restaurant_status`
- `public.idx_tables_active`
- `public.idx_tables_restaurant`
- `public.idx_tables_restaurant_status_active`

Selection policy for this final stage:

- Dropped all remaining zero-scan non-unique advisor candidates that do **not** violate FK protection.
- Preserved all indexes classified as `must_keep_fk_only_covering`.

## Rollback SQL (Explicit) - Additions for Stage 14

```sql
create index if not exists idx_categories_section on public.categories(restaurant_id, section) where section is not null;
create index if not exists idx_menu_items_category_available on public.menu_items(category_id, is_available);
create index if not exists idx_orders_fingerprint_created on public.orders(guest_fingerprint, created_at desc);
create index if not exists idx_orders_kitchen_status on public.orders(restaurant_id, kitchen_status) where kitchen_status is not null;
create index if not exists idx_orders_restaurant_fire_mode_course on public.orders(restaurant_id, fire_mode, current_course);
create index if not exists idx_payments_restaurant_split on public.payments(restaurant_id, split_id) where split_id is not null;
create index if not exists idx_payments_restaurant_status on public.payments(restaurant_id, status, captured_at desc);
create index if not exists idx_payouts_restaurant_status on public.payouts(restaurant_id, status, period_end desc);
create index if not exists idx_reconciliation_entries_ledger on public.reconciliation_entries(ledger_type, ledger_id);
create index if not exists idx_reconciliation_entries_restaurant_source on public.reconciliation_entries(restaurant_id, source_type, source_id);
create index if not exists idx_reconciliation_entries_restaurant_status on public.reconciliation_entries(restaurant_id, status, created_at desc);
create index if not exists idx_tables_active on public.tables(restaurant_id, status) where is_active = true;
create index if not exists idx_tables_restaurant on public.tables(restaurant_id);
create index if not exists idx_tables_restaurant_status_active on public.tables(restaurant_id, status, updated_at desc) where coalesce(is_active, true) = true;
```
