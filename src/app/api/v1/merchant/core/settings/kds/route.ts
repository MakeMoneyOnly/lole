import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import type { Json } from '@/types/database';
import { DEFAULT_KDS_PRINT_POLICY, normalizeKdsPrintPolicy } from '@/features/kds/lib/printer';

const AlertPolicySchema = z.object({
    new_ticket_sound: z.boolean().optional(),
    sla_breach_visual: z.boolean().optional(),
    recall_visual: z.boolean().optional(),
    quiet_hours_enabled: z.boolean().optional(),
    quiet_hours_start: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .optional(),
    quiet_hours_end: z
        .string()
        .regex(/^\d{2}:\d{2}$/)
        .optional(),
});

const KdsSettingsSchema = z.object({
    ready_auto_archive_minutes: z.number().int().min(0).max(180).optional(),
    alert_policy: AlertPolicySchema.optional(),
    print_policy: z
        .object({
            mode: z.enum(['off', 'fallback', 'always']).optional(),
            provider: z.enum(['log', 'webhook']).optional(),
            webhook_url: z.string().url().max(300).optional().or(z.literal('')),
            copies: z.number().int().min(1).max(5).optional(),
            timeout_ms: z.number().int().min(1000).max(20000).optional(),
            max_attempts: z.number().int().min(1).max(8).optional(),
            base_backoff_ms: z.number().int().min(100).max(5000).optional(),
        })
        .optional(),
});

const DEFAULT_READY_AUTO_ARCHIVE_MINUTES = 15;
const DEFAULT_ALERT_POLICY = {
    new_ticket_sound: true,
    sla_breach_visual: true,
    recall_visual: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '23:00',
    quiet_hours_end: '06:00',
};

function normalizeAlertPolicy(input: unknown) {
    const raw = (input ?? {}) as Record<string, unknown>;
    return {
        new_ticket_sound:
            typeof raw.new_ticket_sound === 'boolean'
                ? raw.new_ticket_sound
                : DEFAULT_ALERT_POLICY.new_ticket_sound,
        sla_breach_visual:
            typeof raw.sla_breach_visual === 'boolean'
                ? raw.sla_breach_visual
                : DEFAULT_ALERT_POLICY.sla_breach_visual,
        recall_visual:
            typeof raw.recall_visual === 'boolean'
                ? raw.recall_visual
                : DEFAULT_ALERT_POLICY.recall_visual,
        quiet_hours_enabled:
            typeof raw.quiet_hours_enabled === 'boolean'
                ? raw.quiet_hours_enabled
                : DEFAULT_ALERT_POLICY.quiet_hours_enabled,
        quiet_hours_start:
            typeof raw.quiet_hours_start === 'string' && /^\d{2}:\d{2}$/.test(raw.quiet_hours_start)
                ? raw.quiet_hours_start
                : DEFAULT_ALERT_POLICY.quiet_hours_start,
        quiet_hours_end:
            typeof raw.quiet_hours_end === 'string' && /^\d{2}:\d{2}$/.test(raw.quiet_hours_end)
                ? raw.quiet_hours_end
                : DEFAULT_ALERT_POLICY.quiet_hours_end,
    };
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

    const { data, error } = await context.supabase
        .from('restaurants')
        .select('settings')
        .eq('id', context.restaurantId)
        .maybeSingle();

    if (error) {
        return apiError(
            'Failed to fetch KDS settings',
            500,
            'KDS_SETTINGS_FETCH_FAILED',
            error.message
        );
    }

    const settings = (data?.settings ?? {}) as Record<string, unknown>;
    const kdsSettings = (settings.kds ?? {}) as Record<string, unknown>;

    return apiSuccess({
        ready_auto_archive_minutes:
            typeof kdsSettings.ready_auto_archive_minutes === 'number'
                ? Math.max(0, Math.min(180, Math.floor(kdsSettings.ready_auto_archive_minutes)))
                : DEFAULT_READY_AUTO_ARCHIVE_MINUTES,
        alert_policy: normalizeAlertPolicy(kdsSettings.alert_policy),
        print_policy: normalizeKdsPrintPolicy(
            (kdsSettings.print_policy as Record<string, unknown> | undefined) ??
                DEFAULT_KDS_PRINT_POLICY
        ),
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

    const parsed = await parseJsonBody(request, KdsSettingsSchema);
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
            'Failed to load current KDS settings',
            500,
            'KDS_SETTINGS_FETCH_FAILED',
            fetchError?.message ?? 'Restaurant not found'
        );
    }

    const currentSettings = (restaurant.settings ?? {}) as Record<string, unknown>;
    const currentKds = (currentSettings.kds ?? {}) as Record<string, unknown>;
    const mergedAlertPolicy = parsed.data.alert_policy
        ? {
              ...normalizeAlertPolicy(currentKds.alert_policy),
              ...parsed.data.alert_policy,
          }
        : normalizeAlertPolicy(currentKds.alert_policy);
    const mergedPrintPolicy = parsed.data.print_policy
        ? normalizeKdsPrintPolicy({
              ...normalizeKdsPrintPolicy(currentKds.print_policy),
              ...parsed.data.print_policy,
          })
        : normalizeKdsPrintPolicy(currentKds.print_policy);
    const nextKds = {
        ...currentKds,
        ...parsed.data,
        alert_policy: mergedAlertPolicy,
        print_policy: mergedPrintPolicy,
    };
    const nextSettings = {
        ...currentSettings,
        kds: nextKds,
    };

    const { error: updateError } = await context.supabase
        .from('restaurants')
        .update({ settings: nextSettings as unknown as Json })
        .eq('id', context.restaurantId);

    if (updateError) {
        return apiError(
            'Failed to update KDS settings',
            500,
            'KDS_SETTINGS_UPDATE_FAILED',
            updateError.message
        );
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'kds_settings_updated',
        entity_type: 'restaurant',
        entity_id: context.restaurantId,
        metadata: { source: 'kds_settings_api' },
        old_value: { kds: currentKds } as unknown as Json,
        new_value: { kds: nextKds } as unknown as Json,
    });

    return apiSuccess({
        ready_auto_archive_minutes:
            typeof nextKds.ready_auto_archive_minutes === 'number'
                ? Math.max(0, Math.min(180, Math.floor(nextKds.ready_auto_archive_minutes)))
                : DEFAULT_READY_AUTO_ARCHIVE_MINUTES,
        alert_policy: normalizeAlertPolicy(nextKds.alert_policy),
        print_policy: normalizeKdsPrintPolicy(nextKds.print_policy),
    });
}
