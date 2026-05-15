-- P2 Connected Prep Stations
-- Purpose:
-- 1) Allow menu items to fan out to multiple prep stations
-- 2) Duplicate KDS rows per order_item/station
-- 3) Keep KDS rows in sync when order_items are created/updated

BEGIN;

ALTER TABLE public.menu_items
    ADD COLUMN IF NOT EXISTS connected_stations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE public.menu_items
SET connected_stations = COALESCE(
    (
        SELECT ARRAY_AGG(DISTINCT normalized_station)
        FROM (
            SELECT LOWER(BTRIM(raw_station)) AS normalized_station
            FROM UNNEST(COALESCE(public.menu_items.connected_stations, ARRAY[]::TEXT[])) AS raw_station
        ) normalized
        WHERE normalized_station IN ('kitchen', 'bar', 'dessert', 'coffee')
    ),
    ARRAY[]::TEXT[]
);

ALTER TABLE public.menu_items
    DROP CONSTRAINT IF EXISTS menu_items_connected_stations_valid;

ALTER TABLE public.menu_items
    ADD CONSTRAINT menu_items_connected_stations_valid
    CHECK (connected_stations <@ ARRAY['kitchen', 'bar', 'dessert', 'coffee']::TEXT[]);

-- Old uniqueness (restaurant_id, order_item_id) blocks multi-station rows.
DROP INDEX IF EXISTS public.idx_kds_order_items_restaurant_order_item;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kds_order_items_restaurant_order_item_station
    ON public.kds_order_items(restaurant_id, order_item_id, station);

-- Backfill: ensure existing order_items are expanded into all connected stations.
WITH expanded AS (
    SELECT
        o.restaurant_id,
        oi.order_id,
        oi.id AS order_item_id,
        target.station,
        CASE
            WHEN oi.status = 'ready' THEN 'ready'
            WHEN oi.status = 'cooking' THEN 'in_progress'
            ELSE 'queued'
        END AS status,
        oi.name,
        COALESCE(oi.quantity, 1) AS quantity,
        oi.notes,
        COALESCE(oi.modifiers, '[]'::jsonb) AS modifiers,
        COALESCE(oi.created_at, NOW()) AS created_at
    FROM public.order_items oi
    JOIN public.orders o
        ON o.id = oi.order_id
    LEFT JOIN public.menu_items mi
        ON mi.id = oi.item_id
    CROSS JOIN LATERAL (
        SELECT UNNEST(
            CASE
                WHEN COALESCE(ARRAY_LENGTH(stations.stations, 1), 0) = 0
                    THEN ARRAY['kitchen']::TEXT[]
                ELSE stations.stations
            END
        ) AS station
        FROM (
            SELECT ARRAY(
                SELECT DISTINCT normalized_station
                FROM (
                    SELECT LOWER(BTRIM(raw_station)) AS normalized_station
                    FROM UNNEST(
                        ARRAY_APPEND(
                            COALESCE(mi.connected_stations, ARRAY[]::TEXT[]),
                            COALESCE(NULLIF(oi.station, ''), 'kitchen')
                        )
                    ) AS raw_station
                ) normalized
                WHERE normalized_station IN ('kitchen', 'bar', 'dessert', 'coffee')
            ) AS stations
        ) stations
    ) target
)
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
    expanded.restaurant_id,
    expanded.order_id,
    expanded.order_item_id,
    expanded.station,
    expanded.status,
    expanded.name,
    expanded.quantity,
    expanded.notes,
    expanded.modifiers,
    expanded.created_at,
    NOW()
FROM expanded
ON CONFLICT (restaurant_id, order_item_id, station)
DO UPDATE SET
    name = EXCLUDED.name,
    quantity = EXCLUDED.quantity,
    notes = EXCLUDED.notes,
    modifiers = EXCLUDED.modifiers,
    updated_at = NOW();

CREATE OR REPLACE FUNCTION public.sync_kds_item_from_order_item()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_restaurant_id UUID;
    v_connected_stations TEXT[] := ARRAY[]::TEXT[];
    v_target_stations TEXT[] := ARRAY[]::TEXT[];
    v_station TEXT;
BEGIN
    SELECT restaurant_id
    INTO v_restaurant_id
    FROM public.orders
    WHERE id = NEW.order_id;

    IF v_restaurant_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(mi.connected_stations, ARRAY[]::TEXT[])
    INTO v_connected_stations
    FROM public.menu_items mi
    WHERE mi.id = NEW.item_id;

    v_target_stations := ARRAY(
        SELECT DISTINCT normalized_station
        FROM (
            SELECT LOWER(BTRIM(raw_station)) AS normalized_station
            FROM UNNEST(
                ARRAY_APPEND(
                    COALESCE(v_connected_stations, ARRAY[]::TEXT[]),
                    COALESCE(NULLIF(NEW.station, ''), 'kitchen')
                )
            ) AS raw_station
        ) normalized
        WHERE normalized_station IN ('kitchen', 'bar', 'dessert', 'coffee')
    );

    IF COALESCE(ARRAY_LENGTH(v_target_stations, 1), 0) = 0 THEN
        v_target_stations := ARRAY['kitchen']::TEXT[];
    END IF;

    FOREACH v_station IN ARRAY v_target_stations
    LOOP
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
            v_station,
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
        ON CONFLICT (restaurant_id, order_item_id, station) DO UPDATE SET
            name = EXCLUDED.name,
            quantity = EXCLUDED.quantity,
            notes = EXCLUDED.notes,
            modifiers = EXCLUDED.modifiers,
            updated_at = NOW();
    END LOOP;

    -- Remove station rows no longer targeted by routing.
    DELETE FROM public.kds_order_items
    WHERE restaurant_id = v_restaurant_id
      AND order_item_id = NEW.id
      AND station <> ALL(v_target_stations);

    RETURN NEW;
END;
$$;

COMMIT;
