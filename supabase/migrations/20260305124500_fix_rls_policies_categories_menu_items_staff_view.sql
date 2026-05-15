-- =============================================================================
-- FIX: RLS Policy remediation for categories, menu_items
-- 
-- Problem 1: "Public can view categories" only grants SELECT to {anon}.
--   Authenticated guests (who logged in via the splash screen) can't see categories.
-- Problem 2: "Public can view all items" only grants SELECT to {anon}.
--   Same issue for menu_items.
-- Problem 3: "Staff View All" on menu_items only checks agency_users, 
--   NOT restaurant_staff. Dashboard merchants in restaurant_staff see 0 items.
--
-- Fix: Make public read policies apply to BOTH anon and authenticated roles,
--   and fix "Staff View All" to also check restaurant_staff.
-- =============================================================================

-- ── Fix 1: categories public read → anon + authenticated ────────────────────
DROP POLICY IF EXISTS "Public can view categories" ON public.categories;

CREATE POLICY "Public can view categories"
ON public.categories
FOR SELECT
TO anon, authenticated
USING (true);

-- ── Fix 2: menu_items public read → anon + authenticated ────────────────────
DROP POLICY IF EXISTS "Public can view all items" ON public.menu_items;

CREATE POLICY "Public can view all items"
ON public.menu_items
FOR SELECT
TO anon, authenticated
USING (true);

-- ── Fix 3: "Staff View All" should also check restaurant_staff ──────────────
-- This policy is for authenticated SELECT; it MUST cover restaurant_staff users
-- (the dashboard merchant path), not only agency_users.
DROP POLICY IF EXISTS "Staff View All" ON public.menu_items;

CREATE POLICY "Staff View All"
ON public.menu_items
FOR SELECT
TO authenticated
USING (
  -- Path A: User is restaurant staff for the item's category's restaurant
  EXISTS (
    SELECT 1
    FROM public.categories c
    JOIN public.restaurant_staff rs ON rs.restaurant_id = c.restaurant_id
    WHERE c.id = menu_items.category_id
      AND rs.user_id = (SELECT auth.uid())
      AND rs.is_active = true
  )
  -- Path B: User is agency admin or assigned to the restaurant via agency
  OR EXISTS (
    SELECT 1
    FROM public.agency_users au
    JOIN public.categories c ON c.id = menu_items.category_id
    WHERE au.user_id = (SELECT auth.uid())
      AND (c.restaurant_id = ANY(au.restaurant_ids) OR au.role = 'admin')
  )
);
