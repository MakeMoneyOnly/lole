import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';

export async function GET() {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) return context.response;

    const { data: restaurant, error } = await context.supabase
        .from('restaurants')
        .select('settings')
        .eq('id', context.restaurantId)
        .single();

    if (error) return apiError('Failed to fetch zones', 500);

    const zones = ((restaurant?.settings as Record<string, unknown>)?.zones || []) as string[];
    return apiSuccess({ zones });
}

export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) return context.response;

    try {
        const body = await request.json();
        const zones = body.zones;

        if (!Array.isArray(zones)) {
            return apiError('Invalid zones data. Expected an array of strings.', 400);
        }

        // Get current settings
        const { data: restaurant, error: fetchError } = await context.supabase
            .from('restaurants')
            .select('settings')
            .eq('id', context.restaurantId)
            .single();

        if (fetchError) return apiError('Failed to fetch restaurant settings', 500);

        const currentSettings = (restaurant?.settings as Record<string, unknown>) || {};
        const newSettings = {
            ...currentSettings,
            zones: Array.from(
                new Set(
                    zones.filter(z => typeof z === 'string' && z.trim() !== '').map(z => z.trim())
                )
            ),
        };

        const { error: updateError } = await context.supabase
            .from('restaurants')
            .update({ settings: newSettings })
            .eq('id', context.restaurantId);

        if (updateError) return apiError('Failed to update zones', 500);

        return apiSuccess({ zones: newSettings.zones });
    } catch {
        return apiError('Invalid request body', 400);
    }
}
