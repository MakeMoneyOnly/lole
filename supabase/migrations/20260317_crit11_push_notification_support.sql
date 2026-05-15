-- CRIT-11: Push Notification Support Tables
-- Date: 2026-03-17
-- Purpose: Create tables for push notification device tokens and guest preferences

BEGIN;

-- =========================================================
-- DEVICE TOKENS TABLE
-- Stores push notification tokens for guests and devices
-- =========================================================

CREATE TABLE IF NOT EXISTS public.device_tokens (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tenant context
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,

    -- Guest association (nullable for anonymous devices)
    guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,

    -- Device token (FCM token or Web Push subscription endpoint)
    token TEXT NOT NULL,

    -- Device type: 'android' | 'ios' | 'web'
    device_type TEXT NOT NULL
        CHECK (device_type IN ('android', 'ios', 'web')),

    -- Push provider: 'fcm' | 'webpush'
    provider TEXT NOT NULL DEFAULT 'fcm'
        CHECK (provider IN ('fcm', 'webpush')),

    -- Device name/identifier (optional)
    device_name TEXT,

    -- Token metadata
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Active status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- Index for restaurant queries
CREATE INDEX IF NOT EXISTS idx_device_tokens_restaurant
    ON public.device_tokens (restaurant_id);

-- Index for guest queries
CREATE INDEX IF NOT EXISTS idx_device_tokens_guest
    ON public.device_tokens (guest_id);

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_device_tokens_token
    ON public.device_tokens (token);

-- Index for provider queries
CREATE INDEX IF NOT EXISTS idx_device_tokens_provider
    ON public.device_tokens (provider, is_active);

-- Unique constraint on token
ALTER TABLE public.device_tokens
    ADD CONSTRAINT unique_device_token UNIQUE (token);


-- =========================================================
-- GUEST PUSH PREFERENCES TABLE
-- Stores guest preferences for push notifications
-- =========================================================

CREATE TABLE IF NOT EXISTS public.guest_push_preferences (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Guest reference (one-to-one)
    guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,

    -- Restaurant reference for tenant isolation
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,

    -- Push enabled status
    push_enabled BOOLEAN NOT NULL DEFAULT false,

    -- Preferred notification channel
    preferred_channel TEXT NOT NULL DEFAULT 'both'
        CHECK (preferred_channel IN ('sms', 'push', 'both')),

    -- Opt-in/out timestamps
    push_opt_in_at TIMESTAMPTZ,
    push_opt_out_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint on guest
    CONSTRAINT unique_guest_push_preference UNIQUE (guest_id)
);

-- Index for restaurant queries
CREATE INDEX IF NOT EXISTS idx_guest_push_preferences_restaurant
    ON public.guest_push_preferences (restaurant_id);

-- Index for guest queries
CREATE INDEX IF NOT EXISTS idx_guest_push_preferences_guest
    ON public.guest_push_preferences (guest_id);

-- Index for enabled preferences
CREATE INDEX IF NOT EXISTS idx_guest_push_preferences_enabled
    ON public.guest_push_preferences (push_enabled);


-- =========================================================
-- ROW LEVEL SECURITY POLICIES
-- =========================================================

-- Enable RLS on device_tokens
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens FORCE ROW LEVEL SECURITY;

-- Enable RLS on guest_push_preferences
ALTER TABLE public.guest_push_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_push_preferences FORCE ROW LEVEL SECURITY;

-- device_tokens policies
-- Guests can view their own tokens
CREATE POLICY "Guests can view own device tokens"
    ON public.device_tokens
    FOR SELECT
    TO authenticated
    USING (
        guest_id = (
            SELECT id FROM public.guests
            WHERE user_id = auth.uid()
            LIMIT 1
        )
    );

-- Guests can insert their own tokens
CREATE POLICY "Guests can insert own device tokens"
    ON public.device_tokens
    FOR INSERT
    TO authenticated
    WITH CHECK (
        guest_id = (
            SELECT id FROM public.guests
            WHERE user_id = auth.uid()
            LIMIT 1
        )
    );

-- Guests can update their own tokens
CREATE POLICY "Guests can update own device tokens"
    ON public.device_tokens
    FOR UPDATE
    TO authenticated
    USING (
        guest_id = (
            SELECT id FROM public.guests
            WHERE user_id = auth.uid()
            LIMIT 1
        )
    );

-- Guests can delete their own tokens
CREATE POLICY "Guests can delete own device tokens"
    ON public.device_tokens
    FOR DELETE
    TO authenticated
    USING (
        guest_id = (
            SELECT id FROM public.guests
            WHERE user_id = auth.uid()
            LIMIT 1
        )
    );

-- Staff can view device tokens for their restaurant
CREATE POLICY "Staff can view restaurant device tokens"
    ON public.device_tokens
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = device_tokens.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- Staff can manage device tokens for their restaurant
CREATE POLICY "Staff can manage restaurant device tokens"
    ON public.device_tokens
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = device_tokens.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- Service role can manage all device tokens
CREATE POLICY "Service role can manage device tokens"
    ON public.device_tokens
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- guest_push_preferences policies
-- Guests can view their own preferences
CREATE POLICY "Guests can view own push preferences"
    ON public.guest_push_preferences
    FOR SELECT
    TO authenticated
    USING (
        guest_id = (
            SELECT id FROM public.guests
            WHERE user_id = auth.uid()
            LIMIT 1
        )
    );

-- Guests can update their own preferences
CREATE POLICY "Guests can update own push preferences"
    ON public.guest_push_preferences
    FOR ALL
    TO authenticated
    USING (
        guest_id = (
            SELECT id FROM public.guests
            WHERE user_id = auth.uid()
            LIMIT 1
        )
    );

-- Staff can view preferences for their restaurant
CREATE POLICY "Staff can view restaurant push preferences"
    ON public.guest_push_preferences
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = guest_push_preferences.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- Service role can manage all preferences
CREATE POLICY "Service role can manage push preferences"
    ON public.guest_push_preferences
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- =========================================================
-- UPDATED AT TRIGGER FUNCTIONS
-- =========================================================

-- Apply trigger to device_tokens
DROP TRIGGER IF EXISTS update_device_tokens_updated_at ON public.device_tokens;
CREATE TRIGGER update_device_tokens_updated_at
    BEFORE UPDATE ON public.device_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Apply trigger to guest_push_preferences
DROP TRIGGER IF EXISTS update_guest_push_preferences_updated_at ON public.guest_push_preferences;
CREATE TRIGGER update_guest_push_preferences_updated_at
    BEFORE UPDATE ON public.guest_push_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
