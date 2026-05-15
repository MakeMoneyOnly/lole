-- Orders payment-settlement contract alignment
-- Ensures waiter close-table and Chapa verification flows share a stable schema.

BEGIN;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS chapa_verified BOOLEAN;

UPDATE public.orders
SET chapa_verified = FALSE
WHERE chapa_verified IS NULL;

ALTER TABLE public.orders
    ALTER COLUMN chapa_verified SET DEFAULT FALSE,
    ALTER COLUMN chapa_verified SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_chapa_verified_paid_at
    ON public.orders(chapa_verified, paid_at DESC);

COMMIT;
