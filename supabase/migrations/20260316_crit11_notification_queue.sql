-- CRIT-11: Notification Queue and Waitlist System
-- Date: 2026-03-16
-- Purpose: Create notification queue for reliable SMS/push notifications and table waitlist management

BEGIN;

-- =========================================================
-- NOTIFICATION QUEUE TABLE
-- Stores notification jobs for SMS, push, and email delivery
-- =========================================================

CREATE TABLE IF NOT EXISTS public.notification_queue (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Tenant and guest context
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    guest_id UUID, -- Nullable for loyalty guests
    guest_phone TEXT NOT NULL,
    
    -- Notification type and channel
    notification_type TEXT NOT NULL DEFAULT 'order_status' 
        CHECK (notification_type IN ('order_status', 'waitlist', 'promotion', 'reservation')),
    channel TEXT NOT NULL DEFAULT 'sms' 
        CHECK (channel IN ('sms', 'push', 'email')),
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    
    -- Priority for processing order (higher = more urgent)
    priority INT NOT NULL DEFAULT 0,
    
    -- Message content (bilingual)
    message_am TEXT, -- Amharic message
    message_en TEXT, -- English message
    
    -- Retry configuration
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMPTZ, -- Nullable, set when retry is scheduled
    
    -- Delivery tracking
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    provider_response JSONB, -- Response from SMS/push provider
    
    -- Idempotency key to prevent duplicate sends
    idempotency_key TEXT UNIQUE,
    
    -- Additional metadata
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for processing queue (status + next_retry_at for efficient polling)
CREATE INDEX IF NOT EXISTS idx_notification_queue_status_next_retry 
    ON public.notification_queue (status, next_retry_at);

-- Index for restaurant and notification type queries
CREATE INDEX IF NOT EXISTS idx_notification_queue_restaurant_type 
    ON public.notification_queue (restaurant_id, notification_type);

-- Index for guest ID lookups
CREATE INDEX IF NOT EXISTS idx_notification_queue_guest_id 
    ON public.notification_queue (guest_id);

-- Unique index for idempotency key already created in table definition


-- =========================================================
-- GUEST SESSIONS TABLE
-- Tracks anonymous guest sessions with HMAC-scoped access for order tracking
-- =========================================================

CREATE TABLE IF NOT EXISTS public.guest_sessions (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Tenant context
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    
    -- Anonymous guest identification
    guest_fingerprint TEXT NOT NULL, -- Anonymous identifier (hashed device ID, etc.)
    phone TEXT, -- Encrypted phone number (optional for anonymous sessions)
    
    -- HMAC secret for signing session tokens (for order lookup via QR)
    hmac_secret TEXT NOT NULL,
    
    -- Session lifecycle
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for restaurant and fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_guest_sessions_restaurant_fingerprint 
    ON public.guest_sessions (restaurant_id, guest_fingerprint);

-- Index for active session lookups
CREATE INDEX IF NOT EXISTS idx_guest_sessions_expiry 
    ON public.guest_sessions (expires_at);


-- =========================================================
-- TABLE WAITLIST TABLE
-- Manages walk-in guest waitlist with position tracking
-- =========================================================

CREATE TABLE IF NOT EXISTS public.table_waitlist (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Tenant context
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    
    -- Guest information
    guest_name TEXT,
    guest_phone TEXT NOT NULL,
    guest_count INT NOT NULL DEFAULT 1 CHECK (guest_count > 0),
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'waiting' 
        CHECK (status IN ('waiting', 'notified', 'seated', 'cancelled', 'expired')),
    
    -- Notification tracking
    notified_at TIMESTAMPTZ,
    seated_at TIMESTAMPTZ,
    
    -- Wait time estimation
    estimated_wait_minutes INT,
    position INT NOT NULL, -- Position in waitlist
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for restaurant waitlist queries (ordered by position)
CREATE INDEX IF NOT EXISTS idx_table_waitlist_restaurant_status 
    ON public.table_waitlist (restaurant_id, status, position);

-- Index for guest phone lookups
CREATE INDEX IF NOT EXISTS idx_table_waitlist_phone 
    ON public.table_waitlist (guest_phone);


-- =========================================================
-- ROW LEVEL SECURITY POLICIES
-- =========================================================

-- Enable RLS on notification_queue
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue FORCE ROW LEVEL SECURITY;

-- Enable RLS on guest_sessions
ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_sessions FORCE ROW LEVEL SECURITY;

-- Enable RLS on table_waitlist
ALTER TABLE public.table_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_waitlist FORCE ROW LEVEL SECURITY;

-- notification_queue policies
-- Staff can view all notifications for their restaurant
CREATE POLICY "Staff can view notification queue" 
    ON public.notification_queue
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = notification_queue.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- Staff can insert notifications for their restaurant
CREATE POLICY "Staff can insert notification queue" 
    ON public.notification_queue
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = notification_queue.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- Staff can update notification status
CREATE POLICY "Staff can update notification queue" 
    ON public.notification_queue
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = notification_queue.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- Staff can delete notifications
CREATE POLICY "Staff can delete notification queue" 
    ON public.notification_queue
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = notification_queue.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- guest_sessions policies
-- Staff can view guest sessions for their restaurant
CREATE POLICY "Staff can view guest sessions" 
    ON public.guest_sessions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = guest_sessions.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- Staff can create guest sessions
CREATE POLICY "Staff can insert guest sessions" 
    ON public.guest_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = guest_sessions.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- Staff can update guest sessions
CREATE POLICY "Staff can update guest sessions" 
    ON public.guest_sessions
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = guest_sessions.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- Staff can delete guest sessions
CREATE POLICY "Staff can delete guest sessions" 
    ON public.guest_sessions
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = guest_sessions.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- table_waitlist policies
-- Staff can view waitlist for their restaurant
CREATE POLICY "Staff can view table waitlist" 
    ON public.table_waitlist
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = table_waitlist.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- Staff can add to waitlist
CREATE POLICY "Staff can insert table waitlist" 
    ON public.table_waitlist
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = table_waitlist.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- Staff can update waitlist entries
CREATE POLICY "Staff can update table waitlist" 
    ON public.table_waitlist
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = table_waitlist.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );

-- Staff can remove from waitlist
CREATE POLICY "Staff can delete table waitlist" 
    ON public.table_waitlist
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = table_waitlist.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
    );


-- =========================================================
-- UPDATED AT TRIGGER FUNCTION
-- Helper function to auto-update updated_at timestamp
-- =========================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to notification_queue
DROP TRIGGER IF EXISTS update_notification_queue_updated_at ON public.notification_queue;
CREATE TRIGGER update_notification_queue_updated_at
    BEFORE UPDATE ON public.notification_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Apply trigger to table_waitlist
DROP TRIGGER IF EXISTS update_table_waitlist_updated_at ON public.table_waitlist;
CREATE TRIGGER update_table_waitlist_updated_at
    BEFORE UPDATE ON public.table_waitlist
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
