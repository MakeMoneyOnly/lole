-- Phase 1: Foundation & Authentication Schema Upgrades

-- 1. Tables Management
-- Create a dedicated table for managing physical tables and their unique QR states
-- Check if table exists, if so, we alter it. If not, we create it.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tables') THEN
        CREATE TABLE public.tables (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
            table_number TEXT NOT NULL,
            status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'bill_requested')),
            qr_code_url TEXT,
            active_order_id UUID, -- Link to current active session if needed
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(restaurant_id, table_number)
        );
    ELSE
        -- Add missing columns if table exists
        ALTER TABLE tables ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'bill_requested'));
        ALTER TABLE tables ADD COLUMN IF NOT EXISTS active_order_id UUID;
        ALTER TABLE tables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 2. Staff & Roles
-- Explicit mapping of users to restaurants with specific roles
CREATE TABLE IF NOT EXISTS restaurant_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'kitchen', 'waiter', 'bar')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, restaurant_id)
);

-- 3. Granular Order Items
-- Moving from JSON blob to relational items for precise KDS tracking (per-item status)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES menu_items(id), -- FIXED: Referenced menu_items instead of items
    name TEXT NOT NULL, -- Snapshot of name at time of order
    quantity INTEGER DEFAULT 1,
    price NUMERIC NOT NULL, -- Snapshot of price
    notes TEXT,
    modifiers JSONB, -- Array of strings or objects
    station TEXT DEFAULT 'kitchen', -- 'kitchen' or 'bar'
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'cooking', 'ready', 'served', 'void')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3b. Orders compatibility shape for API/KDS/runtime
-- Earlier baseline variants used table_id/total_amount only; runtime expects table_number/items/total_price.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS table_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_price NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS guest_fingerprint TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS kitchen_status TEXT DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bar_status TEXT DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Backfill compatibility values where legacy columns/data exist.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_amount'
    ) THEN
        UPDATE public.orders
        SET total_price = COALESCE(total_price, total_amount, 0)
        WHERE total_price IS NULL;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'table_id'
    ) THEN
        UPDATE public.orders o
        SET table_number = t.table_number
        FROM public.tables t
        WHERE o.table_id = t.id
          AND o.table_number IS NULL;
    END IF;
END $$;

UPDATE public.orders
SET table_number = 'unknown'
WHERE table_number IS NULL;

UPDATE public.orders
SET items = '[]'::jsonb
WHERE items IS NULL;

UPDATE public.orders
SET order_number = concat('ORD-', upper(substring(replace(id::text, '-', '') from 1 for 6)))
WHERE order_number IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);

-- 4. Indexes for Performance
-- Optimize KDS and Dashboard queries
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);
CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON tables(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_staff_user ON restaurant_staff(user_id);

-- 5. RLS Policies (Basic Setup)
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Allow public read of tables (for QR scanning)
DROP POLICY IF EXISTS "Public tables are viewable" ON tables;
CREATE POLICY "Public tables are viewable" ON tables FOR SELECT USING (true);

-- Allow staff to manage tables
DROP POLICY IF EXISTS "Staff can manage tables" ON tables;
CREATE POLICY "Staff can manage tables" ON tables FOR ALL USING (
    EXISTS (
        SELECT 1 FROM restaurant_staff 
        WHERE user_id = auth.uid() 
        AND restaurant_id = tables.restaurant_id
    )
);

-- Staff RLS
DROP POLICY IF EXISTS "Staff viewable by self or admin" ON restaurant_staff;
CREATE POLICY "Staff viewable by self or admin" ON restaurant_staff FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM restaurant_staff s 
        WHERE s.user_id = auth.uid() 
        AND s.restaurant_id = restaurant_staff.restaurant_id 
        AND s.role IN ('owner', 'admin', 'manager')
    )
);

-- Order Items RLS
DROP POLICY IF EXISTS "Order items viewable by public (guest) and staff" ON order_items;
CREATE POLICY "Order items viewable by public (guest) and staff" ON order_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff can update order items" ON order_items;
CREATE POLICY "Staff can update order items" ON order_items FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM orders o
        JOIN restaurant_staff s ON o.restaurant_id = s.restaurant_id
        WHERE o.id = order_items.order_id
        AND s.user_id = auth.uid()
    )
);
