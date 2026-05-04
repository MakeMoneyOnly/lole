-- Add rounding audit column to erca_submissions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'erca_submissions' AND column_name = 'rounding_difference_santim'
    ) THEN
        ALTER TABLE public.erca_submissions ADD COLUMN rounding_difference_santim NUMERIC(10,2) DEFAULT 0;
    END IF;
END $$;

COMMENT ON COLUMN public.erca_submissions.rounding_difference_santim IS 'Cumulative rounding difference from VAT extraction, in santim (decimal). Audit trail for tax reconciliation.';
