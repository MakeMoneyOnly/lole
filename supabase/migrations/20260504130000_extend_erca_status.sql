-- Extend erca_submissions status CHECK to include pending_fiscalization
-- for stub submissions that were not actually submitted to live ERCA

DO $$
BEGIN
    -- Drop existing constraint
    ALTER TABLE public.erca_submissions DROP CONSTRAINT IF EXISTS erca_submissions_status_check;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.erca_submissions ADD CONSTRAINT erca_submissions_status_check
    CHECK (status IN ('pending', 'success', 'failed', 'retry', 'pending_fiscalization'));

-- Backfill: mark stub records (those with 'Stub mode' error) as pending_fiscalization
-- only if they are currently marked as 'success'
UPDATE public.erca_submissions
SET status = 'pending_fiscalization'
WHERE status = 'success'
  AND error_message LIKE 'Stub mode%';
