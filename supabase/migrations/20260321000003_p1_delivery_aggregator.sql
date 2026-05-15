-- =========================================================
-- Third-Party Delivery Aggregator
-- TASK-DELIVERY-001: Unified delivery partner integration
-- =========================================================

-- Delivery partners table (if not exists from previous migration)
CREATE TABLE IF NOT EXISTS delivery_partners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    
    -- Partner details
    partner_name text NOT NULL CHECK (partner_name IN (
        'telebirr_food',
        'deliver_addis',
        'betengna',
        'custom',
        'other'
    )),
    display_name text NOT NULL,
    
    -- API credentials (encrypted at application layer)
    api_key_ref text, -- Reference to encrypted key in secrets manager
    api_secret_ref text,
    webhook_secret_ref text,
    
    -- Configuration
    is_active boolean DEFAULT true,
    auto_accept_orders boolean DEFAULT false,
    prep_time_minutes integer DEFAULT 30,
    
    -- Menu sync
    last_menu_sync_at timestamptz,
    menu_sync_status text DEFAULT 'pending',
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(restaurant_id, partner_name)
);

-- Aggregator orders (orders from third-party platforms)
CREATE TABLE IF NOT EXISTS aggregator_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    delivery_partner_id uuid NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
    
    -- External order reference
    external_order_id text NOT NULL,
    external_order_number text,
    
    -- Link to internal order (once created)
    internal_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
    
    -- Raw order data from partner
    raw_order_data jsonb NOT NULL,
    
    -- Normalized order data
    customer_name text,
    customer_phone text,
    delivery_address text,
    delivery_latitude numeric,
    delivery_longitude numeric,
    delivery_notes text,
    
    -- Items (normalized)
    items jsonb DEFAULT '[]',
    
    -- Totals
    subtotal numeric DEFAULT 0,
    delivery_fee numeric DEFAULT 0,
    platform_fee numeric DEFAULT 0,
    total numeric DEFAULT 0,
    
    -- Status
    status text NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'accepted', 'rejected', 'preparing', 'ready', 'picked_up', 'delivered', 'cancelled'
    )),
    
    -- Timing
    placed_at timestamptz,
    accepted_at timestamptz,
    estimated_pickup_at timestamptz,
    actual_pickup_at timestamptz,
    estimated_delivery_at timestamptz,
    actual_delivery_at timestamptz,
    
    -- Sync status
    sync_status text DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'error')),
    last_sync_at timestamptz,
    sync_error text,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    UNIQUE(delivery_partner_id, external_order_id)
);

-- Delivery driver tracking
CREATE TABLE IF NOT EXISTS delivery_drivers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
    delivery_partner_id uuid REFERENCES delivery_partners(id) ON DELETE CASCADE,
    
    -- Driver info
    external_driver_id text,
    name text,
    phone text,
    vehicle_type text,
    vehicle_plate text,
    
    -- Location
    current_latitude numeric,
    current_longitude numeric,
    last_location_update_at timestamptz,
    
    -- Status
    status text DEFAULT 'offline' CHECK (status IN ('offline', 'available', 'busy', 'on_delivery')),
    
    -- Current delivery
    current_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Delivery tracking events
CREATE TABLE IF NOT EXISTS delivery_tracking_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Event details
    event_type text NOT NULL CHECK (event_type IN (
        'driver_assigned',
        'driver_on_the_way',
        'driver_arrived',
        'order_picked_up',
        'driver_location_update',
        'order_delivered',
        'delivery_failed',
        'delivery_cancelled'
    )),
    
    -- Location (for location updates)
    latitude numeric,
    longitude numeric,
    
    -- Additional data
    event_data jsonb DEFAULT '{}',
    
    -- Driver
    driver_id uuid REFERENCES delivery_drivers(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Menu sync log
CREATE TABLE IF NOT EXISTS menu_sync_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    delivery_partner_id uuid NOT NULL REFERENCES delivery_partners(id) ON DELETE CASCADE,
    
    -- Sync details
    sync_type text NOT NULL CHECK (sync_type IN ('full', 'partial', 'price_update', 'availability_update')),
    status text NOT NULL CHECK (status IN ('pending', 'success', 'partial', 'failed')),
    
    -- Items synced
    items_total integer DEFAULT 0,
    items_success integer DEFAULT 0,
    items_failed integer DEFAULT 0,
    
    -- Errors
    errors jsonb DEFAULT '[]',
    
    -- Timing
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    
    -- Duration in milliseconds
    duration_ms integer
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_partners_restaurant ON delivery_partners(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_aggregator_orders_restaurant ON aggregator_orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_aggregator_orders_partner ON aggregator_orders(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_aggregator_orders_status ON aggregator_orders(status);
CREATE INDEX IF NOT EXISTS idx_aggregator_orders_external ON aggregator_orders(external_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_drivers_partner ON delivery_drivers(delivery_partner_id);
CREATE INDEX IF NOT EXISTS idx_delivery_drivers_status ON delivery_drivers(status);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order ON delivery_tracking_events(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_created ON delivery_tracking_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_sync_logs_partner ON menu_sync_logs(delivery_partner_id);

-- Enable RLS
ALTER TABLE delivery_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregator_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "staff_can_view_delivery_partners" ON delivery_partners
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "managers_can_manage_delivery_partners" ON delivery_partners
    FOR ALL
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'manager', 'admin')
        )
    );

CREATE POLICY "staff_can_view_aggregator_orders" ON aggregator_orders
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "staff_can_manage_aggregator_orders" ON aggregator_orders
    FOR ALL
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "staff_can_view_delivery_tracking" ON delivery_tracking_events
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Function to inject aggregator order into POS
CREATE OR REPLACE FUNCTION inject_aggregator_order(
    p_aggregator_order_id uuid,
    p_staff_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agg_order RECORD;
    v_order_id uuid;
    v_order_number text;
BEGIN
    -- Get aggregator order
    SELECT * INTO v_agg_order
    FROM aggregator_orders
    WHERE id = p_aggregator_order_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'aggregator_order_not_found');
    END IF;
    
    -- Check if already injected
    IF v_agg_order.internal_order_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'order_id', v_agg_order.internal_order_id,
            'already_exists', true
        );
    END IF;
    
    -- Generate order number
    v_order_number := 'DEL-' || to_char(now(), 'YYMMDD') || '-' || 
        LPAD(nextval('order_number_seq')::text, 4, '0');
    
    -- Create internal order
    INSERT INTO orders (
        id,
        restaurant_id,
        order_number,
        order_type,
        status,
        items,
        total_price,
        customer_name,
        customer_phone,
        delivery_address,
        notes,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_agg_order.restaurant_id,
        v_order_number,
        'delivery',
        'pending',
        v_agg_order.items,
        v_agg_order.total,
        v_agg_order.customer_name,
        v_agg_order.customer_phone,
        v_agg_order.delivery_address,
        v_agg_order.delivery_notes,
        now()
    ) RETURNING id INTO v_order_id;
    
    -- Link aggregator order to internal order
    UPDATE aggregator_orders
    SET internal_order_id = v_order_id,
        status = 'accepted',
        accepted_at = now()
    WHERE id = p_aggregator_order_id;
    
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
        v_agg_order.restaurant_id,
        p_staff_id,
        'aggregator_order_injected',
        'order',
        v_order_id,
        jsonb_build_object(
            'aggregator_order_id', p_aggregator_order_id,
            'delivery_partner_id', v_agg_order.delivery_partner_id,
            'external_order_id', v_agg_order.external_order_id
        ),
        now()
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number
    );
END;
$$;

-- Function to update driver location
CREATE OR REPLACE FUNCTION update_driver_location(
    p_driver_id uuid,
    p_latitude numeric,
    p_longitude numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE delivery_drivers
    SET current_latitude = p_latitude,
        current_longitude = p_longitude,
        last_location_update_at = now(),
        updated_at = now()
    WHERE id = p_driver_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- Comments
COMMENT ON TABLE aggregator_orders IS 'Orders received from third-party delivery platforms';
COMMENT ON TABLE delivery_drivers IS 'Driver information and real-time location tracking';
COMMENT ON TABLE delivery_tracking_events IS 'Event log for delivery tracking';
COMMENT ON TABLE menu_sync_logs IS 'Log of menu synchronization with delivery partners';