-- lole Base Schema Reference (BKND-017)
-- Date: 2026-05-04
-- Description: REFERENCE ONLY — consolidated view of the current database schema
--   across all applied migrations. DO NOT APPLY as a migration.
--   The authoritative schema is defined by the incremental migrations
--   in supabase/migrations/.
--   Regenerate when schema changes significantly.

-- Required extensions: uuid-ossp, timescaledb
-- Post-migration: Run Supabase Security Advisor
--
-- This migration is idempotent (IF NOT EXISTS / IF EXISTS guards).
-- It can be applied on both clean and existing databases.

BEGIN;

-- ==========================================================================
-- 1. Extensions
-- ==========================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- ==========================================================================
-- 2. Helper Functions
-- ==========================================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- set_updated_at (alternative name used by some triggers)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ==========================================================================
-- 3. Core Tables (in dependency order)
-- ==========================================================================

-- 3.1 tenants (multi-tenant root)
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    api_key TEXT,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.2 restaurants (tenant instances)
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_am TEXT,
    description TEXT,
    logo_url TEXT,
    cover_image_url TEXT,
    hero_image_url TEXT,
    currency TEXT DEFAULT 'ETB',
    currency_symbol TEXT,
    location TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    hours_weekday TEXT,
    hours_weekend TEXT,
    settings JSONB DEFAULT '{}'::jsonb,
    social JSONB,
    features JSONB,
    promo_banners JSONB,
    brand_color TEXT,
    is_active BOOLEAN DEFAULT true,
    onboarding_completed BOOLEAN DEFAULT false,
    telegram_chat_id TEXT,
    owner_telegram_chat_id TEXT,
    chapa_subaccount_id TEXT,
    chapa_subaccount_status TEXT DEFAULT 'pending',
    chapa_subaccount_last_error TEXT,
    chapa_subaccount_provisioned_at TIMESTAMPTZ,
    chapa_settlement_bank_name TEXT,
    chapa_settlement_bank_code TEXT,
    chapa_settlement_account_name TEXT,
    chapa_settlement_account_number_masked TEXT,
    hosted_checkout_fee_percentage NUMERIC(5,2) DEFAULT 3.5,
    platform_fee_percentage NUMERIC(5,2) DEFAULT 2.0,
    tin_number TEXT,
    vat_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON public.restaurants(slug);

-- 3.3 user_profiles (trigger-maintained sync from auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    name TEXT,
    first_name TEXT,
    last_name TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

CREATE OR REPLACE FUNCTION public.sync_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.user_profiles (id, email, full_name, name, first_name, last_name)
        VALUES (
            NEW.id,
            NEW.email,
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            NEW.raw_user_meta_data->>'first_name',
            NEW.raw_user_meta_data->>'last_name'
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            name = EXCLUDED.name,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            updated_at = NOW();
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.email IS DISTINCT FROM NEW.email
            OR OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data
        THEN
            INSERT INTO public.user_profiles (id, email, full_name, name, first_name, last_name)
            VALUES (
                NEW.id,
                NEW.email,
                NEW.raw_user_meta_data->>'full_name',
                NEW.raw_user_meta_data->>'name',
                NEW.raw_user_meta_data->>'first_name',
                NEW.raw_user_meta_data->>'last_name'
            )
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email,
                full_name = EXCLUDED.full_name,
                name = EXCLUDED.name,
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                updated_at = NOW();
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_profile ON auth.users;
CREATE TRIGGER trg_sync_user_profile
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_profile();

-- Backfill existing user_profiles
INSERT INTO public.user_profiles (id, email, full_name, name, first_name, last_name)
SELECT
    u.id,
    u.email,
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'first_name',
    u.raw_user_meta_data->>'last_name'
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    name = EXCLUDED.name,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = NOW();

-- 3.4 agency_users
CREATE TABLE IF NOT EXISTS public.agency_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'staff',
    restaurant_ids UUID[] DEFAULT '{}'::uuid[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.5 restaurant_staff
CREATE TABLE IF NOT EXISTS public.restaurant_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner','admin','manager','kitchen','waiter','bar')),
    name TEXT,
    pin_code TEXT,
    is_active BOOLEAN DEFAULT true,
    assigned_zones TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_user ON public.restaurant_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_staff_restaurant ON public.restaurant_staff(restaurant_id);

-- 3.6 categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_am TEXT,
    section TEXT,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.7 menu_items
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_am TEXT,
    description TEXT,
    description_am TEXT,
    price NUMERIC(10,2) NOT NULL,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    is_chef_special BOOLEAN DEFAULT false,
    is_fasting BOOLEAN DEFAULT false,
    course TEXT DEFAULT 'main',
    station TEXT DEFAULT 'kitchen',
    preparation_time_minutes INTEGER,
    preparation_time INTEGER,
    dietary_tags TEXT[] DEFAULT '{}'::text[],
    allergens TEXT[] DEFAULT '{}'::text[],
    ingredients TEXT[] DEFAULT '{}'::text[],
    modifiers JSONB DEFAULT '{}'::jsonb,
    connected_stations TEXT[] DEFAULT '{kitchen}'::text[],
    nutrition JSONB,
    spicy_level INTEGER DEFAULT 0,
    stock_quantity INTEGER,
    pairings TEXT[] DEFAULT '{}'::text[],
    upsell_tags TEXT[] DEFAULT '{}'::text[],
    complementary_items TEXT[] DEFAULT '{}'::text[],
    has_ar BOOLEAN DEFAULT false,
    model_glb TEXT,
    model_usdz TEXT,
    model_scale TEXT,
    popularity NUMERIC DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    rating NUMERIC DEFAULT 0,
    reviews_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON public.menu_items(category_id);

-- 3.8 modifier_groups
CREATE TABLE IF NOT EXISTS public.modifier_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_am TEXT,
    required BOOLEAN DEFAULT false,
    multi_select BOOLEAN DEFAULT false,
    min_select INTEGER,
    max_select INTEGER,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.9 modifier_options
CREATE TABLE IF NOT EXISTS public.modifier_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    modifier_group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_am TEXT,
    price_adjustment NUMERIC(10,2) DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.10 tables
CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL,
    capacity INTEGER DEFAULT 4 CHECK (capacity > 0),
    zone TEXT,
    status TEXT DEFAULT 'available' CHECK (status IN ('available','occupied','reserved','bill_requested')),
    is_active BOOLEAN DEFAULT true,
    qr_code_url TEXT,
    qr_version INTEGER DEFAULT 1 CHECK (qr_version > 0),
    active_order_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(restaurant_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON public.tables(restaurant_id);

-- 3.11 orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL DEFAULT 'unknown',
    status TEXT DEFAULT 'pending',
    status_check CHECK (status IN ('pending','preparing','ready','served','paid','cancelled')),
    total_price NUMERIC(10,2) DEFAULT 0,
    discount_amount NUMERIC(10,2) DEFAULT 0,
    discount_id UUID REFERENCES discounts(id) ON DELETE SET NULL,
    happy_hour_schedule_id UUID,
    currency TEXT DEFAULT 'ETB',
    fire_mode TEXT DEFAULT 'auto',
    customer_name TEXT,
    customer_phone TEXT,
    delivery_address TEXT,
    notes TEXT,
    order_type TEXT,
    kitchen_status TEXT DEFAULT 'pending',
    bar_status TEXT DEFAULT 'pending',
    current_course TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    metadata JSONB,
    idempotency_key UUID UNIQUE,
    order_number TEXT,
    guest_fingerprint TEXT,
    chapa_tx_ref TEXT,
    chapa_verified BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON public.orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

-- 3.12 order_items
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.menu_items(id),
    name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    price NUMERIC(10,2) NOT NULL,
    notes TEXT,
    modifiers JSONB DEFAULT '{}'::jsonb,
    station TEXT DEFAULT 'kitchen',
    course TEXT DEFAULT 'main',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','cooking','ready','served','void')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    idempotency_key TEXT,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON public.order_items(status);

-- 3.13 table_sessions
CREATE TABLE IF NOT EXISTS public.table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
    assigned_staff_id UUID REFERENCES public.restaurant_staff(id) ON DELETE SET NULL,
    guest_count INTEGER NOT NULL DEFAULT 1 CHECK (guest_count > 0),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','transferred','closed','cancelled')),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant_status_opened ON public.table_sessions(restaurant_id, status, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_status ON public.table_sessions(table_id, status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_staff_status ON public.table_sessions(assigned_staff_id, status) WHERE assigned_staff_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_sessions_one_open_per_table ON public.table_sessions(table_id) WHERE status = 'open';

-- 3.14 order_events (order lifecycle event log)
CREATE TABLE IF NOT EXISTS public.order_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    actor_user_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.15 order_check_splits (split bill)
CREATE TABLE IF NOT EXISTS public.order_check_splits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    split_index INTEGER NOT NULL,
    split_label TEXT,
    status TEXT DEFAULT 'open',
    requested_amount NUMERIC(10,2),
    computed_amount NUMERIC(10,2) DEFAULT 0,
    created_by UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.16 order_check_split_items
CREATE TABLE IF NOT EXISTS public.order_check_split_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    split_id UUID NOT NULL REFERENCES public.order_check_splits(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    line_amount NUMERIC(10,2) NOT NULL,
    idempotency_key UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.17 payment_sessions
CREATE TABLE IF NOT EXISTS public.payment_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'ETB',
    channel TEXT NOT NULL,
    surface TEXT NOT NULL,
    intent_type TEXT NOT NULL,
    selected_provider TEXT,
    selected_method TEXT,
    status TEXT NOT NULL DEFAULT 'created',
    checkout_url TEXT,
    provider_reference TEXT,
    provider_transaction_id TEXT,
    expires_at TIMESTAMPTZ,
    authorized_at TIMESTAMPTZ,
    captured_at TIMESTAMPTZ,
    created_by UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.18 payments
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    payment_session_id UUID REFERENCES public.payment_sessions(id) ON DELETE SET NULL,
    split_id UUID REFERENCES public.order_check_splits(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL,
    tip_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'ETB',
    method TEXT NOT NULL,
    provider TEXT DEFAULT 'chapa',
    status TEXT DEFAULT 'pending',
    provider_reference TEXT,
    idempotency_key UUID,
    tip_pool_id UUID,
    tip_allocation_id UUID,
    authorized_at TIMESTAMPTZ,
    captured_at TIMESTAMPTZ,
    created_by UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.19 refunds
CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    provider_reference TEXT,
    processed_at TIMESTAMPTZ,
    created_by UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.20 payouts
CREATE TABLE IF NOT EXISTS public.payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    channel TEXT DEFAULT 'chapa',
    currency TEXT DEFAULT 'ETB',
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    gross NUMERIC(14,2) NOT NULL DEFAULT 0,
    fees NUMERIC(14,2) NOT NULL DEFAULT 0,
    adjustments NUMERIC(14,2) NOT NULL DEFAULT 0,
    net NUMERIC(14,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    created_by UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.21 reconciliation_entries
CREATE TABLE IF NOT EXISTS public.reconciliation_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    ledger_id TEXT NOT NULL,
    ledger_type TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id UUID,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    payout_id UUID REFERENCES public.payouts(id) ON DELETE SET NULL,
    refund_id UUID REFERENCES public.refunds(id) ON DELETE SET NULL,
    expected_amount NUMERIC(14,2) NOT NULL,
    settled_amount NUMERIC(14,2) NOT NULL,
    delta_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'unmatched',
    notes TEXT,
    created_by UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.22 audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
    user_id UUID,
    telegram_user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.23 service_requests
CREATE TABLE IF NOT EXISTS public.service_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL,
    request_type TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    notes TEXT,
    idempotency_key UUID,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.24 kds_order_items (Kitchen Display System)
CREATE TABLE IF NOT EXISTS public.kds_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    station TEXT NOT NULL DEFAULT 'kitchen',
    status TEXT DEFAULT 'pending',
    notes TEXT,
    modifiers JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    held_at TIMESTAMPTZ,
    recalled_at TIMESTAMPTZ,
    last_action_at TIMESTAMPTZ,
    last_action_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.25 kds_item_events
CREATE TABLE IF NOT EXISTS public.kds_item_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kds_order_item_id UUID NOT NULL REFERENCES public.kds_order_items(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    actor_user_id UUID,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.26 guests
CREATE TABLE IF NOT EXISTS public.guests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    identity_key TEXT NOT NULL,
    name TEXT,
    phone_hash TEXT,
    email_hash TEXT,
    fingerprint_hash TEXT,
    language TEXT DEFAULT 'en',
    is_vip BOOLEAN DEFAULT false,
    visit_count INTEGER DEFAULT 0,
    lifetime_value NUMERIC(12,2) DEFAULT 0,
    tags TEXT[] DEFAULT '{}'::text[],
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.27 guest_visits
CREATE TABLE IF NOT EXISTS public.guest_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
    channel TEXT DEFAULT 'dine-in',
    spend NUMERIC(12,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    visited_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.28 loyalty_programs
CREATE TABLE IF NOT EXISTS public.loyalty_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    points_rule_json JSONB DEFAULT '{}'::jsonb,
    tier_rule_json JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'active',
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.29 loyalty_accounts
CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
    points_balance INTEGER DEFAULT 0,
    tier TEXT DEFAULT 'standard',
    status TEXT DEFAULT 'active',
    total_visits INTEGER DEFAULT 0,
    total_points_earned INTEGER DEFAULT 0,
    last_visit_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.30 loyalty_transactions
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.loyalty_accounts(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    points_delta INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    reason TEXT,
    created_by UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.31 gift_cards
CREATE TABLE IF NOT EXISTS public.gift_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    currency TEXT DEFAULT 'ETB',
    initial_balance NUMERIC(12,2) NOT NULL,
    current_balance NUMERIC(12,2) NOT NULL,
    status TEXT DEFAULT 'active',
    expires_at TIMESTAMPTZ,
    created_by UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.32 gift_card_transactions
CREATE TABLE IF NOT EXISTS public.gift_card_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    gift_card_id UUID NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    amount_delta NUMERIC(12,2) NOT NULL,
    balance_after NUMERIC(12,2) NOT NULL,
    type TEXT NOT NULL,
    created_by UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.33 campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    channel TEXT NOT NULL,
    segment_id UUID,
    status TEXT DEFAULT 'draft',
    template_json JSONB DEFAULT '{}'::jsonb,
    scheduled_at TIMESTAMPTZ,
    launched_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.34 campaign_deliveries
CREATE TABLE IF NOT EXISTS public.campaign_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    conversion_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.35 segments
CREATE TABLE IF NOT EXISTS public.segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rule_json JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.36 discounts
CREATE TABLE IF NOT EXISTS public.discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_am TEXT,
    type TEXT NOT NULL,
    value NUMERIC(10,2) NOT NULL,
    applies_to TEXT DEFAULT 'all',
    target_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    target_menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    requires_manager_pin BOOLEAN DEFAULT false,
    max_uses_per_day INTEGER,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.37 happy_hour_schedules
CREATE TABLE IF NOT EXISTS public.happy_hour_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_am TEXT,
    description TEXT,
    description_am TEXT,
    applies_to TEXT DEFAULT 'all',
    discount_percentage NUMERIC(5,2),
    discount_fixed_amount NUMERIC(10,2),
    schedule_days TEXT[] NOT NULL DEFAULT '{monday,tuesday,wednesday,thursday,friday}'::text[],
    schedule_start_time TIME NOT NULL,
    schedule_end_time TIME NOT NULL,
    target_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    target_menu_item_ids UUID[] DEFAULT '{}'::uuid[],
    is_active BOOLEAN DEFAULT true,
    requires_manager_pin BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.38 reviews
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.39 staff_invites
CREATE TABLE IF NOT EXISTS public.staff_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    email TEXT,
    pin_code TEXT,
    status TEXT DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_invites_restaurant_id ON public.staff_invites(restaurant_id);

-- 3.40 stations
CREATE TABLE IF NOT EXISTS public.stations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    station_type TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    telegram_chat_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stations_restaurant_id ON public.stations(restaurant_id);

-- 3.41 shifts
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.restaurant_staff(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    role TEXT NOT NULL,
    station TEXT,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status TEXT DEFAULT 'scheduled',
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.42 time_entries
CREATE TABLE IF NOT EXISTS public.time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES public.restaurant_staff(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    clock_in_at TIMESTAMPTZ NOT NULL,
    clock_out_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active',
    source TEXT DEFAULT 'manual',
    created_by UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.43 tip_pools
CREATE TABLE IF NOT EXISTS public.tip_pools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_am TEXT,
    description TEXT,
    description_am TEXT,
    pool_type TEXT NOT NULL DEFAULT 'percentage',
    pool_value NUMERIC(10,2) DEFAULT 0,
    allocation_mode TEXT DEFAULT 'equal',
    calculated_from TEXT DEFAULT 'net_sales',
    is_active BOOLEAN DEFAULT true,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.44 tip_pool_shares
CREATE TABLE IF NOT EXISTS public.tip_pool_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    tip_pool_id UUID NOT NULL REFERENCES public.tip_pools(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    percentage NUMERIC(5,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.45 tip_allocations
CREATE TABLE IF NOT EXISTS public.tip_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    tip_pool_id UUID NOT NULL REFERENCES public.tip_pools(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    period_date DATE NOT NULL,
    total_tips_collected NUMERIC(12,2) DEFAULT 0,
    total_tips_pooled NUMERIC(12,2) DEFAULT 0,
    total_tips_distributed NUMERIC(12,2) DEFAULT 0,
    distribution JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending',
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.46 delivery_partners
CREATE TABLE IF NOT EXISTS public.delivery_partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    display_name TEXT,
    api_key TEXT,
    credentials_ref TEXT,
    settings_json JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'active',
    last_sync_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.47 delivery_aggregator_configs
CREATE TABLE IF NOT EXISTS public.delivery_aggregator_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    aggregator_name TEXT NOT NULL,
    api_key TEXT,
    api_secret_ref TEXT,
    webhook_url TEXT,
    settings_json JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'active',
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_aggregator_configs_restaurant_id ON public.delivery_aggregator_configs(restaurant_id);

-- 3.48 external_orders
CREATE TABLE IF NOT EXISTS public.external_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    delivery_partner_id UUID REFERENCES public.delivery_partners(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    provider_order_id TEXT NOT NULL,
    source_channel TEXT DEFAULT 'delivery',
    normalized_status TEXT DEFAULT 'new',
    total_amount NUMERIC(12,2) DEFAULT 0,
    currency TEXT DEFAULT 'ETB',
    payload_json JSONB DEFAULT '{}'::jsonb,
    acknowledged_at TIMESTAMPTZ,
    acked_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.49 hardware_devices
CREATE TABLE IF NOT EXISTS public.hardware_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    device_type TEXT NOT NULL,
    device_token TEXT,
    device_profile TEXT,
    status TEXT DEFAULT 'offline',
    pairing_code TEXT,
    pairing_state TEXT,
    pairing_code_expires_at TIMESTAMPTZ,
    pairing_completed_at TIMESTAMPTZ,
    paired_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    last_boot_at TIMESTAMPTZ,
    hardware_fingerprint TEXT,
    location_id UUID,
    assigned_zones TEXT[] DEFAULT '{}'::text[],
    printer_connection_type TEXT,
    printer_device_id TEXT,
    printer_device_name TEXT,
    printer_mac_address TEXT,
    printer_preferences JSONB,
    management_provider TEXT,
    management_device_id TEXT,
    management_status TEXT,
    app_channel TEXT,
    app_version TEXT,
    fiscal_mode TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.50 device_management_actions
CREATE TABLE IF NOT EXISTS public.device_management_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    hardware_device_id UUID NOT NULL REFERENCES public.hardware_devices(id) ON DELETE CASCADE,
    requested_by UUID,
    provider TEXT NOT NULL,
    action_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    request_payload JSONB,
    provider_job_id TEXT,
    response_payload JSONB,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.51 device_tokens
CREATE TABLE IF NOT EXISTS public.device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES public.guests(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_type TEXT NOT NULL,
    provider TEXT DEFAULT 'fcm',
    device_name TEXT,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.52 device_sync_status
CREATE TABLE IF NOT EXISTS public.device_sync_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    device_id UUID NOT NULL,
    device_name TEXT,
    device_type TEXT NOT NULL,
    sync_status TEXT DEFAULT 'pending',
    sync_version TEXT,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.53 push_tokens
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES public.guests(id) ON DELETE CASCADE,
    phone TEXT,
    token TEXT NOT NULL,
    platform TEXT,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_restaurant_id ON public.push_tokens(restaurant_id);

-- 3.54 sync_idempotency_keys
CREATE TABLE IF NOT EXISTS public.sync_idempotency_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    idempotency_key UUID NOT NULL UNIQUE,
    operation_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    result_data JSONB,
    version INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.55 notification_logs
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    recipient TEXT,
    status TEXT DEFAULT 'pending',
    provider TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_restaurant_id ON public.notification_logs(restaurant_id);

-- 3.56 notification_metrics
CREATE TABLE IF NOT EXISTS public.notification_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    notification_id UUID,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    latency_ms INTEGER,
    error_code TEXT,
    error_message TEXT,
    is_retry BOOLEAN DEFAULT false,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_metrics_restaurant_id ON public.notification_metrics(restaurant_id);

-- 3.57 alert_rules
CREATE TABLE IF NOT EXISTS public.alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    enabled BOOLEAN DEFAULT true,
    target_json JSONB DEFAULT '{}'::jsonb,
    condition_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.58 alert_events
CREATE TABLE IF NOT EXISTS public.alert_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES public.alert_rules(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    severity TEXT DEFAULT 'info',
    status TEXT DEFAULT 'firing',
    payload JSONB DEFAULT '{}'::jsonb,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.59 upsell_analytics
CREATE TABLE IF NOT EXISTS public.upsell_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES public.guests(id) ON DELETE CASCADE,
    item_viewed UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    recommended_items UUID[] DEFAULT '{}'::uuid[],
    clicked_item UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    added_to_cart BOOLEAN,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.60 centralized_menu_configs
CREATE TABLE IF NOT EXISTS public.centralized_menu_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    primary_restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    auto_sync_enabled BOOLEAN DEFAULT false,
    sync_items BOOLEAN DEFAULT true,
    sync_categories BOOLEAN DEFAULT true,
    sync_modifiers BOOLEAN DEFAULT true,
    sync_pricing BOOLEAN DEFAULT true,
    sync_availability BOOLEAN DEFAULT true,
    sync_schedule TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_centralized_menu_configs_primary_restaurant_id ON public.centralized_menu_configs(primary_restaurant_id);

-- 3.61 menu_location_links
CREATE TABLE IF NOT EXISTS public.menu_location_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_config_id UUID NOT NULL REFERENCES public.centralized_menu_configs(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT false,
    sync_enabled BOOLEAN DEFAULT true,
    sync_status TEXT,
    last_sync_at TIMESTAMPTZ,
    pending_changes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_location_links_restaurant_id ON public.menu_location_links(restaurant_id);

-- 3.62 menu_change_queue
CREATE TABLE IF NOT EXISTS public.menu_change_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_config_id UUID NOT NULL REFERENCES public.centralized_menu_configs(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    location_ids UUID[] DEFAULT '{}'::uuid[],
    change_data JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending',
    applied_at TIMESTAMPTZ,
    applied_to UUID[] DEFAULT '{}'::uuid[],
    failed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_menu_change_queue_menu_config_id ON public.menu_change_queue(menu_config_id);

-- 3.63 scheduled_reports
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    report_type TEXT NOT NULL,
    schedule_cron TEXT NOT NULL,
    recipient_emails TEXT[] DEFAULT '{}'::text[],
    delivery_method TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_restaurant_id ON public.scheduled_reports(restaurant_id);

-- 3.64 report_executions
CREATE TABLE IF NOT EXISTS public.report_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scheduled_report_id UUID NOT NULL REFERENCES public.scheduled_reports(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    report_period_start TIMESTAMPTZ,
    report_period_end TIMESTAMPTZ,
    data_row_count INTEGER,
    file_url TEXT,
    file_size_bytes INTEGER,
    file_format TEXT,
    email_sent BOOLEAN,
    email_sent_at TIMESTAMPTZ,
    email_error TEXT,
    error_message TEXT,
    error_stack TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_report_executions_restaurant_id ON public.report_executions(restaurant_id);

-- 3.65 report_templates
CREATE TABLE IF NOT EXISTS public.report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    report_type TEXT NOT NULL,
    columns JSONB DEFAULT '{}'::jsonb,
    filters JSONB DEFAULT '{}'::jsonb,
    group_by TEXT[] DEFAULT '{}'::text[],
    order_by TEXT[] DEFAULT '{}'::text[],
    sql_template TEXT,
    chart_config JSONB,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_templates_restaurant_id ON public.report_templates(restaurant_id);

-- 3.66 support_tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'open',
    source TEXT DEFAULT 'in-app',
    diagnostics_json JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.67 global_orders
CREATE TABLE IF NOT EXISTS public.global_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    external_order_id UUID,
    status TEXT DEFAULT 'new',
    table_number TEXT,
    total_amount NUMERIC(12,2),
    currency TEXT DEFAULT 'ETB',
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.68 system_health
CREATE TABLE IF NOT EXISTS public.system_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    latency_ms INTEGER,
    metadata JSONB,
    last_checked TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.69 system_health_monitor
CREATE TABLE IF NOT EXISTS public.system_health_monitor (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    latency_ms INTEGER,
    metadata JSONB,
    last_checked TIMESTAMPTZ
);

-- 3.70 rate_limit_logs
CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.71 workflow_audit_logs
CREATE TABLE IF NOT EXISTS public.workflow_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    workflow_id UUID,
    execution_id UUID,
    status TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.72 erca_submissions (Ethiopian Revenue & Customs Authority)
CREATE TABLE IF NOT EXISTS public.erca_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    vat_amount_santim INTEGER,
    grand_total_santim INTEGER,
    erca_invoice_id TEXT,
    qr_payload TEXT,
    digital_signature TEXT,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_erca_submissions_restaurant_id ON public.erca_submissions(restaurant_id);

-- ==========================================================================
-- 4. Ethiopian Financial Compliance Tables
-- ==========================================================================

-- 4.1 merchant_tax_config
CREATE TABLE IF NOT EXISTS public.merchant_tax_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
    tax_type TEXT NOT NULL DEFAULT 'TOT' CHECK (tax_type IN ('VAT','TOT')),
    vat_registration_number TEXT,
    vat_effective_date DATE,
    tot_rate NUMERIC(5,4) CHECK (tot_rate IS NULL OR tot_rate IN (0.02, 0.10)),
    efm_id TEXT,
    wht_threshold_etb NUMERIC(12,2) NOT NULL DEFAULT 3000.00,
    wht_rate NUMERIC(5,4) NOT NULL DEFAULT 0.02,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT vat_requires_number CHECK (
        (tax_type = 'VAT' AND vat_registration_number IS NOT NULL) OR tax_type = 'TOT'
    ),
    CONSTRAINT tot_requires_rate CHECK (
        (tax_type = 'TOT' AND tot_rate IS NOT NULL) OR tax_type = 'VAT'
    )
);

CREATE INDEX IF NOT EXISTS idx_merchant_tax_config_restaurant ON public.merchant_tax_config(restaurant_id);

-- 4.2 merchant_vat_ledger
CREATE TABLE IF NOT EXISTS public.merchant_vat_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    tax_type TEXT NOT NULL CHECK (tax_type IN ('VAT','TOT')),
    period_year SMALLINT NOT NULL,
    period_month SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    row10_standard_sales_etb NUMERIC(14,2) DEFAULT 0,
    row11_vat_collected_etb NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(row10_standard_sales_etb * 0.15, 2)) STORED,
    row20_exempt_sales_etb NUMERIC(14,2) DEFAULT 0,
    row25_zero_rated_sales_etb NUMERIC(14,2) DEFAULT 0,
    row30_input_vat_etb NUMERIC(14,2) DEFAULT 0,
    row40_net_vat_payable_etb NUMERIC(14,2) GENERATED ALWAYS AS (ROUND((row10_standard_sales_etb * 0.15) - row30_input_vat_etb, 2)) STORED,
    row50_wht_credit_etb NUMERIC(14,2) DEFAULT 0,
    final_amount_to_remit_etb NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(((row10_standard_sales_etb * 0.15) - row30_input_vat_etb) - row50_wht_credit_etb, 2)) STORED,
    tot_gross_sales_etb NUMERIC(14,2) DEFAULT 0,
    tot_rate NUMERIC(5,4),
    tot_payable_etb NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(tot_gross_sales_etb * COALESCE(tot_rate, 0), 2)) STORED,
    z_report_closed BOOLEAN NOT NULL DEFAULT FALSE,
    z_report_closed_at TIMESTAMPTZ,
    z_report_closed_by UUID REFERENCES auth.users(id),
    mor_xml_exported_at TIMESTAMPTZ,
    mor_csv_exported_at TIMESTAMPTZ,
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (restaurant_id, period_year, period_month, tax_type)
);

CREATE INDEX IF NOT EXISTS idx_vat_ledger_restaurant_period ON public.merchant_vat_ledger(restaurant_id, period_year DESC, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_vat_ledger_tax_type ON public.merchant_vat_ledger(restaurant_id, tax_type);
CREATE INDEX IF NOT EXISTS idx_vat_ledger_open_periods ON public.merchant_vat_ledger(restaurant_id, period_year, period_month) WHERE is_locked = FALSE;

-- 4.3 merchant_wht_receipts
CREATE TABLE IF NOT EXISTS public.merchant_wht_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    ledger_id UUID REFERENCES public.merchant_vat_ledger(id) ON DELETE SET NULL,
    receipt_number TEXT NOT NULL,
    buyer_tin TEXT,
    buyer_name TEXT,
    transaction_date DATE NOT NULL,
    gross_amount_etb NUMERIC(14,2) NOT NULL,
    wht_amount_etb NUMERIC(14,2) NOT NULL,
    document_url TEXT,
    amount_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT wht_positive_amounts CHECK (gross_amount_etb > 0 AND wht_amount_etb > 0 AND wht_amount_etb <= gross_amount_etb)
);

CREATE INDEX IF NOT EXISTS idx_wht_receipts_restaurant ON public.merchant_wht_receipts(restaurant_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_wht_receipts_ledger ON public.merchant_wht_receipts(ledger_id);

-- 4.4 merchant_bank_accounts
CREATE TABLE IF NOT EXISTS public.merchant_bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    branch_name TEXT,
    account_number TEXT NOT NULL,
    account_holder_name TEXT NOT NULL,
    swift_code TEXT,
    iban TEXT,
    account_type TEXT NOT NULL DEFAULT 'bank' CHECK (account_type IN ('bank','telebirr','mpesa','ethswitch')),
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_restaurant ON public.merchant_bank_accounts(restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_primary ON public.merchant_bank_accounts(restaurant_id) WHERE is_primary = TRUE;

-- 4.5 merchant_fiscal_days
CREATE TABLE IF NOT EXISTS public.merchant_fiscal_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    fiscal_date DATE NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES auth.users(id),
    gross_sales_etb NUMERIC(14,2),
    vat_collected_etb NUMERIC(14,2),
    tot_collected_etb NUMERIC(14,2),
    wht_deducted_etb NUMERIC(14,2),
    net_deposit_etb NUMERIC(14,2),
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (restaurant_id, fiscal_date)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_days_restaurant ON public.merchant_fiscal_days(restaurant_id, fiscal_date DESC);

-- ==========================================================================
-- 5. TimescaleDB Hypertables (time-series analytics)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.hourly_sales (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    restaurant_id UUID NOT NULL,
    hour_start TIMESTAMPTZ NOT NULL,
    hour_end TIMESTAMPTZ NOT NULL,
    total_orders INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    cancelled_orders INTEGER DEFAULT 0,
    total_revenue NUMERIC(14,2) DEFAULT 0,
    total_discounts NUMERIC(14,2) DEFAULT 0,
    total_tips NUMERIC(14,2) DEFAULT 0,
    dine_in_orders INTEGER DEFAULT 0,
    takeout_orders INTEGER DEFAULT 0,
    delivery_orders INTEGER DEFAULT 0,
    payment_method_breakdown JSONB DEFAULT '{}'::jsonb,
    top_items JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_hypertable('public.hourly_sales', 'hour_start', if_not_exists => true);
CREATE INDEX IF NOT EXISTS idx_hourly_sales_restaurant ON public.hourly_sales(restaurant_id, hour_start DESC);

CREATE TABLE IF NOT EXISTS public.daily_sales (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    restaurant_id UUID NOT NULL,
    date DATE NOT NULL,
    total_orders INTEGER DEFAULT 0,
    completed_orders INTEGER DEFAULT 0,
    cancelled_orders INTEGER DEFAULT 0,
    total_revenue NUMERIC(14,2) DEFAULT 0,
    total_discounts NUMERIC(14,2) DEFAULT 0,
    total_tips NUMERIC(14,2) DEFAULT 0,
    net_revenue NUMERIC(14,2) DEFAULT 0,
    dine_in_orders INTEGER DEFAULT 0,
    takeout_orders INTEGER DEFAULT 0,
    delivery_orders INTEGER DEFAULT 0,
    avg_order_value NUMERIC(14,2) DEFAULT 0,
    payment_method_breakdown JSONB DEFAULT '{}'::jsonb,
    hourly_distribution JSONB DEFAULT '{}'::jsonb,
    top_items JSONB DEFAULT '{}'::jsonb,
    orders_by_status JSONB DEFAULT '{}'::jsonb,
    new_customers INTEGER DEFAULT 0,
    returning_customers INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_hypertable('public.daily_sales', 'date', if_not_exists => true);
CREATE INDEX IF NOT EXISTS idx_daily_sales_restaurant ON public.daily_sales(restaurant_id, date DESC);

-- ==========================================================================
-- 6. RLS Policies
-- ==========================================================================

-- 6.1 Helper: tenant-scoped policy template
-- Staff can access rows for their restaurant via restaurant_staff check.
-- Uses (select auth.uid()) for query-plan caching per AGENTS.md.

-- NOTE: Service role bypasses RLS by default in Supabase - no explicit
-- service_role policies needed.

-- restaurants
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Active Restaurants" ON public.restaurants;
CREATE POLICY "Public Read Active Restaurants" ON public.restaurants
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Staff can update restaurants" ON public.restaurants;
CREATE POLICY "Staff can update restaurants" ON public.restaurants
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = restaurants.id
          AND COALESCE(rs.is_active, true) = true
          AND rs.role IN ('owner','admin','manager')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = restaurants.id
          AND COALESCE(rs.is_active, true) = true
          AND rs.role IN ('owner','admin','manager')
    ));

-- user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;
CREATE POLICY user_profiles_select_own ON public.user_profiles
    FOR SELECT TO authenticated
    USING (id = (select auth.uid()));

DROP POLICY IF EXISTS user_profiles_select_same_restaurant ON public.user_profiles;
CREATE POLICY user_profiles_select_same_restaurant ON public.user_profiles
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.is_active = true
          AND rs.user_id IN (
              SELECT rs2.user_id FROM public.restaurant_staff rs2
              WHERE rs2.restaurant_id = rs.restaurant_id AND rs2.is_active = true
          )
          AND user_profiles.id IN (
              SELECT rs3.user_id FROM public.restaurant_staff rs3
              WHERE rs3.restaurant_id = rs.restaurant_id AND rs3.is_active = true
          )
    ));

-- agency_users
ALTER TABLE public.agency_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agency admin can view agency_users" ON public.agency_users;
CREATE POLICY "Agency admin can view agency_users" ON public.agency_users
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.agency_users au
        WHERE au.user_id = (select auth.uid()) AND au.role = 'admin'
    ));

DROP POLICY IF EXISTS "Users can view own agency record" ON public.agency_users;
CREATE POLICY "Users can view own agency record" ON public.agency_users
    FOR SELECT TO authenticated
    USING (user_id = (select auth.uid()));

-- restaurant_staff
ALTER TABLE public.restaurant_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_staff FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff viewable by self or admin" ON public.restaurant_staff;
CREATE POLICY "Staff viewable by self or admin" ON public.restaurant_staff
    FOR SELECT TO authenticated
    USING (
        user_id = (select auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.restaurant_staff s
            WHERE s.user_id = (select auth.uid())
              AND s.restaurant_id = restaurant_staff.restaurant_id
              AND s.role IN ('owner','admin','manager')
              AND COALESCE(s.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Staff can insert restaurant_staff" ON public.restaurant_staff;
CREATE POLICY "Staff can insert restaurant_staff" ON public.restaurant_staff
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = restaurant_staff.restaurant_id
          AND rs.role IN ('owner','admin')
          AND COALESCE(rs.is_active, true) = true
    ));

DROP POLICY IF EXISTS "Staff can update restaurant_staff" ON public.restaurant_staff;
CREATE POLICY "Staff can update restaurant_staff" ON public.restaurant_staff
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = restaurant_staff.restaurant_id
          AND rs.role IN ('owner','admin','manager')
          AND COALESCE(rs.is_active, true) = true
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = restaurant_staff.restaurant_id
          AND rs.role IN ('owner','admin','manager')
          AND COALESCE(rs.is_active, true) = true
    ));

-- categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Categories" ON public.categories;
CREATE POLICY "Public Read Categories" ON public.categories
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Staff can manage categories" ON public.categories;
CREATE POLICY "Staff can manage categories" ON public.categories
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = categories.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = categories.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- menu_items
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Menu" ON public.menu_items;
CREATE POLICY "Public Read Menu" ON public.menu_items
    FOR SELECT USING (is_available = true);

DROP POLICY IF EXISTS "Staff can manage menu_items" ON public.menu_items;
CREATE POLICY "Staff can manage menu_items" ON public.menu_items
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.categories c
        JOIN public.restaurant_staff rs ON rs.restaurant_id = c.restaurant_id
        WHERE c.id = menu_items.category_id
          AND rs.user_id = (select auth.uid())
          AND COALESCE(rs.is_active, true) = true
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.categories c
        JOIN public.restaurant_staff rs ON rs.restaurant_id = c.restaurant_id
        WHERE c.id = menu_items.category_id
          AND rs.user_id = (select auth.uid())
          AND COALESCE(rs.is_active, true) = true
    ));

-- tables
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public tables are viewable" ON public.tables;
CREATE POLICY "Public tables are viewable" ON public.tables
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff can manage tables" ON public.tables;
CREATE POLICY "Staff can manage tables" ON public.tables
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = tables.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = tables.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon Insert Orders" ON public.orders;
CREATE POLICY "Anon Insert Orders" ON public.orders
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can view orders" ON public.orders;
CREATE POLICY "Staff can view orders" ON public.orders
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = orders.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders" ON public.orders
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = orders.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = orders.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon Insert Order Items" ON public.order_items;
CREATE POLICY "Anon Insert Order Items" ON public.order_items
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view order_items" ON public.order_items;
CREATE POLICY "Public can view order_items" ON public.order_items
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff can update order_items" ON public.order_items;
CREATE POLICY "Staff can update order_items" ON public.order_items
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.restaurant_staff rs ON rs.restaurant_id = o.restaurant_id
        WHERE o.id = order_items.order_id
          AND rs.user_id = (select auth.uid())
          AND COALESCE(rs.is_active, true) = true
    ));

-- table_sessions
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff can view table sessions" ON public.table_sessions;
CREATE POLICY "Tenant staff can view table sessions" ON public.table_sessions
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = table_sessions.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ) OR EXISTS (
        SELECT 1 FROM public.agency_users au
        WHERE au.user_id = (select auth.uid())
          AND (au.role = 'admin' OR table_sessions.restaurant_id = ANY(COALESCE(au.restaurant_ids, ARRAY[]::uuid[])))
    ));

DROP POLICY IF EXISTS "Tenant staff can manage table sessions" ON public.table_sessions;
CREATE POLICY "Tenant staff can manage table sessions" ON public.table_sessions
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = table_sessions.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ) OR EXISTS (
        SELECT 1 FROM public.agency_users au
        WHERE au.user_id = (select auth.uid())
          AND (au.role = 'admin' OR table_sessions.restaurant_id = ANY(COALESCE(au.restaurant_ids, ARRAY[]::uuid[])))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = table_sessions.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ) OR EXISTS (
        SELECT 1 FROM public.agency_users au
        WHERE au.user_id = (select auth.uid())
          AND (au.role = 'admin' OR table_sessions.restaurant_id = ANY(COALESCE(au.restaurant_ids, ARRAY[]::uuid[])))
    ));

-- order_events
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view order_events" ON public.order_events;
CREATE POLICY "Staff can view order_events" ON public.order_events
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = order_events.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- payment_sessions
ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can insert payment sessions" ON public.payment_sessions;
CREATE POLICY "Anon can insert payment sessions" ON public.payment_sessions
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can view payment_sessions" ON public.payment_sessions;
CREATE POLICY "Staff can view payment_sessions" ON public.payment_sessions
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = payment_sessions.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view payments" ON public.payments;
CREATE POLICY "Staff can view payments" ON public.payments
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = payments.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- refunds
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view refunds" ON public.refunds;
CREATE POLICY "Staff can view refunds" ON public.refunds
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = refunds.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- payouts
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view payouts" ON public.payouts;
CREATE POLICY "Staff can view payouts" ON public.payouts
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = payouts.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- reconciliation_entries
ALTER TABLE public.reconciliation_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_entries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view reconciliation_entries" ON public.reconciliation_entries;
CREATE POLICY "Staff can view reconciliation_entries" ON public.reconciliation_entries
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = reconciliation_entries.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view audit_logs" ON public.audit_logs;
CREATE POLICY "Staff can view audit_logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = audit_logs.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- service_requests
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can insert service_requests" ON public.service_requests;
CREATE POLICY "Anon can insert service_requests" ON public.service_requests
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can view service_requests" ON public.service_requests;
CREATE POLICY "Staff can view service_requests" ON public.service_requests
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = service_requests.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- kds_order_items
ALTER TABLE public.kds_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kds_order_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view kds_order_items" ON public.kds_order_items;
CREATE POLICY "Staff can view kds_order_items" ON public.kds_order_items
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = kds_order_items.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

DROP POLICY IF EXISTS "Staff can update kds_order_items" ON public.kds_order_items;
CREATE POLICY "Staff can update kds_order_items" ON public.kds_order_items
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = kds_order_items.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = kds_order_items.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- kds_item_events
ALTER TABLE public.kds_item_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kds_item_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view kds_item_events" ON public.kds_item_events;
CREATE POLICY "Staff can view kds_item_events" ON public.kds_item_events
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = kds_item_events.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- order_check_splits
ALTER TABLE public.order_check_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_check_splits FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view order_check_splits" ON public.order_check_splits;
CREATE POLICY "Staff can view order_check_splits" ON public.order_check_splits
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = order_check_splits.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- order_check_split_items
ALTER TABLE public.order_check_split_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_check_split_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view order_check_split_items" ON public.order_check_split_items;
CREATE POLICY "Staff can view order_check_split_items" ON public.order_check_split_items
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = order_check_split_items.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- guests
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view guests" ON public.guests;
CREATE POLICY "Staff can view guests" ON public.guests
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = guests.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- guest_visits
ALTER TABLE public.guest_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_visits FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view guest_visits" ON public.guest_visits;
CREATE POLICY "Staff can view guest_visits" ON public.guest_visits
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = guest_visits.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- loyalty_programs
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_programs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view loyalty_programs" ON public.loyalty_programs;
CREATE POLICY "Staff can view loyalty_programs" ON public.loyalty_programs
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = loyalty_programs.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- loyalty_accounts
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view loyalty_accounts" ON public.loyalty_accounts;
CREATE POLICY "Staff can view loyalty_accounts" ON public.loyalty_accounts
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = loyalty_accounts.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- loyalty_transactions
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view loyalty_transactions" ON public.loyalty_transactions;
CREATE POLICY "Staff can view loyalty_transactions" ON public.loyalty_transactions
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = loyalty_transactions.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- gift_cards
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_cards FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view gift_cards" ON public.gift_cards;
CREATE POLICY "Staff can view gift_cards" ON public.gift_cards
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = gift_cards.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- gift_card_transactions
ALTER TABLE public.gift_card_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_card_transactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view gift_card_transactions" ON public.gift_card_transactions;
CREATE POLICY "Staff can view gift_card_transactions" ON public.gift_card_transactions
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = gift_card_transactions.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view campaigns" ON public.campaigns;
CREATE POLICY "Staff can view campaigns" ON public.campaigns
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = campaigns.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- campaign_deliveries
ALTER TABLE public.campaign_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_deliveries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view campaign_deliveries" ON public.campaign_deliveries;
CREATE POLICY "Staff can view campaign_deliveries" ON public.campaign_deliveries
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.campaigns c
        JOIN public.restaurant_staff rs ON rs.restaurant_id = c.restaurant_id
        WHERE c.id = campaign_deliveries.campaign_id
          AND rs.user_id = (select auth.uid())
          AND COALESCE(rs.is_active, true) = true
    ));

-- segments
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view segments" ON public.segments;
CREATE POLICY "Staff can view segments" ON public.segments
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = segments.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- discounts
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view discounts" ON public.discounts;
CREATE POLICY "Staff can view discounts" ON public.discounts
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = discounts.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- happy_hour_schedules
ALTER TABLE public.happy_hour_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.happy_hour_schedules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view happy_hour_schedules" ON public.happy_hour_schedules;
CREATE POLICY "Staff can view happy_hour_schedules" ON public.happy_hour_schedules
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = happy_hour_schedules.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- modifier_groups
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifier_groups FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view modifier_groups" ON public.modifier_groups;
CREATE POLICY "Staff can view modifier_groups" ON public.modifier_groups
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = modifier_groups.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- modifier_options
ALTER TABLE public.modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifier_options FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view modifier_options" ON public.modifier_options;
CREATE POLICY "Staff can view modifier_options" ON public.modifier_options
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = modifier_options.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read reviews" ON public.reviews;
CREATE POLICY "Public can read reviews" ON public.reviews
    FOR SELECT USING (true);

-- staff_invites
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_invites FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view staff_invites" ON public.staff_invites;
CREATE POLICY "Staff can view staff_invites" ON public.staff_invites
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = staff_invites.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

DROP POLICY IF EXISTS "Public can check valid staff_invites" ON public.staff_invites;
CREATE POLICY "Public can check valid staff_invites" ON public.staff_invites
    FOR SELECT TO authenticated
    USING (status = 'pending' AND expires_at > NOW());

-- stations
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view stations" ON public.stations;
CREATE POLICY "Staff can view stations" ON public.stations
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = stations.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- shifts
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view shifts" ON public.shifts;
CREATE POLICY "Staff can view shifts" ON public.shifts
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = shifts.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- time_entries
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view time_entries" ON public.time_entries;
CREATE POLICY "Staff can view time_entries" ON public.time_entries
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = time_entries.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- tip_pools
ALTER TABLE public.tip_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tip_pools FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view tip_pools" ON public.tip_pools;
CREATE POLICY "Staff can view tip_pools" ON public.tip_pools
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = tip_pools.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- tip_pool_shares
ALTER TABLE public.tip_pool_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tip_pool_shares FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view tip_pool_shares" ON public.tip_pool_shares;
CREATE POLICY "Staff can view tip_pool_shares" ON public.tip_pool_shares
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = tip_pool_shares.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- tip_allocations
ALTER TABLE public.tip_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tip_allocations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view tip_allocations" ON public.tip_allocations;
CREATE POLICY "Staff can view tip_allocations" ON public.tip_allocations
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = tip_allocations.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- delivery_partners
ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_partners FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view delivery_partners" ON public.delivery_partners;
CREATE POLICY "Staff can view delivery_partners" ON public.delivery_partners
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = delivery_partners.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- delivery_aggregator_configs
ALTER TABLE public.delivery_aggregator_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_aggregator_configs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view delivery_aggregator_configs" ON public.delivery_aggregator_configs;
CREATE POLICY "Staff can view delivery_aggregator_configs" ON public.delivery_aggregator_configs
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = delivery_aggregator_configs.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- external_orders
ALTER TABLE public.external_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view external_orders" ON public.external_orders;
CREATE POLICY "Staff can view external_orders" ON public.external_orders
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = external_orders.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- hardware_devices
ALTER TABLE public.hardware_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hardware_devices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view hardware_devices" ON public.hardware_devices;
CREATE POLICY "Staff can view hardware_devices" ON public.hardware_devices
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = hardware_devices.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- device_management_actions
ALTER TABLE public.device_management_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_management_actions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view device_management_actions" ON public.device_management_actions;
CREATE POLICY "Staff can view device_management_actions" ON public.device_management_actions
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = device_management_actions.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- device_tokens
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view device_tokens" ON public.device_tokens;
CREATE POLICY "Staff can view device_tokens" ON public.device_tokens
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = device_tokens.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- device_sync_status
ALTER TABLE public.device_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sync_status FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view device_sync_status" ON public.device_sync_status;
CREATE POLICY "Staff can view device_sync_status" ON public.device_sync_status
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = device_sync_status.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- push_tokens
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view push_tokens" ON public.push_tokens;
CREATE POLICY "Staff can view push_tokens" ON public.push_tokens
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = push_tokens.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- sync_idempotency_keys
ALTER TABLE public.sync_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_idempotency_keys FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view sync_idempotency_keys" ON public.sync_idempotency_keys;
CREATE POLICY "Staff can view sync_idempotency_keys" ON public.sync_idempotency_keys
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = sync_idempotency_keys.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- notification_logs
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view notification_logs" ON public.notification_logs;
CREATE POLICY "Staff can view notification_logs" ON public.notification_logs
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = notification_logs.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- notification_metrics
ALTER TABLE public.notification_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_metrics FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view notification_metrics" ON public.notification_metrics;
CREATE POLICY "Staff can view notification_metrics" ON public.notification_metrics
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = notification_metrics.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- alert_rules
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view alert_rules" ON public.alert_rules;
CREATE POLICY "Staff can view alert_rules" ON public.alert_rules
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = alert_rules.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- alert_events
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view alert_events" ON public.alert_events;
CREATE POLICY "Staff can view alert_events" ON public.alert_events
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = alert_events.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- upsell_analytics
ALTER TABLE public.upsell_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upsell_analytics FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view upsell_analytics" ON public.upsell_analytics;
CREATE POLICY "Staff can view upsell_analytics" ON public.upsell_analytics
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = upsell_analytics.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- centralized_menu_configs
ALTER TABLE public.centralized_menu_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centralized_menu_configs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view centralized_menu_configs" ON public.centralized_menu_configs;
CREATE POLICY "Staff can view centralized_menu_configs" ON public.centralized_menu_configs
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = centralized_menu_configs.primary_restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ) OR EXISTS (
        SELECT 1 FROM public.menu_location_links mll
        WHERE mll.menu_config_id = centralized_menu_configs.id
          AND EXISTS (
              SELECT 1 FROM public.restaurant_staff rs
              WHERE rs.user_id = (select auth.uid())
                AND rs.restaurant_id = mll.restaurant_id
                AND COALESCE(rs.is_active, true) = true
          )
    ));

-- menu_location_links
ALTER TABLE public.menu_location_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_location_links FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view menu_location_links" ON public.menu_location_links;
CREATE POLICY "Staff can view menu_location_links" ON public.menu_location_links
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = menu_location_links.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ) OR EXISTS (
        SELECT 1 FROM public.centralized_menu_configs cmc
        JOIN public.restaurant_staff rs ON rs.restaurant_id = cmc.primary_restaurant_id
        WHERE cmc.id = menu_location_links.menu_config_id
          AND rs.user_id = (select auth.uid())
          AND COALESCE(rs.is_active, true) = true
    ));

-- menu_change_queue
ALTER TABLE public.menu_change_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_change_queue FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view menu_change_queue" ON public.menu_change_queue;
CREATE POLICY "Staff can view menu_change_queue" ON public.menu_change_queue
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.centralized_menu_configs cmc
        JOIN public.restaurant_staff rs ON rs.restaurant_id = cmc.primary_restaurant_id
        WHERE cmc.id = menu_change_queue.menu_config_id
          AND rs.user_id = (select auth.uid())
          AND COALESCE(rs.is_active, true) = true
    ) OR EXISTS (
        SELECT 1 FROM public.menu_location_links mll
        JOIN public.restaurant_staff rs ON rs.restaurant_id = mll.restaurant_id
        WHERE mll.menu_config_id = menu_change_queue.menu_config_id
          AND rs.user_id = (select auth.uid())
          AND COALESCE(rs.is_active, true) = true
    ));

-- scheduled_reports
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reports FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view scheduled_reports" ON public.scheduled_reports;
CREATE POLICY "Staff can view scheduled_reports" ON public.scheduled_reports
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = scheduled_reports.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- report_executions
ALTER TABLE public.report_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_executions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view report_executions" ON public.report_executions;
CREATE POLICY "Staff can view report_executions" ON public.report_executions
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = report_executions.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- report_templates
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view report_templates" ON public.report_templates;
CREATE POLICY "Staff can view report_templates" ON public.report_templates
    FOR SELECT TO authenticated
    USING (
        is_system = true
        OR EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = (select auth.uid())
              AND rs.restaurant_id = report_templates.restaurant_id
              AND COALESCE(rs.is_active, true) = true
        )
    );

-- support_tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view support_tickets" ON public.support_tickets;
CREATE POLICY "Staff can view support_tickets" ON public.support_tickets
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = support_tickets.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- global_orders
ALTER TABLE public.global_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant can view global_orders" ON public.global_orders;
CREATE POLICY "Tenant can view global_orders" ON public.global_orders
    FOR SELECT TO authenticated
    USING (tenant_id IN (
        SELECT id FROM public.tenants WHERE is_active = true
    ));

-- system_health
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can view system_health" ON public.system_health;
CREATE POLICY "Service role can view system_health" ON public.system_health
    FOR SELECT TO authenticated
    USING (true);

-- system_health_monitor
ALTER TABLE public.system_health_monitor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can view system_health_monitor" ON public.system_health_monitor;
CREATE POLICY "Service role can view system_health_monitor" ON public.system_health_monitor
    FOR SELECT TO authenticated
    USING (true);

-- rate_limit_logs
ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can view rate_limit_logs" ON public.rate_limit_logs;
CREATE POLICY "Service role can view rate_limit_logs" ON public.rate_limit_logs
    FOR SELECT TO authenticated
    USING (true);

-- workflow_audit_logs
ALTER TABLE public.workflow_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can view workflow_audit_logs" ON public.workflow_audit_logs;
CREATE POLICY "Service role can view workflow_audit_logs" ON public.workflow_audit_logs
    FOR SELECT TO authenticated
    USING (true);

-- erca_submissions
ALTER TABLE public.erca_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erca_submissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view erca_submissions" ON public.erca_submissions;
CREATE POLICY "Staff can view erca_submissions" ON public.erca_submissions
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = erca_submissions.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- hourly_sales
ALTER TABLE public.hourly_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hourly_sales FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view hourly_sales" ON public.hourly_sales;
CREATE POLICY "Staff can view hourly_sales" ON public.hourly_sales
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = hourly_sales.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- daily_sales
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sales FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view daily_sales" ON public.daily_sales;
CREATE POLICY "Staff can view daily_sales" ON public.daily_sales
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.restaurant_staff rs
        WHERE rs.user_id = (select auth.uid())
          AND rs.restaurant_id = daily_sales.restaurant_id
          AND COALESCE(rs.is_active, true) = true
    ));

-- Ethiopian compliance tables
ALTER TABLE public.merchant_tax_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_tax_config FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view own tax config" ON public.merchant_tax_config;
CREATE POLICY "Staff view own tax config" ON public.merchant_tax_config
    FOR SELECT TO authenticated
    USING (restaurant_id IN (
        SELECT restaurant_id FROM public.restaurant_staff
        WHERE user_id = (select auth.uid())
    ));

ALTER TABLE public.merchant_vat_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_vat_ledger FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view own VAT ledger" ON public.merchant_vat_ledger;
CREATE POLICY "Staff view own VAT ledger" ON public.merchant_vat_ledger
    FOR SELECT TO authenticated
    USING (restaurant_id IN (
        SELECT restaurant_id FROM public.restaurant_staff
        WHERE user_id = (select auth.uid())
    ));

ALTER TABLE public.merchant_wht_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_wht_receipts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view own WHT receipts" ON public.merchant_wht_receipts;
CREATE POLICY "Staff view own WHT receipts" ON public.merchant_wht_receipts
    FOR SELECT TO authenticated
    USING (restaurant_id IN (
        SELECT restaurant_id FROM public.restaurant_staff
        WHERE user_id = (select auth.uid())
    ));

ALTER TABLE public.merchant_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_bank_accounts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view own bank accounts" ON public.merchant_bank_accounts;
CREATE POLICY "Staff view own bank accounts" ON public.merchant_bank_accounts
    FOR SELECT TO authenticated
    USING (restaurant_id IN (
        SELECT restaurant_id FROM public.restaurant_staff
        WHERE user_id = (select auth.uid())
    ));

ALTER TABLE public.merchant_fiscal_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_fiscal_days FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view own fiscal days" ON public.merchant_fiscal_days;
CREATE POLICY "Staff view own fiscal days" ON public.merchant_fiscal_days
    FOR SELECT TO authenticated
    USING (restaurant_id IN (
        SELECT restaurant_id FROM public.restaurant_staff
        WHERE user_id = (select auth.uid())
    ));

-- ==========================================================================
-- 7. Triggers (updated_at maintenance)
-- ==========================================================================

-- Core tables with updated_at
CREATE TRIGGER update_restaurants_modtime BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menu_items_modtime BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_modtime BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stations_modtime BEFORE UPDATE ON public.stations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discounts_modtime BEFORE UPDATE ON public.discounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_happy_hour_schedules_modtime BEFORE UPDATE ON public.happy_hour_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tip_pools_modtime BEFORE UPDATE ON public.tip_pools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_modifier_groups_modtime BEFORE UPDATE ON public.modifier_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tables using set_updated_at()
DROP TRIGGER IF EXISTS trg_tables_set_updated_at ON public.tables;
CREATE TRIGGER trg_tables_set_updated_at BEFORE UPDATE ON public.tables FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_table_sessions_set_updated_at ON public.table_sessions;
CREATE TRIGGER trg_table_sessions_set_updated_at BEFORE UPDATE ON public.table_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Ethiopian compliance trigger
DROP TRIGGER IF EXISTS trg_updated_at ON public.merchant_tax_config;
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.merchant_tax_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_updated_at ON public.merchant_vat_ledger;
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.merchant_vat_ledger FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_updated_at ON public.merchant_wht_receipts;
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.merchant_wht_receipts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trg_updated_at ON public.merchant_bank_accounts;
CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.merchant_bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================================================
-- 8. Views (security_invoker = on)
-- ==========================================================================

DROP VIEW IF EXISTS public.restaurant_staff_with_users;
CREATE VIEW public.restaurant_staff_with_users AS
SELECT
    rs.id,
    rs.user_id,
    rs.restaurant_id,
    rs.role,
    rs.is_active,
    rs.created_at,
    up.email,
    up.full_name,
    up.name,
    up.first_name,
    up.last_name
FROM public.restaurant_staff rs
LEFT JOIN public.user_profiles up ON rs.user_id = up.id;

ALTER VIEW public.restaurant_staff_with_users SET (security_invoker = on);

DROP VIEW IF EXISTS public.delivery_partner_integrations;
CREATE VIEW public.delivery_partner_integrations AS
SELECT
    dp.id,
    dp.restaurant_id,
    dp.provider,
    dp.display_name,
    CASE WHEN dp.api_key IS NOT NULL THEN substring(dp.api_key, 1, 8) || '...' ELSE NULL END AS api_key_masked,
    dp.status,
    dp.created_at,
    dp.updated_at
FROM public.delivery_partners dp;

ALTER VIEW public.delivery_partner_integrations SET (security_invoker = on);

-- active_* views for soft-delete filtering
DROP VIEW IF EXISTS public.active_menu_items;
CREATE VIEW public.active_menu_items AS
SELECT * FROM public.menu_items WHERE is_available = true;
ALTER VIEW public.active_menu_items SET (security_invoker = on);

DROP VIEW IF EXISTS public.active_restaurants;
CREATE VIEW public.active_restaurants AS
SELECT * FROM public.restaurants WHERE is_active = true;
ALTER VIEW public.active_restaurants SET (security_invoker = on);

DROP VIEW IF EXISTS public.active_tables;
CREATE VIEW public.active_tables AS
SELECT * FROM public.tables WHERE is_active = true;
ALTER VIEW public.active_tables SET (security_invoker = on);

DROP VIEW IF EXISTS public.active_restaurant_staff;
CREATE VIEW public.active_restaurant_staff AS
SELECT * FROM public.restaurant_staff WHERE is_active = true;
ALTER VIEW public.active_restaurant_staff SET (security_invoker = on);

-- Grants for views
GRANT SELECT ON public.restaurant_staff_with_users TO authenticated;
GRANT SELECT ON public.restaurant_staff_with_users TO service_role;
GRANT SELECT ON public.delivery_partner_integrations TO authenticated;
GRANT SELECT ON public.delivery_partner_integrations TO service_role;
GRANT SELECT ON public.active_menu_items TO authenticated;
GRANT SELECT ON public.active_menu_items TO service_role;
GRANT SELECT ON public.active_restaurants TO authenticated;
GRANT SELECT ON public.active_restaurants TO service_role;
GRANT SELECT ON public.active_tables TO authenticated;
GRANT SELECT ON public.active_tables TO service_role;
GRANT SELECT ON public.active_restaurant_staff TO authenticated;
GRANT SELECT ON public.active_restaurant_staff TO service_role;

-- Ethiopian compliance grants
GRANT SELECT ON public.merchant_tax_config TO authenticated;
GRANT SELECT ON public.merchant_vat_ledger TO authenticated;
GRANT SELECT ON public.merchant_wht_receipts TO authenticated;
GRANT SELECT ON public.merchant_bank_accounts TO authenticated;
GRANT SELECT ON public.merchant_fiscal_days TO authenticated;
GRANT ALL ON public.merchant_tax_config TO service_role;
GRANT ALL ON public.merchant_vat_ledger TO service_role;
GRANT ALL ON public.merchant_wht_receipts TO service_role;
GRANT ALL ON public.merchant_bank_accounts TO service_role;
GRANT ALL ON public.merchant_fiscal_days TO service_role;

-- ==========================================================================
-- 9. Utility Functions
-- ==========================================================================

-- birr_to_santim / santim_to_birr
CREATE OR REPLACE FUNCTION public.birr_to_santim(birr_value NUMERIC)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE
AS $$ SELECT (birr_value * 100)::INTEGER; $$;

CREATE OR REPLACE FUNCTION public.santim_to_birr(santim_value INTEGER)
RETURNS NUMERIC
LANGUAGE sql IMMUTABLE
AS $$ SELECT (santim_value::NUMERIC / 100.0); $$;

-- current_user_id
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$ SELECT (select auth.uid()); $$;

-- is_agency_admin
CREATE OR REPLACE FUNCTION public.is_agency_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.agency_users
        WHERE user_id = (select auth.uid()) AND role = 'admin'
    );
$$;

-- user_has_restaurant_access
CREATE OR REPLACE FUNCTION public.user_has_restaurant_access(p_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.restaurant_staff
        WHERE user_id = (select auth.uid())
          AND restaurant_id = p_restaurant_id
          AND COALESCE(is_active, true) = true
    );
$$;

-- get_my_staff_role
CREATE OR REPLACE FUNCTION public.get_my_staff_role(p_restaurant_id UUID DEFAULT NULL)
RETURNS TABLE(restaurant_id UUID, role TEXT)
LANGUAGE sql STABLE
AS $$
    SELECT restaurant_staff.restaurant_id, restaurant_staff.role
    FROM public.restaurant_staff
    WHERE user_id = (select auth.uid())
      AND COALESCE(is_active, true) = true
      AND (p_restaurant_id IS NULL OR restaurant_staff.restaurant_id = p_restaurant_id);
$$;

-- increment_likes
CREATE OR REPLACE FUNCTION public.increment_likes(item_id UUID, delta INTEGER DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.menu_items
    SET likes_count = COALESCE(likes_count, 0) + delta
    WHERE id = item_id;
END;
$$;

-- increment_pending_changes
CREATE OR REPLACE FUNCTION public.increment_pending_changes(p_restaurant_id UUID, p_menu_config_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.menu_location_links
    SET pending_changes = COALESCE(pending_changes, 0) + 1
    WHERE restaurant_id = p_restaurant_id
      AND menu_config_id = p_menu_config_id;
END;
$$;

-- mark_stale_devices_offline
CREATE OR REPLACE FUNCTION public.mark_stale_devices_offline()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.hardware_devices
    SET status = 'offline'
    WHERE status = 'online'
      AND last_active_at < NOW() - INTERVAL '5 minutes';
END;
$$;

-- complete_report_execution
CREATE OR REPLACE FUNCTION public.complete_report_execution(
    p_execution_id UUID,
    p_status TEXT,
    p_file_url TEXT DEFAULT NULL,
    p_file_size_bytes INTEGER DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.report_executions
    SET status = p_status,
        completed_at = NOW(),
        duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000,
        file_url = COALESCE(p_file_url, file_url),
        file_size_bytes = COALESCE(p_file_size_bytes, file_size_bytes),
        error_message = COALESCE(p_error_message, error_message)
    WHERE id = p_execution_id;
END;
$$;

COMMIT;

-- ==========================================================================
-- SUMMARY (provided for documentation)
-- ==========================================================================
-- Tables:             ~74 core tables + 5 compliance tables = 79 tables
-- RLS Policies:       ~90+ policies (SELECT/INSERT/UPDATE/DELETE per table)
-- Views:              6 views (all security_invoker=on)
-- Functions:          11 utility functions
-- Triggers:           ~15 updated_at triggers
-- Hypertables:        2 (hourly_sales, daily_sales)
-- Extensions:         2 (uuid-ossp, timescaledb)
-- ==========================================================================
