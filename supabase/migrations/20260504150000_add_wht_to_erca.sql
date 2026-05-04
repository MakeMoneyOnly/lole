-- Add withholding tax (WHT) support to ERCA submissions
-- Ethiopian B2B transactions incur 2% withholding tax

-- Add column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'erca_submissions' AND column_name = 'withholding_tax_santim'
    ) THEN
        ALTER TABLE public.erca_submissions ADD COLUMN withholding_tax_santim INTEGER DEFAULT 0;
    END IF;
END $$;

COMMENT ON COLUMN public.erca_submissions.withholding_tax_santim IS '2% withholding tax for B2B transactions, in santim. Zero for B2C.';
