-- Add per-item VAT exemption support for menu items
-- Some Ethiopian basic foodstuffs are VAT-exempt

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'menu_items' AND column_name = 'is_vat_exempt'
    ) THEN
        ALTER TABLE public.menu_items ADD COLUMN is_vat_exempt BOOLEAN DEFAULT false;
    END IF;
END $$;

COMMENT ON COLUMN public.menu_items.is_vat_exempt IS 'If true, this item is exempt from VAT (e.g., unprocessed injera, raw milk). VAT will not be calculated or reported for this item.';
