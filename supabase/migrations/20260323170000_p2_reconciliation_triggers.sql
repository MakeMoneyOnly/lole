-- P2 Reconciliation Triggers
-- Date: 2026-03-23
-- Purpose: Automate reconciliation logic for payments based on Check.md blueprint
-- 
-- Functions:
-- 1. create_reconciliation_on_capture() - Auto-insert reconciliation entries when payment is captured
-- 2. reconcile_daily_payments() - Daily reconciliation for payments
-- 3. match_payments_to_payouts() - Match payments with expected payouts

BEGIN;

-- ============================================================
-- Function 1: Auto-insert reconciliation entries on payment capture
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_reconciliation_on_capture()
RETURNS TRIGGER AS $$
BEGIN
    -- Only execute when status changes TO 'captured'
    IF NEW.status = 'captured' AND (OLD.status IS NULL OR OLD.status != 'captured') THEN
        INSERT INTO public.reconciliation_entries (
            id,
            restaurant_id,
            source_type,
            source_id,
            ledger_type,
            ledger_id,
            expected_amount,
            settled_amount,
            delta_amount,
            status,
            metadata,
            created_at
        ) VALUES (
            gen_random_uuid(),
            NEW.restaurant_id,
            'payment',
            NEW.id,
            'gateway',
            COALESCE(NEW.provider_reference, NEW.provider || '-' || NEW.id::text),
            NEW.amount,
            NEW.amount,
            0,
            'matched',
            jsonb_build_object(
                'payment_method', NEW.method,
                'payment_provider', NEW.provider,
                'captured_at', NEW.captured_at
            ),
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_reconcile_payment ON public.payments;
CREATE TRIGGER trigger_reconcile_payment
    AFTER UPDATE OF status ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.create_reconciliation_on_capture();

-- ============================================================
-- Function 2: Daily reconciliation for payments
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconcile_daily_payments(
    p_restaurant_id UUID,
    p_reconciliation_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    id UUID,
    restaurant_id UUID,
    source_type TEXT,
    source_id UUID,
    expected_amount NUMERIC(14, 2),
    settled_amount NUMERIC(14, 2),
    delta_amount NUMERIC(14, 2),
    status TEXT
) AS $$
DECLARE
    v_period_start TIMESTAMPTZ;
    v_period_end TIMESTAMPTZ;
BEGIN
    -- Define the reconciliation period (previous day)
    v_period_start := p_reconciliation_date::TIMESTAMPTZ - INTERVAL '1 day';
    v_period_end := p_reconciliation_date::TIMESTAMPTZ;

    -- Return reconciliation results
    RETURN QUERY
    WITH payment_summary AS (
        SELECT
            p.restaurant_id,
            p.provider,
            p.method,
            COUNT(*) as payment_count,
            SUM(p.amount) as total_amount,
            SUM(p.tip_amount) as total_tips,
            SUM(p.amount + p.tip_amount) as settled_amount
        FROM public.payments p
        WHERE p.restaurant_id = p_restaurant_id
            AND p.status = 'captured'
            AND p.captured_at >= v_period_start
            AND p.captured_at < v_period_end
        GROUP BY p.restaurant_id, p.provider, p.method
    )
    SELECT
        gen_random_uuid() as id,
        ps.restaurant_id,
        'payment'::text as source_type,
        NULL::uuid as source_id,
        ps.settled_amount as expected_amount,
        ps.settled_amount as settled_amount,
        0::NUMERIC(14, 2) as delta_amount,
        CASE
            WHEN ps.settled_amount > 0 THEN 'matched'::text
            ELSE 'exception'::text
        END as status
    FROM payment_summary ps
    WHERE ps.settled_amount > 0;

    -- Also create reconciliation entries for unmatched days (no payments captured)
    -- This helps track days where no activity occurred
    INSERT INTO public.reconciliation_entries (
        id,
        restaurant_id,
        source_type,
        source_id,
        ledger_type,
        ledger_id,
        expected_amount,
        settled_amount,
        delta_amount,
        status,
        metadata,
        created_at
    )
    SELECT
        gen_random_uuid(),
        p_restaurant_id,
        'payment',
        NULL,
        'gateway',
        'daily-' || p_reconciliation_date::text,
        COALESCE(ps.settled_amount, 0),
        COALESCE(ps.settled_amount, 0),
        0,
        CASE WHEN ps.settled_amount IS NOT NULL AND ps.settled_amount > 0 THEN 'matched' ELSE 'exception' END,
        jsonb_build_object(
            'reconciliation_date', p_reconciliation_date,
            'period_start', v_period_start,
            'period_end', v_period_end,
            'payment_count', COALESCE(ps.payment_count, 0)
        ),
        NOW()
    FROM (
        SELECT
            SUM(p.amount + p.tip_amount) as settled_amount,
            COUNT(*) as payment_count
        FROM public.payments p
        WHERE p.restaurant_id = p_restaurant_id
            AND p.status = 'captured'
            AND p.captured_at >= v_period_start
            AND p.captured_at < v_period_end
    ) ps
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function 3: Match payments to payouts
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_payments_to_payouts(
    p_restaurant_id UUID,
    p_payout_id UUID DEFAULT NULL
)
RETURNS TABLE (
    payout_id UUID,
    payment_id UUID,
    matched_amount NUMERIC(14, 2),
    status TEXT
) AS $$
DECLARE
    v_payout_record RECORD;
    v_payments_total NUMERIC(14, 2);
    v_payout_net NUMERIC(14, 2);
    v_delta NUMERIC(14, 2);
BEGIN
    -- If no payout_id provided, process all pending payouts for the restaurant
    IF p_payout_id IS NULL THEN
        FOR v_payout_record IN
            SELECT id, period_start, period_end, net, status
            FROM public.payouts
            WHERE restaurant_id = p_restaurant_id
                AND status = 'pending'
            ORDER BY period_start DESC
        LOOP
            -- Calculate total payments in the payout period
            SELECT COALESCE(SUM(p.amount + p.tip_amount), 0)
            INTO v_payments_total
            FROM public.payments p
            WHERE p.restaurant_id = p_restaurant_id
                AND p.status = 'captured'
                AND p.captured_at >= v_payout_record.period_start
                AND p.captured_at < v_payout_record.period_end;

            v_payout_net := v_payout_record.net;
            v_delta := v_payments_total - v_payout_net;

            -- Create/update reconciliation entry for the payout
            INSERT INTO public.reconciliation_entries (
                id,
                restaurant_id,
                payout_id,
                source_type,
                source_id,
                ledger_type,
                ledger_id,
                expected_amount,
                settled_amount,
                delta_amount,
                status,
                metadata,
                created_at
            )
            VALUES (
                gen_random_uuid(),
                p_restaurant_id,
                v_payout_record.id,
                'payout',
                v_payout_record.id,
                'bank',
                'payout-' || v_payout_record.id::text,
                v_payout_net,
                v_payments_total,
                v_delta,
                CASE
                    WHEN ABS(v_delta) <= 0.01 THEN 'matched'
                    WHEN v_delta > 0 THEN 'exception' -- More payments than payout (underpayment)
                    ELSE 'exception' -- Less payments than payout (overpayment)
                END,
                jsonb_build_object(
                    'period_start', v_payout_record.period_start,
                    'period_end', v_payout_record.period_end,
                    'payments_total', v_payments_total,
                    'payout_net', v_payout_net
                ),
                NOW()
            )
            ON CONFLICT (payout_id) 
            WHERE payout_id IS NOT NULL
            DO UPDATE SET
                expected_amount = v_payout_net,
                settled_amount = v_payments_total,
                delta_amount = v_delta,
                status = CASE
                    WHEN ABS(v_delta) <= 0.01 THEN 'matched'
                    ELSE 'exception'
                END,
                metadata = jsonb_build_object(
                    'period_start', v_payout_record.period_start,
                    'period_end', v_payout_record.period_end,
                    'payments_total', v_payments_total,
                    'payout_net', v_payout_net,
                    'reconciled_at', NOW()
                ),
                updated_at = NOW();

            RETURN QUERY
            SELECT 
                v_payout_record.id,
                NULL::uuid,
                v_payments_total,
                CASE
                    WHEN ABS(v_delta) <= 0.01 THEN 'matched'
                    ELSE 'exception'
                END;
        END LOOP;
    ELSE
        -- Process specific payout
        SELECT id, period_start, period_end, net
        INTO v_payout_record
        FROM public.payouts
        WHERE id = p_payout_id;

        IF NOT FOUND THEN
            RETURN;
        END IF;

        SELECT COALESCE(SUM(p.amount + p.tip_amount), 0)
        INTO v_payments_total
        FROM public.payments p
        WHERE p.restaurant_id = p_restaurant_id
            AND p.status = 'captured'
            AND p.captured_at >= v_payout_record.period_start
            AND p.captured_at < v_payout_record.period_end;

        v_payout_net := v_payout_record.net;
        v_delta := v_payments_total - v_payout_net;

        INSERT INTO public.reconciliation_entries (
            id,
            restaurant_id,
            payout_id,
            source_type,
            source_id,
            ledger_type,
            ledger_id,
            expected_amount,
            settled_amount,
            delta_amount,
            status,
            metadata,
            created_at
        )
        VALUES (
            gen_random_uuid(),
            p_restaurant_id,
            p_payout_id,
            'payout',
            p_payout_id,
            'bank',
            'payout-' || p_payout_id::text,
            v_payout_net,
            v_payments_total,
            v_delta,
            CASE WHEN ABS(v_delta) <= 0.01 THEN 'matched' ELSE 'exception' END,
            jsonb_build_object(
                'period_start', v_payout_record.period_start,
                'period_end', v_payout_record.period_end,
                'payments_total', v_payments_total,
                'payout_net', v_payout_net
            ),
            NOW()
        )
        ON CONFLICT (payout_id) 
        WHERE payout_id IS NOT NULL
        DO UPDATE SET
            expected_amount = v_payout_net,
            settled_amount = v_payments_total,
            delta_amount = v_delta,
            status = CASE WHEN ABS(v_delta) <= 0.01 THEN 'matched' ELSE 'exception' END,
            updated_at = NOW();

        RETURN QUERY
        SELECT 
            p_payout_id,
            NULL::uuid,
            v_payments_total,
            CASE WHEN ABS(v_delta) <= 0.01 THEN 'matched' ELSE 'exception' END;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Indexes for reconciliation performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_reconciliation_entries_captured_at
    ON public.reconciliation_entries(created_at DESC)
    WHERE created_at >= NOW() - INTERVAL '90 days';

-- Comment for documentation
COMMENT ON FUNCTION public.create_reconciliation_on_capture() IS 
    'Trigger function: Creates reconciliation entry when payment status changes to captured';
COMMENT ON FUNCTION public.reconcile_daily_payments(UUID, DATE) IS 
    'Performs daily reconciliation for payments within a date range';
COMMENT ON FUNCTION public.match_payments_to_payouts(UUID, UUID) IS 
    'Matches payments to payouts and creates reconciliation entries for discrepancies';

COMMIT;