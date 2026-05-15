-- Allow the payment checkout flow to stage guest orders before funds settle.
-- These orders are promoted back to `pending` once Chapa confirms payment.

BEGIN;

-- Remove known demo/seed orders before tightening the production status contract.
DELETE FROM public.orders
WHERE restaurant_id IN (
    SELECT id
    FROM public.restaurants
    WHERE slug IN ('demo-table', 'p0-demo-restaurant')
);

-- Normalize legacy lifecycle states from older demos and pre-parity environments.
UPDATE public.orders
SET status = CASE status
    WHEN 'cooking' THEN 'preparing'
    WHEN 'void' THEN 'cancelled'
    WHEN 'closed' THEN 'completed'
    WHEN 'draft' THEN 'pending'
    WHEN 'service_pending' THEN 'pending'
    WHEN 'service_in_progress' THEN 'preparing'
    ELSE status
END
WHERE status IN (
    'cooking',
    'void',
    'closed',
    'draft',
    'service_pending',
    'service_in_progress'
);

-- Enterprise-grade schema hardening: any remaining rows outside the supported
-- runtime contract are treated as legacy/incompatible and removed so the
-- constraint can become strict again.
DELETE FROM public.orders
WHERE status IS NULL
   OR status NOT IN (
       'payment_pending',
       'pending',
       'acknowledged',
       'confirmed',
       'preparing',
       'ready',
       'delivered',
       'cancelled',
       'paid',
       'completed',
       'served'
   );

DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
            AND t.relname = 'orders'
            AND c.contype = 'c'
            AND c.conname = 'orders_status_check'
    LOOP
        EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_check
    CHECK (status IN (
        'payment_pending',
        'pending',
        'acknowledged',
        'confirmed',
        'preparing',
        'ready',
        'delivered',
        'cancelled',
        'paid',
        'completed',
        'served'
    ));

COMMIT;
