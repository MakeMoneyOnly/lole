import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseQuery } from '@/lib/api/validation';

const GuestIdSchema = z.string().uuid();

const GuestVisitsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export async function GET(
    request: Request,
    routeContext: { params: Promise<{ guestId: string }> }
) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    const { guestId } = await routeContext.params;
    const guestIdParsed = GuestIdSchema.safeParse(guestId);
    if (!guestIdParsed.success) {
        return apiError('Invalid guest id', 400, 'INVALID_GUEST_ID', guestIdParsed.error.flatten());
    }

    const url = new URL(request.url);
    const parsed = parseQuery(
        {
            limit: url.searchParams.get('limit') ?? undefined,
        },
        GuestVisitsQuerySchema
    );
    if (!parsed.success) {
        return parsed.response;
    }

    const { data: guest, error: guestError } = await context.supabase
        .from('guests')
        .select('id')
        .eq('id', guestIdParsed.data)
        .eq('restaurant_id', context.restaurantId)
        .maybeSingle();

    if (guestError) {
        return apiError('Failed to load guest', 500, 'GUEST_FETCH_FAILED', guestError.message);
    }
    if (!guest) {
        return apiError('Guest not found', 404, 'GUEST_NOT_FOUND');
    }

    const { data, error } = await context.supabase
        .from('guest_visits')
        .select(
            'id, order_id, table_id, channel, visited_at, spend, metadata, orders(order_number, status, table_number, total_price)'
        )
        .eq('restaurant_id', context.restaurantId)
        .eq('guest_id', guestIdParsed.data)
        .order('visited_at', { ascending: false })
        .limit(parsed.data.limit);

    if (error) {
        return apiError(
            'Failed to fetch guest visits',
            500,
            'GUEST_VISITS_FETCH_FAILED',
            error.message
        );
    }

    return apiSuccess({
        visits: data ?? [],
        total: data?.length ?? 0,
    });
}
