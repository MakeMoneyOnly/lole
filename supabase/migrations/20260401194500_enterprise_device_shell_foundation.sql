-- ============================================================================
-- Enterprise Device Shell Foundation
-- Date: 2026-04-01
-- Purpose: Extends hardware_devices with device management, pairing, printer config,
--          MDM (Esper), and fiscal mode columns. Creates device_management_actions and
--          fiscal_submission_queue tables with RLS policies, indexes, and triggers.
-- Impact: public.hardware_devices (new columns + constraints),
--         public.device_management_actions (new table),
--         public.fiscal_submission_queue (new table)
-- Rollback: DROP TABLE IF EXISTS public.fiscal_submission_queue;
--           DROP TABLE IF EXISTS public.device_management_actions;
--           ALTER TABLE public.hardware_devices DROP COLUMN IF EXISTS device_profile,
--             DROP COLUMN IF EXISTS location_id, DROP COLUMN IF EXISTS pairing_state,
--             DROP COLUMN IF EXISTS pairing_code_expires_at, DROP COLUMN IF EXISTS pairing_completed_at,
--             DROP COLUMN IF EXISTS hardware_fingerprint, DROP COLUMN IF EXISTS printer_connection_type,
--             DROP COLUMN IF EXISTS printer_device_id, DROP COLUMN IF EXISTS printer_device_name,
--             DROP COLUMN IF EXISTS printer_mac_address, DROP COLUMN IF EXISTS printer_preferences,
--             DROP COLUMN IF EXISTS management_provider, DROP COLUMN IF EXISTS management_device_id,
--             DROP COLUMN IF EXISTS management_status, DROP COLUMN IF EXISTS app_channel,
--             DROP COLUMN IF EXISTS app_version, DROP COLUMN IF EXISTS last_boot_at,
--             DROP COLUMN IF EXISTS fiscal_mode;
-- ============================================================================

BEGIN;

ALTER TABLE public.hardware_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_devices FORCE ROW LEVEL SECURITY;

ALTER TABLE public.hardware_devices
    ADD COLUMN IF NOT EXISTS device_profile text,
    ADD COLUMN IF NOT EXISTS location_id uuid,
    ADD COLUMN IF NOT EXISTS pairing_state text DEFAULT 'ready',
    ADD COLUMN IF NOT EXISTS pairing_code_expires_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS pairing_completed_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS hardware_fingerprint text,
    ADD COLUMN IF NOT EXISTS printer_connection_type text,
    ADD COLUMN IF NOT EXISTS printer_device_id text,
    ADD COLUMN IF NOT EXISTS printer_device_name text,
    ADD COLUMN IF NOT EXISTS printer_mac_address text,
    ADD COLUMN IF NOT EXISTS printer_preferences jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS management_provider text DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS management_device_id text,
    ADD COLUMN IF NOT EXISTS management_status text DEFAULT 'unmanaged',
    ADD COLUMN IF NOT EXISTS app_channel text DEFAULT 'stable',
    ADD COLUMN IF NOT EXISTS app_version text,
    ADD COLUMN IF NOT EXISTS last_boot_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS fiscal_mode text DEFAULT 'stub';

UPDATE public.hardware_devices
SET device_profile = CASE device_type
        WHEN 'terminal' THEN 'cashier'
        WHEN 'kds' THEN 'kds'
        WHEN 'kiosk' THEN 'kiosk'
        ELSE 'waiter'
    END
WHERE device_profile IS NULL;

UPDATE public.hardware_devices
SET pairing_state = CASE
        WHEN paired_at IS NOT NULL OR device_token IS NOT NULL THEN 'paired'
        ELSE 'ready'
    END
WHERE pairing_state IS NULL;

ALTER TABLE public.hardware_devices
    ALTER COLUMN device_profile SET DEFAULT 'waiter';

ALTER TABLE public.hardware_devices
    ALTER COLUMN pairing_state SET DEFAULT 'ready';

ALTER TABLE public.hardware_devices
    ALTER COLUMN management_provider SET DEFAULT 'none';

ALTER TABLE public.hardware_devices
    ALTER COLUMN management_status SET DEFAULT 'unmanaged';

ALTER TABLE public.hardware_devices
    ALTER COLUMN app_channel SET DEFAULT 'stable';

ALTER TABLE public.hardware_devices
    ALTER COLUMN fiscal_mode SET DEFAULT 'stub';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'hardware_devices_device_profile_check'
    ) THEN
        ALTER TABLE public.hardware_devices
            ADD CONSTRAINT hardware_devices_device_profile_check
            CHECK (device_profile IN ('cashier', 'waiter', 'kds', 'kiosk'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'hardware_devices_pairing_state_check'
    ) THEN
        ALTER TABLE public.hardware_devices
            ADD CONSTRAINT hardware_devices_pairing_state_check
            CHECK (pairing_state IN ('ready', 'paired', 'revoked', 'expired'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'hardware_devices_management_provider_check'
    ) THEN
        ALTER TABLE public.hardware_devices
            ADD CONSTRAINT hardware_devices_management_provider_check
            CHECK (management_provider IN ('none', 'esper'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'hardware_devices_management_status_check'
    ) THEN
        ALTER TABLE public.hardware_devices
            ADD CONSTRAINT hardware_devices_management_status_check
            CHECK (management_status IN ('unmanaged', 'managed', 'pending', 'error'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'hardware_devices_fiscal_mode_check'
    ) THEN
        ALTER TABLE public.hardware_devices
            ADD CONSTRAINT hardware_devices_fiscal_mode_check
            CHECK (fiscal_mode IN ('stub', 'mor_live', 'mor_pending'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hardware_devices_device_profile
    ON public.hardware_devices (restaurant_id, device_profile);

CREATE INDEX IF NOT EXISTS idx_hardware_devices_pairing_state
    ON public.hardware_devices (restaurant_id, pairing_state);

CREATE INDEX IF NOT EXISTS idx_hardware_devices_pairing_code_expires
    ON public.hardware_devices (pairing_code_expires_at)
    WHERE pairing_code_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hardware_devices_hardware_fingerprint
    ON public.hardware_devices (hardware_fingerprint)
    WHERE hardware_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hardware_devices_management_device_id
    ON public.hardware_devices (management_device_id)
    WHERE management_device_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.device_management_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    hardware_device_id uuid NOT NULL REFERENCES public.hardware_devices(id) ON DELETE CASCADE,
    requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    provider text NOT NULL DEFAULT 'esper' CHECK (provider IN ('esper')),
    action_type text NOT NULL CHECK (action_type IN ('reboot', 'wipe', 'lock', 'unlock', 'push_update')),
    status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'dispatched', 'succeeded', 'failed')),
    provider_job_id text,
    request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    requested_at timestamp with time zone NOT NULL DEFAULT now(),
    completed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.device_management_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_management_actions FORCE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_device_management_actions_restaurant_status
    ON public.device_management_actions (restaurant_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_management_actions_device_requested_at
    ON public.device_management_actions (hardware_device_id, requested_at DESC);

DROP POLICY IF EXISTS "Managers can view device management actions" ON public.device_management_actions;
CREATE POLICY "Managers can view device management actions"
    ON public.device_management_actions FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id
            FROM public.restaurant_staff
            WHERE user_id = (SELECT auth.uid())
                AND role IN ('owner', 'admin', 'manager')
                AND is_active = true
        )
    );

DROP POLICY IF EXISTS "Managers can insert device management actions" ON public.device_management_actions;
CREATE POLICY "Managers can insert device management actions"
    ON public.device_management_actions FOR INSERT
    WITH CHECK (
        restaurant_id IN (
            SELECT restaurant_id
            FROM public.restaurant_staff
            WHERE user_id = (SELECT auth.uid())
                AND role IN ('owner', 'admin', 'manager')
                AND is_active = true
        )
    );

DROP POLICY IF EXISTS "Managers can update device management actions" ON public.device_management_actions;
CREATE POLICY "Managers can update device management actions"
    ON public.device_management_actions FOR UPDATE
    USING (
        restaurant_id IN (
            SELECT restaurant_id
            FROM public.restaurant_staff
            WHERE user_id = (SELECT auth.uid())
                AND role IN ('owner', 'admin', 'manager')
                AND is_active = true
        )
    )
    WITH CHECK (
        restaurant_id IN (
            SELECT restaurant_id
            FROM public.restaurant_staff
            WHERE user_id = (SELECT auth.uid())
                AND role IN ('owner', 'admin', 'manager')
                AND is_active = true
        )
    );

CREATE TABLE IF NOT EXISTS public.fiscal_submission_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    hardware_device_id uuid REFERENCES public.hardware_devices(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed')),
    connectivity_mode text NOT NULL DEFAULT 'online' CHECK (connectivity_mode IN ('online', 'offline')),
    warning_text text,
    fiscal_transaction_number text,
    qr_payload text,
    digital_signature text,
    request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    attempts integer NOT NULL DEFAULT 0,
    last_error text,
    submitted_at timestamp with time zone,
    synced_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fiscal_submission_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_submission_queue FORCE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_fiscal_submission_queue_restaurant_status
    ON public.fiscal_submission_queue (restaurant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiscal_submission_queue_order
    ON public.fiscal_submission_queue (order_id)
    WHERE order_id IS NOT NULL;

DROP POLICY IF EXISTS "Managers can view fiscal submission queue" ON public.fiscal_submission_queue;
CREATE POLICY "Managers can view fiscal submission queue"
    ON public.fiscal_submission_queue FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id
            FROM public.restaurant_staff
            WHERE user_id = (SELECT auth.uid())
                AND role IN ('owner', 'admin', 'manager')
                AND is_active = true
        )
    );

DROP POLICY IF EXISTS "Managers can insert fiscal submission queue" ON public.fiscal_submission_queue;
CREATE POLICY "Managers can insert fiscal submission queue"
    ON public.fiscal_submission_queue FOR INSERT
    WITH CHECK (
        restaurant_id IN (
            SELECT restaurant_id
            FROM public.restaurant_staff
            WHERE user_id = (SELECT auth.uid())
                AND role IN ('owner', 'admin', 'manager')
                AND is_active = true
        )
    );

DROP POLICY IF EXISTS "Managers can update fiscal submission queue" ON public.fiscal_submission_queue;
CREATE POLICY "Managers can update fiscal submission queue"
    ON public.fiscal_submission_queue FOR UPDATE
    USING (
        restaurant_id IN (
            SELECT restaurant_id
            FROM public.restaurant_staff
            WHERE user_id = (SELECT auth.uid())
                AND role IN ('owner', 'admin', 'manager')
                AND is_active = true
        )
    )
    WITH CHECK (
        restaurant_id IN (
            SELECT restaurant_id
            FROM public.restaurant_staff
            WHERE user_id = (SELECT auth.uid())
                AND role IN ('owner', 'admin', 'manager')
                AND is_active = true
        )
    );

DROP TRIGGER IF EXISTS update_device_management_actions_updated_at ON public.device_management_actions;
CREATE TRIGGER update_device_management_actions_updated_at
    BEFORE UPDATE ON public.device_management_actions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_fiscal_submission_queue_updated_at ON public.fiscal_submission_queue;
CREATE TRIGGER update_fiscal_submission_queue_updated_at
    BEFORE UPDATE ON public.fiscal_submission_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.device_management_actions IS 'Remote management actions for managed field devices such as Esper reboot or wipe requests.';
COMMENT ON TABLE public.fiscal_submission_queue IS 'Tracks fiscal submission state and offline replay metadata for MoR compliance.';

COMMIT;
