-- MED-024: Add erca_enabled column to restaurants
-- Allows per-restaurant opt-in for ERCA fiscal compliance
-- Complements existing vat_number column (which identifies VAT-registered restaurants)

-- Add erca_enabled column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'restaurants' AND column_name = 'erca_enabled'
    ) THEN
        ALTER TABLE public.restaurants ADD COLUMN erca_enabled BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Backfill: enable ERCA for restaurants that already have a VAT number
UPDATE public.restaurants
SET erca_enabled = true
WHERE vat_number IS NOT NULL AND erca_enabled IS DISTINCT FROM true;

COMMENT ON COLUMN public.restaurants.erca_enabled IS 'Whether ERCA e-invoicing is enabled for this restaurant. Requires valid vat_number.';
