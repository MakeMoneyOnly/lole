import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { listActiveDiscountsForRestaurant } from '@/lib/discounts/service';

const CreateDiscountSchema = z.object({
    name: z.string().trim().min(1).max(120),
    name_am: z.string().trim().max(120).optional().nullable(),
    type: z.enum(['percentage', 'fixed_amount', 'bogo', 'item_override']),
    value: z.number().int().min(0),
    applies_to: z.enum(['order', 'item', 'category']).default('order'),
    target_menu_item_id: z.string().uuid().optional().nullable(),
    target_category_id: z.string().uuid().optional().nullable(),
    requires_manager_pin: z.boolean().optional().default(false),
    max_uses_per_day: z.number().int().min(1).optional().nullable(),
    valid_from: z.string().datetime().optional().nullable(),
    valid_until: z.string().datetime().optional().nullable(),
    is_active: z.boolean().optional().default(true),
});

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
        const discounts = await listActiveDiscountsForRestaurant(
            context.supabase,
            context.restaurantId
        );
        return apiSuccess({ discounts });
    } catch (error) {
        return apiError(
            'Failed to load discounts',
            500,
            'DISCOUNTS_FETCH_FAILED',
            error instanceof Error ? error.message : 'Unknown discount fetch error'
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

    const parsed = await parseJsonBody(request, CreateDiscountSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    if (parsed.data.applies_to === 'item' && !parsed.data.target_menu_item_id) {
        return apiError(
            'target_menu_item_id is required for item discounts',
            400,
            'DISCOUNT_TARGET_REQUIRED'
        );
    }

    if (parsed.data.applies_to === 'category' && !parsed.data.target_category_id) {
        return apiError(
            'target_category_id is required for category discounts',
            400,
            'DISCOUNT_TARGET_REQUIRED'
        );
    }

    const db = context.supabase;
    const { data, error } = await db
        .from('discounts')
        .insert({
            restaurant_id: context.restaurantId,
            ...parsed.data,
        })
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, name_am, type, value, applies_to, target_menu_item_id, target_category_id, requires_manager_pin, max_uses_per_day, valid_from, valid_until, is_active, created_at, updated_at'
        )
        .single();

    if (error || !data) {
        return apiError('Failed to create discount', 500, 'DISCOUNT_CREATE_FAILED', error?.message);
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'discount_created',
        entity_type: 'discount',
        entity_id: data.id,
        metadata: { source: 'discounts_api' },
        new_value: data,
    });

    return apiSuccess({ discount: data }, 201);
}
