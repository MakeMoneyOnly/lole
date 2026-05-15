-- Fix User Deletion Cascade Issue
-- Date: 2026-02-19
-- Description: Fixes "Failed to delete user: Database error deleting user" by adding
--              ON DELETE SET NULL to foreign keys referencing auth.users that are missing it.
-- Reference: https://supabase.com/docs/guides/troubleshooting/dashboard-errors-when-managing-users-N1ls4A

BEGIN;

-- ============================================================================
-- Issue: When trying to delete a user from the Supabase Dashboard, the operation
-- fails because there are foreign key constraints from public schema tables to
-- auth.users that don't have ON DELETE CASCADE or ON DELETE SET NULL.
--
-- Solution: Add ON DELETE SET NULL to all foreign keys referencing auth.users
-- that are missing it. This allows user deletion while preserving audit trails.
-- ============================================================================

-- 1. Fix staff_invites.created_by - Missing ON DELETE clause
-- This was the primary cause of the user deletion error
DO $$
BEGIN
    -- Drop the existing constraint if it exists (without ON DELETE)
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = 'staff_invites'
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = 'created_by'
    ) THEN
        ALTER TABLE public.staff_invites
            DROP CONSTRAINT staff_invites_created_by_fkey;
    END IF;
END $$;

-- Add the constraint with ON DELETE SET NULL
ALTER TABLE public.staff_invites
    ADD CONSTRAINT staff_invites_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

-- 2. Verify all other auth.users references have proper ON DELETE clauses
-- The following tables already have correct constraints:
-- - restaurant_staff: ON DELETE CASCADE (correct - staff should be deleted with user)
-- - order_events.actor_user_id: ON DELETE SET NULL (correct - preserve audit trail)
-- - support_tickets.created_by: ON DELETE SET NULL (correct - preserve audit trail)

-- 3. Create a helper function to check for any future missing constraints
-- This can be used to audit the database for similar issues
CREATE OR REPLACE FUNCTION public.check_auth_users_fk_cascade()
RETURNS TABLE (
    table_name TEXT,
    column_name TEXT,
    constraint_name TEXT,
    has_cascade BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tc.table_name::TEXT,
        kcu.column_name::TEXT,
        tc.constraint_name::TEXT,
        CASE 
            WHEN rc.delete_rule IN ('CASCADE', 'SET NULL', 'SET DEFAULT') THEN true
            ELSE false
        END AS has_cascade
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
    WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.table_schema = 'public'
        AND rc.unique_constraint_schema = 'auth'
        AND rc.unique_constraint_name = 'users_pkey';
END;
$$;

COMMENT ON FUNCTION public.check_auth_users_fk_cascade() IS
    'Helper function to audit foreign keys referencing auth.users for proper ON DELETE clauses. Returns tables that reference auth.users and whether they have CASCADE/SET NULL/SET DEFAULT on delete.';

-- 4. Add documentation comment
COMMENT ON TABLE public.staff_invites IS
    'Staff invitation tokens for onboarding new team members. created_by is set to NULL when the inviting user is deleted.';

COMMIT;

-- ============================================================================
-- Post-migration verification
-- Run this query to verify all auth.users FKs have proper cascade:
-- SELECT * FROM public.check_auth_users_fk_cascade();
-- All rows should show has_cascade = true
-- ============================================================================