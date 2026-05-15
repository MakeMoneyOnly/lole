-- P1 KDS Hardening: item-level production state
-- Date: 2026-02-28
-- Purpose: support item-level KDS lifecycle and immutable item event timeline

BEGIN;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.kds_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
    station TEXT NOT NULL DEFAULT 'kitchen' CHECK (station IN ('kitchen', 'bar', 'dessert', 'coffee')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'on_hold', 'ready', 'recalled')),
    name TEXT NOT NULL,
    quantity NUMERIC(10, 3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    notes TEXT,
    modifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ,
    held_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    recalled_at TIMESTAMPTZ,
    last_action_by UUID,
    last_action_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kds_order_items_restaurant_order_item
    ON public.kds_order_items(restaurant_id, order_item_id);

CREATE INDEX IF NOT EXISTS idx_kds_order_items_restaurant_station_status
    ON public.kds_order_items(restaurant_id, station, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kds_order_items_order
    ON public.kds_order_items(order_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_kds_order_items_set_updated_at ON public.kds_order_items;
CREATE TRIGGER trg_kds_order_items_set_updated_at
    BEFORE UPDATE ON public.kds_order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.kds_item_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    kds_order_item_id UUID NOT NULL REFERENCES public.kds_order_items(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('start', 'hold', 'ready', 'recall')),
    from_status TEXT,
    to_status TEXT,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kds_item_events_item_created
    ON public.kds_item_events(kds_order_item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kds_item_events_restaurant_created
    ON public.kds_item_events(restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_kds_item_events_order_created
    ON public.kds_item_events(order_id, created_at DESC);

INSERT INTO public.kds_order_items (
    restaurant_id,
    order_id,
    order_item_id,
    station,
    status,
    name,
    quantity,
    notes,
    modifiers,
    created_at,
    updated_at
)
SELECT
    o.restaurant_id,
    oi.order_id,
    oi.id,
    COALESCE(NULLIF(oi.station, ''), 'kitchen') AS station,
    CASE
        WHEN oi.status = 'ready' THEN 'ready'
        WHEN oi.status = 'cooking' THEN 'in_progress'
        ELSE 'queued'
    END AS status,
    oi.name,
    COALESCE(oi.quantity, 1),
    oi.notes,
    COALESCE(oi.modifiers, '[]'::jsonb),
    COALESCE(oi.created_at, NOW()),
    NOW()
FROM public.order_items oi
JOIN public.orders o
    ON o.id = oi.order_id
ON CONFLICT (restaurant_id, order_item_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_kds_item_from_order_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_restaurant_id UUID;
BEGIN
    SELECT restaurant_id
    INTO v_restaurant_id
    FROM public.orders
    WHERE id = NEW.order_id;

    IF v_restaurant_id IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.kds_order_items (
        restaurant_id,
        order_id,
        order_item_id,
        station,
        status,
        name,
        quantity,
        notes,
        modifiers,
        created_at,
        updated_at
    )
    VALUES (
        v_restaurant_id,
        NEW.order_id,
        NEW.id,
        COALESCE(NULLIF(NEW.station, ''), 'kitchen'),
        CASE
            WHEN NEW.status = 'ready' THEN 'ready'
            WHEN NEW.status = 'cooking' THEN 'in_progress'
            ELSE 'queued'
        END,
        NEW.name,
        COALESCE(NEW.quantity, 1),
        NEW.notes,
        COALESCE(NEW.modifiers, '[]'::jsonb),
        COALESCE(NEW.created_at, NOW()),
        NOW()
    )
    ON CONFLICT (restaurant_id, order_item_id) DO UPDATE SET
        station = EXCLUDED.station,
        name = EXCLUDED.name,
        quantity = EXCLUDED.quantity,
        notes = EXCLUDED.notes,
        modifiers = EXCLUDED.modifiers,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_sync_kds_item ON public.order_items;
CREATE TRIGGER trg_order_items_sync_kds_item
    AFTER INSERT OR UPDATE ON public.order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_kds_item_from_order_item();

ALTER TABLE public.kds_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kds_item_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff can view kds_order_items" ON public.kds_order_items;
CREATE POLICY "Tenant staff can view kds_order_items"
    ON public.kds_order_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = kds_order_items.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1
            FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR kds_order_items.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
    );

DROP POLICY IF EXISTS "Tenant staff can manage kds_order_items" ON public.kds_order_items;
CREATE POLICY "Tenant staff can manage kds_order_items"
    ON public.kds_order_items
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = kds_order_items.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1
            FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR kds_order_items.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = kds_order_items.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1
            FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR kds_order_items.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
    );

DROP POLICY IF EXISTS "Tenant staff can view kds_item_events" ON public.kds_item_events;
CREATE POLICY "Tenant staff can view kds_item_events"
    ON public.kds_item_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = kds_item_events.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1
            FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR kds_item_events.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
    );

DROP POLICY IF EXISTS "Tenant staff can create kds_item_events" ON public.kds_item_events;
CREATE POLICY "Tenant staff can create kds_item_events"
    ON public.kds_item_events
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = kds_item_events.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1
            FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR kds_item_events.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
    );

COMMIT;
