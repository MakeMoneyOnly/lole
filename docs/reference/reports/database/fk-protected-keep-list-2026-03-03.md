# FK Protected Keep List (2026-03-03)

## Purpose

Accepted exception list for zero-scan non-unique indexes that are currently the only non-partial FK-leading coverage.

## Decision

- Status: `FK_PROTECTED_KEEP`
- Action: do not drop unless same-stage migration adds an alternate non-partial FK-leading index and includes rollback SQL.
- Review cadence: quarterly, and after significant query-shape changes.

## Keep List (34)

- `public.idx_alert_events_rule_id`
- `public.idx_categories_restaurant_order`
- `public.idx_orders_tenant`
- `public.idx_guest_visits_guest_visited`
- `public.idx_guest_visits_table_id`
- `public.idx_hardware_devices_restaurant_id`
- `public.idx_kds_item_events_actor_user_id`
- `public.idx_kds_item_events_item_created`
- `public.idx_kds_item_events_order_created`
- `public.idx_kds_item_events_restaurant_created`
- `public.idx_kds_order_items_order_item_id`
- `public.idx_order_check_split_items_order_id`
- `public.idx_order_check_split_items_order_item_id`
- `public.idx_order_check_split_items_restaurant_order`
- `public.idx_order_check_splits_restaurant_order`
- `public.idx_order_events_actor_user_id`
- `public.idx_order_items_item_id`
- `public.idx_payments_order_id`
- `public.idx_payments_split_id`
- `public.idx_rate_limit_logs_restaurant_id`
- `public.idx_recipe_ingredients_item`
- `public.idx_recipes_menu_item_id`
- `public.idx_reconciliation_entries_payment_id`
- `public.idx_reconciliation_entries_payout_id`
- `public.idx_reconciliation_entries_refund_id`
- `public.idx_refunds_order_id`
- `public.idx_restaurant_staff_restaurant`
- `public.idx_reviews_item_created`
- `public.idx_reviews_restaurant_created`
- `public.idx_staff_invites_created_by`
- `public.idx_stock_movements_item_created`
- `public.idx_supplier_invoices_purchase_order`
- `public.idx_support_tickets_created_by`
- `public.idx_workflow_audit_logs_tenant_id`

## Verification SQL

Run `supabase/sql/fk_protected_keep_verification.sql` and confirm count remains `34` before any new index-drop campaign.
