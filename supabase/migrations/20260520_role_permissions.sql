-- Role Permissions Configuration Table
-- Date: 2026-05-20
-- Description: Externalizes role permissions to database configuration for OCP compliance.
--              Allows new roles and permissions to be added via database without code changes.

BEGIN;

-- Create role_permissions table for storing role -> permission mappings
CREATE TABLE public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    permission TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index on role column for efficient lookups
CREATE INDEX idx_role_permissions_role ON public.role_permissions(role);

-- Add unique constraint to prevent duplicate role-permission pairs
CREATE UNIQUE INDEX idx_role_permissions_unique ON public.role_permissions(role, permission);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_role_permissions_updated_at
    BEFORE UPDATE ON public.role_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default permissions for existing roles
-- owner gets all permissions
INSERT INTO public.role_permissions (role, permission) VALUES
    ('owner', 'all');

-- admin permissions
INSERT INTO public.role_permissions (role, permission) VALUES
    ('admin', 'staff:read'),
    ('admin', 'staff:write'),
    ('admin', 'orders:read'),
    ('admin', 'orders:write'),
    ('admin', 'menu:read'),
    ('admin', 'menu:write'),
    ('admin', 'reports:read');

-- manager permissions (same as admin)
INSERT INTO public.role_permissions (role, permission) VALUES
    ('manager', 'staff:read'),
    ('manager', 'staff:write'),
    ('manager', 'orders:read'),
    ('manager', 'orders:write'),
    ('manager', 'menu:read'),
    ('manager', 'menu:write'),
    ('manager', 'reports:read');

-- kitchen permissions
INSERT INTO public.role_permissions (role, permission) VALUES
    ('kitchen', 'orders:read'),
    ('kitchen', 'orders:update:status');

-- waiter permissions
INSERT INTO public.role_permissions (role, permission) VALUES
    ('waiter', 'orders:read'),
    ('waiter', 'orders:create'),
    ('waiter', 'orders:update');

-- bar permissions
INSERT INTO public.role_permissions (role, permission) VALUES
    ('bar', 'orders:read'),
    ('bar', 'orders:update:status');

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies - allow authenticated users to read role permissions
CREATE POLICY "role_permissions_select_policy"
    ON public.role_permissions
    FOR SELECT
    TO authenticated
    USING (true);

-- Only service role can modify permissions
CREATE POLICY "role_permissions_modify_policy"
    ON public.role_permissions
    FOR ALL
    TO service_role
    USING (true);

-- Grant permissions
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

COMMIT;