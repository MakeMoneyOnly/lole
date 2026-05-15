-- =========================================================
-- Enhanced Loyalty Features Migration
-- P1 features: Visit-Based Rewards, Tiered Loyalty, Birthday Rewards
-- =========================================================

-- Add tier column to loyalty_accounts if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'loyalty_accounts' 
        AND column_name = 'tier'
    ) THEN
        ALTER TABLE loyalty_accounts ADD COLUMN tier text NOT NULL DEFAULT 'bronze';
    END IF;
END $$;

-- Add total_visits column to loyalty_accounts if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'loyalty_accounts' 
        AND column_name = 'total_visits'
    ) THEN
        ALTER TABLE loyalty_accounts ADD COLUMN total_visits integer NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add total_points_earned column to loyalty_accounts if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'loyalty_accounts' 
        AND column_name = 'total_points_earned'
    ) THEN
        ALTER TABLE loyalty_accounts ADD COLUMN total_points_earned integer NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add last_visit_at column to loyalty_accounts if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'loyalty_accounts' 
        AND column_name = 'last_visit_at'
    ) THEN
        ALTER TABLE loyalty_accounts ADD COLUMN last_visit_at timestamptz;
    END IF;
END $$;

-- =========================================================
-- Guest Rewards Table (for visit rewards, birthday rewards, etc.)
-- =========================================================

CREATE TABLE IF NOT EXISTS guest_rewards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    
    -- Reward details
    name text NOT NULL,
    reward_type text NOT NULL CHECK (reward_type IN ('points', 'percentage_discount', 'fixed_discount', 'free_item')),
    reward_value numeric NOT NULL,
    reward_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL,
    
    -- Source tracking
    source text NOT NULL CHECK (source IN ('visit_milestone', 'birthday', 'tier_upgrade', 'campaign', 'manual', 'referral')),
    source_metadata jsonb DEFAULT '{}',
    
    -- Status
    status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'redeemed', 'expired', 'cancelled')),
    
    -- Redemption tracking
    redeemed_at timestamptz,
    order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
    
    -- Expiration
    expires_at timestamptz,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT valid_reward_value CHECK (reward_value > 0)
);

-- Indexes for guest_rewards
CREATE INDEX IF NOT EXISTS idx_guest_rewards_restaurant_guest ON guest_rewards(restaurant_id, guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_rewards_status ON guest_rewards(status) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_guest_rewards_expires ON guest_rewards(expires_at) WHERE status = 'available';

-- Enable RLS
ALTER TABLE guest_rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Staff can manage rewards
CREATE POLICY "staff_can_manage_guest_rewards" ON guest_rewards
    FOR ALL
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- RLS Policy: Guests can view their own rewards
CREATE POLICY "guests_can_view_own_rewards" ON guest_rewards
    FOR SELECT
    USING (
        guest_id IN (
            SELECT id FROM guests WHERE user_id = auth.uid()
        )
    );

-- =========================================================
-- Guest Visits Table (for visit tracking)
-- =========================================================

-- Check if guest_visits already exists
CREATE TABLE IF NOT EXISTS guest_visits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
    
    -- Visit details
    visit_number integer NOT NULL,
    amount_spent numeric NOT NULL DEFAULT 0,
    visited_at timestamptz NOT NULL DEFAULT now(),
    
    -- Metadata
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Unique constraint: one visit per order
    UNIQUE(restaurant_id, guest_id, order_id)
);

-- Indexes for guest_visits
CREATE INDEX IF NOT EXISTS idx_guest_visits_restaurant_guest ON guest_visits(restaurant_id, guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_visits_visited_at ON guest_visits(visited_at DESC);

-- Enable RLS
ALTER TABLE guest_visits ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Staff can view visits
CREATE POLICY "staff_can_view_guest_visits" ON guest_visits
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- =========================================================
-- Add birthday column to guests if not exists
-- =========================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'guests' 
        AND column_name = 'birthday'
    ) THEN
        ALTER TABLE guests ADD COLUMN birthday date;
    END IF;
END $$;

-- =========================================================
-- Update loyalty_transactions to support new types
-- =========================================================

-- Add check constraint for transaction_type if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'loyalty_transactions_transaction_type_check'
    ) THEN
        ALTER TABLE loyalty_transactions DROP CONSTRAINT IF EXISTS loyalty_transactions_transaction_type_check;
        ALTER TABLE loyalty_transactions ADD CONSTRAINT loyalty_transactions_transaction_type_check
            CHECK (transaction_type IN (
                'earn', 'redeem', 'adjustment_credit', 'adjustment_debit',
                'visit_reward', 'birthday_bonus', 'tier_upgrade', 'referral_bonus', 'expired'
            ));
    END IF;
END $$;

-- =========================================================
-- Function to automatically process birthday rewards
-- =========================================================

CREATE OR REPLACE FUNCTION process_guest_birthday_reward(
    p_restaurant_id uuid,
    p_guest_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_guest RECORD;
    v_account RECORD;
    v_birthday date;
    v_today date := CURRENT_DATE;
    v_days_until integer;
    v_bonus_points integer := 100;
    v_discount_pct integer := 10;
    v_reward_id uuid;
    v_result jsonb;
BEGIN
    -- Get guest with birthday
    SELECT id, birthday INTO v_guest
    FROM guests
    WHERE id = p_guest_id AND restaurant_id = p_restaurant_id;
    
    IF NOT FOUND OR v_guest.birthday IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'no_birthday');
    END IF;
    
    -- Calculate days until birthday
    v_birthday := make_date(
        extract(year from v_today)::int,
        extract(month from v_guest.birthday)::int,
        extract(day from v_guest.birthday)::int
    );
    
    IF v_birthday < v_today THEN
        v_birthday := make_date(
            extract(year from v_today)::int + 1,
            extract(month from v_guest.birthday)::int,
            extract(day from v_guest.birthday)::int
        );
    END IF;
    
    v_days_until := (v_birthday - v_today);
    
    -- Check if within birthday window (7 days before to 7 days after)
    IF v_days_until > 7 OR v_days_until < -7 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'outside_window');
    END IF;
    
    -- Check if already given this year
    IF EXISTS (
        SELECT 1 FROM guest_rewards
        WHERE guest_id = p_guest_id
        AND restaurant_id = p_restaurant_id
        AND source = 'birthday'
        AND created_at >= date_trunc('year', v_today)
    ) THEN
        RETURN jsonb_build_object('success', false, 'reason', 'already_given');
    END IF;
    
    -- Get loyalty account for tier multiplier
    SELECT id, points_balance, tier INTO v_account
    FROM loyalty_accounts
    WHERE guest_id = p_guest_id AND restaurant_id = p_restaurant_id;
    
    -- Apply tier multiplier to bonus
    IF v_account.tier = 'silver' THEN
        v_bonus_points := 125;
        v_discount_pct := 12;
    ELSIF v_account.tier = 'gold' THEN
        v_bonus_points := 150;
        v_discount_pct := 15;
    ELSIF v_account.tier = 'platinum' THEN
        v_bonus_points := 200;
        v_discount_pct := 20;
    END IF;
    
    -- Create reward
    INSERT INTO guest_rewards (
        restaurant_id, guest_id, name, reward_type, reward_value,
        source, expires_at, status
    ) VALUES (
        p_restaurant_id, p_guest_id, 
        'Birthday ' || v_discount_pct || '% Off',
        'percentage_discount', v_discount_pct,
        'birthday',
        v_birthday + interval '7 days',
        'available'
    ) RETURNING id INTO v_reward_id;
    
    -- Add bonus points if account exists
    IF v_account.id IS NOT NULL THEN
        UPDATE loyalty_accounts
        SET points_balance = points_balance + v_bonus_points,
            total_points_earned = total_points_earned + v_bonus_points
        WHERE id = v_account.id;
        
        INSERT INTO loyalty_transactions (
            restaurant_id, account_id, points_delta, balance_after,
            transaction_type, reason, metadata
        ) VALUES (
            p_restaurant_id, v_account.id, v_bonus_points,
            (SELECT points_balance FROM loyalty_accounts WHERE id = v_account.id),
            'birthday_bonus',
            'Birthday bonus (' || v_account.tier || ' tier)',
            jsonb_build_object('tier', v_account.tier, 'reward_id', v_reward_id)
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'reward_id', v_reward_id,
        'bonus_points', v_bonus_points,
        'discount_pct', v_discount_pct
    );
END;
$$;

-- =========================================================
-- Function to record visit and check for rewards
-- =========================================================

CREATE OR REPLACE FUNCTION record_guest_visit_and_check_rewards(
    p_restaurant_id uuid,
    p_guest_id uuid,
    p_order_id uuid,
    p_order_total numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account RECORD;
    v_visit_count integer;
    v_new_visit_count integer;
    v_rewards_earned jsonb := '[]'::jsonb;
    v_visit_reward RECORD;
    v_tier text;
    v_new_tier text;
BEGIN
    -- Get or create loyalty account
    SELECT id, points_balance, tier, total_visits INTO v_account
    FROM loyalty_accounts
    WHERE guest_id = p_guest_id AND restaurant_id = p_restaurant_id;
    
    IF NOT FOUND THEN
        INSERT INTO loyalty_accounts (
            restaurant_id, guest_id, points_balance, tier, total_visits, total_points_earned, status
        ) VALUES (
            p_restaurant_id, p_guest_id, 0, 'bronze', 0, 0, 'active'
        ) RETURNING id, points_balance, tier, total_visits INTO v_account;
    END IF;
    
    -- Check if visit already recorded
    IF EXISTS (
        SELECT 1 FROM guest_visits
        WHERE guest_id = p_guest_id AND order_id = p_order_id
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'reason', 'already_recorded',
            'visit_count', v_account.total_visits
        );
    END IF;
    
    -- Record the visit
    v_new_visit_count := COALESCE(v_account.total_visits, 0) + 1;
    
    INSERT INTO guest_visits (
        restaurant_id, guest_id, order_id, visit_number, amount_spent
    ) VALUES (
        p_restaurant_id, p_guest_id, p_order_id, v_new_visit_count, p_order_total
    );
    
    -- Update account
    UPDATE loyalty_accounts
    SET total_visits = v_new_visit_count,
        last_visit_at = now()
    WHERE id = v_account.id;
    
    -- Check for visit milestone rewards
    FOR v_visit_reward IN
        SELECT * FROM (
            VALUES
                (5, 'points', 50, '5 Visit Bonus'),
                (10, 'percentage_discount', 10, '10 Visit 10% Off'),
                (25, 'points', 200, '25 Visit Milestone'),
                (50, 'percentage_discount', 20, '50 Visit 20% Off')
        ) AS t(visits_required, reward_type, reward_value, name)
        WHERE visits_required = v_new_visit_count
    LOOP
        -- Create reward
        IF v_visit_reward.reward_type = 'points' THEN
            UPDATE loyalty_accounts
            SET points_balance = points_balance + v_visit_reward.reward_value,
                total_points_earned = total_points_earned + v_visit_reward.reward_value
            WHERE id = v_account.id;
            
            INSERT INTO loyalty_transactions (
                restaurant_id, account_id, points_delta, balance_after,
                transaction_type, reason, metadata
            ) VALUES (
                p_restaurant_id, v_account.id, v_visit_reward.reward_value,
                (SELECT points_balance FROM loyalty_accounts WHERE id = v_account.id),
                'visit_reward', v_visit_reward.name,
                jsonb_build_object('visit_number', v_new_visit_count)
            );
        ELSE
            INSERT INTO guest_rewards (
                restaurant_id, guest_id, name, reward_type, reward_value,
                source, source_metadata, expires_at, status
            ) VALUES (
                p_restaurant_id, p_guest_id, v_visit_reward.name,
                v_visit_reward.reward_type, v_visit_reward.reward_value,
                'visit_milestone',
                jsonb_build_object('visit_number', v_new_visit_count),
                now() + interval '30 days',
                'available'
            );
        END IF;
        
        v_rewards_earned := v_rewards_earned || jsonb_build_object(
            'name', v_visit_reward.name,
            'type', v_visit_reward.reward_type,
            'value', v_visit_reward.reward_value
        );
    END LOOP;
    
    -- Check for tier upgrade
    v_new_tier := CASE
        WHEN v_new_visit_count >= 75 OR (SELECT points_balance FROM loyalty_accounts WHERE id = v_account.id) >= 5000 THEN 'platinum'
        WHEN v_new_visit_count >= 30 OR (SELECT points_balance FROM loyalty_accounts WHERE id = v_account.id) >= 1500 THEN 'gold'
        WHEN v_new_visit_count >= 10 OR (SELECT points_balance FROM loyalty_accounts WHERE id = v_account.id) >= 500 THEN 'silver'
        ELSE 'bronze'
    END;
    
    IF v_new_tier != v_account.tier THEN
        UPDATE loyalty_accounts SET tier = v_new_tier WHERE id = v_account.id;
        
        INSERT INTO loyalty_transactions (
            restaurant_id, account_id, points_delta, balance_after,
            transaction_type, reason, metadata
        ) VALUES (
            p_restaurant_id, v_account.id, 0,
            (SELECT points_balance FROM loyalty_accounts WHERE id = v_account.id),
            'tier_upgrade', 'Upgraded to ' || v_new_tier,
            jsonb_build_object('old_tier', v_account.tier, 'new_tier', v_new_tier)
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'visit_count', v_new_visit_count,
        'rewards_earned', v_rewards_earned,
        'tier', v_new_tier,
        'tier_changed', v_new_tier != v_account.tier
    );
END;
$$;

-- =========================================================
-- Comments
-- =========================================================

COMMENT ON TABLE guest_rewards IS 'Rewards earned by guests through visits, birthdays, tier upgrades, etc.';
COMMENT ON TABLE guest_visits IS 'Tracks each guest visit for loyalty calculations';
COMMENT ON FUNCTION process_guest_birthday_reward IS 'Automatically creates birthday rewards for eligible guests';
COMMENT ON FUNCTION record_guest_visit_and_check_rewards IS 'Records a visit and checks for milestone rewards';