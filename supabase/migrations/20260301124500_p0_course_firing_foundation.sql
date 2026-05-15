-- P0 Course Firing Foundation
-- Date: 2026-03-01
-- Purpose: add course metadata and order fire mode controls for KDS gating

BEGIN;

ALTER TABLE public.menu_items
    ADD COLUMN IF NOT EXISTS course TEXT NOT NULL DEFAULT 'main';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'menu_items_course_check'
    ) THEN
        ALTER TABLE public.menu_items
            ADD CONSTRAINT menu_items_course_check
            CHECK (course IN ('appetizer', 'main', 'dessert', 'beverage', 'side'));
    END IF;
END $$;

ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS course TEXT NOT NULL DEFAULT 'main';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'order_items_course_check'
    ) THEN
        ALTER TABLE public.order_items
            ADD CONSTRAINT order_items_course_check
            CHECK (course IN ('appetizer', 'main', 'dessert', 'beverage', 'side'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_order_course
    ON public.order_items(order_id, course);

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS fire_mode TEXT NOT NULL DEFAULT 'auto',
    ADD COLUMN IF NOT EXISTS current_course TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'orders_fire_mode_check'
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT orders_fire_mode_check
            CHECK (fire_mode IN ('auto', 'manual'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'orders_current_course_check'
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT orders_current_course_check
            CHECK (current_course IS NULL OR current_course IN ('appetizer', 'main', 'dessert', 'beverage', 'side'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_fire_mode_course
    ON public.orders(restaurant_id, fire_mode, current_course);

UPDATE public.order_items oi
SET course = COALESCE(mi.course, 'main')
FROM public.menu_items mi
WHERE oi.item_id = mi.id
    AND (oi.course IS NULL OR oi.course = 'main');

COMMIT;
