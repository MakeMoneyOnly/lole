import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';

const SecuritySettingsSchema = z.object({
    require_mfa: z.boolean().optional(),
    session_timeout_minutes: z.number().int().min(5).max(1440).optional(),
    allowed_ip_ranges: z.array(z.string()).optional(),
    alert_on_suspicious_login: z.boolean().optional(),
});

export async function GET() {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }
    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const { data, error } = await context.supabase
        .from('restaurants')
        .select('settings')
        .eq('id', context.restaurantId)
        .single();

    if (error || !data) {
        return apiError(
            'Failed to fetch security settings',
            500,
            'SECURITY_SETTINGS_FETCH_FAILED',
            error?.message ?? 'Restaurant not found'
        );
    }

    const settings = (data.settings ?? {}) as Record<string, unknown>;
    const security = (settings.security ?? {
        require_mfa: false,
        session_timeout_minutes: 120,
        allowed_ip_ranges: [],
        alert_on_suspicious_login: true,
    }) as Record<string, unknown>;

    return apiSuccess(security);
}

export async function PATCH(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }
    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const parsed = await parseJsonBody(request, SecuritySettingsSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { data: restaurant, error: fetchError } = await context.supabase
        .from('restaurants')
        .select('settings')
        .eq('id', context.restaurantId)
        .single();

    if (fetchError || !restaurant) {
        return apiError(
            'Failed to fetch current settings',
            500,
            'SETTINGS_FETCH_FAILED',
            fetchError?.message ?? 'Restaurant not found'
        );
    }

    const currentSettings = (restaurant.settings ?? {}) as Record<string, unknown>;
    const currentSecurity = (currentSettings.security ?? {}) as Record<string, unknown>;
    const nextSecurity = {
        ...currentSecurity,
        ...parsed.data,
    };
    const nextSettings = {
        ...currentSettings,
        security: nextSecurity,
    };

    const { error: updateError } = await context.supabase
        .from('restaurants')
        .update({ settings: nextSettings })
        .eq('id', context.restaurantId);

    if (updateError) {
        return apiError(
            'Failed to update security settings',
            500,
            'SECURITY_SETTINGS_UPDATE_FAILED',
            updateError.message
        );
    }

    return apiSuccess(nextSecurity);
}
