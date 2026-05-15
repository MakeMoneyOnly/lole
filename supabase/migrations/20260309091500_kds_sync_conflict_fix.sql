BEGIN;

-- The live database already uses the canonical order_items shape
-- (item_id/name/price/course). The issue was an outdated trigger function
-- still targeting the old single-station KDS conflict key.
--
-- This keeps order item writes compatible with the current multi-station
-- unique index on (restaurant_id, order_item_id, station).
CREATE OR REPLACE FUNCTION public.sync_kds_item_from_order_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
    v_restaurant_id uuid;
    v_station text;
    v_old_station text;
BEGIN
    SELECT restaurant_id INTO v_restaurant_id
    FROM public.orders
    WHERE id = NEW.order_id;

    IF v_restaurant_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_station := COALESCE(NULLIF(NEW.station, ''), 'kitchen');
    v_old_station := COALESCE(NULLIF(OLD.station, ''), 'kitchen');

    IF TG_OP = 'UPDATE' AND v_old_station IS DISTINCT FROM v_station THEN
        DELETE FROM public.kds_order_items
        WHERE restaurant_id = v_restaurant_id
          AND order_item_id = NEW.id
          AND station = v_old_station;
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
    ) VALUES (
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
    ) ON CONFLICT (restaurant_id, order_item_id, station) DO UPDATE SET
        order_id = EXCLUDED.order_id,
        status = EXCLUDED.status,
        name = EXCLUDED.name,
        quantity = EXCLUDED.quantity,
        notes = EXCLUDED.notes,
        modifiers = EXCLUDED.modifiers,
        updated_at = NOW();

    RETURN NEW;
END;
$function$;

COMMIT;
