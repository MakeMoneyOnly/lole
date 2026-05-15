-- Migration: Add success column to audit_logs for service role audit tracking
-- This column tracks whether service role operations succeeded or failed
-- Part of P0 security audit requirements

BEGIN;

-- Add success column if it doesn't exist
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT true;

-- Add source column to track API endpoint/function source
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS source VARCHAR(255);

-- Add ip_address column for network-level tracking
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);

-- Add index for querying by success status
CREATE INDEX IF NOT EXISTS idx_audit_logs_success 
ON public.audit_logs(success) 
WHERE success IS NOT NULL;

-- Add index for querying by source
CREATE INDEX IF NOT EXISTS idx_audit_logs_source 
ON public.audit_logs(source, created_at DESC);

COMMIT;
