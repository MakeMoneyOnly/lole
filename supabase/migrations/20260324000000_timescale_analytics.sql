-- TimescaleDB Analytics Setup
-- Enables time-series analytics for better performance at scale
-- Creates hypertables, continuous aggregates, and retention policies

-- Step 1: Enable TimescaleDB extension
-- This must be created in the extensions schema
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Step 2: Create hourly sales hypertable for time-series analytics
-- This table stores aggregated sales data per hour per restaurant
CREATE TABLE IF NOT EXISTS hourly_sales (
    id BIGSERIAL,
    restaurant_id UUID NOT NULL,
    hour_start TIMESTAMPTZ NOT NULL,
    hour_end TIMESTAMPTZ NOT NULL,
    
    -- Sales metrics
    total_orders INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    cancelled_orders INTEGER DEFAULT 0,
    total_revenue BIGINT DEFAULT 0, -- in santim
    total_discounts BIGINT DEFAULT 0, -- in santim
    total_tips BIGINT DEFAULT 0, -- in santim
    
    -- Order type breakdown
    dine_in_orders INTEGER DEFAULT 0,
    takeout_orders INTEGER DEFAULT 0,
    delivery_orders INTEGER DEFAULT 0,
    
    -- Payment method breakdown (JSONB for flexibility)
    payment_method_breakdown JSONB DEFAULT '{}',
    
    -- Item sales breakdown (JSONB for flexibility)
    top_items JSONB DEFAULT '[]',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT pk_hourly_sales PRIMARY KEY (id, restaurant_id)
);

-- Step 3: Create daily sales hypertable for EOD reports
-- This table stores aggregated sales data per day per restaurant
CREATE TABLE IF NOT EXISTS daily_sales (
    id BIGSERIAL,
    restaurant_id UUID NOT NULL,
    date DATE NOT NULL,
    
    -- Sales metrics
    total_orders INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    cancelled_orders INTEGER DEFAULT 0,
    total_revenue BIGINT DEFAULT 0, -- in santim
    total_discounts BIGINT DEFAULT 0, -- in santim
    total_tips BIGINT DEFAULT 0, -- in santim
    net_revenue BIGINT DEFAULT 0, -- in santim (after discounts)
    
    -- Order type breakdown
    dine_in_orders INTEGER DEFAULT 0,
    takeout_orders INTEGER DEFAULT 0,
    delivery_orders INTEGER DEFAULT 0,
    
    -- Average order values
    avg_order_value BIGINT DEFAULT 0, -- in santim
    
    -- Payment method breakdown (JSONB)
    payment_method_breakdown JSONB DEFAULT '{}',
    
    -- Hourly distribution (JSONB - 24 hours)
    hourly_distribution JSONB DEFAULT '[]',
    
    -- Top selling items (JSONB)
    top_items JSONB DEFAULT '[]',
    
    -- Orders by status (JSONB)
    orders_by_status JSONB DEFAULT '{}',
    
    -- Guest metrics
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT pk_daily_sales PRIMARY KEY (id, restaurant_id)
);

-- Step 4: Convert tables to hypertables
-- TimescaleDB automatically partitions by time
SELECT create_hypertable('hourly_sales', 'hour_start', 
    chunk_time_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

SELECT create_hypertable('daily_sales', 'date',
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

-- Step 5: Add indexes for common query patterns
-- Index for restaurant + time range queries (most common)
CREATE INDEX IF NOT EXISTS idx_hourly_sales_restaurant_time 
    ON hourly_sales (restaurant_id, hour_start DESC);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_daily_sales_restaurant_date 
    ON daily_sales (restaurant_id, date DESC);

-- Index for time-range queries without restaurant filter
CREATE INDEX IF NOT EXISTS idx_hourly_sales_time 
    ON hourly_sales (hour_start DESC);

CREATE INDEX IF NOT EXISTS idx_daily_sales_date 
    ON daily_sales (date DESC);

-- Step 6: Enable compression for older chunks
-- Compress chunks older than 7 days
ALTER TABLE hourly_sales SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'restaurant_id'
);

SELECT add_compression_policy('hourly_sales', INTERVAL '7 days', if_not_exists => TRUE);

ALTER TABLE daily_sales SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'restaurant_id'
);

SELECT add_compression_policy('daily_sales', INTERVAL '30 days', if_not_exists => TRUE);

-- Step 7: Create continuous aggregates for common queries
-- Hourly aggregate for the last 30 days (pre-computed hourly summaries)
CREATE MATERIALIZED VIEW IF NOT EXISTS hourly_sales_agg_30d
WITH (timescaledb.continuous) AS
SELECT 
    restaurant_id,
    time_bucket(INTERVAL '1 hour', hour_start) AS hour,
    SUM(total_orders) AS total_orders,
    SUM(completed_orders) AS completed_orders,
    SUM(cancelled_orders) AS cancelled_orders,
    SUM(total_revenue) AS total_revenue,
    SUM(total_discounts) AS total_discounts,
    SUM(total_tips) AS total_tips,
    AVG(total_revenue) AS avg_revenue
FROM hourly_sales
WHERE hour_start >= NOW() - INTERVAL '30 days'
GROUP BY restaurant_id, time_bucket(INTERVAL '1 hour', hour_start);

-- Daily aggregate for the last year (pre-computed daily summaries)
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_sales_agg_1y
WITH (timescaledb.continuous) AS
SELECT 
    restaurant_id,
    date,
    SUM(total_orders) AS total_orders,
    SUM(completed_orders) AS completed_orders,
    SUM(cancelled_orders) AS cancelled_orders,
    SUM(total_revenue) AS total_revenue,
    SUM(total_discounts) AS total_discounts,
    SUM(total_tips) AS total_tips,
    SUM(net_revenue) AS net_revenue,
    AVG(avg_order_value) AS avg_order_value
FROM daily_sales
WHERE date >= NOW() - INTERVAL '1 year'
GROUP BY restaurant_id, date;

-- Add indexes on continuous aggregates
CREATE INDEX IF NOT EXISTS idx_hourly_sales_agg_30d_restaurant_time 
    ON hourly_sales_agg_30d (restaurant_id, hour DESC);

CREATE INDEX IF NOT EXISTS idx_daily_sales_agg_1y_restaurant_date 
    ON daily_sales_agg_1y (restaurant_id, date DESC);

-- Step 8: Add refresh policies for continuous aggregates
-- Refresh hourly aggregate every hour, keeping 30 days
SELECT add_continuous_aggregate_policy('hourly_sales_agg_30d',
    start_offset => INTERVAL '30 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);

-- Refresh daily aggregate every day, keeping 1 year
SELECT add_continuous_aggregate_policy('daily_sales_agg_1y',
    start_offset => INTERVAL '1 year',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE);

-- Step 9: Add retention policy
-- Keep raw hourly data for 90 days, then delete
SELECT add_retention_policy('hourly_sales', INTERVAL '90 days', if_not_exists => TRUE);

-- Keep raw daily data for 3 years (for long-term reporting)
SELECT add_retention_policy('daily_sales', INTERVAL '3 years', if_not_exists => TRUE);

-- Step 10: Create function to populate hourly sales from orders
-- This function will be called by a trigger or cron job
CREATE OR REPLACE FUNCTION populate_hourly_sales(
    p_restaurant_id UUID,
    p_hour_start TIMESTAMPTZ,
    p_hour_end TIMESTAMPTZ
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    SELECT jsonb_agg(jsonb_build_object(
        'name', item_name,
        'quantity', total_qty,
        'revenue', total_revenue
    ) ORDER BY total_qty DESC LIMIT 10)
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

-- Step 11: Create function to populate daily sales from hourly data
CREATE OR REPLACE FUNCTION populate_daily_sales(
    p_restaurant_id UUID,
    p_date DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    SELECT COALESCE(jsonb_agg(item ORDER BY revenue DESC LIMIT 10), '[]')
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

-- Step 12: Grant permissions
-- Grant read access to authenticated role
GRANT SELECT ON hourly_sales TO authenticated;
GRANT SELECT ON daily_sales TO authenticated;
GRANT SELECT ON hourly_sales_agg_30d TO authenticated;
GRANT SELECT ON daily_sales_agg_1y TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION populate_hourly_sales(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION populate_daily_sales(UUID, DATE) TO authenticated;

-- Grant usage on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
