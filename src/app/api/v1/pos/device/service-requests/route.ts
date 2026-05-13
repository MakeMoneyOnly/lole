/**
 * GET /api/device/service-requests — pending service requests for the waiter
 * Requires X-Device-Token header.
 */
import { apiError, apiSuccess } from '@/lib/api/response';
import { getDeviceContext } from '@/lib/api/authz';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET(request: Request) {
    const ctx = await getDeviceContext(request);
    if (!ctx.ok) return ctx.response;

    const admin = createServiceRoleClient();

    const { data, error } = await admin
        .from('service_requests')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, table_number, request_type, status, notes, completed_at, idempotency_key, created_at'
        )
        .eq('restaurant_id', ctx.restaurantId)
        .in('status', ['pending', 'acknowledged'])
        .order('created_at', { ascending: false });

    if (error) {
        return apiError(
            'Failed to fetch service requests',
            500,
            'SERVICE_REQUESTS_FETCH_FAILED',
            error.message
        );
    }

    return apiSuccess({ service_requests: data ?? [] });
}
