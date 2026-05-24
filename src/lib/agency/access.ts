import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function getAgencyFleetAccess(userId: string): Promise<{
    ok: boolean;
    role?: 'admin' | 'manager';
    restaurantIds?: string[];
    message?: string;
}> {
    const admin = createServiceRoleClient();
    const { data: agencyUser, error } = await admin
        .from('agency_users')
        .select('role, restaurant_ids')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        return {
            ok: false,
            message: error.message,
        };
    }

    if (!agencyUser?.role || !['admin', 'manager'].includes(agencyUser.role)) {
        return {
            ok: false,
            message: 'You do not have access to fleet management.',
        };
    }

    let restaurantIds = agencyUser.restaurant_ids ?? [];
    if (agencyUser.role === 'admin' && restaurantIds.length === 0) {
        const { data: restaurants, error: restaurantsError } = await admin
            .from('restaurants')
            .select('id');

        if (restaurantsError) {
            return {
                ok: false,
                message: restaurantsError.message,
            };
        }

        restaurantIds = (restaurants ?? []).map(restaurant => String(restaurant.id));
    }

    return {
        ok: true,
        role: agencyUser.role as 'admin' | 'manager',
        restaurantIds,
    };
}
