import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseQuery } from '@/lib/api/validation';

const GuestsQuerySchema = z.object({
    query: z.string().trim().max(120).optional(),
    segment: z.enum(['all', 'vip', 'returning', 'new']).optional().default('all'),
    tag: z.string().trim().max(40).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export async function GET(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    const url = new URL(request.url);
    const parsed = parseQuery(
        {
            query: url.searchParams.get('query') ?? undefined,
            segment: url.searchParams.get('segment') ?? undefined,
            tag: url.searchParams.get('tag') ?? undefined,
            limit: url.searchParams.get('limit') ?? undefined,
        },
        GuestsQuerySchema
    );
    if (!parsed.success) {
        return parsed.response;
    }

    let query = context.supabase
        .from('guests')
        .select(
            'id, name, language, tags, is_vip, first_seen_at, last_seen_at, visit_count, lifetime_value, created_at, updated_at'
        )
        .eq('restaurant_id', context.restaurantId)
        .order('last_seen_at', { ascending: false })
        .limit(parsed.data.limit);

    if (parsed.data.query) {
        query = query.ilike('name', `%${parsed.data.query}%`);
    }

    if (parsed.data.segment === 'vip') {
        query = query.eq('is_vip', true);
    } else if (parsed.data.segment === 'returning') {
        query = query.gte('visit_count', 2);
    } else if (parsed.data.segment === 'new') {
        query = query.lte('visit_count', 1);
    }

    if (parsed.data.tag) {
        query = query.contains('tags', [parsed.data.tag]);
    }

    const { data, error } = await query;
    if (error) {
        return apiError('Failed to fetch guests', 500, 'GUESTS_FETCH_FAILED', error.message);
    }

    return apiSuccess({
        guests: data ?? [],
        total: data?.length ?? 0,
    });
}
