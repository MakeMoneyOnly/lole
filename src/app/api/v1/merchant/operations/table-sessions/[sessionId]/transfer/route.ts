import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';

const TransferSessionSchema = z.object({
    to_table_id: z.string().uuid(),
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

    const parsed = await parseJsonBody(request, TransferSessionSchema);
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

    if (session.table_id === parsed.data.to_table_id) {
        return apiError('Cannot transfer to the same table', 409, 'INVALID_TRANSFER_TARGET');
    }

    const { data: destinationOpen } = await restaurantContext.supabase
        .from('table_sessions')
        .select('id')
        .eq('table_id', parsed.data.to_table_id)
        .eq('status', 'open')
        .maybeSingle();

    if (destinationOpen) {
        return apiError(
            'Destination table already has an open session',
            409,
            'DESTINATION_TABLE_OCCUPIED'
        );
    }

    const now = new Date().toISOString();
    const { error: closeCurrentError } = await restaurantContext.supabase
        .from('table_sessions')
        .update({
            status: 'transferred',
            closed_at: now,
            notes: parsed.data.notes ?? session.notes,
        })
        .eq('id', session.id);

    if (closeCurrentError) {
        return apiError(
            'Failed to close current table session',
            500,
            'TABLE_SESSION_TRANSFER_CLOSE_FAILED',
            closeCurrentError.message
        );
    }

    const { data: newSession, error: newSessionError } = await restaurantContext.supabase
        .from('table_sessions')
        .insert({
            restaurant_id: restaurantContext.restaurantId,
            table_id: parsed.data.to_table_id,
            assigned_staff_id: session.assigned_staff_id,
            guest_count: session.guest_count,
            status: 'open',
            notes: parsed.data.notes ?? session.notes,
            metadata: {
                ...(session.metadata as object),
                transferred_from_session_id: session.id,
                transferred_at: now,
            },
        })
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, table_id, status, guest_count, assigned_staff_id, notes, metadata, opened_at, closed_at, created_at, updated_at'
        )
        .single();

    if (newSessionError) {
        return apiError(
            'Failed to create transferred table session',
            500,
            'TABLE_SESSION_TRANSFER_CREATE_FAILED',
            newSessionError.message
        );
    }

    await Promise.all([
        restaurantContext.supabase
            .from('tables')
            .update({ status: 'available' })
            .eq('id', session.table_id)
            .eq('restaurant_id', restaurantContext.restaurantId),
        restaurantContext.supabase
            .from('tables')
            .update({ status: 'occupied' })
            .eq('id', parsed.data.to_table_id)
            .eq('restaurant_id', restaurantContext.restaurantId),
    ]);

    return apiSuccess({
        previous_session_id: session.id,
        new_session: newSession,
    });
}
