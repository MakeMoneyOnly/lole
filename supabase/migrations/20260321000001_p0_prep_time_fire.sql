-- =========================================================
-- Fire by Prep Time
-- TASK-KDS-001: Calculate when items should fire based on prep duration
-- =========================================================

-- Add prep_time_minutes column to menu_items if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'menu_items' 
        AND column_name = 'prep_time_minutes'
    ) THEN
        ALTER TABLE menu_items ADD COLUMN prep_time_minutes integer DEFAULT 15;
    END IF;
END $$;

-- Add calculated_fire_at column to order_items if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' 
        AND column_name = 'calculated_fire_at'
    ) THEN
        ALTER TABLE order_items ADD COLUMN calculated_fire_at timestamptz;
    END IF;
END $$;

-- Add actual_fired_at column to order_items if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' 
        AND column_name = 'actual_fired_at'
    ) THEN
        ALTER TABLE order_items ADD COLUMN actual_fired_at timestamptz;
    END IF;
END $$;

-- Add fire_status column to order_items if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' 
        AND column_name = 'fire_status'
    ) THEN
        ALTER TABLE order_items ADD COLUMN fire_status text DEFAULT 'pending' 
            CHECK (fire_status IN ('pending', 'fired', 'completed', 'cancelled'));
    END IF;
END $$;

-- Add target_completion_at column to orders if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'target_completion_at'
    ) THEN
        ALTER TABLE orders ADD COLUMN target_completion_at timestamptz;
    END IF;
END $$;

-- Create index for prep time queries
CREATE INDEX IF NOT EXISTS idx_menu_items_prep_time ON menu_items(prep_time_minutes) WHERE prep_time_minutes IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_fire_status ON order_items(fire_status);
CREATE INDEX IF NOT EXISTS idx_order_items_calculated_fire_at ON order_items(calculated_fire_at);

-- Function to calculate fire times for all items in an order
CREATE OR REPLACE FUNCTION calculate_order_fire_times(
    p_order_id uuid,
    p_target_time timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_target timestamptz;
    v_max_prep_time integer := 0;
    v_item RECORD;
    v_fire_at timestamptz;
    v_results jsonb := '[]'::jsonb;
BEGIN
    -- Get order details
    SELECT id, restaurant_id, created_at, target_completion_at INTO v_order
    FROM orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'order_not_found');
    END IF;
    
    -- Determine target completion time
    v_target := COALESCE(p_target_time, v_order.target_completion_at, now() + interval '30 minutes');
    
    -- Update order with target completion time
    UPDATE orders SET target_completion_at = v_target WHERE id = p_order_id;
    
    -- Find the maximum prep time to calculate when to start
    SELECT COALESCE(MAX(mi.prep_time_minutes), 15) INTO v_max_prep_time
    FROM order_items oi
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE oi.order_id = p_order_id;
    
    -- Calculate fire time for each item based on its prep time
    FOR v_item IN
        SELECT 
            oi.id as order_item_id,
            oi.menu_item_id,
            mi.name,
            mi.prep_time_minutes,
            oi.course
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = p_order_id
    LOOP
        -- Calculate when this item should fire
        -- Items with longer prep times fire earlier
        v_fire_at := v_target - (COALESCE(v_item.prep_time_minutes, 15) || ' minutes')::interval;
        
        -- Don't fire in the past
        IF v_fire_at < now() THEN
            v_fire_at := now();
        END IF;
        
        -- Update the order item
        UPDATE order_items 
        SET calculated_fire_at = v_fire_at,
            fire_status = CASE WHEN fire_status IS NULL THEN 'pending' ELSE fire_status END
        WHERE id = v_item.order_item_id;
        
        -- Add to results
        v_results := v_results || jsonb_build_object(
            'order_item_id', v_item.order_item_id,
            'menu_item_id', v_item.menu_item_id,
            'name', v_item.name,
            'prep_time_minutes', v_item.prep_time_minutes,
            'fire_at', v_fire_at,
            'course', v_item.course
        );
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'target_completion_at', v_target,
        'max_prep_time_minutes', v_max_prep_time,
        'items', v_results
    );
END;
$$;

-- Function to get items ready to fire
CREATE OR REPLACE FUNCTION get_items_ready_to_fire(
    p_restaurant_id uuid
)
RETURNS TABLE (
    order_id uuid,
    order_number text,
    table_number text,
    item_id uuid,
    item_name text,
    quantity integer,
    course text,
    prep_time_minutes integer,
    calculated_fire_at timestamptz,
    minutes_until_fire numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id as order_id,
        o.order_number,
        o.table_number,
        oi.id as item_id,
        mi.name as item_name,
        oi.quantity,
        oi.course,
        mi.prep_time_minutes,
        oi.calculated_fire_at,
        EXTRACT(EPOCH FROM (oi.calculated_fire_at - now())) / 60 as minutes_until_fire
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE o.restaurant_id = p_restaurant_id
    AND o.status IN ('pending', 'confirmed', 'preparing')
    AND oi.fire_status = 'pending'
    AND oi.calculated_fire_at IS NOT NULL
    AND oi.calculated_fire_at <= now() + interval '5 minutes'  -- Show items within 5 min of fire time
    ORDER BY oi.calculated_fire_at ASC;
END;
$$;

-- Function to mark item as fired
CREATE OR REPLACE FUNCTION mark_item_fired(
    p_order_item_id uuid,
    p_staff_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_item RECORD;
BEGIN
    SELECT oi.*, o.restaurant_id INTO v_order_item
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.id = p_order_item_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'item_not_found');
    END IF;
    
    UPDATE order_items 
    SET fire_status = 'fired',
        actual_fired_at = now()
    WHERE id = p_order_item_id;
    
    -- Log to audit
    INSERT INTO audit_logs (
        restaurant_id,
        user_id,
        action,
        entity_type,
        entity_id,
        metadata,
        created_at
    ) VALUES (
        v_order_item.restaurant_id,
        p_staff_id,
        'item_fired',
        'order_item',
        p_order_item_id,
        jsonb_build_object(
            'order_id', v_order_item.order_id,
            'calculated_fire_at', v_order_item.calculated_fire_at,
            'actual_fired_at', now()
        ),
        now()
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'order_item_id', p_order_item_id,
        'fired_at', now()
    );
END;
$$;

-- Function to auto-fire items when their time comes
CREATE OR REPLACE FUNCTION auto_fire_ready_items(
    p_restaurant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fired_count integer := 0;
    v_item RECORD;
BEGIN
    FOR v_item IN
        SELECT oi.id
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.restaurant_id = p_restaurant_id
        AND o.status IN ('pending', 'confirmed', 'preparing')
        AND oi.fire_status = 'pending'
        AND oi.calculated_fire_at IS NOT NULL
        AND oi.calculated_fire_at <= now()
    LOOP
        UPDATE order_items 
        SET fire_status = 'fired',
            actual_fired_at = now()
        WHERE id = v_item.id;
        
        v_fired_count := v_fired_count + 1;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'items_fired', v_fired_count
    );
END;
$$;

-- Comments
COMMENT ON COLUMN menu_items.prep_time_minutes IS 'Estimated preparation time in minutes for this menu item';
COMMENT ON COLUMN order_items.calculated_fire_at IS 'Calculated time when this item should start being prepared';
COMMENT ON COLUMN order_items.actual_fired_at IS 'Actual time when the item was fired to the kitchen';
COMMENT ON COLUMN order_items.fire_status IS 'Current fire status: pending, fired, completed, cancelled';
COMMENT ON FUNCTION calculate_order_fire_times IS 'Calculates optimal fire times for all items in an order to complete together';
COMMENT ON FUNCTION get_items_ready_to_fire IS 'Returns items that are ready or about to be ready to fire';
COMMENT ON FUNCTION mark_item_fired IS 'Marks an item as fired and logs to audit';