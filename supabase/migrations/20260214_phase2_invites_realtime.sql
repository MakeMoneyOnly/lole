-- Phase 2: Staff Invites & Realtime Configuration

-- 1. Staff Invites System
CREATE TABLE IF NOT EXISTS staff_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE, -- Secure token for the invite link
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'kitchen', 'waiter', 'bar')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT, -- Optional, to restricting invite to specific email
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_invites_code ON staff_invites(code);
CREATE INDEX IF NOT EXISTS idx_staff_invites_restaurant ON staff_invites(restaurant_id);

-- RLS for Invites
ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins/Managers can view invites" ON staff_invites;
CREATE POLICY "Admins/Managers can view invites" ON staff_invites FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM restaurant_staff s 
        WHERE s.user_id = auth.uid() 
        AND s.restaurant_id = staff_invites.restaurant_id 
        AND s.role IN ('owner', 'admin', 'manager')
    )
);

DROP POLICY IF EXISTS "Admins/Managers can create invites" ON staff_invites;
CREATE POLICY "Admins/Managers can create invites" ON staff_invites FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM restaurant_staff s 
        WHERE s.user_id = auth.uid() 
        AND s.restaurant_id = staff_invites.restaurant_id 
        AND s.role IN ('owner', 'admin', 'manager')
    )
);

DROP POLICY IF EXISTS "Admins/Managers can delete invites" ON staff_invites;
CREATE POLICY "Admins/Managers can delete invites" ON staff_invites FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM restaurant_staff s 
        WHERE s.user_id = auth.uid() 
        AND s.restaurant_id = staff_invites.restaurant_id 
        AND s.role IN ('owner', 'admin', 'manager')
    )
);

-- Public access to verify invite codes (needed for the join page)
DROP POLICY IF EXISTS "Public can check valid invites" ON staff_invites;
CREATE POLICY "Public can check valid invites" ON staff_invites FOR SELECT USING (
    status = 'pending' AND expires_at > NOW()
);

-- 2. Configure Realtime
-- Safely add tables to publication by checking if they are already added
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- orders
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    END IF;

    -- order_items
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'order_items') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
    END IF;

    -- tables
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tables') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE tables;
    END IF;

    -- menu_items
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'menu_items') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
    END IF;
END $$;
