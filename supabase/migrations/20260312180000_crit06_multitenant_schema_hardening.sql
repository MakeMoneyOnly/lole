-- CRIT-06: Multi-tenant schema and security hardening
-- Date: 2026-03-12
-- Purpose: 
-- 1. Add restaurant_id to order_items for proper tenant isolation
-- 2. Add idempotency_key to order_items for offline sync
-- 3. Normalize modifiers from JSONB to tables (modifier_groups, modifier_options)
-- 4. Add RLS policies for new tables
--
-- This is the guardrail before scaling write paths and integrations

BEGIN;

-- ============================================================================
-- STEP 1: Add restaurant_id to order_items
-- ============================================================================

-- Check if order_items already has restaurant_id
DO $$
DECLARE
    col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'order_items' 
        AND column_name = 'restaurant_id'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        -- Add restaurant_id column
        ALTER TABLE public.order_items 
            ADD COLUMN restaurant_id UUID REFERENCES public.restaurants(id);
        
        -- Backfill from orders table
        UPDATE public.order_items oi
        SET restaurant_id = o.restaurant_id
        FROM public.orders o
        WHERE oi.order_id = o.id
        AND oi.restaurant_id IS NULL;
        
        -- Add NOT NULL constraint (only if all rows have values)
        IF EXISTS (
            SELECT 1 FROM public.order_items 
            WHERE restaurant_id IS NULL
        ) THEN
            -- Set default for any remaining nulls
            ALTER TABLE public.order_items 
                ALTER COLUMN restaurant_id SET DEFAULT (
                    SELECT id FROM public.restaurants LIMIT 1
                );
        END IF;
        
        ALTER TABLE public.order_items 
            ALTER COLUMN restaurant_id SET NOT NULL;
        
        -- Create index for tenant-scoped queries
        CREATE INDEX IF NOT EXISTS idx_order_items_restaurant 
            ON public.order_items(restaurant_id);
        
        RAISE NOTICE 'order_items.restaurant_id added and backfilled';
    ELSE
        RAISE NOTICE 'order_items.restaurant_id already exists - skipping';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Add idempotency_key to order_items
-- ============================================================================

DO $
DECLARE
    col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'order_items' 
        AND column_name = 'idempotency_key'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        ALTER TABLE public.order_items 
            ADD COLUMN idempotency_key TEXT;
        
        CREATE INDEX IF NOT EXISTS idx_order_items_idempotency_key 
            ON public.order_items(idempotency_key) 
            WHERE idempotency_key IS NOT NULL;
        
        RAISE NOTICE 'order_items.idempotency_key added';
    ELSE
        RAISE NOTICE 'order_items.idempotency_key already exists - skipping';
    END IF;
END $;

-- Also add idempotency_key to order_check_split_items for split bill scenarios
DO $
DECLARE
    col_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'order_check_split_items' 
        AND column_name = 'idempotency_key'
    ) INTO col_exists;
    
    IF NOT col_exists THEN
        ALTER TABLE public.order_check_split_items 
            ADD COLUMN idempotency_key TEXT;
        
        CREATE INDEX IF NOT EXISTS idx_order_check_split_items_idempotency_key 
            ON public.order_check_split_items(idempotency_key) 
            WHERE idempotency_key IS NOT NULL;
        
        RAISE NOTICE 'order_check_split_items.idempotency_key added';
    ELSE
        RAISE NOTICE 'order_check_split_items.idempotency_key already exists - skipping';
    END IF;
END $;

-- ============================================================================
-- STEP 3: Create modifier_groups table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.modifier_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_am TEXT,
    required BOOLEAN DEFAULT false,
    multi_select BOOLEAN DEFAULT false,
    min_select INTEGER DEFAULT 0,
    max_select INTEGER,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint for restaurant scope
ALTER TABLE public.modifier_groups 
    ADD CONSTRAINT uq_modifier_groups_restaurant_menu_item_name 
    UNIQUE (restaurant_id, menu_item_id, name);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_modifier_groups_menu_item 
    ON public.modifier_groups(menu_item_id);

CREATE INDEX IF NOT EXISTS idx_modifier_groups_restaurant 
    ON public.modifier_groups(restaurant_id, is_active);

-- RLS
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create modifier_options table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.modifier_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    modifier_group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_am TEXT,
    price_adjustment INTEGER DEFAULT 0,  -- in SANTIM (can be negative)
    is_available BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_modifier_options_group 
    ON public.modifier_options(modifier_group_id);

CREATE INDEX IF NOT EXISTS idx_modifier_options_restaurant 
    ON public.modifier_options(restaurant_id, is_available);

-- RLS
ALTER TABLE public.modifier_options ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Add RLS policies for modifier_groups
-- ============================================================================

-- Public read for active modifier groups (for guest ordering)
CREATE POLICY "Public read active modifier groups"
    ON public.modifier_groups
    FOR SELECT
    USING (
        is_active = true
        AND EXISTS (
            SELECT 1 FROM public.menu_items mi
            WHERE mi.id = modifier_groups.menu_item_id
            AND mi.is_available = true
        )
    );

-- Tenant staff can manage modifier groups
CREATE POLICY "Tenant staff can manage modifier groups"
    ON public.modifier_groups
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
            AND rs.restaurant_id = modifier_groups.restaurant_id
            AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
            AND rs.restaurant_id = modifier_groups.restaurant_id
            AND COALESCE(rs.is_active, true) = true
        )
    );

-- ============================================================================
-- STEP 6: Add RLS policies for modifier_options
-- ============================================================================

-- Public read for active modifier options
CREATE POLICY "Public read active modifier options"
    ON public.modifier_options
    FOR SELECT
    USING (
        is_available = true
        AND EXISTS (
            SELECT 1 FROM public.modifier_groups mg
            WHERE mg.id = modifier_options.modifier_group_id
            AND mg.is_active = true
        )
    );

-- Tenant staff can manage modifier options
CREATE POLICY "Tenant staff can manage modifier options"
    ON public.modifier_options
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
            AND rs.restaurant_id = modifier_options.restaurant_id
            AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
            AND rs.restaurant_id = modifier_options.restaurant_id
            AND COALESCE(rs.is_active, true) = true
        )
    );

-- ============================================================================
-- STEP 7: Update order_items RLS to include restaurant_id
-- ============================================================================

-- Drop existing policies that don't account for restaurant_id on order_items
DROP POLICY IF EXISTS "Tenant staff can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Tenant staff can update order items" ON public.order_items;

-- New tenant-scoped policies using restaurant_id directly
CREATE POLICY "Tenant staff can view order items"
    ON public.order_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
            AND rs.restaurant_id = order_items.restaurant_id
            AND COALESCE(rs.is_active, true) = true
        )
    );

CREATE POLICY "Tenant staff can update order items"
    ON public.order_items
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
            AND rs.restaurant_id = order_items.restaurant_id
            AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
            AND rs.restaurant_id = order_items.restaurant_id
            AND COALESCE(rs.is_active, true) = true
        )
    );

-- Guest insert policy for order_items
CREATE POLICY "Guest can create order items with valid tenant data"
    ON public.order_items
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = order_items.restaurant_id
            AND COALESCE(r.is_active, true) = true
        )
    );

-- ============================================================================
-- STEP 8: Add indexes for order_items restaurant_id (if not exists)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_order_status
    ON public.order_items (restaurant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_kds_station
    ON public.order_items (restaurant_id, station, status);

-- ============================================================================
-- STEP 9: Update trigger for updated_at on modifier_groups
-- ============================================================================

CREATE OR REPLACE FUNCTION update_modifier_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_modifier_groups_modtime ON public.modifier_groups;
CREATE TRIGGER update_modifier_groups_modtime 
    BEFORE UPDATE ON public.modifier_groups 
    FOR EACH ROW EXECUTE PROCEDURE update_modifier_groups_updated_at();

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================
-- Run these queries to verify the migration:
-- 
-- SELECT COUNT(*) FROM public.order_items WHERE restaurant_id IS NULL;
-- SELECT COUNT(*) FROM public.modifier_groups;
-- SELECT COUNT(*) FROM public.modifier_options;
-- 
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('modifier_groups', 'modifier_options', 'order_items');
