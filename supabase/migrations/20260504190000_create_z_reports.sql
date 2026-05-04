-- Daily Z-Report storage for ERCA fiscal compliance
-- Stores generated daily VAT summaries for audit and retrieval

CREATE TABLE IF NOT EXISTS public.z_reports (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date             DATE NOT NULL,
    restaurant_count        INTEGER NOT NULL DEFAULT 0,
    total_invoices          INTEGER NOT NULL DEFAULT 0,
    total_revenue_santim    INTEGER NOT NULL DEFAULT 0,
    total_vat_santim        INTEGER NOT NULL DEFAULT 0,
    report_data             JSONB DEFAULT '[]',
    generated_at            TIMESTAMPTZ DEFAULT NOW(),
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_z_reports_date ON public.z_reports(report_date DESC);

ALTER TABLE public.z_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view z_reports for their restaurant"
    ON public.z_reports FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role has full access to z_reports"
    ON public.z_reports FOR ALL
    TO service_role
    USING (true) WITH CHECK (true);

GRANT SELECT ON public.z_reports TO authenticated;
GRANT ALL ON public.z_reports TO service_role;

COMMENT ON TABLE public.z_reports IS 'Daily Z-Report summaries for ERCA fiscal compliance. Generated automatically at EOD.';
