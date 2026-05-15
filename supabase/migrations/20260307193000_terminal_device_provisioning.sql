-- Extend digital hardware provisioning so cashier terminals are first-class
-- managed devices alongside waiter POS and KDS tablets.

BEGIN;

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
            AND t.relname = 'hardware_devices'
            AND c.contype = 'c'
            AND pg_get_constraintdef(c.oid) ILIKE '%device_type%'
    LOOP
        EXECUTE format('ALTER TABLE public.hardware_devices DROP CONSTRAINT %I', constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.hardware_devices
    ADD CONSTRAINT hardware_devices_device_type_check
    CHECK (device_type IN ('pos', 'kds', 'kiosk', 'digital_menu', 'terminal'));

CREATE INDEX IF NOT EXISTS idx_hardware_devices_restaurant_last_active
    ON public.hardware_devices (restaurant_id, last_active_at DESC);

COMMIT;
