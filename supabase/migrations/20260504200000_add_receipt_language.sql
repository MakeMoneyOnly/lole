-- Add receipt language preference to restaurant_settings
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'restaurant_settings' AND column_name = 'receipt_language'
    ) THEN
        ALTER TABLE public.restaurant_settings ADD COLUMN receipt_language TEXT DEFAULT 'en' CHECK (receipt_language IN ('en', 'am'));
    END IF;
END $$;

COMMENT ON COLUMN public.restaurant_settings.receipt_language IS 'Receipt language: en (English) or am (Amharic). ERCA requires Amharic invoices for local businesses.';
