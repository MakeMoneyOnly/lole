/**
 * GET /api/device/menu
 * Device-authenticated endpoint for POS/KDS to fetch categories + menu items.
 * Requires X-Device-Token header.
 */
import { apiError, apiSuccess } from '@/lib/api/response';
import { getDeviceContext } from '@/lib/api/authz';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET(request: Request) {
    const ctx = await getDeviceContext(request);
    if (!ctx.ok) return ctx.response;

    const admin = createServiceRoleClient();

    const { data, error } = await admin
        .from('categories')
        .select('*, items:menu_items(*)')
        .eq('restaurant_id', ctx.restaurantId)
        .order('order_index');

    if (error) {
        return apiError('Failed to fetch menu', 500, 'MENU_FETCH_FAILED', error.message);
    }

    return apiSuccess({ categories: data ?? [] });
}
