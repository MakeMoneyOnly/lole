import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import type { Json } from '@/types/database';

const PresetSchema = z.enum(['owner', 'manager', 'kitchen_lead']);

const PatchPresetSchema = z.object({
    preset: PresetSchema,
});

function resolveRecommendedPreset(role: string | null | undefined): z.infer<typeof PresetSchema> {
    if (role === 'owner' || role === 'admin') return 'owner';
    if (role === 'manager') return 'manager';
    return 'kitchen_lead';
}

export async function GET() {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    const [restaurantRes, staffRes] = await Promise.all([
        context.supabase
            .from('restaurants')
            .select('settings')
            .eq('id', context.restaurantId)
            .single(),
        context.supabase
            .from('restaurant_staff')
            .select('role')
            .eq('restaurant_id', context.restaurantId)
            .eq('user_id', auth.user.id)
            .maybeSingle(),
    ]);

    if (restaurantRes.error || !restaurantRes.data) {
        return apiError(
            'Failed to fetch dashboard preset settings',
            500,
            'DASHBOARD_PRESET_FETCH_FAILED',
            restaurantRes.error?.message ?? 'Restaurant not found'
        );
    }

    const settings = (restaurantRes.data.settings ?? {}) as Record<string, unknown>;
    const currentPresetCandidate = (settings.dashboard_preset ?? null) as string | null;
    const currentPreset = PresetSchema.safeParse(currentPresetCandidate).success
        ? (currentPresetCandidate as z.infer<typeof PresetSchema>)
        : null;

    const recommendedPreset = resolveRecommendedPreset(staffRes.data?.role);

    return apiSuccess({
        current_preset: currentPreset,
        recommended_preset: recommendedPreset,
        available_presets: ['owner', 'manager', 'kitchen_lead'] as const,
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

    const parsed = await parseJsonBody(request, PatchPresetSchema);
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
            'Failed to fetch current dashboard settings',
            500,
            'DASHBOARD_PRESET_FETCH_FAILED',
            fetchError?.message ?? 'Restaurant not found'
        );
    }

    const currentSettings = (restaurant.settings ?? {}) as Record<string, unknown>;
    const nextSettings = {
        ...currentSettings,
        dashboard_preset: parsed.data.preset,
    };

    const { error: updateError } = await context.supabase
        .from('restaurants')
        .update({ settings: nextSettings })
        .eq('id', context.restaurantId);

    if (updateError) {
        return apiError(
            'Failed to update dashboard preset',
            500,
            'DASHBOARD_PRESET_UPDATE_FAILED',
            updateError.message
        );
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'dashboard_preset_updated',
        entity_type: 'restaurant_settings',
        entity_id: context.restaurantId,
        old_value: { dashboard_preset: currentSettings.dashboard_preset ?? null } as Json,
        new_value: { dashboard_preset: parsed.data.preset } as Json,
        metadata: { source: 'merchant_dashboard' },
    });

    return apiSuccess({ preset: parsed.data.preset });
}
