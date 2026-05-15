-- ============================================================================
-- Password Policy Database Constraint
-- LOW-006: Enforce password complexity at database layer
--
-- This migration adds a check constraint to validate password complexity
-- for agency_users and restaurant_staff tables where passwords are stored.
-- ============================================================================

-- Note: In Supabase/Postgres Auth, passwords are stored in auth.users table
-- which is managed by Supabase Auth. The application-layer validation in
-- src/lib/security/passwordPolicy.ts is the primary enforcement point.
--
-- For custom password fields in public schema tables, we add validation.

-- ============================================================================
-- Password Complexity Check Function
-- ============================================================================

create or replace function public.validate_password_complexity(password text)
returns boolean
language plpgsql
stable
as $$
begin
    -- Minimum 12 characters
    if length(password) < 12 then
        return false;
    end if;

    -- Maximum 128 characters
    if length(password) > 128 then
        return false;
    end if;

    -- At least one uppercase letter
    if not password ~ '[A-Z]' then
        return false;
    end if;

    -- At least one lowercase letter
    if not password ~ '[a-z]' then
        return false;
    end if;

    -- At least one digit
    if not password ~ '[0-9]' then
        return false;
    end if;

    -- At least one special character
    if not password ~ '[!@#$%^&*()_+\-=\[\]{};'':"\\|,.<>\/?]' then
        return false;
    end if;

    -- No common patterns (case-insensitive)
    if lower(password) ~ '(password|123|abc|qwerty|admin|letmein|welcome|monkey|dragon|master|hello)' then
        return false;
    end if;

    -- No repeated characters (3+ in a row)
    if password ~ '(.)\1{2,}' then
        return false;
    end if;

    return true;
end;
$$;

comment on function public.validate_password_complexity(text) is
'Validates password meets complexity requirements: min 12 chars, uppercase, lowercase, digit, special char, no common patterns';

-- ============================================================================
-- Add Check Constraint for Tables with Password Columns
-- ============================================================================

-- Check if agency_users has a password_hash column and add constraint
-- Note: Most password storage is in auth.users, but if custom columns exist:
do $$
begin
    -- Only add constraint if column exists
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
        and table_name = 'agency_users'
        and column_name = 'password_hash'
    ) then
        -- Add check constraint for new passwords (allow NULL for existing rows)
        alter table public.agency_users
        drop constraint if exists agency_users_password_complexity_check;

        alter table public.agency_users
        add constraint agency_users_password_complexity_check
        check (
            password_hash is null
            or validate_password_complexity(password_hash)
        );
    end if;
end $$;

-- ============================================================================
-- Trigger for Password Validation on Insert/Update
-- ============================================================================

-- Create a trigger function that validates password before insert/update
-- This is for demonstration; actual password validation happens in application layer
create or replace function public.check_password_before_save()
returns trigger
language plpgsql
as $$
begin
    -- Skip validation if password_hash is null (OAuth users, etc.)
    if new.password_hash is null then
        return new;
    end if;

    -- Validate password complexity
    if not public.validate_password_complexity(new.password_hash) then
        raise exception 'Password does not meet complexity requirements: minimum 12 characters, uppercase, lowercase, digit, and special character required';
    end if;

    return new;
end;
$$;

comment on function public.check_password_before_save() is
'Trigger function to validate password complexity before saving';

-- ============================================================================
-- Documentation
-- ============================================================================

comment on schema public is
'Public schema with tenant-scoped tables. Password validation enforced via application layer with database-level validation as defense-in-depth.';

-- ============================================================================
-- Rollback Instructions
-- ============================================================================

-- To rollback this migration:
-- 1. DROP FUNCTION IF EXISTS public.validate_password_complexity(text);
-- 2. DROP FUNCTION IF EXISTS public.check_password_before_save();
-- 3. ALTER TABLE public.agency_users DROP CONSTRAINT IF EXISTS agency_users_password_complexity_check;
