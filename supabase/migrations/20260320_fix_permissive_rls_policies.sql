-- P1-7: Fix Remaining RLS Policies with USING (true)
-- Date: 2026-03-20
-- Purpose: Remove permissive RLS policies that use USING (true) or WITH CHECK (true)
--          and replace with proper tenant-scoped policies
--
-- SECURITY FIX: These policies allowed unrestricted access which is a critical vulnerability
--
-- Note: service_role bypasses RLS by default in Supabase, so we remove these redundant
-- and overly permissive policies. For notification_metrics, we add proper INSERT/UPDATE
-- policies since it doesn't use FORCE RLS.

BEGIN;

-- =========================================================
-- FIX 1: device_tokens table
-- Drop permissive service_role policy
-- =========================================================

DROP POLICY IF EXISTS "Service role can manage device tokens" 
    ON public.device_tokens;

-- Add proper staff policy for INSERT/UPDATE/DELETE on device_tokens
-- (SELECT policy already exists and is properly scoped)
CREATE POLICY "Staff can manage restaurant device tokens"
    ON public.device_tokens
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = device_tokens.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

CREATE POLICY "Staff can update restaurant device tokens"
    ON public.device_tokens
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = device_tokens.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = device_tokens.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

CREATE POLICY "Staff can delete restaurant device tokens"
    ON public.device_tokens
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = device_tokens.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- =========================================================
-- FIX 2: guest_push_preferences table
-- Drop permissive service_role policy
-- =========================================================

DROP POLICY IF EXISTS "Service role can manage push preferences" 
    ON public.guest_push_preferences;

-- Add proper staff policy for INSERT/UPDATE/DELETE on guest_push_preferences
-- (SELECT policy already exists and is properly scoped)
CREATE POLICY "Staff can manage restaurant push preferences"
    ON public.guest_push_preferences
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = guest_push_preferences.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

CREATE POLICY "Staff can update restaurant push preferences"
    ON public.guest_push_preferences
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = guest_push_preferences.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = guest_push_preferences.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

CREATE POLICY "Staff can delete restaurant push preferences"
    ON public.guest_push_preferences
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = guest_push_preferences.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- =========================================================
-- FIX 3: notification_metrics table
-- Drop permissive service_role policies and add proper tenant-scoped ones
-- =========================================================

DROP POLICY IF EXISTS "Service role can insert notification metrics" 
    ON public.notification_metrics;

DROP POLICY IF EXISTS "Service role can update notification metrics" 
    ON public.notification_metrics;

-- Add proper staff policy for INSERT on notification_metrics
-- (SELECT policy already exists and is properly scoped)
CREATE POLICY "Staff can insert notification metrics"
    ON public.notification_metrics
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = notification_metrics.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- Add proper staff policy for UPDATE on notification_metrics
CREATE POLICY "Staff can update notification metrics"
    ON public.notification_metrics
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = notification_metrics.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = notification_metrics.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- Add proper staff policy for DELETE on notification_metrics
CREATE POLICY "Staff can delete notification metrics"
    ON public.notification_metrics
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = notification_metrics.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- =========================================================
-- FIX 4: device_sync_status table
-- Drop permissive service_role policy
-- =========================================================

DROP POLICY IF EXISTS "Service role can manage device sync status" 
    ON public.device_sync_status;

-- Add proper staff policy for INSERT/UPDATE/DELETE on device_sync_status
-- (SELECT policy already exists and is properly scoped)
CREATE POLICY "Staff can insert device sync status"
    ON public.device_sync_status
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = device_sync_status.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

CREATE POLICY "Staff can update device sync status"
    ON public.device_sync_status
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = device_sync_status.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = device_sync_status.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

CREATE POLICY "Staff can delete device sync status"
    ON public.device_sync_status
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = device_sync_status.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- =========================================================
-- Verification (optional - for debugging)
-- =========================================================

-- Verify policies have been updated:
-- SELECT policyname, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename IN ('device_tokens', 'guest_push_preferences', 'notification_metrics', 'device_sync_status')
-- ORDER BY tablename, policyname;

COMMIT;
