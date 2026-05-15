-- CRIT-11: Notification Metrics Table
-- Date: 2026-03-17
-- Purpose: Create notification_metrics table for observability and delivery tracking

BEGIN;

-- =========================================================
-- NOTIFICATION METRICS TABLE
-- Stores delivery metrics for notification observability
-- =========================================================

CREATE TABLE IF NOT EXISTS public.notification_metrics (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Tenant context (required for multi-tenant isolation)
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    
    -- Notification reference (optional - links to notification_queue)
    notification_id UUID REFERENCES public.notification_queue(id) ON DELETE SET NULL,
    
    -- Channel type
    channel TEXT NOT NULL 
        CHECK (channel IN ('sms', 'push', 'email')),
    
    -- Delivery status
    status TEXT NOT NULL 
        CHECK (status IN ('sent', 'failed', 'retry')),
    
    -- Latency tracking (in milliseconds)
    latency_ms INTEGER,
    
    -- Error tracking
    error_code TEXT,
    error_message TEXT,
    
    -- Retry flag
    is_retry BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Recorded at timestamp
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for restaurant queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_notification_metrics_restaurant 
    ON public.notification_metrics (restaurant_id, recorded_at DESC);

-- Index for channel and status queries
CREATE INDEX IF NOT EXISTS idx_notification_metrics_channel_status 
    ON public.notification_metrics (channel, status, recorded_at DESC);

-- Index for restaurant + channel queries
CREATE INDEX IF NOT EXISTS idx_notification_metrics_restaurant_channel 
    ON public.notification_metrics (restaurant_id, channel, recorded_at DESC);

-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_notification_metrics_date 
    ON public.notification_metrics (recorded_at DESC);

-- Composite index for aggregation queries
CREATE INDEX IF NOT EXISTS idx_notification_metrics_aggregate 
    ON public.notification_metrics (restaurant_id, channel, status, recorded_at DESC);

-- RLS - Row Level Security
ALTER TABLE public.notification_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Restaurant staff can read metrics for their restaurant
CREATE POLICY "Restaurant staff can read notification metrics"
    ON public.notification_metrics FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM restaurant_staff rs
            WHERE rs.restaurant_id = notification_metrics.restaurant_id
            AND rs.user_id = auth.uid()
        )
    );

-- RLS Policy: Service role can insert metrics (for internal use)
CREATE POLICY "Service role can insert notification metrics"
    ON public.notification_metrics FOR INSERT
    WITH CHECK (true);

-- RLS Policy: Service role can update metrics
CREATE POLICY "Service role can update notification metrics"
    ON public.notification_metrics FOR UPDATE
    USING (true);

COMMENT ON TABLE public.notification_metrics IS 'Stores notification delivery metrics for observability and analytics. Tracks success/failure rates, latency, and retries by channel.';
COMMENT ON COLUMN public.notification_metrics.restaurant_id IS 'Tenant identifier for multi-tenant isolation';
COMMENT ON COLUMN public.notification_metrics.notification_id IS 'Optional reference to notification_queue for detailed tracking';
COMMENT ON COLUMN public.notification_metrics.channel IS 'Notification channel: sms, push, or email';
COMMENT ON COLUMN public.notification_metrics.status IS 'Delivery status: sent, failed, or retry';
COMMENT ON COLUMN public.notification_metrics.latency_ms IS 'Delivery latency in milliseconds';
COMMENT ON COLUMN public.notification_metrics.error_code IS 'Provider error code if delivery failed';
COMMENT ON COLUMN public.notification_metrics.error_message IS 'Human-readable error message';
COMMENT ON COLUMN public.notification_metrics.is_retry IS 'True if this is a retry attempt';

COMMIT;
