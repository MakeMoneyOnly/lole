-- P0 Split Check Foundation
-- Date: 2026-03-01
-- Purpose: support item/even/custom check splitting and payment attribution per split

BEGIN;

CREATE TABLE IF NOT EXISTS public.order_check_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    split_index INTEGER NOT NULL CHECK (split_index >= 0),
    split_label TEXT,
    requested_amount NUMERIC(12, 2) CHECK (requested_amount IS NULL OR requested_amount >= 0),
    computed_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (computed_amount >= 0),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'void')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT order_check_splits_order_index_unique UNIQUE (order_id, split_index)
);

CREATE INDEX IF NOT EXISTS idx_order_check_splits_restaurant_order
    ON public.order_check_splits(restaurant_id, order_id, split_index);

DROP TRIGGER IF EXISTS trg_order_check_splits_set_updated_at ON public.order_check_splits;
CREATE TRIGGER trg_order_check_splits_set_updated_at
    BEFORE UPDATE ON public.order_check_splits
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.order_check_split_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    split_id UUID NOT NULL REFERENCES public.order_check_splits(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    quantity NUMERIC(10, 3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    line_amount NUMERIC(12, 2) NOT NULL CHECK (line_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT order_check_split_items_split_order_item_unique UNIQUE (split_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS idx_order_check_split_items_restaurant_order
    ON public.order_check_split_items(restaurant_id, order_id);

CREATE INDEX IF NOT EXISTS idx_order_check_split_items_split
    ON public.order_check_split_items(split_id);

ALTER TABLE public.order_check_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_check_split_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff can view order_check_splits" ON public.order_check_splits;
CREATE POLICY "Tenant staff can view order_check_splits"
    ON public.order_check_splits
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = order_check_splits.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR order_check_splits.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
    );

DROP POLICY IF EXISTS "Tenant staff can manage order_check_splits" ON public.order_check_splits;
CREATE POLICY "Tenant staff can manage order_check_splits"
    ON public.order_check_splits
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = order_check_splits.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR order_check_splits.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = order_check_splits.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR order_check_splits.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
    );

DROP POLICY IF EXISTS "Tenant staff can view order_check_split_items" ON public.order_check_split_items;
CREATE POLICY "Tenant staff can view order_check_split_items"
    ON public.order_check_split_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = order_check_split_items.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR order_check_split_items.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
    );

DROP POLICY IF EXISTS "Tenant staff can manage order_check_split_items" ON public.order_check_split_items;
CREATE POLICY "Tenant staff can manage order_check_split_items"
    ON public.order_check_split_items
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = order_check_split_items.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR order_check_split_items.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = order_check_split_items.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR order_check_split_items.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
    );

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS split_id UUID REFERENCES public.order_check_splits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_restaurant_split
    ON public.payments(restaurant_id, split_id)
    WHERE split_id IS NOT NULL;

COMMIT;
