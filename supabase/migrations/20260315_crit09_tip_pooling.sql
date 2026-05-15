-- Tip Pooling Foundation
-- Date: 2026-03-15
-- Purpose: support configurable tip distribution across staff roles

BEGIN;

-- Tip pool configuration
CREATE TABLE IF NOT EXISTS public.tip_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_am TEXT,
    description TEXT,
    description_am TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    -- Pool configuration
    pool_type TEXT NOT NULL DEFAULT 'percentage' CHECK (pool_type IN ('percentage', 'fixed_amount')),
    pool_value INTEGER NOT NULL DEFAULT 0 CHECK (pool_value >= 0),
    -- Whether tips are calculated from total bill or just from tips received
    calculated_from TEXT NOT NULL DEFAULT 'tips' CHECK (calculated_from IN ('tips', 'total')),
    -- Start/end dates for time-based pools
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    -- Shift-based or daily pool
    allocation_mode TEXT NOT NULL DEFAULT 'shift' CHECK (allocation_mode IN ('shift', 'daily', 'weekly')),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tip_pool_valid_period CHECK (
        valid_from IS NULL OR valid_until IS NULL OR valid_from < valid_until
    )
);

-- Tip pool shares (distribution percentages per role)
CREATE TABLE IF NOT EXISTS public.tip_pool_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    tip_pool_id UUID NOT NULL REFERENCES public.tip_pools(id) ON DELETE CASCADE,
    -- Role-based distribution
    role TEXT NOT NULL CHECK (role IN ('server', 'bartender', 'host', 'busser', 'kitchen', 'manager', 'cook', 'barista')),
    percentage INTEGER NOT NULL CHECK (percentage >= 0 AND percentage <= 10000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tip_pool_shares_unique_role UNIQUE (tip_pool_id, role)
);

-- Track tip allocations per shift/day
CREATE TABLE IF NOT EXISTS public.tip_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    tip_pool_id UUID NOT NULL REFERENCES public.tip_pools(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    -- Period this allocation covers
    period_date DATE NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    -- Financial totals
    total_tips_collected INTEGER NOT NULL DEFAULT 0,
    total_tips_pooled INTEGER NOT NULL DEFAULT 0,
    total_tips_distributed INTEGER NOT NULL DEFAULT 0,
    -- Distribution breakdown
    distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'calculated', 'distributed', 'cancelled')),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tip_allocation_unique_period UNIQUE (tip_pool_id, period_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tip_pools_restaurant_active
    ON public.tip_pools (restaurant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_tip_pool_shares_pool
    ON public.tip_pool_shares (tip_pool_id);

CREATE INDEX IF NOT EXISTS idx_tip_allocations_pool_date
    ON public.tip_allocations (tip_pool_id, period_date);

CREATE INDEX IF NOT EXISTS idx_tip_allocations_restaurant_date
    ON public.tip_allocations (restaurant_id, period_date);

-- Add tip_pool_id to payments for tracking
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS tip_pool_id UUID REFERENCES public.tip_pools(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tip_amount INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tip_allocation_id UUID REFERENCES public.tip_allocations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_tip_pool
    ON public.payments (tip_pool_id)
    WHERE tip_pool_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_tip_allocation
    FROM public.payments (tip_allocation_id)
    WHERE tip_allocation_id IS NOT NULL;

-- RLS for tip pools
ALTER TABLE public.tip_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tip_pools FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tip_pool_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tip_pool_shares FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tip_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tip_allocations FORCE ROW LEVEL SECURITY;

-- Staff can view tip pools and allocations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'tip_pools'
          AND policyname = 'tip_pools_staff_select'
    ) THEN
        CREATE POLICY tip_pools_staff_select
            ON public.tip_pools
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.restaurant_staff rs
                    WHERE rs.restaurant_id = tip_pools.restaurant_id
                      AND rs.user_id = (select auth.uid())
                      AND rs.is_active = true
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'tip_pool_shares'
          AND policyname = 'tip_pool_shares_staff_select'
    ) THEN
        CREATE POLICY tip_pool_shares_staff_select
            ON public.tip_pool_shares
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.restaurant_staff rs
                    WHERE rs.restaurant_id = tip_pool_shares.restaurant_id
                      AND rs.user_id = (select auth.uid())
                      AND rs.is_active = true
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'tip_allocations'
          AND policyname = 'tip_allocations_staff_select'
    ) THEN
        CREATE POLICY tip_allocations_staff_select
            ON public.tip_allocations
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.restaurant_staff rs
                    WHERE rs.restaurant_id = tip_allocations.restaurant_id
                      AND rs.user_id = (select auth.uid())
                      AND rs.is_active = true
                )
            );
    END IF;
END
$$;

-- Managers can manage tip pools
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'tip_pools'
          AND policyname = 'tip_pools_manager_write'
    ) THEN
        CREATE POLICY tip_pools_manager_write
            ON public.tip_pools
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.restaurant_staff rs
                    WHERE rs.restaurant_id = tip_pools.restaurant_id
                      AND rs.user_id = (select auth.uid())
                      AND rs.is_active = true
                      AND rs.role IN ('owner', 'admin', 'manager')
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.restaurant_staff rs
                    WHERE rs.restaurant_id = tip_pools.restaurant_id
                      AND rs.user_id = (select auth.uid())
                      AND rs.is_active = true
                      AND rs.role IN ('owner', 'admin', 'manager')
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'tip_pool_shares'
          AND policyname = 'tip_pool_shares_manager_write'
    ) THEN
        CREATE POLICY tip_pool_shares_manager_write
            ON public.tip_pool_shares
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.restaurant_staff rs
                    WHERE rs.restaurant_id = tip_pool_shares.restaurant_id
                      AND rs.user_id = (select auth.uid())
                      AND rs.is_active = true
                      AND rs.role IN ('owner', 'admin', 'manager')
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.restaurant_staff rs
                    WHERE rs.restaurant_id = tip_pool_shares.restaurant_id
                      AND rs.user_id = (select auth.uid())
                      AND rs.is_active = true
                      AND rs.role IN ('owner', 'admin', 'manager')
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'tip_allocations'
          AND policyname = 'tip_allocations_manager_write'
    ) THEN
        CREATE POLICY tip_allocations_manager_write
            ON public.tip_allocations
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.restaurant_staff rs
                    WHERE rs.restaurant_id = tip_allocations.restaurant_id
                      AND rs.user_id = (select auth.uid())
                      AND rs.is_active = true
                      AND rs.role IN ('owner', 'admin', 'manager')
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.restaurant_staff rs
                    WHERE rs.restaurant_id = tip_allocations.restaurant_id
                      AND rs.user_id = (select auth.uid())
                      AND rs.is_active = true
                      AND rs.role IN ('owner', 'admin', 'manager')
                )
            );
    END IF;
END
$$;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trg_tip_pools_set_updated_at ON public.tip_pools;
CREATE TRIGGER trg_tip_pools_set_updated_at
    BEFORE UPDATE ON public.tip_pools
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tip_pool_shares_set_updated_at ON public.tip_pool_shares;
CREATE TRIGGER trg_tip_pool_shares_set_updated_at
    BEFORE UPDATE ON public.tip_pool_shares
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tip_allocations_set_updated_at ON public.tip_allocations;
CREATE TRIGGER trg_tip_allocations_set_updated_at
    BEFORE UPDATE ON public.tip_allocations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMIT;
