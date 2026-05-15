-- Device Sync Status Table
-- CRIT-05: Track device sync status for stale device detection
-- 
-- This table stores the last sync time for POS, KDS, and printer devices
-- to enable detection of devices that haven't synced within expected thresholds.

BEGIN;

-- ============================================================================
-- STEP 1: Create device_sync_status table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.device_sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT NOT NULL CHECK (device_type IN ('pos', 'kds', 'printer')),
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT NOT NULL DEFAULT 'unknown' CHECK (sync_status IN ('online', 'offline', 'stale', 'unknown')),
    sync_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one device entry per restaurant
    UNIQUE(restaurant_id, device_id)
);

-- ============================================================================
-- STEP 2: Create indexes for common queries
-- ============================================================================

-- Index for finding stale devices by sync status and time
CREATE INDEX IF NOT EXISTS idx_device_sync_status_status_time 
    ON public.device_sync_status(sync_status, last_sync_at)
    WHERE sync_status IN ('offline', 'stale');

-- Index for restaurant-scoped queries
CREATE INDEX IF NOT EXISTS idx_device_sync_status_restaurant 
    ON public.device_sync_status(restaurant_id, sync_status);

-- Index for device type queries
CREATE INDEX IF NOT EXISTS idx_device_sync_status_type 
    ON public.device_sync_status(device_type, sync_status);

-- ============================================================================
-- STEP 3: Enable RLS
-- ============================================================================

ALTER TABLE public.device_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sync_status FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: RLS Policies
-- ============================================================================

-- Tenant staff can view device sync status
CREATE POLICY "Tenant staff can view device sync status"
    ON public.device_sync_status
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
            AND rs.restaurant_id = device_sync_status.restaurant_id
            AND COALESCE(rs.is_active, true) = true
        )
    );

-- Service role can manage all device sync status (for cron jobs)
CREATE POLICY "Service role can manage device sync status"
    ON public.device_sync_status
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Devices can update their own sync status (using service role or signed context)
-- Note: In production, device updates should go through an authenticated endpoint
-- that uses service role to update this table

-- ============================================================================
-- STEP 5: Trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_device_sync_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_device_sync_status_modtime ON public.device_sync_status;
CREATE TRIGGER update_device_sync_status_modtime 
    BEFORE UPDATE ON public.device_sync_status 
    FOR EACH ROW EXECUTE PROCEDURE update_device_sync_status_updated_at();

-- ============================================================================
-- STEP 6: Function to mark device offline after threshold
-- ============================================================================

CREATE OR REPLACE FUNCTION mark_stale_devices_offline()
RETURNS void AS $$
DECLARE
    stale_threshold INTERVAL := INTERVAL '30 minutes';
BEGIN
    -- Mark devices as stale if they haven't synced in 30 minutes
    UPDATE public.device_sync_status
    SET sync_status = 'stale'
    WHERE sync_status = 'online'
    AND last_sync_at < NOW() - stale_threshold;
    
    -- Mark devices as offline if they haven't synced in 60 minutes
    UPDATE public.device_sync_status
    SET sync_status = 'offline'
    WHERE sync_status = 'stale'
    AND last_sync_at < NOW() - INTERVAL '60 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 7: Comments for documentation
-- ============================================================================

COMMENT ON TABLE public.device_sync_status IS 'Tracks sync status of POS, KDS, and printer devices for offline detection';
COMMENT ON COLUMN public.device_sync_status.device_id IS 'Unique device identifier within the restaurant';
COMMENT ON COLUMN public.device_sync_status.device_type IS 'Type of device: pos, kds, or printer';
COMMENT ON COLUMN public.device_sync_status.last_sync_at IS 'Timestamp of last successful sync';
COMMENT ON COLUMN public.device_sync_status.sync_status IS 'Current sync status: online, offline, stale, or unknown';
COMMENT ON COLUMN public.device_sync_status.sync_version IS 'Version of sync protocol or app version';

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================
-- Run these queries to verify the migration:
-- 
-- SELECT * FROM public.device_sync_status LIMIT 5;
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'device_sync_status';
-- SELECT * FROM pg_policies WHERE tablename = 'device_sync_status';