import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';

const CloseSessionSchema = z.object({
    notes: z.string().max(500).optional().nullable(),
});

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const restaurantContext = await getAuthorizedRestaurantContext(auth.user.id);
    if (!restaurantContext.ok) {
        return restaurantContext.response;
    }

    const parsed = await parseJsonBody(request, CloseSessionSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { sessionId } = await context.params;
    const { data: session, error: sessionError } = await restaurantContext.supabase
        .from('table_sessions')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, table_id, status, guest_count, assigned_staff_id, notes, metadata, opened_at, closed_at, created_at, updated_at'
        )
        .eq('id', sessionId)
        .eq('restaurant_id', restaurantContext.restaurantId)
        .eq('status', 'open')
        .maybeSingle();

    if (sessionError) {
        return apiError(
            'Failed to fetch table session',
            500,
            'TABLE_SESSION_FETCH_FAILED',
            sessionError.message
        );
    }
    if (!session) {
        return apiError('Open table session not found', 404, 'TABLE_SESSION_NOT_FOUND');
    }

    const now = new Date().toISOString();
    const { data: closedSession, error: closeError } = await restaurantContext.supabase
        .from('table_sessions')
        .update({
            status: 'closed',
            closed_at: now,
            notes: parsed.data.notes ?? session.notes,
        })
        .eq('id', session.id)
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, table_id, status, guest_count, assigned_staff_id, notes, metadata, opened_at, closed_at, created_at, updated_at'
        )
        .single();

    if (closeError) {
        return apiError(
            'Failed to close table session',
            500,
            'TABLE_SESSION_CLOSE_FAILED',
            closeError.message
        );
    }

    await restaurantContext.supabase
        .from('tables')
        .update({ status: 'available' })
        .eq('id', session.table_id)
        .eq('restaurant_id', restaurantContext.restaurantId);

    return apiSuccess(closedSession);
}
