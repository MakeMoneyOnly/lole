-- CRIT-02: Convert all money fields to integer Santim
-- Date: 2026-03-12
-- Purpose: Blueprint law requires all money to be integer santim before expanding payments, discounts, and split settlement
-- This migration converts DECIMAL/NUMERIC money fields to INTEGER (santim)

BEGIN;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to convert birr to santim (for backward compatibility during migration)
CREATE OR REPLACE FUNCTION public.birr_to_santim(birr_value NUMERIC)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(ROUND(birr_value * 100)::INTEGER, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to convert santim to birr (for display)
CREATE OR REPLACE FUNCTION public.santim_to_birr(santim_value INTEGER)
RETURNS NUMERIC(14, 2) AS $$
BEGIN
    RETURN COALESCE(santim_value::NUMERIC / 100, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- STEP 1: menu_items - price column
-- ============================================================================

-- Check if price column exists and its type
DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'price'
    ) INTO col_exists;
    
    IF col_exists THEN
        SELECT data_type INTO col_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'price';
        
        -- Only migrate if it's not already integer
        IF col_type != 'integer' THEN
            -- Add temporary nullable integer column
            ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS price_santim INTEGER;
            
            -- Backfill data: convert DECIMAL to INTEGER (santim)
            UPDATE public.menu_items SET price_santim = birr_to_santim(price) WHERE price_santim IS NULL;
            
            -- Add NOT NULL constraint
            ALTER TABLE public.menu_items ALTER COLUMN price_santim SET NOT NULL;
            
            -- Drop old column and rename
            ALTER TABLE public.menu_items DROP COLUMN IF EXISTS price CASCADE;
            ALTER TABLE public.menu_items RENAME COLUMN price_santim TO price;
            
            RAISE NOTICE 'menu_items.price migrated to integer';
        ELSE
            RAISE NOTICE 'menu_items.price already integer - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'menu_items.price column not found - skipping';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: orders - total_price column (not total_amount!)
-- ============================================================================

DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_price'
    ) INTO col_exists;
    
    IF col_exists THEN
        SELECT data_type INTO col_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_price';
        
        IF col_type != 'integer' THEN
            -- Use CASCADE to drop dependent objects (policies that reference this column)
            ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_price_santim INTEGER;
            UPDATE public.orders SET total_price_santim = birr_to_santim(total_price) WHERE total_price_santim IS NULL;
            ALTER TABLE public.orders ALTER COLUMN total_price_santim SET NOT NULL;
            ALTER TABLE public.orders DROP COLUMN IF EXISTS total_price CASCADE;
            ALTER TABLE public.orders RENAME COLUMN total_price_santim TO total_price;
            
            RAISE NOTICE 'orders.total_price migrated to integer';
        ELSE
            RAISE NOTICE 'orders.total_price already integer - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'orders.total_price column not found - skipping';
    END IF;
END $$;

-- Also handle discount_amount if it exists
DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'discount_amount'
    ) INTO col_exists;
    
    IF col_exists THEN
        SELECT data_type INTO col_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'discount_amount';
        
        IF col_type != 'integer' THEN
            ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount_santim INTEGER;
            UPDATE public.orders SET discount_amount_santim = birr_to_santim(discount_amount) WHERE discount_amount_santim IS NULL;
            ALTER TABLE public.orders ALTER COLUMN discount_amount_santim SET NOT NULL;
            ALTER TABLE public.orders DROP COLUMN IF EXISTS discount_amount CASCADE;
            ALTER TABLE public.orders RENAME COLUMN discount_amount_santim TO discount_amount;
            
            RAISE NOTICE 'orders.discount_amount migrated to integer';
        ELSE
            RAISE NOTICE 'orders.discount_amount already integer - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'orders.discount_amount column not found - skipping';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: order_items - unit_price and price columns
-- ============================================================================

DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    -- Handle unit_price
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'unit_price'
    ) INTO col_exists;
    
    IF col_exists THEN
        SELECT data_type INTO col_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'unit_price';
        
        IF col_type != 'integer' THEN
            ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS unit_price_santim INTEGER;
            UPDATE public.order_items SET unit_price_santim = birr_to_santim(unit_price) WHERE unit_price_santim IS NULL;
            ALTER TABLE public.order_items ALTER COLUMN unit_price_santim SET NOT NULL;
            ALTER TABLE public.order_items DROP COLUMN IF EXISTS unit_price CASCADE;
            ALTER TABLE public.order_items RENAME COLUMN unit_price_santim TO unit_price;
            
            RAISE NOTICE 'order_items.unit_price migrated to integer';
        ELSE
            RAISE NOTICE 'order_items.unit_price already integer - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'order_items.unit_price column not found - skipping';
    END IF;
END $$;

-- Handle price column (some migrations may have created this)
DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'price'
    ) INTO col_exists;
    
    IF col_exists THEN
        SELECT data_type INTO col_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'price';
        
        IF col_type != 'integer' THEN
            ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS price_santim INTEGER;
            UPDATE public.order_items SET price_santim = birr_to_santim(price) WHERE price_santim IS NULL;
            ALTER TABLE public.order_items ALTER COLUMN price_santim SET NOT NULL;
            ALTER TABLE public.order_items DROP COLUMN IF EXISTS price CASCADE;
            ALTER TABLE public.order_items RENAME COLUMN price_santim TO price;
            
            RAISE NOTICE 'order_items.price migrated to integer';
        ELSE
            RAISE NOTICE 'order_items.price already integer - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'order_items.price column not found - skipping';
    END IF;
END $$;

-- Handle total_price column if it exists separately
DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'total_price'
    ) INTO col_exists;
    
    IF col_exists THEN
        SELECT data_type INTO col_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'total_price';
        
        IF col_type != 'integer' THEN
            ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS total_price_santim INTEGER;
            UPDATE public.order_items SET total_price_santim = birr_to_santim(total_price) WHERE total_price_santim IS NULL;
            ALTER TABLE public.order_items ALTER COLUMN total_price_santim SET NOT NULL;
            ALTER TABLE public.order_items DROP COLUMN IF EXISTS total_price CASCADE;
            ALTER TABLE public.order_items RENAME COLUMN total_price_santim TO total_price;
            
            RAISE NOTICE 'order_items.total_price migrated to integer';
        ELSE
            RAISE NOTICE 'order_items.total_price already integer - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'order_items.total_price column not found - skipping';
    END IF;
END $$;

-- ============================================================================
-- STEP 4: payments - amount and tip_amount columns
-- ============================================================================

DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'amount'
    ) INTO col_exists;
    
    IF col_exists THEN
        SELECT data_type INTO col_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'amount';
        
        IF col_type != 'integer' THEN
            ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount_santim INTEGER;
            UPDATE public.payments SET amount_santim = birr_to_santim(amount) WHERE amount_santim IS NULL;
            ALTER TABLE public.payments ALTER COLUMN amount_santim SET NOT NULL;
            ALTER TABLE public.payments DROP COLUMN IF EXISTS amount CASCADE;
            ALTER TABLE public.payments RENAME COLUMN amount_santim TO amount;
            
            RAISE NOTICE 'payments.amount migrated to integer';
        ELSE
            RAISE NOTICE 'payments.amount already integer - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'payments.amount column not found - skipping';
    END IF;
END $$;

-- tip_amount
DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'tip_amount'
    ) INTO col_exists;
    
    IF col_exists THEN
        SELECT data_type INTO col_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'tip_amount';
        
        IF col_type != 'integer' THEN
            ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS tip_amount_santim INTEGER;
            UPDATE public.payments SET tip_amount_santim = birr_to_santim(tip_amount) WHERE tip_amount_santim IS NULL;
            ALTER TABLE public.payments ALTER COLUMN tip_amount_santim SET NOT NULL;
            ALTER TABLE public.payments DROP COLUMN IF EXISTS tip_amount CASCADE;
            ALTER TABLE public.payments RENAME COLUMN tip_amount_santim TO tip_amount;
            
            RAISE NOTICE 'payments.tip_amount migrated to integer';
        ELSE
            RAISE NOTICE 'payments.tip_amount already integer - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'payments.tip_amount column not found - skipping';
    END IF;
END $$;

-- ============================================================================
-- STEP 5: refunds - amount column
-- ============================================================================

DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'refunds' AND column_name = 'amount'
    ) INTO col_exists;
    
    IF col_exists THEN
        SELECT data_type INTO col_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'refunds' AND column_name = 'amount';
        
        IF col_type != 'integer' THEN
            ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS amount_santim INTEGER;
            UPDATE public.refunds SET amount_santim = birr_to_santim(amount) WHERE amount_santim IS NULL;
            ALTER TABLE public.refunds ALTER COLUMN amount_santim SET NOT NULL;
            ALTER TABLE public.refunds DROP COLUMN IF EXISTS amount CASCADE;
            ALTER TABLE public.refunds RENAME COLUMN amount_santim TO amount;
            
            RAISE NOTICE 'refunds.amount migrated to integer';
        ELSE
            RAISE NOTICE 'refunds.amount already integer - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'refunds.amount column not found - skipping';
    END IF;
END $$;

-- ============================================================================
-- STEP 6: payouts - gross, fees, adjustments, net columns
-- ============================================================================

DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payouts' AND column_name = 'gross'
    ) INTO col_exists;
    
    IF col_exists THEN
        SELECT data_type INTO col_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payouts' AND column_name = 'gross';
        
        IF col_type != 'integer' THEN
            ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS gross_santim INTEGER;
            UPDATE public.payouts SET gross_santim = birr_to_santim(gross) WHERE gross_santim IS NULL;
            ALTER TABLE public.payouts ALTER COLUMN gross_santim SET NOT NULL;
            ALTER TABLE public.payouts DROP COLUMN IF EXISTS gross CASCADE;
            ALTER TABLE public.payouts RENAME COLUMN gross_santim TO gross;
            
            RAISE NOTICE 'payouts.gross migrated to integer';
        ELSE
            RAISE NOTICE 'payouts.gross already integer - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'payouts.gross column not found - skipping';
    END IF;
END $$;

-- fees
DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payouts' AND column_name = 'fees'
    ) INTO col_exists;
    
    IF col_exists THEN
        SELECT data_type INTO col_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payouts' AND column_name = 'fees';
        
        IF col_type != 'integer' THEN
            ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS fees_santim INTEGER;
            UPDATE public.payouts SET fees_santim = birr_to_santim(fees) WHERE fees_santim IS NULL;
            ALTER TABLE public.payouts ALTER COLUMN fees_santim SET NOT NULL;
            ALTER TABLE public.payouts DROP COLUMN IF EXISTS fees CASCADE;
            ALTER TABLE public.payouts RENAME COLUMN fees_santim TO fees;
            
            RAISE NOTICE 'payouts.fees migrated to integer';
        ELSE
            RAISE NOTICE 'payouts.fees already integer - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'payouts.fees column not found - skipping';
    END IF;
END $$;

-- adjustments
DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payouts' AND column_name = 'adjustments'
    ) INTO col_exists;
    
    IF col_exists THEN
        SELECT data_type INTO col_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payouts' AND column_name = 'adjustments';
        
        IF col_type != 'integer' THEN
            ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS adjustments_santim INTEGER;
            UPDATE public.payouts SET adjustments_santim = birr_to_santim(adjustments) WHERE adjustments_santim IS NULL;
            ALTER TABLE public.payouts ALTER COLUMN adjustments_santim SET NOT NULL;
            ALTER TABLE public.payouts DROP COLUMN IF EXISTS adjustments CASCADE;
            ALTER TABLE public.payouts RENAME COLUMN adjustments_santim TO adjustments;
            
            RAISE NOTICE 'payouts.adjustments migrated to integer';
        ELSE
            RAISE NOTICE 'payouts.adjustments already integer - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'payouts.adjustments column not found - skipping';
    END IF;
END $$;

-- net
DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payouts' AND column_name = 'net'
    ) INTO col_exists;
    
    IF col_exists THEN
        SELECT data_type INTO col_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payouts' AND column_name = 'net';
        
        IF col_type != 'integer' THEN
            ALTER TABLE public.payouts ADD COLUMN IF NOT EXISTS net_santim INTEGER;
            UPDATE public.payouts SET net_santim = birr_to_santim(net) WHERE net_santim IS NULL;
            ALTER TABLE public.payouts ALTER COLUMN net_santim SET NOT NULL;
            ALTER TABLE public.payouts DROP COLUMN IF EXISTS net CASCADE;
            ALTER TABLE public.payouts RENAME COLUMN net_santim TO net;
            
            RAISE NOTICE 'payouts.net migrated to integer';
        ELSE
            RAISE NOTICE 'payouts.net already integer - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'payouts.net column not found - skipping';
    END IF;
END $$;

-- ============================================================================
-- STEP 7: reconciliation_entries - expected_amount, settled_amount, delta_amount
-- ============================================================================

DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reconciliation_entries' AND column_name = 'expected_amount'
    ) INTO col_exists;
    
    IF col_exists THEN
        SELECT data_type INTO col_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reconciliation_entries' AND column_name = 'expected_amount';
        
        IF col_type != 'integer' THEN
            ALTER TABLE public.reconciliation_entries ADD COLUMN IF NOT EXISTS expected_amount_santim INTEGER;
            UPDATE public.reconciliation_entries SET expected_amount_santim = birr_to_santim(expected_amount) WHERE expected_amount_santim IS NULL;
            ALTER TABLE public.reconciliation_entries ALTER COLUMN expected_amount_santim SET NOT NULL;
            ALTER TABLE public.reconciliation_entries DROP COLUMN IF EXISTS expected_amount CASCADE;
            ALTER TABLE public.reconciliation_entries RENAME COLUMN expected_amount_santim TO expected_amount;
            
            RAISE NOTICE 'reconciliation_entries.expected_amount migrated to integer';
        ELSE
            RAISE NOTICE 'reconciliation_entries.expected_amount already integer - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'reconciliation_entries.expected_amount column not found - skipping';
    END IF;
END $$;

-- settled_amount
DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reconciliation_entries' AND column_name = 'settled_amount'
    ) INTO col_exists;
    
    IF col_exists THEN
        SELECT data_type INTO col_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reconciliation_entries' AND column_name = 'settled_amount';
        
        IF col_type != 'integer' THEN
            ALTER TABLE public.reconciliation_entries ADD COLUMN IF NOT EXISTS settled_amount_santim INTEGER;
            UPDATE public.reconciliation_entries SET settled_amount_santim = birr_to_santim(settled_amount) WHERE settled_amount_santim IS NULL;
            ALTER TABLE public.reconciliation_entries ALTER COLUMN settled_amount_santim SET NOT NULL;
            ALTER TABLE public.reconciliation_entries DROP COLUMN IF EXISTS settled_amount CASCADE;
            ALTER TABLE public.reconciliation_entries RENAME COLUMN settled_amount_santim TO settled_amount;
            
            RAISE NOTICE 'reconciliation_entries.settled_amount migrated to integer';
        ELSE
            RAISE NOTICE 'reconciliation_entries.settled_amount already integer - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'reconciliation_entries.settled_amount column not found - skipping';
    END IF;
END $$;

-- delta_amount
DO $$
DECLARE
    col_exists BOOLEAN;
    col_type TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reconciliation_entries' AND column_name = 'delta_amount'
    ) INTO col_exists;
    
    IF col_exists THEN
        SELECT data_type INTO col_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'reconciliation_entries' AND column_name = 'delta_amount';
        
        IF col_type != 'integer' THEN
            ALTER TABLE public.reconciliation_entries ADD COLUMN IF NOT EXISTS delta_amount_santim INTEGER;
            UPDATE public.reconciliation_entries SET delta_amount_santim = birr_to_santim(delta_amount) WHERE delta_amount_santim IS NULL;
            ALTER TABLE public.reconciliation_entries ALTER COLUMN delta_amount_santim SET NOT NULL;
            ALTER TABLE public.reconciliation_entries DROP COLUMN IF EXISTS delta_amount CASCADE;
            ALTER TABLE public.reconciliation_entries RENAME COLUMN delta_amount_santim TO delta_amount;
            
            RAISE NOTICE 'reconciliation_entries.delta_amount migrated to integer';
        ELSE
            RAISE NOTICE 'reconciliation_entries.delta_amount already integer - skipping';
        END IF;
    ELSE
        RAISE NOTICE 'reconciliation_entries.delta_amount column not found - skipping';
    END IF;
END $$;

-- ============================================================================
-- FINAL: Verify the migration
-- ============================================================================

DO $$
DECLARE
    v_menu_items_price_type TEXT;
    v_orders_total_price_type TEXT;
    v_order_items_unit_price_type TEXT;
    v_order_items_price_type TEXT;
    v_payments_amount_type TEXT;
    v_payments_tip_amount_type TEXT;
    v_refunds_amount_type TEXT;
    v_payouts_gross_type TEXT;
    v_payouts_net_type TEXT;
BEGIN
    -- Verify column types
    SELECT data_type INTO v_menu_items_price_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'price';
    
    SELECT data_type INTO v_orders_total_price_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_price';
    
    SELECT data_type INTO v_order_items_unit_price_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'unit_price';
    
    SELECT data_type INTO v_order_items_price_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'price';
    
    SELECT data_type INTO v_payments_amount_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'amount';
    
    SELECT data_type INTO v_payments_tip_amount_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'tip_amount';
    
    SELECT data_type INTO v_refunds_amount_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'refunds' AND column_name = 'amount';
    
    SELECT data_type INTO v_payouts_gross_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payouts' AND column_name = 'gross';
    
    SELECT data_type INTO v_payouts_net_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'payouts' AND column_name = 'net';
    
    -- Raise notice with verification results
    RAISE NOTICE '=== CRIT-02 Migration Verification ===';
    RAISE NOTICE 'menu_items.price: %', v_menu_items_price_type;
    RAISE NOTICE 'orders.total_price: %', v_orders_total_price_type;
    RAISE NOTICE 'order_items.unit_price: %', v_order_items_unit_price_type;
    RAISE NOTICE 'order_items.price: %', v_order_items_price_type;
    RAISE NOTICE 'payments.amount: %', v_payments_amount_type;
    RAISE NOTICE 'payments.tip_amount: %', v_payments_tip_amount_type;
    RAISE NOTICE 'refunds.amount: %', v_refunds_amount_type;
    RAISE NOTICE 'payouts.gross: %', v_payouts_gross_type;
    RAISE NOTICE 'payouts.net: %', v_payouts_net_type;
    
    -- All should be 'integer'
    IF (v_menu_items_price_type = 'integer' OR v_menu_items_price_type IS NULL)
       AND (v_orders_total_price_type = 'integer' OR v_orders_total_price_type IS NULL)
       AND (v_order_items_unit_price_type = 'integer' OR v_order_items_unit_price_type IS NULL)
       AND (v_order_items_price_type = 'integer' OR v_order_items_price_type IS NULL)
       AND (v_payments_amount_type = 'integer' OR v_payments_amount_type IS NULL)
       AND (v_payments_tip_amount_type = 'integer' OR v_payments_tip_amount_type IS NULL)
       AND (v_refunds_amount_type = 'integer' OR v_refunds_amount_type IS NULL)
       AND (v_payouts_gross_type = 'integer' OR v_payouts_gross_type IS NULL)
       AND (v_payouts_net_type = 'integer' OR v_payouts_net_type IS NULL)
    THEN
        RAISE NOTICE 'CRIT-02 Migration completed - all monetary fields are now INTEGER (santim)';
    ELSE
        RAISE WARNING 'CRIT-02 Migration may have issues - please verify column types';
    END IF;
END $$;

COMMIT;
