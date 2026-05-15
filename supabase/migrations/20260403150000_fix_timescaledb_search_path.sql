-- Fix SECURITY DEFINER functions with improper search_path
-- Security remediation: Add pg_catalog to search_path to prevent search_path attacks
-- Related to TimescaleDB analytics setup migration

BEGIN;

-- Fix populate_hourly_sales function
-- Changed: SET search_path = public -> SET search_path = pg_catalog, public
CREATE OR REPLACE FUNCTION populate_hourly_sales(
    p_restaurant_id UUID,
    p_hour_start TIMESTAMPTZ,
    p_hour_end TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_order_data RECORD;
    v_payment_breakdown JSONB := '{}';
    v_item_sales JSONB := '[]';
    v_dine_in_count INTEGER := 0;
    v_takeout_count INTEGER := 0;
    v_delivery_count INTEGER := 0;
BEGIN
    -- Aggregate order data for the hour
    SELECT
        COUNT(*) AS total_orders,
        COUNT(*) FILTER (WHERE status IN ('served', 'completed')) AS completed_orders,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_orders,
        COALESCE(SUM(total_price), 0) AS total_revenue,
        COALESCE(SUM(discount_amount), 0) AS total_discounts,
        COALESCE(SUM(tip_amount), 0) AS total_tips,
        COUNT(*) FILTER (WHERE order_type = 'dine_in') AS dine_in_orders,
        COUNT(*) FILTER (WHERE order_type = 'takeout') AS takeout_orders,
        COUNT(*) FILTER (WHERE order_type = 'delivery') AS delivery_orders
    INTO v_order_data
    FROM orders
    WHERE restaurant_id = p_restaurant_id
      AND created_at >= p_hour_start
      AND created_at < p_hour_end;

    -- Get payment method breakdown
    SELECT COALESCE(jsonb_object_agg(payment_method, count), '{}')
    INTO v_payment_breakdown
    FROM (
        SELECT COALESCE(payment_method, 'unknown') AS payment_method, COUNT(*) AS count
        FROM orders
        WHERE restaurant_id = p_restaurant_id
          AND created_at >= p_hour_start
          AND created_at < p_hour_end
        GROUP BY payment_method
    ) sub;

    -- Get top items
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', item_name,
        'quantity', total_qty,
        'revenue', total_revenue
    )), '[]')
    INTO v_item_sales
    FROM (
        SELECT
            oi.name AS item_name,
            SUM(oi.quantity) AS total_qty,
            SUM(oi.quantity * oi.price) AS total_revenue
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.restaurant_id = p_restaurant_id
          AND o.created_at >= p_hour_start
          AND o.created_at < p_hour_end
        GROUP BY oi.name
        ORDER BY SUM(oi.quantity) DESC
        LIMIT 10
    ) sub;

    -- Upsert hourly sales record
    INSERT INTO hourly_sales (
        restaurant_id, hour_start, hour_end,
        total_orders, completed_orders, cancelled_orders,
        total_revenue, total_discounts, total_tips,
        dine_in_orders, takeout_orders, delivery_orders,
        payment_method_breakdown, top_items,
        created_at, updated_at
    ) VALUES (
        p_restaurant_id, p_hour_start, p_hour_end,
        COALESCE(v_order_data.total_orders, 0),
        COALESCE(v_order_data.completed_orders, 0),
        COALESCE(v_order_data.cancelled_orders, 0),
        COALESCE(v_order_data.total_revenue, 0),
        COALESCE(v_order_data.total_discounts, 0),
        COALESCE(v_order_data.total_tips, 0),
        COALESCE(v_order_data.dine_in_orders, 0),
        COALESCE(v_order_data.takeout_orders, 0),
        COALESCE(v_order_data.delivery_orders, 0),
        v_payment_breakdown, v_item_sales,
        NOW(), NOW()
    )
    ON CONFLICT (restaurant_id, hour_start)
    DO UPDATE SET
        total_orders = EXCLUDED.total_orders,
        completed_orders = EXCLUDED.completed_orders,
        cancelled_orders = EXCLUDED.cancelled_orders,
        total_revenue = EXCLUDED.total_revenue,
        total_discounts = EXCLUDED.total_discounts,
        total_tips = EXCLUDED.total_tips,
        dine_in_orders = EXCLUDED.dine_in_orders,
        takeout_orders = EXCLUDED.takeout_orders,
        delivery_orders = EXCLUDED.delivery_orders,
        payment_method_breakdown = EXCLUDED.payment_method_breakdown,
        top_items = EXCLUDED.top_items,
        updated_at = NOW();
END;
$$;

-- Fix populate_daily_sales function
-- Changed: SET search_path = public -> SET search_path = pg_catalog, public
CREATE OR REPLACE FUNCTION populate_daily_sales(
    p_restaurant_id UUID,
    p_date DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_hour_start TIMESTAMPTZ;
    v_hour_end TIMESTAMPTZ;
    v_hour_data RECORD;
    v_daily_data RECORD;
    v_hourly_dist JSONB := '[]';
    v_payment_breakdown JSONB := '{}';
    v_top_items JSONB := '[]';
    v_orders_by_status JSONB := '{}';
BEGIN
    v_hour_start := p_date::timestamptz;
    v_hour_end := (p_date + 1)::timestamptz;

    -- Aggregate from hourly_sales
    SELECT
        SUM(total_orders) AS total_orders,
        SUM(completed_orders) AS completed_orders,
        SUM(cancelled_orders) AS cancelled_orders,
        SUM(total_revenue) AS total_revenue,
        SUM(total_discounts) AS total_discounts,
        SUM(total_tips) AS total_tips,
        SUM(total_revenue) - SUM(total_discounts) AS net_revenue,
        SUM(dine_in_orders) AS dine_in_orders,
        SUM(takeout_orders) AS takeout_orders,
        SUM(delivery_orders) AS delivery_orders,
        CASE WHEN SUM(total_orders) > 0
             THEN SUM(total_revenue) / SUM(total_orders)
             ELSE 0 END AS avg_order_value
    INTO v_daily_data
    FROM hourly_sales
    WHERE restaurant_id = p_restaurant_id
      AND hour_start >= v_hour_start
      AND hour_start < v_hour_end;

    -- Build hourly distribution
    FOR v_hour_data IN
        SELECT
            EXTRACT(HOUR FROM hour_start) AS hour,
            total_orders,
            total_revenue
        FROM hourly_sales
        WHERE restaurant_id = p_restaurant_id
          AND hour_start >= v_hour_start
          AND hour_start < v_hour_end
        ORDER BY hour_start
    LOOP
        v_hourly_dist := v_hourly_dist || jsonb_build_array(
            jsonb_build_object(
                'hour', v_hour_data.hour,
                'orders', v_hour_data.total_orders,
                'revenue', v_hour_data.total_revenue
            )
        );
    END LOOP;

    -- Get aggregated payment breakdown
    SELECT COALESCE(jsonb_object_agg(key, value), '{}')
    INTO v_payment_breakdown
    FROM (
        SELECT
            key,
            SUM(value::bigint) AS value
        FROM hourly_sales,
             jsonb_each(hourly_sales.payment_method_breakdown)
        WHERE restaurant_id = p_restaurant_id
          AND hour_start >= v_hour_start
          AND hour_start < v_hour_end
        GROUP BY key
    ) sub;

    -- Get top items from hourly data
    SELECT COALESCE(jsonb_agg(item), '[]')
    INTO v_top_items
    FROM (
        SELECT
            item->>'name' AS name,
            SUM((item->>'quantity')::int) AS quantity,
            SUM((item->>'revenue')::bigint) AS revenue
        FROM hourly_sales,
             jsonb_array_elements(top_items) AS item
        WHERE restaurant_id = p_restaurant_id
          AND hour_start >= v_hour_start
          AND hour_start < v_hour_end
        GROUP BY item->>'name'
        ORDER BY SUM((item->>'revenue')::bigint) DESC
        LIMIT 10
    ) sub;

    -- Get orders by status
    SELECT COALESCE(jsonb_object_agg(status, count), '{}')
    INTO v_orders_by_status
    FROM (
        SELECT status, COUNT(*) AS count
        FROM orders
        WHERE restaurant_id = p_restaurant_id
          AND created_at >= v_hour_start
          AND created_at < v_hour_end
        GROUP BY status
    ) sub;

    -- Upsert daily sales record
    INSERT INTO daily_sales (
        restaurant_id, date,
        total_orders, completed_orders, cancelled_orders,
        total_revenue, total_discounts, total_tips, net_revenue,
        dine_in_orders, takeout_orders, delivery_orders,
        avg_order_value,
        payment_method_breakdown, hourly_distribution,
        top_items, orders_by_status,
        created_at, updated_at
    ) VALUES (
        p_restaurant_id, p_date,
        COALESCE(v_daily_data.total_orders, 0),
        COALESCE(v_daily_data.completed_orders, 0),
        COALESCE(v_daily_data.cancelled_orders, 0),
        COALESCE(v_daily_data.total_revenue, 0),
        COALESCE(v_daily_data.total_discounts, 0),
        COALESCE(v_daily_data.total_tips, 0),
        COALESCE(v_daily_data.net_revenue, 0),
        COALESCE(v_daily_data.dine_in_orders, 0),
        COALESCE(v_daily_data.takeout_orders, 0),
        COALESCE(v_daily_data.delivery_orders, 0),
        COALESCE(v_daily_data.avg_order_value, 0),
        v_payment_breakdown, v_hourly_dist,
        v_top_items, v_orders_by_status,
        NOW(), NOW()
    )
    ON CONFLICT (restaurant_id, date)
    DO UPDATE SET
        total_orders = EXCLUDED.total_orders,
        completed_orders = EXCLUDED.completed_orders,
        cancelled_orders = EXCLUDED.cancelled_orders,
        total_revenue = EXCLUDED.total_revenue,
        total_discounts = EXCLUDED.total_discounts,
        total_tips = EXCLUDED.total_tips,
        net_revenue = EXCLUDED.net_revenue,
        dine_in_orders = EXCLUDED.dine_in_orders,
        takeout_orders = EXCLUDED.takeout_orders,
        delivery_orders = EXCLUDED.delivery_orders,
        avg_order_value = EXCLUDED.avg_order_value,
        payment_method_breakdown = EXCLUDED.payment_method_breakdown,
        hourly_distribution = EXCLUDED.hourly_distribution,
        top_items = EXCLUDED.top_items,
        orders_by_status = EXCLUDED.orders_by_status,
        updated_at = NOW();
END;
$$;

COMMIT;
