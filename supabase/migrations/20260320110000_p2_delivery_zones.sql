-- =========================================================
-- Delivery Zones Migration
-- P2 feature: Geographic delivery zones with fee calculation
-- =========================================================

-- Create delivery_zones table
CREATE TABLE IF NOT EXISTS delivery_zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    
    -- Zone identification
    name text NOT NULL,
    description text,
    
    -- Geographic boundary
    boundary_type text NOT NULL CHECK (boundary_type IN ('polygon', 'circle', 'radius')),
    center_latitude double precision,
    center_longitude double precision,
    radius_meters integer,
    polygon_coordinates jsonb, -- Array of [longitude, latitude] pairs
    
    -- Fee structure
    base_fee numeric NOT NULL DEFAULT 0,
    per_km_fee numeric NOT NULL DEFAULT 0,
    minimum_order numeric NOT NULL DEFAULT 0,
    maximum_order numeric,
    
    -- Availability
    is_active boolean NOT NULL DEFAULT true,
    estimated_delivery_minutes_min integer NOT NULL DEFAULT 15,
    estimated_delivery_minutes_max integer NOT NULL DEFAULT 45,
    
    -- Scheduling
    available_days integer[], -- 0-6 (Sunday-Saturday)
    available_hours_start text, -- HH:MM format
    available_hours_end text, -- HH:MM format
    
    -- Metadata
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT valid_base_fee CHECK (base_fee >= 0),
    CONSTRAINT valid_per_km_fee CHECK (per_km_fee >= 0),
    CONSTRAINT valid_minimum_order CHECK (minimum_order >= 0),
    CONSTRAINT valid_radius CHECK (radius_meters IS NULL OR radius_meters > 0),
    CONSTRAINT valid_delivery_time CHECK (estimated_delivery_minutes_min <= estimated_delivery_minutes_max)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_delivery_zones_restaurant ON delivery_zones(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones(is_active) WHERE is_active = true;

-- Create GIST index for polygon coordinates if PostGIS is available
-- This is optional and will only work if PostGIS extension is installed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        -- Can add spatial index here if PostGIS is available
        NULL;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Staff can manage delivery zones
CREATE POLICY "staff_can_manage_delivery_zones" ON delivery_zones
    FOR ALL
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- RLS Policy: Public can view active delivery zones (for guest ordering)
CREATE POLICY "public_can_view_active_delivery_zones" ON delivery_zones
    FOR SELECT
    USING (is_active = true);

-- Add upsell columns to menu_items if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'menu_items' 
        AND column_name = 'upsell_tags'
    ) THEN
        ALTER TABLE menu_items ADD COLUMN upsell_tags text[];
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'menu_items' 
        AND column_name = 'complementary_items'
    ) THEN
        ALTER TABLE menu_items ADD COLUMN complementary_items uuid[];
    END IF;
END $$;

-- Create upsell_analytics table for tracking recommendation effectiveness
CREATE TABLE IF NOT EXISTS upsell_analytics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    guest_id uuid REFERENCES guests(id) ON DELETE SET NULL,
    
    -- What was viewed
    item_viewed uuid REFERENCES menu_items(id) ON DELETE SET NULL,
    
    -- What was recommended
    recommended_items uuid[],
    
    -- Interaction tracking
    clicked_item uuid REFERENCES menu_items(id) ON DELETE SET NULL,
    added_to_cart boolean DEFAULT false,
    order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz
);

-- Indexes for upsell_analytics
CREATE INDEX IF NOT EXISTS idx_upsell_analytics_restaurant ON upsell_analytics(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_upsell_analytics_guest ON upsell_analytics(guest_id);
CREATE INDEX IF NOT EXISTS idx_upsell_analytics_created ON upsell_analytics(created_at DESC);

-- Enable RLS
ALTER TABLE upsell_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Staff can view analytics
CREATE POLICY "staff_can_view_upsell_analytics" ON upsell_analytics
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Add order_count column to menu_items for popularity tracking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'menu_items' 
        AND column_name = 'order_count'
    ) THEN
        ALTER TABLE menu_items ADD COLUMN order_count integer NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Create index for popular items query
CREATE INDEX IF NOT EXISTS idx_menu_items_order_count ON menu_items(order_count DESC) WHERE is_available = true;

-- Function to update order_count on menu_items
CREATE OR REPLACE FUNCTION update_menu_item_order_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE menu_items
        SET order_count = order_count + COALESCE(NEW.quantity, 1)
        WHERE id = NEW.menu_item_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.quantity != NEW.quantity THEN
        UPDATE menu_items
        SET order_count = order_count + (COALESCE(NEW.quantity, 0) - COALESCE(OLD.quantity, 0))
        WHERE id = NEW.menu_item_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE menu_items
        SET order_count = GREATEST(0, order_count - COALESCE(OLD.quantity, 1))
        WHERE id = OLD.menu_item_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for order_count updates
DROP TRIGGER IF EXISTS trigger_update_menu_item_order_count ON order_items;
CREATE TRIGGER trigger_update_menu_item_order_count
    AFTER INSERT OR UPDATE OR DELETE ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_menu_item_order_count();

-- Comments
COMMENT ON TABLE delivery_zones IS 'Geographic delivery zones with fee calculation';
COMMENT ON TABLE upsell_analytics IS 'Tracks upsell recommendation effectiveness';
COMMENT ON COLUMN delivery_zones.boundary_type IS 'Type of geographic boundary: circle/radius or polygon';
COMMENT ON COLUMN delivery_zones.polygon_coordinates IS 'GeoJSON-style array of [longitude, latitude] pairs for polygon boundaries';