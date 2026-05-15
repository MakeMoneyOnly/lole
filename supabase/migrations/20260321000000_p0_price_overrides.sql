-- =========================================================
-- Price Overrides with Audit Trail
-- TASK-POS-001: Allow staff to manually adjust item prices
-- =========================================================

-- Create price_overrides enum for reason codes
CREATE TYPE price_override_reason AS (
    code text,
    description text
);

-- Create price_overrides table
CREATE TABLE IF NOT EXISTS price_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    
    -- Price details
    original_price numeric NOT NULL CHECK (original_price >= 0),
    new_price numeric NOT NULL CHECK (new_price >= 0),
    price_difference numeric GENERATED ALWAYS AS (original_price - new_price) STORED,
    
    -- Reason
    reason_code text NOT NULL CHECK (reason_code IN (
        'manager_discount',
        'complimentary',
        'price_error',
        'customer_complaint',
        'promotion',
        'other'
    )),
    reason_notes text,
    
    -- Staff who made the override
    staff_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT price_override_different CHECK (original_price != new_price)
);

-- Indexes for price_overrides
CREATE INDEX IF NOT EXISTS idx_price_overrides_restaurant ON price_overrides(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_price_overrides_order ON price_overrides(order_id);
CREATE INDEX IF NOT EXISTS idx_price_overrides_order_item ON price_overrides(order_item_id);
CREATE INDEX IF NOT EXISTS idx_price_overrides_staff ON price_overrides(staff_id);
CREATE INDEX IF NOT EXISTS idx_price_overrides_created_at ON price_overrides(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_overrides_reason ON price_overrides(reason_code);

-- Enable RLS
ALTER TABLE price_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_overrides FORCE ROW LEVEL SECURITY;

-- RLS Policy: Staff can view overrides for their restaurant
CREATE POLICY "staff_can_view_price_overrides" ON price_overrides
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- RLS Policy: Only managers can create overrides
CREATE POLICY "managers_can_create_price_overrides" ON price_overrides
    FOR INSERT
    WITH CHECK (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'manager', 'admin')
        )
    );

-- RLS Policy: Service role has full access
CREATE POLICY "service_role_full_access_price_overrides" ON price_overrides
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Function to log price override to audit_logs
CREATE OR REPLACE FUNCTION log_price_override_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO audit_logs (
        restaurant_id,
        user_id,
        action,
        entity_type,
        entity_id,
        metadata,
        created_at
    ) VALUES (
        NEW.restaurant_id,
        NEW.staff_id,
        'price_override',
        'order_item',
        NEW.order_item_id,
        jsonb_build_object(
            'order_id', NEW.order_id,
            'original_price', NEW.original_price,
            'new_price', NEW.new_price,
            'price_difference', NEW.price_difference,
            'reason_code', NEW.reason_code,
            'reason_notes', NEW.reason_notes,
            'approved_by', NEW.approved_by
        ),
        NEW.created_at
    );
    
    RETURN NEW;
END;
$$;

-- Trigger to automatically log price overrides
CREATE TRIGGER trigger_log_price_override_audit
    AFTER INSERT ON price_overrides
    FOR EACH ROW
    EXECUTE FUNCTION log_price_override_audit();

-- Function to check if user can override prices
CREATE OR REPLACE FUNCTION can_override_prices(
    p_user_id uuid,
    p_restaurant_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role
    FROM restaurant_staff
    WHERE user_id = p_user_id
    AND restaurant_id = p_restaurant_id
    AND is_active = true;
    
    RETURN v_role IN ('owner', 'manager', 'admin');
END;
$$;

-- Comments
COMMENT ON TABLE price_overrides IS 'Tracks all price overrides with full audit trail for compliance';
COMMENT ON COLUMN price_overrides.reason_code IS 'Required reason code for the price adjustment';
COMMENT ON COLUMN price_overrides.approved_by IS 'Manager who approved the override (if different from staff_id)';
COMMENT ON FUNCTION can_override_prices IS 'Checks if a user has permission to override prices';