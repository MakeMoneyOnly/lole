import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';

const OpenTableSessionSchema = z.object({
    table_id: z.string().uuid(),
    guest_count: z.number().int().positive().max(50).optional().default(1),
    assigned_staff_id: z.string().uuid().optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
});

export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const parsed = await parseJsonBody(request, OpenTableSessionSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { data: table, error: tableError } = await context.supabase
        .from('tables')
        .select('id, restaurant_id, status')
        .eq('id', parsed.data.table_id)
        .eq('restaurant_id', context.restaurantId)
        .maybeSingle();

    if (tableError) {
        return apiError('Failed to fetch table', 500, 'TABLE_FETCH_FAILED', tableError.message);
    }
    if (!table) {
        return apiError('Table not found', 404, 'TABLE_NOT_FOUND');
    }

    const { data: existingOpen, error: existingError } = await context.supabase
        .from('table_sessions')
        .select('id')
        .eq('table_id', parsed.data.table_id)
        .eq('status', 'open')
        .maybeSingle();

    if (existingError) {
        return apiError(
            'Failed to verify table session state',
            500,
            'TABLE_SESSION_STATE_FAILED',
            existingError.message
        );
    }
    if (existingOpen) {
        return apiError('Table already has an open session', 409, 'TABLE_SESSION_ALREADY_OPEN');
    }

    const { data: session, error: sessionError } = await context.supabase
        .from('table_sessions')
        .insert({
            restaurant_id: context.restaurantId,
            table_id: parsed.data.table_id,
            guest_count: parsed.data.guest_count,
            assigned_staff_id: parsed.data.assigned_staff_id ?? null,
            notes: parsed.data.notes ?? null,
            status: 'open',
        })
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, table_id, status, guest_count, assigned_staff_id, notes, metadata, opened_at, closed_at, created_at, updated_at'
        )
        .single();

    if (sessionError) {
        return apiError(
            'Failed to open table session',
            500,
            'TABLE_SESSION_OPEN_FAILED',
            sessionError.message
        );
    }

    await context.supabase
        .from('tables')
        .update({ status: 'occupied' })
        .eq('id', parsed.data.table_id)
        .eq('restaurant_id', context.restaurantId);

    return apiSuccess(session, 201);
}
