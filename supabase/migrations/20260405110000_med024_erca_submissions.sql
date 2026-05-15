-- MED-024: ERCA Submissions Table
-- Stores audit trail of all ERCA invoice submissions for Ethiopian VAT compliance
-- Retention: 7 years minimum (Ethiopian law requirement)

-- Create erca_submissions table
CREATE TABLE IF NOT EXISTS erca_submissions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id         UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    order_id              UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    invoice_number        TEXT NOT NULL,
    vat_amount_santim     INTEGER,
    grand_total_santim    INTEGER,
    erca_invoice_id       TEXT,           -- ERCA's own reference ID on success
    qr_payload            TEXT,           -- QR code data for receipt
    digital_signature     TEXT,           -- Digital signature for receipt
    status                TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'success', 'failed', 'retry')),
    error_message         TEXT,
    retry_count           INTEGER DEFAULT 0,
    submitted_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (order_id)                     -- one submission record per order
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_erca_restaurant_date
    ON erca_submissions (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_erca_status
    ON erca_submissions (status) WHERE status IN ('failed', 'retry', 'pending');

CREATE INDEX IF NOT EXISTS idx_erca_submitted_at
    ON erca_submissions (submitted_at DESC) WHERE status = 'success';

-- Enable RLS
ALTER TABLE erca_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Staff can view submissions for their restaurant
CREATE POLICY "Staff can view ERCA submissions for their restaurant"
    ON erca_submissions FOR SELECT
    TO authenticated
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff
            WHERE user_id = auth.uid()
        )
    );

-- Service role has full access
CREATE POLICY "Service role has full access to ERCA submissions"
    ON erca_submissions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_erca_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER erca_submissions_updated_at
    BEFORE UPDATE ON erca_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_erca_submissions_updated_at();

-- Add retention policy comment
COMMENT ON TABLE erca_submissions IS 'ERCA invoice submission audit trail. Retention: 7 years minimum per Ethiopian VAT law.';

-- Grant appropriate permissions
GRANT SELECT ON erca_submissions TO authenticated;
GRANT ALL ON erca_submissions TO service_role;

-- Add columns to restaurants table for ERCA configuration if not exists
DO $$
BEGIN
    -- Add tin_number if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'restaurants' AND column_name = 'tin_number'
    ) THEN
        ALTER TABLE restaurants ADD COLUMN tin_number TEXT;
    END IF;

    -- Add vat_number if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'restaurants' AND column_name = 'vat_number'
    ) THEN
        ALTER TABLE restaurants ADD COLUMN vat_number TEXT;
    END IF;

    -- Add name_am (Amharic name) if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'restaurants' AND column_name = 'name_am'
    ) THEN
        ALTER TABLE restaurants ADD COLUMN name_am TEXT;
    END IF;
END $$;

-- Create index on vat_number for quick ERCA eligibility check
CREATE INDEX IF NOT EXISTS idx_restaurants_vat_number
    ON restaurants (vat_number) WHERE vat_number IS NOT NULL;
