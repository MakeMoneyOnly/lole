-- 7-year retention enforcement for ERCA submissions
-- Ethiopian VAT law requires 7-year retention of all fiscal records.
-- Prevents accidental or malicious deletion of records within the retention window.

-- Create trigger function
CREATE OR REPLACE FUNCTION prevent_erca_submission_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow deletion of records older than 7 years
    IF OLD.created_at < NOW() - INTERVAL '7 years' THEN
        RETURN OLD;
    END IF;

    -- Block deletion of records within 7-year window
    RAISE EXCEPTION 'Cannot delete ERCA submission %: record is within mandatory 7-year retention period per Ethiopian VAT law. Created: %. Retention until: %',
        OLD.id,
        OLD.created_at,
        OLD.created_at + INTERVAL '7 years';
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS trg_erca_submissions_retention ON public.erca_submissions;
CREATE TRIGGER trg_erca_submissions_retention
    BEFORE DELETE ON public.erca_submissions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_erca_submission_deletion();

-- Also apply to erca_submissions_archive if it exists (for historical consistency)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'erca_submissions_archive'
    ) THEN
        DROP TRIGGER IF EXISTS trg_erca_submissions_archive_retention ON public.erca_submissions_archive;
        CREATE TRIGGER trg_erca_submissions_archive_retention
            BEFORE DELETE ON public.erca_submissions_archive
            FOR EACH ROW
            EXECUTE FUNCTION prevent_erca_submission_deletion();
    END IF;
END $$;
