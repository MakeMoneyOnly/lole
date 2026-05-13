import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';

const CreateHappyHourSchema = z.object({
    name: z.string().trim().min(1).max(120),
    name_am: z.string().trim().max(120).optional().nullable(),
    description: z.string().trim().max(500).optional().nullable(),
    description_am: z.string().trim().max(500).optional().nullable(),
    is_active: z.boolean().optional().default(true),
    schedule_days: z
        .array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))
        .optional()
        .default(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
    schedule_start_time: z
        .string()
        .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format'),
    schedule_end_time: z
        .string()
        .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format'),
    discount_percentage: z.number().int().min(0).max(10000).optional().nullable(),
    discount_fixed_amount: z.number().int().min(0).optional().nullable(),
    applies_to: z.enum(['order', 'item', 'category']).default('order'),
    target_category_id: z.string().uuid().optional().nullable(),
    target_menu_item_ids: z.array(z.string().uuid()).optional().default([]),
    priority: z.number().int().min(0).optional().default(0),
    requires_manager_pin: z.boolean().optional().default(false),
});

const _UpdateHappyHourSchema = CreateHappyHourSchema.partial();

export async function GET() {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    try {
        const db = context.supabase;
        const { data, error } = await db
            .from('happy_hour_schedules')
            // HIGH-013: Explicit column selection
            .select(
                'id, restaurant_id, name, name_am, description, description_am, is_active, schedule_days, schedule_start_time, schedule_end_time, discount_percentage, discount_fixed_amount, applies_to, target_category_id, target_menu_item_ids, priority, requires_manager_pin, created_by, created_at, updated_at'
            )
            .eq('restaurant_id', context.restaurantId)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            return apiError(
                'Failed to load happy hour schedules',
                500,
                'HAPPY_HOUR_FETCH_FAILED',
                error.message
            );
        }

        return apiSuccess({ happy_hours: data ?? [] });
    } catch (error) {
        return apiError(
            'Failed to load happy hour schedules',
            500,
            'HAPPY_HOUR_FETCH_FAILED',
            error instanceof Error ? error.message : 'Unknown error'
        );
    }
}

export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    const parsed = await parseJsonBody(request, CreateHappyHourSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    // Validate time range
    if (parsed.data.schedule_start_time >= parsed.data.schedule_end_time) {
        return apiError('End time must be after start time', 400, 'HAPPY_HOUR_INVALID_TIME');
    }

    // Validate that at least one discount type is provided
    if (!parsed.data.discount_percentage && !parsed.data.discount_fixed_amount) {
        return apiError(
            'Either discount_percentage or discount_fixed_amount is required',
            400,
            'HAPPY_HOUR_DISCOUNT_REQUIRED'
        );
    }

    // Validate applies_to for category
    if (parsed.data.applies_to === 'category' && !parsed.data.target_category_id) {
        return apiError(
            'target_category_id is required for category-based happy hour',
            400,
            'HAPPY_HOUR_CATEGORY_REQUIRED'
        );
    }

    const db = context.supabase;
    const { data, error } = await db
        .from('happy_hour_schedules')
        .insert({
            restaurant_id: context.restaurantId,
            created_by: auth.user.id,
            ...parsed.data,
        })
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, name_am, description, description_am, is_active, schedule_days, schedule_start_time, schedule_end_time, discount_percentage, discount_fixed_amount, applies_to, target_category_id, target_menu_item_ids, priority, requires_manager_pin, created_by, created_at, updated_at'
        )
        .single();

    if (error || !data) {
        return apiError(
            'Failed to create happy hour',
            500,
            'HAPPY_HOUR_CREATE_FAILED',
            error?.message
        );
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'happy_hour_created',
        entity_type: 'happy_hour_schedule',
        entity_id: data.id,
        metadata: { name: data.name },
    });

    return apiSuccess({ happy_hour: data }, 201);
}
