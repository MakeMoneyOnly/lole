BEGIN;

-- Supabase can flag low-traffic FK indexes as unused, but covering foreign-key
-- indexes are still the safer default for deletes, updates, and join-heavy
-- workloads. Restore them using minimal btree indexes.
CREATE INDEX IF NOT EXISTS idx_alert_events_rule_id
    ON public.alert_events (rule_id);

CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id
    ON public.categories (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_discounts_target_category
    ON public.discounts (target_category_id)
    WHERE target_category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discounts_target_menu_item
    ON public.discounts (target_menu_item_id)
    WHERE target_menu_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_tenant
    ON public.global_orders (tenant_id);

CREATE INDEX IF NOT EXISTS idx_guest_visits_guest_id
    ON public.guest_visits (guest_id);

CREATE INDEX IF NOT EXISTS idx_guest_visits_table_id
    ON public.guest_visits (table_id);

CREATE INDEX IF NOT EXISTS idx_hardware_devices_restaurant_id
    ON public.hardware_devices (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_kds_item_events_actor_user_id
    ON public.kds_item_events (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_kds_item_events_item_id
    ON public.kds_item_events (kds_order_item_id);

CREATE INDEX IF NOT EXISTS idx_kds_item_events_order_id
    ON public.kds_item_events (order_id);

CREATE INDEX IF NOT EXISTS idx_kds_item_events_restaurant_id
    ON public.kds_item_events (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_order_events_actor_user_id
    ON public.order_events (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_order_items_item_id
    ON public.order_items (item_id);

CREATE INDEX IF NOT EXISTS idx_orders_discount_id
    ON public.orders (discount_id)
    WHERE discount_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_sessions_restaurant_id
    ON public.payment_sessions (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_payments_payment_session_id
    ON public.payments (payment_session_id)
    WHERE payment_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_split_id
    ON public.payments (split_id)
    WHERE split_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_restaurant_id
    ON public.rate_limit_logs (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_item
    ON public.recipe_ingredients (inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_recipes_menu_item_id
    ON public.recipes (menu_item_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_entries_payment_id
    ON public.reconciliation_entries (payment_id)
    WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reconciliation_entries_payout_id
    ON public.reconciliation_entries (payout_id)
    WHERE payout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reconciliation_entries_refund_id
    ON public.reconciliation_entries (refund_id)
    WHERE refund_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_item_id
    ON public.reviews (item_id);

CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_id
    ON public.reviews (restaurant_id);

CREATE INDEX IF NOT EXISTS idx_staff_invites_created_by
    ON public.staff_invites (created_by)
    WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id
    ON public.stock_movements (inventory_item_id);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_purchase_order
    ON public.supplier_invoices (purchase_order_id)
    WHERE purchase_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by
    ON public.support_tickets (created_by)
    WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_audit_logs_tenant_id
    ON public.workflow_audit_logs (tenant_id);

COMMIT;
