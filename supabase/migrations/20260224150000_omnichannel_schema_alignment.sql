-- Omnichannel Schema Alignment
-- Date: 2026-02-24
-- Purpose: Align database schema with omnichannel typescript implementation

BEGIN;

-- 1. Align column names for acknowledged_at
ALTER TABLE public.external_orders RENAME COLUMN acked_at TO acknowledged_at;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

-- 2. Add api_key column to delivery_partners and create the view for webhook validation
ALTER TABLE public.delivery_partners ADD COLUMN IF NOT EXISTS api_key TEXT;
CREATE OR REPLACE VIEW public.delivery_partner_integrations AS 
    SELECT id, restaurant_id, provider, status, api_key, created_at, updated_at 
    FROM public.delivery_partners;

-- 3. Relax normalized_status constraints on external_orders to match our adapters
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
            AND t.relname = 'external_orders'
            AND c.contype = 'c'
            AND pg_get_constraintdef(c.oid) ILIKE '%normalized_status%'
    LOOP
        EXECUTE format('ALTER TABLE public.external_orders DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.external_orders
    ADD CONSTRAINT external_orders_normalized_status_check
    CHECK (normalized_status IN (
        'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled', 'failed',
        'new', 'acknowledged', 'out_for_delivery', 'completed'
    ));

-- 4. Relax status constraints on orders to ensure direct delivery statuses are supported
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
            AND pg_get_constraintdef(c.oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_check
    CHECK (status IN (
        'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled',
        'paid', 'completed', 'served'
    ));

COMMIT;
