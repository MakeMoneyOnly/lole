import { apiError, apiSuccess } from '@/lib/api/response';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { listActiveDiscountsForRestaurant } from '@/lib/discounts/service';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
        return apiError('slug is required', 400, 'MISSING_SLUG');
    }

    const admin = createServiceRoleClient();
    const { data: restaurant, error } = await admin
        .from('restaurants')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

    if (error) {
        return apiError(
            'Failed to resolve restaurant',
            500,
            'RESTAURANT_RESOLVE_FAILED',
            error.message
        );
    }

    if (!restaurant) {
        return apiError('Restaurant not found', 404, 'RESTAURANT_NOT_FOUND');
    }

    try {
        const discounts = await listActiveDiscountsForRestaurant(
            admin as SupabaseClient<Database>,
            restaurant.id,
            {
                excludeManagerApproval: true,
            }
        );
        return apiSuccess({ discounts });
    } catch (fetchError) {
        return apiError(
            'Failed to load discounts',
            500,
            'DISCOUNTS_FETCH_FAILED',
            fetchError instanceof Error ? fetchError.message : 'Unknown discount fetch error'
        );
    }
}
