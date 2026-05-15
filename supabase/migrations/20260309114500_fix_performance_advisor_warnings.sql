BEGIN;

-- Remove advisor-reported unused indexes so the query planner has fewer
-- redundant choices and writes have less index maintenance overhead.
DROP INDEX IF EXISTS ops.idx_stage5_index_usage_snapshots_index;
DROP INDEX IF EXISTS ops.idx_stage5_query_stat_snapshots_queryid;
DROP INDEX IF EXISTS public.idx_alert_events_rule_id;
DROP INDEX IF EXISTS public.idx_categories_restaurant_order;
DROP INDEX IF EXISTS public.idx_discounts_target_category;
DROP INDEX IF EXISTS public.idx_discounts_target_menu_item;
DROP INDEX IF EXISTS public.idx_guest_visits_guest_visited;
DROP INDEX IF EXISTS public.idx_guest_visits_table_id;
DROP INDEX IF EXISTS public.idx_hardware_devices_restaurant_id;
DROP INDEX IF EXISTS public.idx_hardware_devices_restaurant_last_active;
DROP INDEX IF EXISTS public.idx_kds_item_events_actor_user_id;
DROP INDEX IF EXISTS public.idx_kds_item_events_item_created;
DROP INDEX IF EXISTS public.idx_kds_item_events_order_created;
DROP INDEX IF EXISTS public.idx_kds_item_events_restaurant_created;
DROP INDEX IF EXISTS public.idx_order_events_actor_user_id;
DROP INDEX IF EXISTS public.idx_order_items_item_id;
DROP INDEX IF EXISTS public.idx_orders_discount_id;
DROP INDEX IF EXISTS public.idx_orders_tenant;
DROP INDEX IF EXISTS public.idx_payments_split_id;
DROP INDEX IF EXISTS public.idx_rate_limit_logs_restaurant_id;
DROP INDEX IF EXISTS public.idx_recipe_ingredients_item;
DROP INDEX IF EXISTS public.idx_recipes_menu_item_id;
DROP INDEX IF EXISTS public.idx_reconciliation_entries_payment_id;
DROP INDEX IF EXISTS public.idx_reconciliation_entries_payout_id;
DROP INDEX IF EXISTS public.idx_reconciliation_entries_refund_id;
DROP INDEX IF EXISTS public.idx_reviews_item_created;
DROP INDEX IF EXISTS public.idx_reviews_restaurant_created;
DROP INDEX IF EXISTS public.idx_staff_invites_created_by;
DROP INDEX IF EXISTS public.idx_stock_movements_item_created;
DROP INDEX IF EXISTS public.idx_supplier_invoices_purchase_order;
DROP INDEX IF EXISTS public.idx_support_tickets_created_by;
DROP INDEX IF EXISTS public.idx_workflow_audit_logs_tenant_id;
DROP INDEX IF EXISTS public.payment_sessions_provider_tx_idx;
DROP INDEX IF EXISTS public.payment_sessions_restaurant_status_idx;
DROP INDEX IF EXISTS public.payments_payment_session_id_idx;

-- Keep public read access intact while removing overlapping authenticated SELECT
-- policies that the advisor flags as multiple permissive policies.

-- categories: public read stays public; staff policy becomes write-only.
DROP POLICY IF EXISTS "Staff can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Staff can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Staff can update categories" ON public.categories;
DROP POLICY IF EXISTS "Staff can delete categories" ON public.categories;

CREATE POLICY "Staff can insert categories"
    ON public.categories
    FOR INSERT
    TO authenticated
    WITH CHECK (public.user_has_restaurant_access(restaurant_id));

CREATE POLICY "Staff can update categories"
    ON public.categories
    FOR UPDATE
    TO authenticated
    USING (public.user_has_restaurant_access(restaurant_id))
    WITH CHECK (public.user_has_restaurant_access(restaurant_id));

CREATE POLICY "Staff can delete categories"
    ON public.categories
    FOR DELETE
    TO authenticated
    USING (public.user_has_restaurant_access(restaurant_id));

-- tables: public read stays available; staff policy becomes write-only.
DROP POLICY IF EXISTS "Staff can manage tables" ON public.tables;
DROP POLICY IF EXISTS "Staff can insert tables" ON public.tables;
DROP POLICY IF EXISTS "Staff can update tables" ON public.tables;
DROP POLICY IF EXISTS "Staff can delete tables" ON public.tables;

CREATE POLICY "Staff can insert tables"
    ON public.tables
    FOR INSERT
    TO authenticated
    WITH CHECK (public.user_has_restaurant_access(restaurant_id));

CREATE POLICY "Staff can update tables"
    ON public.tables
    FOR UPDATE
    TO authenticated
    USING (public.user_has_restaurant_access(restaurant_id))
    WITH CHECK (public.user_has_restaurant_access(restaurant_id));

CREATE POLICY "Staff can delete tables"
    ON public.tables
    FOR DELETE
    TO authenticated
    USING (public.user_has_restaurant_access(restaurant_id));

-- discounts: keep broad staff read, but split manager write privileges away from
-- SELECT so authenticated SELECT only evaluates one permissive policy.
DROP POLICY IF EXISTS discounts_manager_write ON public.discounts;
DROP POLICY IF EXISTS discounts_manager_insert ON public.discounts;
DROP POLICY IF EXISTS discounts_manager_update ON public.discounts;
DROP POLICY IF EXISTS discounts_manager_delete ON public.discounts;

CREATE POLICY discounts_manager_insert
    ON public.discounts
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.restaurant_id = discounts.restaurant_id
              AND rs.user_id = (SELECT auth.uid())
              AND rs.is_active = true
              AND rs.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY discounts_manager_update
    ON public.discounts
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.restaurant_id = discounts.restaurant_id
              AND rs.user_id = (SELECT auth.uid())
              AND rs.is_active = true
              AND rs.role IN ('owner', 'admin', 'manager')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.restaurant_id = discounts.restaurant_id
              AND rs.user_id = (SELECT auth.uid())
              AND rs.is_active = true
              AND rs.role IN ('owner', 'admin', 'manager')
        )
    );

CREATE POLICY discounts_manager_delete
    ON public.discounts
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.restaurant_id = discounts.restaurant_id
              AND rs.user_id = (SELECT auth.uid())
              AND rs.is_active = true
              AND rs.role IN ('owner', 'admin', 'manager')
        )
    );

-- menu_items: public authenticated read already covers staff, so this extra
-- authenticated SELECT policy is redundant and triggers the advisor warning.
DROP POLICY IF EXISTS "Staff View All" ON public.menu_items;

COMMIT;
