-- P2 Centralized Menu Management
-- Date: 2026-04-03
-- Purpose: Support multi-location restaurants to manage menus centrally

BEGIN;

CREATE TABLE IF NOT EXISTS public.centralized_menu_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sync_categories BOOLEAN NOT NULL DEFAULT true,
    sync_items BOOLEAN NOT NULL DEFAULT true,
    sync_modifiers BOOLEAN NOT NULL DEFAULT true,
    sync_pricing BOOLEAN NOT NULL DEFAULT false,
    sync_availability BOOLEAN NOT NULL DEFAULT true,
    auto_sync_enabled BOOLEAN NOT NULL DEFAULT false,
    sync_schedule TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT centralized_menu_configs_primary_restaurant_unique UNIQUE (primary_restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_centralized_menu_configs_primary_restaurant
    ON public.centralized_menu_configs(primary_restaurant_id);

DROP TRIGGER IF EXISTS trg_centralized_menu_configs_set_updated_at ON public.centralized_menu_configs;
CREATE TRIGGER trg_centralized_menu_configs_set_updated_at
    BEFORE UPDATE ON public.centralized_menu_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.menu_location_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_config_id UUID NOT NULL REFERENCES public.centralized_menu_configs(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    sync_enabled BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'failed', 'partial')),
    pending_changes INTEGER NOT NULL DEFAULT 0 CHECK (pending_changes >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT menu_location_links_config_restaurant_unique UNIQUE (menu_config_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_menu_location_links_menu_config
    ON public.menu_location_links(menu_config_id);

CREATE INDEX IF NOT EXISTS idx_menu_location_links_restaurant
    ON public.menu_location_links(restaurant_id);

DROP TRIGGER IF EXISTS trg_menu_location_links_set_updated_at ON public.menu_location_links;
CREATE TRIGGER trg_menu_location_links_set_updated_at
    BEFORE UPDATE ON public.menu_location_links
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.menu_change_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_config_id UUID NOT NULL REFERENCES public.centralized_menu_configs(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete', 'price_change', 'availability_change')),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('category', 'menu_item', 'modifier_group', 'modifier_option')),
    entity_id UUID NOT NULL,
    location_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    change_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed')),
    applied_at TIMESTAMPTZ,
    applied_to UUID[] DEFAULT '{}'::uuid[],
    failed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_menu_change_queue_menu_config
    ON public.menu_change_queue(menu_config_id);

CREATE INDEX IF NOT EXISTS idx_menu_change_queue_status
    ON public.menu_change_queue(status)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_menu_change_queue_entity
    ON public.menu_change_queue(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_menu_change_queue_created_at
    ON public.menu_change_queue(created_at);

ALTER TABLE public.centralized_menu_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_location_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_change_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff can view centralized_menu_configs" ON public.centralized_menu_configs;
CREATE POLICY "Tenant staff can view centralized_menu_configs"
    ON public.centralized_menu_configs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = centralized_menu_configs.primary_restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR centralized_menu_configs.primary_restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
        OR EXISTS (
            SELECT 1 FROM public.menu_location_links mll
            WHERE mll.menu_config_id = centralized_menu_configs.id
                AND EXISTS (
                    SELECT 1 FROM public.restaurant_staff rs
                    WHERE rs.user_id = auth.uid()
                        AND rs.restaurant_id = mll.restaurant_id
                        AND COALESCE(rs.is_active, true) = true
                )
        )
    );

DROP POLICY IF EXISTS "Tenant staff can manage centralized_menu_configs" ON public.centralized_menu_configs;
CREATE POLICY "Tenant staff can manage centralized_menu_configs"
    ON public.centralized_menu_configs
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = centralized_menu_configs.primary_restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR centralized_menu_configs.primary_restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = centralized_menu_configs.primary_restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR centralized_menu_configs.primary_restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
    );

DROP POLICY IF EXISTS "Tenant staff can view menu_location_links" ON public.menu_location_links;
CREATE POLICY "Tenant staff can view menu_location_links"
    ON public.menu_location_links
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = menu_location_links.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR menu_location_links.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
        OR EXISTS (
            SELECT 1 FROM public.centralized_menu_configs cmc
            JOIN public.restaurant_staff rs ON rs.restaurant_id = cmc.primary_restaurant_id
            WHERE cmc.id = menu_location_links.menu_config_id
                AND rs.user_id = auth.uid()
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Tenant staff can manage menu_location_links" ON public.menu_location_links;
CREATE POLICY "Tenant staff can manage menu_location_links"
    ON public.menu_location_links
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = menu_location_links.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR menu_location_links.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
        OR EXISTS (
            SELECT 1 FROM public.centralized_menu_configs cmc
            JOIN public.restaurant_staff rs ON rs.restaurant_id = cmc.primary_restaurant_id
            WHERE cmc.id = menu_location_links.menu_config_id
                AND rs.user_id = auth.uid()
                AND COALESCE(rs.is_active, true) = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.restaurant_staff rs
            WHERE rs.user_id = auth.uid()
                AND rs.restaurant_id = menu_location_links.restaurant_id
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR menu_location_links.restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                )
        )
        OR EXISTS (
            SELECT 1 FROM public.centralized_menu_configs cmc
            JOIN public.restaurant_staff rs ON rs.restaurant_id = cmc.primary_restaurant_id
            WHERE cmc.id = menu_location_links.menu_config_id
                AND rs.user_id = auth.uid()
                AND COALESCE(rs.is_active, true) = true
        )
    );

DROP POLICY IF EXISTS "Tenant staff can view menu_change_queue" ON public.menu_change_queue;
CREATE POLICY "Tenant staff can view menu_change_queue"
    ON public.menu_change_queue
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.centralized_menu_configs cmc
            JOIN public.restaurant_staff rs ON rs.restaurant_id = cmc.primary_restaurant_id
            WHERE cmc.id = menu_change_queue.menu_config_id
                AND rs.user_id = auth.uid()
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR EXISTS (
                        SELECT 1 FROM public.centralized_menu_configs cmc
                        WHERE cmc.id = menu_change_queue.menu_config_id
                            AND cmc.primary_restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                    )
                )
        )
    );

DROP POLICY IF EXISTS "Tenant staff can manage menu_change_queue" ON public.menu_change_queue;
CREATE POLICY "Tenant staff can manage menu_change_queue"
    ON public.menu_change_queue
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.centralized_menu_configs cmc
            JOIN public.restaurant_staff rs ON rs.restaurant_id = cmc.primary_restaurant_id
            WHERE cmc.id = menu_change_queue.menu_config_id
                AND rs.user_id = auth.uid()
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR EXISTS (
                        SELECT 1 FROM public.centralized_menu_configs cmc
                        WHERE cmc.id = menu_change_queue.menu_config_id
                            AND cmc.primary_restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                    )
                )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.centralized_menu_configs cmc
            JOIN public.restaurant_staff rs ON rs.restaurant_id = cmc.primary_restaurant_id
            WHERE cmc.id = menu_change_queue.menu_config_id
                AND rs.user_id = auth.uid()
                AND COALESCE(rs.is_active, true) = true
        )
        OR EXISTS (
            SELECT 1 FROM public.agency_users au
            WHERE au.user_id = auth.uid()
                AND (
                    au.role = 'admin'
                    OR EXISTS (
                        SELECT 1 FROM public.centralized_menu_configs cmc
                        WHERE cmc.id = menu_change_queue.menu_config_id
                            AND cmc.primary_restaurant_id = ANY (COALESCE(au.restaurant_ids, ARRAY[]::uuid[]))
                    )
                )
        )
    );

CREATE OR REPLACE FUNCTION public.increment_pending_changes(
    p_restaurant_id UUID,
    p_menu_config_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.menu_location_links
    SET pending_changes = pending_changes + 1,
        updated_at = NOW()
    WHERE restaurant_id = p_restaurant_id
        AND menu_config_id = p_menu_config_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_pending_changes(UUID, UUID) TO authenticated;

COMMENT ON TABLE public.centralized_menu_configs IS 'Configuration for centralized menu management across multiple restaurant locations';
COMMENT ON TABLE public.menu_location_links IS 'Links between centralized menu configs and restaurant locations';
COMMENT ON TABLE public.menu_change_queue IS 'Queue of pending menu changes to be synced to locations';
COMMENT ON FUNCTION public.increment_pending_changes(UUID, UUID) IS 'Increment pending_changes counter for a menu location link';

COMMIT;
