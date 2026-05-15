BEGIN;

-- Fix onboarding issues:
-- 1. Add missing onboarding_completed column
-- 2. Fix chapa_subaccount_status constraint to include all status values

-- Add onboarding_completed column if it doesn't exist
ALTER TABLE public.restaurants
    ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Drop the existing constraint
ALTER TABLE public.restaurants
    DROP CONSTRAINT IF EXISTS restaurants_chapa_subaccount_status_check;

-- Add the updated constraint with all valid status values
ALTER TABLE public.restaurants
    ADD CONSTRAINT restaurants_chapa_subaccount_status_check
    CHECK (
        chapa_subaccount_status IN (
            'pending',
            'provisioning',
            'active',
            'failed',
            'pending_review',
            'verification_required',
            'not_configured'
        )
    );

-- Add index for onboarding_completed for faster queries
CREATE INDEX IF NOT EXISTS restaurants_onboarding_completed_idx
    ON public.restaurants (onboarding_completed)
    WHERE onboarding_completed = false;

COMMIT;