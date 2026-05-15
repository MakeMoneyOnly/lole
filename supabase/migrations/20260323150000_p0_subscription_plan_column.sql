-- Subscription Plan Column for PRO Feature Gating
-- Date: 2026-03-23
-- Description: Add plan column to restaurants table for subscription/pro feature gating

-- 1. Add plan column with enum values
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
CHECK (plan IN ('free', 'pro', 'enterprise'));

-- 2. Add plan expiration date for subscription management
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;

-- 3. Add index for plan-based queries (e.g., finding all pro restaurants)
CREATE INDEX IF NOT EXISTS idx_restaurants_plan ON public.restaurants(plan);

-- 4. Add index for expiration queries (e.g., finding expired subscriptions)
CREATE INDEX IF NOT EXISTS idx_restaurants_plan_expires_at ON public.restaurants(plan_expires_at);

-- 5. Create a view for plan information (can be used by frontend)
CREATE OR REPLACE VIEW public.restaurant_plan_info AS
SELECT 
    id,
    slug,
    name,
    plan,
    plan_expires_at,
    CASE 
        WHEN plan = 'free' THEN false
        WHEN plan = 'pro' THEN true
        WHEN plan = 'enterprise' THEN true
        ELSE false
    END AS has_pro_features,
    CASE
        WHEN plan_expires_at IS NOT NULL AND plan_expires_at < NOW() THEN true
        ELSE false
    END AS is_plan_expired
FROM public.restaurants;

-- 6. Grant access to the view for authenticated users
GRANT SELECT ON public.restaurant_plan_info TO authenticated;
GRANT SELECT ON public.restaurant_plan_info TO anon;

-- 7. Add comment for documentation
COMMENT ON COLUMN public.restaurants.plan IS 'Subscription plan: free, pro, or enterprise';
COMMENT ON COLUMN public.restaurants.plan_expires_at IS 'When the current plan expires, null for unlimited';