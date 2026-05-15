-- Phase 2 Architecture Alignment Migration
-- Date: 2026-02-04
-- Context: Aligning legacy 'items' schema to new 'menu_items' standard

-- 1. Restaurants Updates
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- 2. Rename 'items' to 'menu_items' (Standardization)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'items') THEN
        ALTER TABLE public.items RENAME TO menu_items;
    END IF;
END $$;

-- 3. Enhance menu_items
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS dietary_tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS station TEXT DEFAULT 'kitchen';
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS preparation_time_minutes INTEGER;

-- 4. Align Audit Logs
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_log') THEN
        ALTER TABLE public.audit_log RENAME TO audit_logs;
    END IF;
END $$;

-- 5. Orders Updates
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key UUID UNIQUE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- 6. Tables (QR Codes) - Ensure exists
CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_number TEXT NOT NULL,
    qr_code_url TEXT,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(restaurant_id, table_number),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Ensure RLS Policies on new/renamed tables
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 8. Public Access Policies (Re-apply)
DROP POLICY IF EXISTS "Public Read Active Restaurants" ON public.restaurants;
CREATE POLICY "Public Read Active Restaurants" ON public.restaurants FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public Read Menu" ON public.menu_items;
CREATE POLICY "Public Read Menu" ON public.menu_items FOR SELECT USING (is_available = true);

-- 9. Fix Foreign Keys (if items was renamed, FKs might need checking, but Postgres handles rename usually)
