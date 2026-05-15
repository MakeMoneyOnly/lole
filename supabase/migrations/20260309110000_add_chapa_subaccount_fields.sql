BEGIN;

-- Store Chapa split-settlement state per restaurant.
-- We keep only a masked account number for display/debug safety and rely on
-- onboarding retry to recollect the raw account details if provisioning fails.
ALTER TABLE public.restaurants
    ADD COLUMN IF NOT EXISTS chapa_subaccount_id text,
    ADD COLUMN IF NOT EXISTS chapa_subaccount_status text NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS chapa_subaccount_last_error text,
    ADD COLUMN IF NOT EXISTS chapa_subaccount_provisioned_at timestamptz,
    ADD COLUMN IF NOT EXISTS chapa_settlement_bank_code text,
    ADD COLUMN IF NOT EXISTS chapa_settlement_account_name text,
    ADD COLUMN IF NOT EXISTS chapa_settlement_account_number_masked text,
    ADD COLUMN IF NOT EXISTS platform_fee_percentage numeric(5,4) NOT NULL DEFAULT 0.03;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'restaurants_chapa_subaccount_status_check'
    ) THEN
        ALTER TABLE public.restaurants
            ADD CONSTRAINT restaurants_chapa_subaccount_status_check
            CHECK (
                chapa_subaccount_status IN ('pending', 'provisioning', 'active', 'failed', 'pending_review', 'verification_required', 'not_configured')
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'restaurants_platform_fee_percentage_check'
    ) THEN
        ALTER TABLE public.restaurants
            ADD CONSTRAINT restaurants_platform_fee_percentage_check
            CHECK (platform_fee_percentage >= 0 AND platform_fee_percentage < 1);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_chapa_subaccount_id_uidx
    ON public.restaurants (chapa_subaccount_id)
    WHERE chapa_subaccount_id IS NOT NULL;

COMMIT;
