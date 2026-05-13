import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';

const NotificationSettingsSchema = z.object({
    email_enabled: z.boolean().optional(),
    sms_enabled: z.boolean().optional(),
    in_app_enabled: z.boolean().optional(),
    escalation_enabled: z.boolean().optional(),
    escalation_minutes: z.number().int().min(1).max(240).optional(),
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
            'Failed to fetch notification settings',
            500,
            'NOTIFICATIONS_SETTINGS_FETCH_FAILED',
            error?.message ?? 'Restaurant not found'
        );
    }

    const settings = (data.settings ?? {}) as Record<string, unknown>;
    const notifications = (settings.notifications ?? {
        email_enabled: true,
        sms_enabled: false,
        in_app_enabled: true,
        escalation_enabled: true,
        escalation_minutes: 15,
    }) as Record<string, unknown>;

    return apiSuccess(notifications);
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

    const parsed = await parseJsonBody(request, NotificationSettingsSchema);
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
    const currentNotifications = (currentSettings.notifications ?? {}) as Record<string, unknown>;
    const nextNotifications = {
        ...currentNotifications,
        ...parsed.data,
    };
    const nextSettings = {
        ...currentSettings,
        notifications: nextNotifications,
    };

    const { error: updateError } = await context.supabase
        .from('restaurants')
        .update({ settings: nextSettings })
        .eq('id', context.restaurantId);

    if (updateError) {
        return apiError(
            'Failed to update notification settings',
            500,
            'NOTIFICATIONS_SETTINGS_UPDATE_FAILED',
            updateError.message
        );
    }

    return apiSuccess(nextNotifications);
}
