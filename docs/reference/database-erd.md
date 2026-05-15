# Database Entity-Relationship Diagram

> Generated from `src/types/database.ts` type definitions. Last updated: 2026-04-09.

## Overview

The lole database contains **67 tables** (excluding views and functions) organized across 8 domains. The central entity is `restaurants`, which is referenced by nearly all tenant-scoped tables via `restaurant_id` foreign keys. Multi-tenant isolation is enforced through RLS policies on all tenant-scoped tables.

---

## Domain Index

| Domain        | Tables | Description                                                              |
| ------------- | ------ | ------------------------------------------------------------------------ |
| Core          | 9      | Tenants, restaurants, users, staff, shifts, stations                     |
| Orders        | 13     | Orders, items, splits, payments, refunds, tips, reconciliation           |
| Menu          | 10     | Categories, items, modifiers, discounts, happy hour, centralized configs |
| KDS           | 2      | Kitchen display items and events                                         |
| Guest         | 11     | Guests, visits, campaigns, loyalty, reviews, gift cards                  |
| Tables        | 2      | Physical tables and sessions                                             |
| Notifications | 4      | Logs, metrics, push/device tokens                                        |
| Delivery      | 6      | Partners, aggregators, external orders, service requests, support        |
| System        | 10     | Audit logs, health, sync, reports, alerts, billing, compliance           |

---

## Full ERD (Mermaid)

```mermaid
erDiagram
    tenants {
        uuid id PK
        string name
        string slug
        string api_key
        boolean is_active
        json settings
        timestamp created_at
    }

    restaurants {
        uuid id PK
        uuid tenant_id FK
        string name
        string name_am
        string slug
        string currency
        string timezone
        string status
        json settings
        json metadata
        timestamp created_at
        timestamp updated_at
    }

    user_profiles {
        uuid id PK
        string email
        string full_name
        string phone
        string role
        string locale
        timestamp created_at
        timestamp updated_at
    }

    agency_users {
        uuid id PK
        uuid user_id
        string role
        uuid[] restaurant_ids
        timestamp created_at
    }

    restaurant_staff {
        uuid id PK
        uuid restaurant_id FK
        string full_name
        string role
        string pin_hash
        string status
        timestamp created_at
        timestamp updated_at
    }

    staff_invites {
        uuid id PK
        uuid restaurant_id FK
        string email
        string role
        string code
        string pin_code
        string status
        timestamp expires_at
        timestamp created_at
    }

    shifts {
        uuid id PK
        uuid restaurant_id FK
        uuid staff_id FK
        string role
        string shift_date
        string start_time
        string end_time
        string status
        string station
        timestamp created_at
    }

    time_entries {
        uuid id PK
        uuid restaurant_id FK
        uuid staff_id FK
        uuid shift_id FK
        string clock_in_at
        string clock_out_at
        string status
        string source
        timestamp created_at
    }

    stations {
        uuid id PK
        uuid restaurant_id FK
        string name
        string station_type
        boolean enabled
        string telegram_chat_id
        timestamp created_at
    }

    tenants ||--o{ restaurants : owns
    restaurants ||--o{ restaurant_staff : employs
    restaurants ||--o{ staff_invites : invites
    restaurants ||--o{ shifts : schedules
    restaurants ||--o{ stations : configures
    restaurant_staff ||--o{ shifts : assigned
    restaurant_staff ||--o{ time_entries : tracks
    shifts ||--o{ time_entries : records

    orders {
        uuid id PK
        uuid restaurant_id FK
        string order_number
        string order_type
        string status
        string source
        uuid table_id
        uuid guest_id
        uuid discount_id FK
        uuid happy_hour_schedule_id FK
        number subtotal
        number tax_amount
        number discount_amount
        number total_amount
        string currency
        string notes
        json metadata
        timestamp created_at
        timestamp updated_at
    }

    order_items {
        uuid id PK
        uuid order_id FK
        uuid item_id FK
        uuid restaurant_id FK
        string name
        number quantity
        number unit_price
        number total_price
        string notes
        json modifiers
        string status
        timestamp created_at
    }

    order_events {
        uuid id PK
        uuid order_id FK
        uuid restaurant_id FK
        string event_type
        string from_status
        string to_status
        string actor_user_id
        json metadata
        timestamp created_at
    }

    order_check_splits {
        uuid id PK
        uuid order_id FK
        uuid restaurant_id FK
        string split_type
        number total_amount
        string status
        timestamp created_at
    }

    order_check_split_items {
        uuid id PK
        uuid order_id FK
        uuid order_item_id FK
        uuid split_id FK
        uuid restaurant_id FK
        number portion
        number amount
        timestamp created_at
    }

    payment_sessions {
        uuid id PK
        uuid order_id FK
        uuid restaurant_id FK
        string provider
        string status
        number amount
        string currency
        json metadata
        timestamp created_at
    }

    payments {
        uuid id PK
        uuid order_id FK
        uuid restaurant_id FK
        uuid payment_session_id FK
        uuid split_id FK
        uuid tip_allocation_id FK
        uuid tip_pool_id FK
        string method
        string provider
        string status
        number amount
        number tip_amount
        string currency
        json metadata
        timestamp created_at
    }

    payouts {
        uuid id PK
        uuid restaurant_id FK
        string status
        number amount
        string currency
        string period_start
        string period_end
        timestamp created_at
    }

    refunds {
        uuid id PK
        uuid order_id FK
        uuid payment_id FK
        uuid restaurant_id FK
        string status
        number amount
        string reason
        json metadata
        timestamp created_at
    }

    reconciliation_entries {
        uuid id PK
        uuid restaurant_id FK
        uuid payment_id FK
        uuid payout_id FK
        uuid refund_id FK
        string entry_type
        number amount
        timestamp created_at
    }

    tip_pools {
        uuid id PK
        uuid restaurant_id FK
        string name
        string distribution_method
        boolean is_active
        timestamp created_at
    }

    tip_pool_shares {
        uuid id PK
        uuid restaurant_id FK
        uuid tip_pool_id FK
        string role
        number percentage
        timestamp created_at
    }

    tip_allocations {
        uuid id PK
        uuid restaurant_id FK
        uuid tip_pool_id FK
        uuid shift_id FK
        string status
        number total_tips_collected
        number total_tips_pooled
        number total_tips_distributed
        json distribution
        timestamp created_at
    }

    restaurants ||--o{ orders : receives
    orders ||--o{ order_items : contains
    orders ||--o{ order_events : tracks
    orders ||--o{ order_check_splits : split_into
    order_check_splits ||--o{ order_check_split_items : includes
    order_items ||--o{ order_check_split_items : allocated_in
    orders ||--o{ payment_sessions : initiates
    orders ||--o{ payments : settled_by
    payment_sessions ||--o{ payments : processes
    order_check_splits ||--o{ payments : pays
    orders ||--o{ refunds : refunded_by
    payments ||--o{ refunds : reversed_by
    payments ||--o{ reconciliation_entries : reconciled_in
    payouts ||--o{ reconciliation_entries : included_in
    refunds ||--o{ reconciliation_entries : tracked_in
    tip_pools ||--o{ tip_pool_shares : distributes
    tip_pools ||--o{ tip_allocations : allocates
    tip_allocations ||--o{ payments : tips_from

    categories {
        uuid id PK
        uuid restaurant_id FK
        string name
        string name_am
        string section
        number order_index
        timestamp created_at
    }

    menu_items {
        uuid id PK
        uuid restaurant_id FK
        uuid category_id FK
        string name
        string name_am
        string description
        string description_am
        number price
        number cost
        boolean is_available
        string dietary_info
        json metadata
        number likes
        timestamp created_at
    }

    modifier_groups {
        uuid id PK
        uuid restaurant_id FK
        uuid menu_item_id FK
        string name
        string name_am
        boolean is_required
        number min_selections
        number max_selections
        timestamp created_at
    }

    modifier_options {
        uuid id PK
        uuid restaurant_id FK
        uuid modifier_group_id FK
        string name
        string name_am
        number price
        boolean is_default
        timestamp created_at
    }

    discounts {
        uuid id PK
        uuid restaurant_id FK
        string name
        string name_am
        string type
        number value
        string applies_to
        boolean is_active
        boolean requires_manager_pin
        uuid target_category_id FK
        uuid target_menu_item_id FK
        string valid_from
        string valid_until
        timestamp created_at
    }

    happy_hour_schedules {
        uuid id PK
        uuid restaurant_id FK
        string name
        string name_am
        string applies_to
        number discount_percentage
        number discount_fixed_amount
        string[] schedule_days
        string schedule_start_time
        string schedule_end_time
        uuid target_category_id FK
        boolean is_active
        boolean requires_manager_pin
        number priority
        timestamp created_at
    }

    centralized_menu_configs {
        uuid id PK
        uuid primary_restaurant_id FK
        string name
        string description
        boolean sync_items
        boolean sync_pricing
        boolean sync_categories
        boolean sync_modifiers
        boolean sync_availability
        boolean auto_sync_enabled
        timestamp created_at
    }

    menu_location_links {
        uuid id PK
        uuid menu_config_id FK
        uuid restaurant_id FK
        timestamp created_at
    }

    menu_change_queue {
        uuid id PK
        uuid menu_config_id FK
        string change_type
        json payload
        string status
        number pending_changes
        timestamp created_at
    }

    upsell_analytics {
        uuid id PK
        uuid restaurant_id FK
        uuid menu_item_id
        uuid suggested_item_id
        number times_suggested
        number times_accepted
        number revenue_generated
        timestamp created_at
    }

    restaurants ||--o{ categories : organizes
    categories ||--o{ menu_items : contains
    restaurants ||--o{ menu_items : offers
    menu_items ||--o{ modifier_groups : has
    modifier_groups ||--o{ modifier_options : includes
    restaurants ||--o{ discounts : applies
    categories ||--o{ discounts : targets
    menu_items ||--o{ discounts : targets
    restaurants ||--o{ happy_hour_schedules : schedules
    categories ||--o{ happy_hour_schedules : applies_to
    restaurants ||--o{ centralized_menu_configs : manages
    centralized_menu_configs ||--o{ menu_location_links : syncs_to
    centralized_menu_configs ||--o{ menu_change_queue : queues

    kds_order_items {
        uuid id PK
        uuid restaurant_id FK
        uuid order_id FK
        uuid order_item_id FK
        string name
        number quantity
        string station
        string status
        string notes
        json modifiers
        json metadata
        string last_action_by
        timestamp started_at
        timestamp ready_at
        timestamp held_at
        timestamp recalled_at
        timestamp created_at
    }

    kds_item_events {
        uuid id PK
        uuid restaurant_id FK
        uuid kds_order_item_id FK
        uuid order_id FK
        string event_type
        string from_status
        string to_status
        string actor_user_id
        string reason
        json metadata
        timestamp created_at
    }

    orders ||--o{ kds_order_items : displayed_on
    order_items ||--o{ kds_order_items : tracked_by
    kds_order_items ||--o{ kds_item_events : logs

    guests {
        uuid id PK
        uuid restaurant_id FK
        string identity_key
        string name
        string language
        boolean is_vip
        number visit_count
        number lifetime_value
        string[] tags
        string notes
        string phone_hash
        string email_hash
        string fingerprint_hash
        json metadata
        timestamp first_seen_at
        timestamp last_seen_at
        timestamp created_at
    }

    guest_visits {
        uuid id PK
        uuid guest_id FK
        uuid restaurant_id FK
        uuid order_id FK
        uuid table_id FK
        string channel
        number spend
        json metadata
        timestamp visited_at
        timestamp created_at
    }

    segments {
        uuid id PK
        uuid restaurant_id FK
        string name
        json rule_json
        string created_by
        timestamp created_at
    }

    campaigns {
        uuid id PK
        uuid restaurant_id FK
        uuid segment_id FK
        string name
        string channel
        string status
        json template_json
        string scheduled_at
        string launched_at
        string created_by
        timestamp created_at
    }

    campaign_deliveries {
        uuid id PK
        uuid campaign_id FK
        uuid guest_id FK
        uuid conversion_order_id FK
        string status
        json metadata
        timestamp sent_at
        timestamp opened_at
        timestamp clicked_at
        timestamp created_at
    }

    loyalty_programs {
        uuid id PK
        uuid restaurant_id FK
        string name
        string type
        json rules
        boolean is_active
        timestamp created_at
    }

    loyalty_accounts {
        uuid id PK
        uuid restaurant_id FK
        uuid guest_id FK
        uuid program_id FK
        number points_balance
        string tier
        json metadata
        timestamp created_at
    }

    loyalty_transactions {
        uuid id PK
        uuid restaurant_id FK
        uuid account_id FK
        uuid order_id FK
        string type
        number points
        json metadata
        timestamp created_at
    }

    reviews {
        uuid id PK
        uuid restaurant_id FK
        uuid item_id FK
        number rating
        string comment
        timestamp created_at
    }

    gift_cards {
        uuid id PK
        uuid restaurant_id FK
        string code
        string currency
        number initial_balance
        number current_balance
        string status
        string expires_at
        json metadata
        timestamp created_at
    }

    gift_card_transactions {
        uuid id PK
        uuid restaurant_id FK
        uuid gift_card_id FK
        uuid order_id FK
        number amount_delta
        number balance_after
        string type
        json metadata
        timestamp created_at
    }

    restaurants ||--o{ guests : hosts
    guests ||--o{ guest_visits : records
    restaurants ||--o{ segments : defines
    segments ||--o{ campaigns : targets
    campaigns ||--o{ campaign_deliveries : delivers
    guests ||--o{ campaign_deliveries : receives
    restaurants ||--o{ loyalty_programs : runs
    guests ||--o{ loyalty_accounts : enrolls
    loyalty_programs ||--o{ loyalty_accounts : tracks
    loyalty_accounts ||--o{ loyalty_transactions : transacts
    restaurants ||--o{ gift_cards : issues
    gift_cards ||--o{ gift_card_transactions : transactions

    tables {
        uuid id PK
        uuid restaurant_id FK
        string table_number
        number capacity
        string status
        string zone
        boolean is_active
        string qr_code_url
        number qr_version
        uuid active_order_id
        timestamp created_at
    }

    table_sessions {
        uuid id PK
        uuid restaurant_id FK
        uuid table_id FK
        uuid assigned_staff_id FK
        string status
        number guest_count
        string opened_at
        string closed_at
        string notes
        json metadata
        timestamp created_at
    }

    restaurants ||--o{ tables : configures
    tables ||--o{ table_sessions : hosts
    restaurant_staff ||--o{ table_sessions : assigned_to

    notification_logs {
        uuid id PK
        uuid restaurant_id FK
        uuid order_id FK
        string channel
        string template
        string status
        string recipient
        json metadata
        timestamp created_at
    }

    notification_metrics {
        uuid id PK
        uuid restaurant_id FK
        string channel
        string period
        number sent
        number delivered
        number failed
        timestamp created_at
    }

    push_tokens {
        uuid id PK
        uuid restaurant_id FK
        uuid guest_id FK
        string token
        string platform
        boolean is_active
        timestamp created_at
    }

    device_tokens {
        uuid id PK
        uuid restaurant_id FK
        uuid guest_id FK
        string token
        string device_type
        string provider
        string device_name
        boolean is_active
        json metadata
        timestamp created_at
    }

    restaurants ||--o{ notification_logs : sends
    restaurants ||--o{ notification_metrics : tracks
    restaurants ||--o{ push_tokens : registers
    guests ||--o{ push_tokens : subscribes
    restaurants ||--o{ device_tokens : manages
    guests ||--o{ device_tokens : owns

    delivery_partners {
        uuid id PK
        uuid restaurant_id FK
        string provider
        string display_name
        string status
        string api_key
        string credentials_ref
        json settings_json
        timestamp last_sync_at
        timestamp created_at
    }

    delivery_aggregator_configs {
        uuid id PK
        uuid restaurant_id FK
        string aggregator_name
        string api_key
        string api_secret_ref
        string webhook_url
        json settings_json
        string status
        timestamp last_sync_at
        timestamp created_at
    }

    delivery_partner_integrations {
        uuid id PK
        uuid restaurant_id FK
        string provider
        string status
        json settings_json
        timestamp created_at
    }

    external_orders {
        uuid id PK
        uuid restaurant_id FK
        uuid delivery_partner_id FK
        string provider
        string provider_order_id
        string source_channel
        string normalized_status
        number total_amount
        string currency
        json payload_json
        string acked_by
        timestamp acknowledged_at
        timestamp created_at
    }

    service_requests {
        uuid id PK
        uuid restaurant_id FK
        string type
        string status
        json metadata
        timestamp created_at
    }

    support_tickets {
        uuid id PK
        uuid restaurant_id FK
        string subject
        string description
        string priority
        string status
        string source
        json diagnostics_json
        string created_by
        timestamp created_at
    }

    restaurants ||--o{ delivery_partners : integrates
    restaurants ||--o{ delivery_aggregator_configs : configures
    restaurants ||--o{ delivery_partner_integrations : connects
    restaurants ||--o{ external_orders : receives
    delivery_partners ||--o{ external_orders : fulfills
    delivery_partner_integrations ||--o{ external_orders : routes
    restaurants ||--o{ service_requests : handles
    restaurants ||--o{ support_tickets : files

    audit_logs {
        uuid id PK
        uuid restaurant_id FK
        string entity_type
        uuid entity_id
        string action
        json old_value
        json new_value
        json metadata
        uuid user_id
        string telegram_user_id
        timestamp created_at
    }

    workflow_audit_logs {
        uuid id PK
        uuid restaurant_id FK
        string workflow_type
        string step
        string status
        json payload
        timestamp created_at
    }

    rate_limit_logs {
        uuid id PK
        uuid restaurant_id FK
        string endpoint
        string ip_address
        number request_count
        timestamp window_start
        timestamp created_at
    }

    device_sync_status {
        uuid id PK
        uuid restaurant_id FK
        string device_id
        string device_name
        string device_type
        string sync_status
        string sync_version
        timestamp last_sync_at
        timestamp created_at
    }

    sync_idempotency_keys {
        uuid id PK
        uuid restaurant_id FK
        string idempotency_key
        string operation_type
        json result_data
        number version
        timestamp processed_at
        timestamp created_at
    }

    system_health {
        uuid id PK
        string service
        string status
        number latency_ms
        string message
        json metadata
        timestamp last_checked
        timestamp created_at
    }

    system_health_monitor {
        uuid id PK
        string service
        string status
        number latency_ms
        string message
        json metadata
        timestamp last_checked
    }

    hardware_devices {
        uuid id PK
        uuid restaurant_id FK
        string name
        string device_type
        string status
        string pairing_code
        string device_token
        string[] assigned_zones
        json metadata
        timestamp paired_at
        timestamp last_active_at
        timestamp created_at
    }

    alert_rules {
        uuid id PK
        uuid restaurant_id FK
        string name
        string severity
        json condition_json
        json target_json
        boolean enabled
        timestamp created_at
    }

    alert_events {
        uuid id PK
        uuid restaurant_id FK
        uuid rule_id FK
        string entity_type
        uuid entity_id
        string severity
        string status
        json payload
        timestamp resolved_at
        timestamp created_at
    }

    report_templates {
        uuid id PK
        uuid restaurant_id FK
        string name
        string type
        json config
        timestamp created_at
    }

    scheduled_reports {
        uuid id PK
        uuid restaurant_id FK
        string schedule
        string format
        json recipients
        timestamp created_at
    }

    report_executions {
        uuid id PK
        uuid scheduled_report_id FK
        uuid restaurant_id FK
        string status
        string result_url
        timestamp started_at
        timestamp completed_at
        timestamp created_at
    }

    hourly_sales {
        uuid id PK
        uuid restaurant_id FK
        timestamp hour
        number total_sales
        number total_orders
        number avg_order_value
    }

    daily_sales {
        uuid id PK
        uuid restaurant_id FK
        date date
        number total_sales
        number total_orders
        number avg_order_value
        number total_refunds
    }

    erca_submissions {
        uuid id PK
        uuid restaurant_id FK
        string period
        string status
        json payload
        string submission_ref
        timestamp submitted_at
        timestamp created_at
    }

    global_orders {
        uuid id PK
        uuid tenant_id FK
        uuid external_order_id
        string status
        number total_amount
        string currency
        string table_number
        json items
        timestamp created_at
    }

    restaurants ||--o{ audit_logs : audits
    restaurants ||--o{ workflow_audit_logs : traces
    restaurants ||--o{ rate_limit_logs : throttles
    restaurants ||--o{ device_sync_status : syncs
    restaurants ||--o{ sync_idempotency_keys : deduplicates
    restaurants ||--o{ hardware_devices : pairs
    restaurants ||--o{ alert_rules : defines
    alert_rules ||--o{ alert_events : triggers
    restaurants ||--o{ report_templates : templates
    restaurants ||--o{ scheduled_reports : schedules
    scheduled_reports ||--o{ report_executions : executes
    restaurants ||--o{ hourly_sales : aggregates
    restaurants ||--o{ daily_sales : summarizes
    restaurants ||--o{ erca_submissions : complies
    tenants ||--o{ global_orders : tracks
```

---

## Relationship Summary

### Central Hub: `restaurants`

The `restaurants` table is the tenant-scoping entity. Almost every domain table has a `restaurant_id` foreign key, which is also the primary column used in RLS policies for multi-tenant isolation.

### Cross-Domain Relationships

| From                   | To                   | Relationship                          | Purpose                           |
| ---------------------- | -------------------- | ------------------------------------- | --------------------------------- |
| orders                 | tables               | order.table_id                        | Link order to physical table      |
| orders                 | guests               | order.guest_id                        | Link order to guest               |
| orders                 | discounts            | order.discount_id                     | Apply discount to order           |
| orders                 | happy_hour_schedules | order.happy_hour_schedule_id          | Apply happy hour pricing          |
| order_items            | menu_items           | order_item.item_id                    | Reference menu item at order time |
| kds_order_items        | orders               | kds_order_item.order_id               | Display order on kitchen screen   |
| kds_order_items        | order_items          | kds_order_item.order_item_id          | Track individual item preparation |
| guest_visits           | orders               | guest_visit.order_id                  | Link visit to order               |
| guest_visits           | tables               | guest_visit.table_id                  | Track which table guest used      |
| table_sessions         | restaurant_staff     | table_session.assigned_staff_id       | Staff assigned to table           |
| payments               | tip_allocations      | payment.tip_allocation_id             | Tip from split check              |
| payments               | tip_pools            | payment.tip_pool_id                   | Tip to pool                       |
| external_orders        | delivery_partners    | external_order.delivery_partner_id    | Delivery fulfillment              |
| campaign_deliveries    | orders               | campaign_delivery.conversion_order_id | Track campaign conversion         |
| loyalty_transactions   | orders               | loyalty_transaction.order_id          | Points from order                 |
| gift_card_transactions | orders               | gift_card_transaction.order_id        | Gift card used in order           |

---

## Views

| View                          | Base Tables                     | Purpose                                |
| ----------------------------- | ------------------------------- | -------------------------------------- |
| `restaurant_staff_with_users` | restaurant_staff, user_profiles | Join staff with auth user profile data |

---

## Database Functions

| Function                      | Args                             | Returns | Purpose                                |
| ----------------------------- | -------------------------------- | ------- | -------------------------------------- |
| `birr_to_santim`              | birr_value: number               | number  | Convert Birr to Santim (cents)         |
| `santim_to_birr`              | santim_value: number             | number  | Convert Santim to Birr                 |
| `current_user_id`             | none                             | string  | Get current authenticated user ID      |
| `get_my_staff_role`           | none                             | string  | Get current user's staff role          |
| `is_agency_admin`             | none                             | boolean | Check if current user is agency admin  |
| `user_has_restaurant_access`  | restaurant_id, user_id           | boolean | Verify user access to restaurant       |
| `increment_likes`             | item_id                          | void    | Increment menu item likes counter      |
| `increment_pending_changes`   | config_id                        | void    | Increment menu change queue counter    |
| `mark_stale_devices_offline`  | none                             | void    | Mark inactive devices as offline       |
| `check_auth_users_fk_cascade` | none                             | void    | Verify auth users FK cascade integrity |
| `complete_report_execution`   | execution_id, status, result_url | void    | Finalize report execution              |

---

## RLS and Security Notes

- All tenant-scoped tables have RLS enabled with `restaurant_id` as the tenant boundary.
- Sensitive guest data (phone, email) is stored as hashes (`phone_hash`, `email_hash`, `fingerprint_hash`).
- API keys and credentials are stored as references (`credentials_ref`, `api_secret_ref`) rather than plaintext.
- The `sync_idempotency_keys` table prevents duplicate operations during offline sync.
- `rate_limit_logs` supports per-endpoint/per-IP throttling.
