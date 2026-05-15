-- ============================================================================
-- Migration: 20260408140000_security_advisor_wrap_auth_uid.sql
-- ============================================================================
--
-- Purpose: Fix RLS policies using bare auth.uid() by wrapping in (select ...)
--          for query plan caching, as recommended by AGENTS.md and flagged
--          by the Supabase Security Advisor.
--
-- Background: RLS policies that call auth.uid() directly cause the function
--             to be evaluated once per row. Wrapping in (select auth.uid())
--             allows PostgreSQL to cache the result and evaluate it once per
--             query, significantly improving RLS policy performance.
--
-- Approach: Dynamic PL/pgSQL block that:
--   1. Iterates over all RLS policies in the public schema
--   2. Identifies policies where qual or with_check contains auth.uid()
--      but NOT (select auth.uid())
--   3. Drops and recreates those policies with (select auth.uid()) wrapping
--
-- Per AGENTS.md: "In RLS policies, wrap auth calls with select when safe to
--                 cache: (select auth.uid()), (select auth.jwt())."
-- ============================================================================

BEGIN;

DO $$
DECLARE
    pol_rec RECORD;
    new_qual TEXT;
    new_with_check TEXT;
    policy_cmd TEXT;
    policy_roles TEXT;
    needs_recreate BOOLEAN;
    qual_changed BOOLEAN;
    wc_changed BOOLEAN;
BEGIN
    FOR pol_rec IN
        SELECT
            schemaname,
            tablename,
            policyname,
            cmd,
            roles,
            qual,
            with_check
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        needs_recreate := false;
        qual_changed := false;
        wc_changed := false;
        new_qual := pol_rec.qual;
        new_with_check := pol_rec.with_check;

        -- Check qual (USING clause)
        IF new_qual IS NOT NULL AND new_qual != '' THEN
            -- Only replace if auth.uid() is present but NOT already wrapped
            -- Pattern: auth.uid() that is NOT preceded by "(select " or "select "
            IF new_qual LIKE '%auth.uid()%' 
               AND new_qual NOT LIKE '%(select auth.uid()%' 
               AND new_qual NOT LIKE '%select auth.uid()%'
            THEN
                new_qual := regexp_replace(
                    new_qual,
                    'auth\.uid\(\)',
                    '(select auth.uid())',
                    'g'
                );
                qual_changed := true;
                needs_recreate := true;
            END IF;
        END IF;

        -- Check with_check (WITH CHECK clause)
        IF new_with_check IS NOT NULL AND new_with_check != '' THEN
            IF new_with_check LIKE '%auth.uid()%' 
               AND new_with_check NOT LIKE '%(select auth.uid()%' 
               AND new_with_check NOT LIKE '%select auth.uid()%'
            THEN
                new_with_check := regexp_replace(
                    new_with_check,
                    'auth\.uid\(\)',
                    '(select auth.uid())',
                    'g'
                );
                wc_changed := true;
                needs_recreate := true;
            END IF;
        END IF;

        IF needs_recreate THEN
            -- Build the role list
            policy_roles := array_to_string(pol_rec.roles, ', ');

            -- Build CREATE POLICY statement based on command type
            CASE pol_rec.cmd
                WHEN 'SELECT' THEN
                    policy_cmd := format(
                        'DROP POLICY IF EXISTS %I ON %I.%I; CREATE POLICY %I ON %I.%I FOR SELECT TO %s USING (%s)',
                        pol_rec.policyname, pol_rec.schemaname, pol_rec.tablename,
                        pol_rec.policyname, pol_rec.schemaname, pol_rec.tablename,
                        policy_roles, new_qual
                    );
                WHEN 'INSERT' THEN
                    policy_cmd := format(
                        'DROP POLICY IF EXISTS %I ON %I.%I; CREATE POLICY %I ON %I.%I FOR INSERT TO %s WITH CHECK (%s)',
                        pol_rec.policyname, pol_rec.schemaname, pol_rec.tablename,
                        pol_rec.policyname, pol_rec.schemaname, pol_rec.tablename,
                        policy_roles, COALESCE(new_with_check, new_qual)
                    );
                WHEN 'UPDATE' THEN
                    policy_cmd := format(
                        'DROP POLICY IF EXISTS %I ON %I.%I; CREATE POLICY %I ON %I.%I FOR UPDATE TO %s USING (%s) WITH CHECK (%s)',
                        pol_rec.policyname, pol_rec.schemaname, pol_rec.tablename,
                        pol_rec.policyname, pol_rec.schemaname, pol_rec.tablename,
                        policy_roles, new_qual, COALESCE(new_with_check, new_qual)
                    );
                WHEN 'DELETE' THEN
                    policy_cmd := format(
                        'DROP POLICY IF EXISTS %I ON %I.%I; CREATE POLICY %I ON %I.%I FOR DELETE TO %s USING (%s)',
                        pol_rec.policyname, pol_rec.schemaname, pol_rec.tablename,
                        pol_rec.policyname, pol_rec.schemaname, pol_rec.tablename,
                        policy_roles, new_qual
                    );
                WHEN 'ALL' THEN
                    -- ALL policies need both USING and WITH CHECK
                    policy_cmd := format(
                        'DROP POLICY IF EXISTS %I ON %I.%I; CREATE POLICY %I ON %I.%I FOR ALL TO %s USING (%s) WITH CHECK (%s)',
                        pol_rec.policyname, pol_rec.schemaname, pol_rec.tablename,
                        pol_rec.policyname, pol_rec.schemaname, pol_rec.tablename,
                        policy_roles, new_qual, COALESCE(new_with_check, new_qual)
                    );
                ELSE
                    RAISE WARNING 'Unhandled policy command type: % for policy % on %', 
                        pol_rec.cmd, pol_rec.policyname, pol_rec.tablename;
                    CONTINUE;
            END CASE;

            BEGIN
                EXECUTE policy_cmd;
                RAISE NOTICE 'Wrapped auth.uid() in policy % on % (%)', 
                    pol_rec.policyname, pol_rec.tablename, pol_rec.cmd;
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'Failed to update policy % on %: %', 
                    pol_rec.policyname, pol_rec.tablename, SQLERRM;
            END;
        END IF;
    END LOOP;
END $$;

-- Verification: Check for remaining unwrapped auth.uid() calls
DO $$
DECLARE
    unwrapped_rec RECORD;
    unwrapped_count INT := 0;
BEGIN
    FOR unwrapped_rec IN
        SELECT tablename, policyname, cmd, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        AND (
            (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(select auth.uid()%' AND qual NOT LIKE '%select auth.uid()%')
            OR (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(select auth.uid()%' AND with_check NOT LIKE '%select auth.uid()%')
        )
    LOOP
        RAISE WARNING 'Policy still using unwrapped auth.uid(): % on % (%)',
            unwrapped_rec.policyname, unwrapped_rec.tablename, unwrapped_rec.cmd;
        unwrapped_count := unwrapped_count + 1;
    END LOOP;

    IF unwrapped_count = 0 THEN
        RAISE NOTICE 'Verification passed: all auth.uid() calls are wrapped in (select ...).';
    ELSE
        RAISE WARNING 'Verification found % polic(ies) still using unwrapped auth.uid().', unwrapped_count;
    END IF;
END $$;

COMMIT;
