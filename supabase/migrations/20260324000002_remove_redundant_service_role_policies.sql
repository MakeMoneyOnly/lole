-- ============================================================================
-- HIGH-020: Remove Redundant service_role RLS Policies
-- ============================================================================
-- Issue: Several tables have explicit service_role policies with USING (true)
-- which are redundant since service role bypasses RLS by default.
--
-- Background:
-- Supabase's service_role key bypasses RLS policies entirely. Having explicit
-- policies with USING (true) is unnecessary and creates confusion about the
-- actual security model.
--
-- Tables affected:
-- - device_tokens
-- - guest_push_preferences
-- - device_sync_status
--
-- Security note: Service role key should only be used server-side and never
-- exposed to clients. The service role bypasses ALL RLS policies.
-- ============================================================================

-- Remove redundant service_role policies from device_tokens
DROP POLICY IF EXISTS service_role_full_access_device_tokens ON device_tokens;

-- Remove redundant service_role policies from guest_push_preferences
DROP POLICY IF EXISTS service_role_full_access_guest_push_preferences ON guest_push_preferences;

-- Remove redundant service_role policies from device_sync_status
DROP POLICY IF EXISTS service_role_full_access_device_sync_status ON device_sync_status;

-- Add documentation comments
COMMENT ON TABLE device_tokens IS 'Device tokens for push notifications. Service role bypasses RLS - no explicit policy needed.';
COMMENT ON TABLE guest_push_preferences IS 'Guest push notification preferences. Service role bypasses RLS - no explicit policy needed.';
COMMENT ON TABLE device_sync_status IS 'Device synchronization status. Service role bypasses RLS - no explicit policy needed.';

-- ============================================================================
-- Rollback:
-- If you need to restore these policies (not recommended), run:
--
-- CREATE POLICY service_role_full_access_device_tokens ON device_tokens
--     FOR ALL TO service_role USING (true) WITH CHECK (true);
--
-- CREATE POLICY service_role_full_access_guest_push_preferences ON guest_push_preferences
--     FOR ALL TO service_role USING (true) WITH CHECK (true);
--
-- CREATE POLICY service_role_full_access_device_sync_status ON device_sync_status
--     FOR ALL TO service_role USING (true) WITH CHECK (true);
-- ============================================================================