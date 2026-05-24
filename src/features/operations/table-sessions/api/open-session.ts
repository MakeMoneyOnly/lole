import { apiError, apiSuccess } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { OpenTableSessionSchema } from '../contracts';
import { auditTableSession } from '../../shared/audit-helpers';

interface TableSession {
    id: string;
    restaurant_id: string;
    table_id: string;
    guest_count: number;
    assigned_staff_id: string | null;
    status: 'open' | 'closed' | 'transferred';
    notes: string | null;
}

export async function openSessionHandler(request: Request): Promise<Response> {
    try {
        const auth = await requireMerchantAuth(request);

        if (!auth.ok) {
            return auth.response;
        }

        const { supabase, restaurantId, user } = auth;

        const body = await request.json();
        const validated = OpenTableSessionSchema.parse({
            ...body,
            restaurantId,
        });

        const { data: table, error: tableError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('tables')
                .select('id, restaurant_id, status')
                .eq('id', validated.tableId)
                .eq('restaurant_id', restaurantId)
                .maybeSingle();

        if (tableError) {
            return apiError('Failed to fetch table', 500, 'TABLE_FETCH_FAILED', tableError.message);
        }
        if (!table) {
            return apiError('Table not found', 404, 'TABLE_NOT_FOUND');
        }

        const { data: existingOpen, error: existingError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('table_sessions')
                .select('id')
                .eq('table_id', validated.tableId)
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

        const { data: session, error: sessionError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('table_sessions')
                .insert({
                    restaurant_id: restaurantId,
                    table_id: validated.tableId,
                    guest_count: validated.guestCount,
                    assigned_staff_id: validated.assignedStaffId ?? null,
                    notes: validated.notes ?? null,
                    status: 'open',
                })
                .select('*')
                .single();

        if (sessionError) {
            return apiError(
                'Failed to open table session',
                500,
                'TABLE_SESSION_OPEN_FAILED',
                sessionError.message
            );
        }

        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
            .from('tables')
            .update({ status: 'occupied' })
            .eq('id', validated.tableId)
            .eq('restaurant_id', restaurantId);

        await auditTableSession(supabase, restaurantId, {
            sessionId: (session as TableSession).id,
            userId: user.id,
            action: 'opened',
            tableId: (session as TableSession).table_id,
        });

        return apiSuccess(session as TableSession, 201);
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'openSession',
        });
    }
}
