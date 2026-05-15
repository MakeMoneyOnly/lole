BEGIN;

-- Shared payment orchestration layer across guest QR, online ordering, waiter POS,
-- and terminal settlement. `payments` remains the ledger/attempt record while
-- `payment_sessions` tracks the lifecycle and provider routing state.
CREATE TABLE IF NOT EXISTS public.payment_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    order_id uuid NULL REFERENCES public.orders(id) ON DELETE SET NULL,
    surface text NOT NULL CHECK (
        surface IN ('guest_qr', 'online_order', 'waiter_pos', 'terminal')
    ),
    channel text NOT NULL CHECK (
        channel IN ('dine_in', 'pickup', 'delivery', 'online')
    ),
    intent_type text NOT NULL CHECK (
        intent_type IN (
            'pay_now',
            'pay_later',
            'waiter_close_out',
            'staff_recorded',
            'assisted_digital'
        )
    ),
    status text NOT NULL CHECK (
        status IN (
            'created',
            'awaiting_method',
            'pending_provider',
            'authorized',
            'captured',
            'failed',
            'cancelled',
            'expired'
        )
    ),
    selected_method text NULL,
    selected_provider text NULL,
    amount numeric(12, 2) NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'ETB',
    checkout_url text NULL,
    provider_transaction_id text NULL,
    provider_reference text NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    authorized_at timestamptz NULL,
    captured_at timestamptz NULL,
    expires_at timestamptz NULL,
    created_by uuid NULL,
    created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS payment_sessions_restaurant_status_idx
    ON public.payment_sessions (restaurant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_sessions_order_idx
    ON public.payment_sessions (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_sessions_provider_tx_idx
    ON public.payment_sessions (selected_provider, provider_transaction_id);

ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_sessions FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'payment_sessions'
            AND policyname = 'payment_sessions_restaurant_staff_select'
    ) THEN
        CREATE POLICY payment_sessions_restaurant_staff_select
            ON public.payment_sessions
            FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.restaurant_staff rs
                    WHERE rs.restaurant_id = payment_sessions.restaurant_id
                        AND rs.user_id = (select auth.uid())
                        AND rs.is_active = true
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'payment_sessions'
            AND policyname = 'payment_sessions_restaurant_staff_insert'
    ) THEN
        CREATE POLICY payment_sessions_restaurant_staff_insert
            ON public.payment_sessions
            FOR INSERT
            TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1
                    FROM public.restaurant_staff rs
                    WHERE rs.restaurant_id = payment_sessions.restaurant_id
                        AND rs.user_id = (select auth.uid())
                        AND rs.is_active = true
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'payment_sessions'
            AND policyname = 'payment_sessions_restaurant_staff_update'
    ) THEN
        CREATE POLICY payment_sessions_restaurant_staff_update
            ON public.payment_sessions
            FOR UPDATE
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.restaurant_staff rs
                    WHERE rs.restaurant_id = payment_sessions.restaurant_id
                        AND rs.user_id = (select auth.uid())
                        AND rs.is_active = true
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1
                    FROM public.restaurant_staff rs
                    WHERE rs.restaurant_id = payment_sessions.restaurant_id
                        AND rs.user_id = (select auth.uid())
                        AND rs.is_active = true
                )
            );
    END IF;
END $$;

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS payment_session_id uuid NULL REFERENCES public.payment_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payments_payment_session_id_idx
    ON public.payments (payment_session_id);

COMMIT;
