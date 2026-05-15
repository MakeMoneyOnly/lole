-- Devices Table for Hardware Provisioning
CREATE TABLE IF NOT EXISTS public.hardware_devices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name text NOT NULL,
    device_type text NOT NULL CHECK (device_type IN ('pos', 'kds', 'kiosk', 'digital_menu')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    pairing_code text UNIQUE, -- 6 digit short code for quick initial pairing
    device_token text UNIQUE, -- Long lived token for the device
    paired_at timestamp with time zone,
    last_active_at timestamp with time zone,
    assigned_zones text[] DEFAULT '{}', -- E.g. ['patio', 'bar', 'kitchen_hot']
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hardware_devices ENABLE ROW LEVEL SECURITY;

-- Device RLS Policies
CREATE POLICY "Users can view devices in their restaurant"
    ON public.hardware_devices FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM public.restaurant_staff
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Managers and owners can insert devices"
    ON public.hardware_devices FOR INSERT
    WITH CHECK (
        restaurant_id IN (
            SELECT restaurant_id FROM public.restaurant_staff
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = true
        )
    );

CREATE POLICY "Managers and owners can update devices"
    ON public.hardware_devices FOR UPDATE
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM public.restaurant_staff
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = true
        )
    );

CREATE POLICY "Managers and owners can delete devices"
    ON public.hardware_devices FOR DELETE
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM public.restaurant_staff
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager') AND is_active = true
        )
    );

-- Add Staff PIN and Zones to restaurant_staff
-- PIN is stored as text. In a real production app, it might be cryptographically hashed 
-- depending on security requirements, but for POS ease-of-use (4 digits), simple text/hash works. 
-- For MVP, we use text, and handle verification application side.
ALTER TABLE public.restaurant_staff
ADD COLUMN IF NOT EXISTS pin_code text,
ADD COLUMN IF NOT EXISTS assigned_zones text[] DEFAULT '{}';

-- Ensure PIN is unique per restaurant (a 4-digit PIN shouldn't be shared within the same staff team)
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_staff_pin_unique
ON public.restaurant_staff (restaurant_id, pin_code)
WHERE pin_code IS NOT NULL AND is_active = true;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_hardware_devices_modtime()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_hardware_devices_modtime
    BEFORE UPDATE ON public.hardware_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_hardware_devices_modtime();

-- Add 'runner' to allowed roles if not already handled by application layer check constraints
-- Note: Supabase UI and previous migrations might use text without check constraints, 
-- but if there is a DOMAIN or CHECK constraint on 'role', it needs updating.
-- Based on the schema inspection, 'role' is just text.

-- Adjust staff_invites to support PIN workflow if necessary
ALTER TABLE public.staff_invites 
ADD COLUMN IF NOT EXISTS pin_code text;

-- Notify clients when devices change
ALTER PUBLICATION supabase_realtime ADD TABLE hardware_devices;
