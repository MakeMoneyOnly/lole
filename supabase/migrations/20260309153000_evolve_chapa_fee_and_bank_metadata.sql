BEGIN;

ALTER TABLE public.restaurants
    ADD COLUMN IF NOT EXISTS hosted_checkout_fee_percentage numeric(5,4),
    ADD COLUMN IF NOT EXISTS chapa_settlement_bank_name text;

UPDATE public.restaurants
SET
    hosted_checkout_fee_percentage = COALESCE(
        hosted_checkout_fee_percentage,
        platform_fee_percentage,
        0.03
    )
WHERE hosted_checkout_fee_percentage IS NULL;

ALTER TABLE public.restaurants
    ALTER COLUMN hosted_checkout_fee_percentage SET DEFAULT 0.03,
    ALTER COLUMN hosted_checkout_fee_percentage SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'restaurants_hosted_checkout_fee_percentage_check'
    ) THEN
        ALTER TABLE public.restaurants
            ADD CONSTRAINT restaurants_hosted_checkout_fee_percentage_check
            CHECK (hosted_checkout_fee_percentage >= 0 AND hosted_checkout_fee_percentage < 1);
    END IF;
END $$;

COMMENT ON COLUMN public.restaurants.platform_fee_percentage IS
    'Deprecated compatibility field. Use hosted_checkout_fee_percentage for Chapa-hosted guest checkout pricing.';

COMMENT ON COLUMN public.restaurants.hosted_checkout_fee_percentage IS
    'Current lole fee applied to Chapa-hosted guest checkout flows.';

COMMIT;
