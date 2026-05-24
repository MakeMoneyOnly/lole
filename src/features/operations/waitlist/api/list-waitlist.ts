import { apiError, apiSuccess } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { ListWaitlistQuerySchema } from '../contracts';

interface WaitlistEntry {
    id: string;
    restaurant_id: string;
    guest_name: string;
    guest_phone: string;
    guest_count: number;
    status: string;
    position?: number;
    notes: string | null;
    created_at: string;
    notified_at: string | null;
    seated_at: string | null;
}

export async function listWaitlistHandler(request: Request): Promise<Response> {
    try {
        const auth = await requireMerchantAuth(request);

        if (!auth.ok) {
            return auth.response;
        }

        const { supabase, restaurantId } = auth;

        const url = new URL(request.url);
        const rawQuery = {
            restaurantId: restaurantId,
            status: url.searchParams.get('status') ?? undefined,
            search: url.searchParams.get('search') ?? undefined,
            limit: url.searchParams.get('limit') ?? undefined,
            offset: url.searchParams.get('offset') ?? undefined,
        };

        const validated = ListWaitlistQuerySchema.parse(rawQuery);
        const { status, search, limit, offset } = validated;

        let query = // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('waitlist_entries')
                .select('*', { count: 'exact' })
                .eq('restaurant_id', restaurantId)
                .order('created_at', { ascending: true })
                .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq('status', status);
        }

        if (search) {
            const searchTerm = search.trim();
            if (searchTerm.length > 0) {
                query = query.or(
                    `guest_name.ilike.%${searchTerm}%,guest_phone.ilike.%${searchTerm}%`
                );
            }
        }

        const { data: entries, error, count } = await query;

        if (error) {
            return apiError(
                'Failed to fetch waitlist',
                500,
                'WAITLIST_FETCH_FAILED',
                error.message
            );
        }

        return apiSuccess({
            entries: entries as WaitlistEntry[],
            total: count ?? 0,
        });
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'listWaitlist',
        });
    }
}
