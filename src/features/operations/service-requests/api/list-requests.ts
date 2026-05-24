import { apiError, apiSuccess } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { ListServiceRequestsQuerySchema } from '../contracts';

interface ServiceRequest {
    id: string;
    restaurant_id: string;
    table_number: string;
    request_type: string;
    status: string;
    notes: string | null;
    completed_at: string | null;
}

export async function listRequestsHandler(request: Request): Promise<Response> {
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

        const validated = ListServiceRequestsQuerySchema.parse(rawQuery);
        const { status, search, limit, offset } = validated;

        let query = // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('service_requests')
                .select('*', { count: 'exact' })
                .eq('restaurant_id', restaurantId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq('status', status);
        }

        if (search) {
            const searchTerm = search.trim();
            if (searchTerm.length > 0) {
                query = query.or(
                    `table_number.ilike.%${searchTerm}%,request_type.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`
                );
            }
        }

        const { data: requests, error, count } = await query;

        if (error) {
            return apiError(
                'Failed to fetch service requests',
                500,
                'SERVICE_REQUESTS_FETCH_FAILED',
                error.message
            );
        }

        return apiSuccess({
            requests: requests as ServiceRequest[],
            total: count ?? 0,
        });
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'listRequests',
        });
    }
}
