-- Ensure online-ordering columns exist on orders.
-- Fixes runtime insert failures like:
-- "Could not find the 'order_type' column of 'orders' in the schema cache"

BEGIN;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS order_type TEXT,
    ADD COLUMN IF NOT EXISTS delivery_address TEXT,
    ADD COLUMN IF NOT EXISTS chapa_tx_ref TEXT;

-- Backfill a sane default for existing rows and enforce supported values.
UPDATE public.orders
SET order_type = 'dine_in'
WHERE order_type IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'orders_order_type_check'
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT orders_order_type_check
            CHECK (order_type IN ('dine_in', 'online', 'delivery', 'pickup'));
    END IF;
END $$;

ALTER TABLE public.orders
    ALTER COLUMN order_type SET DEFAULT 'dine_in';

CREATE INDEX IF NOT EXISTS idx_orders_order_type_created_at
    ON public.orders(order_type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_chapa_tx_ref_unique
    ON public.orders(chapa_tx_ref)
    WHERE chapa_tx_ref IS NOT NULL;

COMMIT;
