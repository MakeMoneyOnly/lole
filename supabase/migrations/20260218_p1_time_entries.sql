-- P1 Team Operations: time entries
-- Date: 2026-02-18
-- Purpose: staff clock in/out tracking for shift accountability

BEGIN;

CREATE TABLE IF NOT EXISTS public.time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
    staff_id UUID NOT NULL REFERENCES public.restaurant_staff(id) ON DELETE CASCADE,
    clock_in_at TIMESTAMPTZ NOT NULL,
    clock_out_at TIMESTAMPTZ,
    source TEXT NOT NULL DEFAULT 'dashboard' CHECK (source IN ('dashboard', 'mobile', 'kiosk', 'api')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT time_entries_out_after_in CHECK (clock_out_at IS NULL OR clock_out_at >= clock_in_at)
);

CREATE INDEX IF NOT EXISTS idx_time_entries_restaurant_staff_clock_in
    ON public.time_entries(restaurant_id, staff_id, clock_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_time_entries_open_staff
    ON public.time_entries(restaurant_id, staff_id)
    WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_time_entries_shift
    ON public.time_entries(shift_id, clock_in_at DESC);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'set_updated_at'
    ) THEN
        DROP TRIGGER IF EXISTS trg_time_entries_set_updated_at ON public.time_entries;
        CREATE TRIGGER trg_time_entries_set_updated_at
            BEFORE UPDATE ON public.time_entries
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff can view time entries" ON public.time_entries;
CREATE POLICY "Tenant staff can view time entries"
    ON public.time_entries
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = time_entries.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1
            FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR time_entries.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
    );

DROP POLICY IF EXISTS "Tenant staff can manage time entries" ON public.time_entries;
CREATE POLICY "Tenant staff can manage time entries"
    ON public.time_entries
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = time_entries.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1
            FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR time_entries.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = time_entries.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1
            FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR time_entries.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
    );

COMMIT;
