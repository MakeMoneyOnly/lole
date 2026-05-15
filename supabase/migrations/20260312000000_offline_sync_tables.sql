-- Migration: Create sync idempotency keys table
-- Purpose: Track processed sync operations to prevent duplicates
-- Created: 2026-03-12

-- Create sync idempotency keys table for offline sync
CREATE TABLE IF NOT EXISTS sync_idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT NOT NULL UNIQUE,
    operation_type TEXT NOT NULL,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    result_data JSONB DEFAULT '{}',
    version INTEGER DEFAULT 1,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast idempotency key lookups
CREATE INDEX IF NOT EXISTS idx_sync_idempotency_keys_idempotency 
ON sync_idempotency_keys(idempotency_key);

-- Index for restaurant queries
CREATE INDEX IF NOT EXISTS idx_sync_idempotency_keys_restaurant 
ON sync_idempotency_keys(restaurant_id, processed_at);

-- Enable RLS
ALTER TABLE sync_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Restaurant staff can read their restaurant's keys
CREATE POLICY "Restaurant staff can read sync idempotency keys"
ON sync_idempotency_keys FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM restaurant_staff
        WHERE restaurant_staff.user_id = auth.uid()
        AND restaurant_staff.restaurant_id = sync_idempotency_keys.restaurant_id
    )
);

-- RLS Policy: Restaurant staff can insert their restaurant's keys
CREATE POLICY "Restaurant staff can insert sync idempotency keys"
ON sync_idempotency_keys FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM restaurant_staff
        WHERE restaurant_staff.user_id = auth.uid()
        AND restaurant_staff.restaurant_id = sync_idempotency_keys.restaurant_id
    )
);

-- RLS Policy: Restaurant staff can update their restaurant's keys
CREATE POLICY "Restaurant staff can update sync idempotency keys"
ON sync_idempotency_keys FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM restaurant_staff
        WHERE restaurant_staff.user_id = auth.uid()
        AND restaurant_staff.restaurant_id = sync_idempotency_keys.restaurant_id
    )
);

-- Add idempotency_key column to orders if not exists (for offline sync)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE orders ADD COLUMN idempotency_key TEXT;
        CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key);
    END IF;
END $$;

-- Add idempotency_key column to payments if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE payments ADD COLUMN idempotency_key TEXT;
        CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key ON payments(idempotency_key);
    END IF;
END $$;

-- Add idempotency_key column to service_requests if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'service_requests' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE service_requests ADD COLUMN idempotency_key TEXT;
        CREATE INDEX IF NOT EXISTS idx_service_requests_idempotency_key ON service_requests(idempotency_key);
    END IF;
END $$;

-- Add idempotency_key column to kds_item_actions if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'kds_item_actions' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE kds_item_actions ADD COLUMN idempotency_key TEXT;
        CREATE INDEX IF NOT EXISTS idx_kds_item_actions_idempotency_key ON kds_item_actions(idempotency_key);
    END IF;
END $$;

COMMENT ON TABLE sync_idempotency_keys IS 'Tracks processed sync operations to prevent duplicates in offline-first scenarios';
