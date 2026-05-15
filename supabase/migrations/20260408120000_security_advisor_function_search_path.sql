-- ============================================================================
-- Migration: 20260408120000_security_advisor_function_search_path.sql
-- ============================================================================
--
-- Purpose: Add explicit SET search_path to SECURITY DEFINER functions that are
--          missing it, as flagged by the Supabase Security Advisor.
--
-- Background: The Supabase Security Advisor identified 18 SECURITY DEFINER
--             functions in the public schema without an explicit search_path,
--             making them vulnerable to search path injection attacks.
--
--             A prior migration (20260303195500_security_definer_hardening_stage4.sql)
--             already hardened 5 functions (bootstrap_merchant_for_auth_user,
--             check_merchant_item_updates, get_my_staff_role, is_agency_admin,
--             validate_item_update) by adding SET search_path = pg_catalog, public.
--             However, 18 functions created in later migrations were not covered
--             by that stage.
--
-- Approach: Uses pg_get_functiondef() to retrieve each function's full DDL,
--           then injects SET search_path = pg_catalog, public after the
--           SECURITY DEFINER clause. This preserves the exact function body
--           without needing to hardcode it, and is safe across future body
--           changes.
--
-- Functions targeted (18):
--   1.  log_price_override_audit
--   2.  mark_stale_devices_offline
--   3.  can_override_prices
--   4.  calculate_order_fire_times
--   5.  get_items_ready_to_fire
--   6.  soft_delete
--   7.  restore_deleted
--   8.  permanent_delete_old_records
--   9.  count_deleted_records
--   10. mark_item_fired
--   11. is_guest_unsubscribed
--   12. get_pending_scheduled_reports
--   13. can_create_order
--   14. increment_monthly_orders
--   15. check_and_use_price_change
--   16. get_remaining_price_changes
--   17. validate_required_modifiers
--   18. validate_order_modifiers
--
-- Safety guarantees:
--   - Only modifies functions that exist AND are SECURITY DEFINER
--   - Skips any function that already has search_path configured
--   - Uses CREATE OR REPLACE (idempotent)
--   - Function bodies are preserved exactly via pg_get_functiondef()
--   - Verification DO block at the end warns about any remaining unhardened
--     SECURITY DEFINER functions
--
-- Per AGENTS.md: "Set explicit search_path in security-sensitive functions
--                 (especially security definer)."
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- Step 1: Harden all 18 SECURITY DEFINER functions by adding search_path
-- --------------------------------------------------------------------------

DO $$
DECLARE
    fn_rec RECORD;
    fn_def TEXT;
    new_def TEXT;
BEGIN
    FOR fn_rec IN
        SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS fdef
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'log_price_override_audit',
              'mark_stale_devices_offline',
              'can_override_prices',
              'calculate_order_fire_times',
              'get_items_ready_to_fire',
              'soft_delete',
              'restore_deleted',
              'permanent_delete_old_records',
              'count_deleted_records',
              'mark_item_fired',
              'is_guest_unsubscribed',
              'get_pending_scheduled_reports',
              'can_create_order',
              'increment_monthly_orders',
              'check_and_use_price_change',
              'get_remaining_price_changes',
              'validate_required_modifiers',
              'validate_order_modifiers'
          )
          AND p.prosecdef = true
          AND (
              p.proconfig IS NULL
              OR NOT EXISTS (
                  SELECT 1 FROM unnest(p.proconfig) AS cfg WHERE cfg LIKE 'search_path=%'
              )
          )
    LOOP
        fn_def := fn_rec.fdef;

        -- Skip if search_path is already present (shouldn't happen due to
        -- the WHERE clause above, but defensive check)
        IF fn_def LIKE '%SET search_path%' THEN
            RAISE NOTICE 'Skipped (already has search_path): %', fn_rec.proname;
            CONTINUE;
        END IF;

        -- Insert SET search_path = pg_catalog, public after SECURITY DEFINER
        new_def := regexp_replace(
            fn_def,
            'SECURITY DEFINER',
            'SECURITY DEFINER SET search_path = pg_catalog, public',
            'i'
        );

        -- If the replacement didn't change anything, the function definition
        -- may use a different casing or format; warn and skip
        IF new_def = fn_def THEN
            RAISE WARNING
                'Could not inject search_path into function %. Manual review required.',
                fn_rec.proname;
            CONTINUE;
        END IF;

        EXECUTE new_def;

        RAISE NOTICE 'Hardened function: %', fn_rec.proname;
    END LOOP;
END $$;

-- --------------------------------------------------------------------------
-- Step 2: Verify no SECURITY DEFINER functions remain without search_path
-- --------------------------------------------------------------------------

DO $$
DECLARE
    missing_fn TEXT;
    missing_count INT := 0;
BEGIN
    FOR missing_fn IN
        SELECT p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef = true
          AND (
              p.proconfig IS NULL
              OR NOT EXISTS (
                  SELECT 1 FROM unnest(p.proconfig) AS cfg WHERE cfg LIKE 'search_path=%'
              )
          )
        ORDER BY p.proname
    LOOP
        RAISE WARNING 'SECURITY DEFINER function still missing search_path: %', missing_fn;
        missing_count := missing_count + 1;
    END LOOP;

    IF missing_count = 0 THEN
        RAISE NOTICE 'Verification passed: all public SECURITY DEFINER functions have search_path set.';
    ELSE
        RAISE WARNING 'Verification found % SECURITY DEFINER function(s) still missing search_path.', missing_count;
    END IF;
END $$;

COMMIT;
