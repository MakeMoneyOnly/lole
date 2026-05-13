import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';

const OnlineOrderingSettingsSchema = z
    .object({
        enabled: z.boolean().optional(),
        accepts_scheduled_orders: z.boolean().optional(),
        auto_accept_orders: z.boolean().optional(),
        prep_time_minutes: z.number().int().min(5).max(180).optional(),
        max_daily_orders: z.number().int().min(1).max(5000).optional(),
        service_hours: z
            .object({
                start: z.string().regex(/^\d{2}:\d{2}$/),
                end: z.string().regex(/^\d{2}:\d{2}$/),
            })
            .optional(),
        order_throttling_enabled: z.boolean().optional(),
        throttle_limit_per_15m: z.number().int().min(1).max(500).optional(),
    })
    .refine(value => Object.keys(value).length > 0, {
        message: 'At least one field is required',
    });

const defaultOnlineOrderingSettings = {
    enabled: true,
    accepts_scheduled_orders: true,
    auto_accept_orders: false,
    prep_time_minutes: 30,
    max_daily_orders: 300,
    service_hours: {
        start: '08:00',
        end: '22:00',
    },
    order_throttling_enabled: false,
    throttle_limit_per_15m: 40,
};

export async function GET() {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    const { data, error } = await context.supabase
        .from('restaurants')
        .select('settings, slug')
        .eq('id', context.restaurantId)
        .single();

    if (error || !data) {
        return apiError(
            'Failed to fetch online ordering settings',
            500,
            'ONLINE_ORDERING_SETTINGS_FETCH_FAILED',
            error?.message ?? 'Restaurant not found'
        );
    }

    const settings = (data.settings ?? {}) as Record<string, unknown>;
    const channels = (settings.channels ?? {}) as Record<string, unknown>;
    const onlineOrdering = (channels.online_ordering ?? {}) as Record<string, unknown>;

    return apiSuccess({
        ...defaultOnlineOrderingSettings,
        ...onlineOrdering,
        slug: data.slug,
    });
}

export async function PATCH(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    const parsed = await parseJsonBody(request, OnlineOrderingSettingsSchema);
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
    const currentChannels = (currentSettings.channels ?? {}) as Record<string, unknown>;
    const currentOnlineOrdering = {
        ...defaultOnlineOrderingSettings,
        ...((currentChannels.online_ordering ?? {}) as Record<string, unknown>),
    };
    const nextOnlineOrdering = {
        ...currentOnlineOrdering,
        ...parsed.data,
    };

    const nextChannels = {
        ...currentChannels,
        online_ordering: nextOnlineOrdering,
    };
    const nextSettings = {
        ...currentSettings,
        channels: nextChannels,
    };

    const { error: updateError } = await context.supabase
        .from('restaurants')
        .update({ settings: nextSettings })
        .eq('id', context.restaurantId);

    if (updateError) {
        return apiError(
            'Failed to update online ordering settings',
            500,
            'ONLINE_ORDERING_SETTINGS_UPDATE_FAILED',
            updateError.message
        );
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'online_ordering_settings_updated',
        entity_type: 'restaurant_settings',
        entity_id: context.restaurantId,
        old_value: currentOnlineOrdering,
        new_value: nextOnlineOrdering,
        metadata: { source: 'merchant_dashboard' },
    });

    return apiSuccess(nextOnlineOrdering);
}
