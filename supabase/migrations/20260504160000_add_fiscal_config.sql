-- Add fiscal_config JSONB to restaurant_settings for per-restaurant tax configuration
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'restaurant_settings' AND column_name = 'fiscal_config'
    ) THEN
        ALTER TABLE public.restaurant_settings ADD COLUMN fiscal_config JSONB DEFAULT '{}';
    END IF;
END $$;

COMMENT ON COLUMN public.restaurant_settings.fiscal_config IS 'Per-restaurant fiscal configuration: vat_rate (default 0.15), withholding_tax_rate (default 0.02), fiscal_year_start, etc.';
