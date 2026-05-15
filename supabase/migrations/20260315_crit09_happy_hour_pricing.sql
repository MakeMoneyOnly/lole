-- Happy Hour Pricing Foundation
-- Date: 2026-03-15
-- Purpose: support time-based pricing rules for happy hour promotions

BEGIN;

-- Happy hour schedule table
CREATE TABLE IF NOT EXISTS public.happy_hour_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_am TEXT,
    description TEXT,
    description_am TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    -- Schedule configuration (supports multiple time ranges per day)
    schedule_days TEXT[] NOT NULL DEFAULT ARRAY['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    schedule_start_time TIME NOT NULL,
    schedule_end_time TIME NOT NULL,
    -- Pricing rules
    discount_percentage INTEGER CHECK (discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 10000)),
    discount_fixed_amount INTEGER CHECK (discount_fixed_amount IS NULL OR discount_fixed_amount >= 0),
    applies_to TEXT NOT NULL DEFAULT 'order' CHECK (applies_to IN ('order', 'item', 'category')),
    target_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    target_menu_item_ids UUID[] DEFAULT '{}',
    -- Priority for overlapping schedules (higher = more important)
    priority INTEGER NOT NULL DEFAULT 0,
    -- Manager PIN requirement for activation
    requires_manager_pin BOOLEAN NOT NULL DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT happy_hour_schedule_valid_time CHECK (schedule_start_time < schedule_end_time)
);

-- Index for efficient happy hour lookup by restaurant and time
CREATE INDEX IF NOT EXISTS idx_happy_hour_schedules_restaurant_active
    ON public.happy_hour_schedules (restaurant_id, is_active, priority DESC)
    WHERE is_active = true;

-- Index for finding active schedules at a given time
CREATE INDEX IF NOT EXISTS idx_happy_hour_schedules_time_lookup
    ON public.happy_hour_schedules (restaurant_id, schedule_days, is_active)
    WHERE is_active = true;

-- RLS
ALTER TABLE public.happy_hour_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.happy_hour_schedules FORCE ROW LEVEL SECURITY;

-- Staff can view happy hour schedules
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'happy_hour_schedules'
          AND policyname = 'happy_hour_schedules_staff_select'
    ) THEN
        CREATE POLICY happy_hour_schedules_staff_select
            ON public.happy_hour_schedules
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.restaurant_staff rs
                    WHERE rs.restaurant_id = happy_hour_schedules.restaurant_id
                      AND rs.user_id = (select auth.uid())
                      AND rs.is_active = true
                )
            );
    END IF;
END
$$;

-- Managers can create/update happy hour schedules
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'happy_hour_schedules'
          AND policyname = 'happy_hour_schedules_manager_write'
    ) THEN
        CREATE POLICY happy_hour_schedules_manager_write
            ON public.happy_hour_schedules
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.restaurant_staff rs
                    WHERE rs.restaurant_id = happy_hour_schedules.restaurant_id
                      AND rs.user_id = (select auth.uid())
                      AND rs.is_active = true
                      AND rs.role IN ('owner', 'admin', 'manager')
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.restaurant_staff rs
                    WHERE rs.restaurant_id = happy_hour_schedules.restaurant_id
                      AND rs.user_id = (select auth.uid())
                      AND rs.is_active = true
                      AND rs.role IN ('owner', 'admin', 'manager')
                )
            );
    END IF;
END
$$;

-- Add happy_hour_schedule_id to orders for audit trail
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS happy_hour_schedule_id UUID REFERENCES public.happy_hour_schedules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_happy_hour_schedule
    ON public.orders (happy_hour_schedule_id)
    WHERE happy_hour_schedule_id IS NOT NULL;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_happy_hour_schedules_set_updated_at ON public.happy_hour_schedules;
CREATE TRIGGER trg_happy_hour_schedules_set_updated_at
    BEFORE UPDATE ON public.happy_hour_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMIT;
