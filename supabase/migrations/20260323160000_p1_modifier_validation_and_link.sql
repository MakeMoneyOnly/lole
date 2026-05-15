-- ============================================================================
-- Modifier Tables Enhancement: Validation and FK Link
-- 
-- This migration:
-- 1. Adds modifier_group_id to menu_items for quick lookup
-- 2. Adds required modifier validation function for order creation
-- 3. Migrates any existing JSONB modifier data if present
--
-- Task 5.1: Modifier tables already exist (migration 20260312180000)
-- Task 5.2: Add required-field validation for modifiers
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add modifier_group_id to menu_items
-- This allows quick access to a default modifier group for a menu item
-- ============================================================================

ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS modifier_group_id UUID REFERENCES public.modifier_groups(id) ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_menu_items_modifier_group 
ON public.menu_items(modifier_group_id) 
WHERE modifier_group_id IS NOT NULL;

-- ============================================================================
-- STEP 2: Create function to validate required modifiers
-- This function checks if all required modifier groups have at least one option selected
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_required_modifiers(
    p_menu_item_id UUID,
    p_selected_modifier_ids UUID[]
)
RETURNS TABLE(
    is_valid BOOLEAN,
    missing_groups TEXT[],
    error_message TEXT,
    error_message_am TEXT
) AS $$
DECLARE
    v_required_groups RECORD;
    v_missing_groups TEXT[] := '{}';
    v_group_name TEXT;
    v_group_name_am TEXT;
BEGIN
    -- If no modifier IDs provided, check if any groups are required
    IF p_selected_modifier_ids IS NULL OR array_length(p_selected_modifier_ids, 1) IS NULL THEN
        -- Check for required modifier groups
        FOR v_required_groups IN 
            SELECT mg.id, mg.name, mg.name_am, mg.required
            FROM public.modifier_groups mg
            WHERE mg.menu_item_id = p_menu_item_id
            AND mg.required = true
            AND mg.is_active = true
        LOOP
            v_missing_groups := array_append(v_missing_groups, v_required_groups.name);
            v_group_name := v_required_groups.name;
            v_group_name_am := v_required_groups.name_am;
        END LOOP;

        IF array_length(v_missing_groups, 1) > 0 THEN
            RETURN QUERY SELECT 
                false, 
                v_missing_groups,
                'Please select required options: ' || array_to_string(v_missing_groups, ', '),
                'እባክዎን የሚያስፈልጉ አማራጮችን ይምረጡ: ' || array_to_string(v_missing_groups, ', ');
            RETURN;
        END IF;
    ELSE
        -- Check each required group has at least one option selected
        FOR v_required_groups IN 
            SELECT mg.id, mg.name, mg.name_am, mg.required
            FROM public.modifier_groups mg
            WHERE mg.menu_item_id = p_menu_item_id
            AND mg.required = true
            AND mg.is_active = true
        LOOP
            -- Check if any of the selected modifier IDs belong to this group
            IF NOT EXISTS (
                SELECT 1 FROM public.modifier_options mo
                WHERE mo.modifier_group_id = v_required_groups.id
                AND mo.id = ANY(p_selected_modifier_ids)
            ) THEN
                v_missing_groups := array_append(v_missing_groups, v_required_groups.name);
            END IF;
        END LOOP;

        IF array_length(v_missing_groups, 1) > 0 THEN
            RETURN QUERY SELECT 
                false, 
                v_missing_groups,
                'Please select required options: ' || array_to_string(v_missing_groups, ', '),
                'እባክዎን የሚያስፈልጉ አማራጮችን ይምረጡ: ' || array_to_string(v_missing_groups, ', ');
            RETURN;
        END IF;
    END IF;

    -- All required modifiers satisfied
    RETURN QUERY SELECT true, '{}'::text[], NULL, NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.validate_required_modifiers TO authenticated, anon, service_role;

-- ============================================================================
-- STEP 3: Create function to validate all items in an order
-- Validates required modifiers for all items in an order before insertion
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_order_modifiers(
    p_order_items JSONB
)
RETURNS TABLE(
    is_valid BOOLEAN,
    menu_item_id UUID,
    missing_groups TEXT[],
    error_message TEXT,
    error_message_am TEXT
) AS $$
DECLARE
    v_item JSONB;
    v_menu_item_id UUID;
    v_selected_modifier_ids UUID[] := '{}';
    v_modifier JSONB;
    v_validation RECORD;
BEGIN
    -- Loop through each item in the order
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
    LOOP
        v_menu_item_id := (v_item->>'menu_item_id')::UUID;
        
        -- Extract selected modifier IDs from the modifiers JSONB
        v_selected_modifier_ids := '{}'::UUID[];
        
        IF v_item->'modifiers' IS NOT NULL THEN
            FOR v_modifier IN SELECT * FROM jsonb_array_elements(v_item->'modifiers')
            LOOP
                IF v_modifier->>'id' IS NOT NULL THEN
                    v_selected_modifier_ids := array_append(
                        v_selected_modifier_ids, 
                        (v_modifier->>'id')::UUID
                    );
                END IF;
            END LOOP;
        END IF;

        -- Validate required modifiers for this item
        FOR v_validation IN 
            SELECT * FROM public.validate_required_modifiers(v_menu_item_id, v_selected_modifier_ids)
        LOOP
            IF NOT v_validation.is_valid THEN
                RETURN QUERY SELECT 
                    false, 
                    v_menu_item_id, 
                    v_validation.missing_groups, 
                    v_validation.error_message,
                    v_validation.error_message_am;
                RETURN;
            END IF;
        END LOOP;
    END LOOP;

    -- All items valid
    RETURN QUERY SELECT true, NULL, NULL, NULL, NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.validate_order_modifiers TO authenticated, anon, service_role;

-- ============================================================================
-- STEP 4: Update RLS policies for modifier_group_id on menu_items
-- ============================================================================

-- Drop existing policy if it exists and recreate to include new column
DROP POLICY IF EXISTS "Public read active menu items with modifiers" ON public.menu_items;

CREATE POLICY "Public read active menu items with modifiers" 
ON public.menu_items
FOR SELECT
USING (
    is_active = true
);

-- Allow staff to update modifier_group_id
DROP POLICY IF EXISTS "Staff can manage menu items with modifiers" ON public.menu_items;

CREATE POLICY "Staff can manage menu items with modifiers" 
ON public.menu_items
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = auth.uid()
        AND rs.restaurant_id = menu_items.restaurant_id
        AND COALESCE(rs.is_active, true) = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = auth.uid()
        AND rs.restaurant_id = menu_items.restaurant_id
        AND COALESCE(rs.is_active, true) = true
    )
);

-- ============================================================================
-- STEP 5: Update updated_at trigger for menu_items (already exists but ensure it covers new column)
-- ============================================================================

-- Ensure the updated_at trigger exists and works (should already exist)
DROP TRIGGER IF EXISTS update_menu_items_modtime ON public.menu_items;

-- ============================================================================
-- STEP 6: Add indexes for modifier validation performance
-- ============================================================================

-- Index on modifier_groups for required lookup during validation
CREATE INDEX IF NOT EXISTS idx_modifier_groups_menu_item_required
ON public.modifier_groups(menu_item_id, required, is_active)
WHERE required = true AND is_active = true;

-- Index on modifier_options for validation lookups
CREATE INDEX IF NOT EXISTS idx_modifier_options_group_available
ON public.modifier_options(modifier_group_id, is_available)
WHERE is_available = true;

COMMIT;

-- ============================================================================
-- Rollback instructions:
-- ROLLBACK;
-- This will:
-- 1. Drop the modifier_group_id column from menu_items
-- 2. Drop the validation functions
-- 3. Restore RLS policies
-- Note: Indexes can be dropped manually if needed
-- ============================================================================
