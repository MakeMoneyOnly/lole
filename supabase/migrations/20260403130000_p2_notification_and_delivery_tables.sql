-- P2 Notification and Delivery Tables
-- Date: 2026-04-03
-- Purpose: Add missing notification_logs, push_tokens, and delivery_aggregator_configs tables

BEGIN;

-- Notification logs table
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    recipient TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    provider TEXT,
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_restaurant ON public.notification_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_order ON public.notification_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON public.notification_logs(created_at);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff can view notification_logs" ON public.notification_logs;
CREATE POLICY "Tenant staff can view notification_logs"
    ON public.notification_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = notification_logs.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (au.role = 'admin' OR notification_logs.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[])))
        )
    );

DROP POLICY IF EXISTS "Service role can insert notification_logs" ON public.notification_logs;
CREATE POLICY "Service role can insert notification_logs"
    ON public.notification_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Push tokens table (for customer devices)
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    phone TEXT,
    guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
    token TEXT NOT NULL,
    platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    UNIQUE (restaurant_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_restaurant ON public.push_tokens(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_phone ON public.push_tokens(phone);
CREATE INDEX IF NOT EXISTS idx_push_tokens_guest ON public.push_tokens(guest_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff can manage push_tokens" ON public.push_tokens;
CREATE POLICY "Tenant staff can manage push_tokens"
    ON public.push_tokens
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = push_tokens.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (au.role = 'admin' OR push_tokens.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[])))
        )
    );

-- Delivery aggregator configs (for multi-provider delivery integrations)
CREATE TABLE IF NOT EXISTS public.delivery_aggregator_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    aggregator_name TEXT NOT NULL,
    api_key TEXT,
    api_secret_ref TEXT,
    webhook_url TEXT,
    settings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'error')),
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (restaurant_id, aggregator_name)
);

CREATE INDEX IF NOT EXISTS idx_delivery_aggregator_configs_restaurant ON public.delivery_aggregator_configs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_aggregator_configs_status ON public.delivery_aggregator_configs(status) WHERE status = 'active';

ALTER TABLE public.delivery_aggregator_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff can manage delivery_aggregator_configs" ON public.delivery_aggregator_configs;
CREATE POLICY "Tenant staff can manage delivery_aggregator_configs"
    ON public.delivery_aggregator_configs
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = delivery_aggregator_configs.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (au.role = 'admin' OR delivery_aggregator_configs.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[])))
        )
    );

COMMIT;
