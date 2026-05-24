import { apiError, apiSuccess } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { TransferTableSessionSchema } from '../contracts';
import { auditTableSession } from '../../shared/audit-helpers';

interface TableSession {
    id: string;
    restaurant_id: string;
    table_id: string;
    guest_count: number;
    assigned_staff_id: string | null;
    status: 'open' | 'closed' | 'transferred';
    notes: string | null;
    metadata: Record<string, unknown> | null;
}

export async function transferSessionHandler(
    request: Request,
    context: { params: Promise<{ sessionId: string }> }
): Promise<Response> {
    try {
        const auth = await requireMerchantAuth(request);

        if (!auth.ok) {
            return auth.response;
        }

        const { supabase, restaurantId, user } = auth;
        const resolvedParams = await context.params;
        const sessionId = resolvedParams.sessionId;

        const body = await request.json();
        const validated = TransferTableSessionSchema.parse({
            ...body,
            sessionId,
            restaurantId,
        });

        const { data: session, error: sessionError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('table_sessions')
                .select('*')
                .eq('id', validated.sessionId)
                .eq('restaurant_id', restaurantId)
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

        const sessionData = session as TableSession;

        if (sessionData.table_id === validated.toTableId) {
            return apiError('Cannot transfer to the same table', 409, 'INVALID_TRANSFER_TARGET');
        }

        const { data: destinationOpen } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('table_sessions')
                .select('id')
                .eq('table_id', validated.toTableId)
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
        const { error: closeCurrentError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('table_sessions')
                .update({
                    status: 'transferred',
                    closed_at: now,
                    notes: validated.notes ?? sessionData.notes,
                })
                .eq('id', sessionData.id);

        if (closeCurrentError) {
            return apiError(
                'Failed to close current table session',
                500,
                'TABLE_SESSION_TRANSFER_CLOSE_FAILED',
                closeCurrentError.message
            );
        }

        const { data: newSession, error: newSessionError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('table_sessions')
                .insert({
                    restaurant_id: restaurantId,
                    table_id: validated.toTableId,
                    assigned_staff_id: sessionData.assigned_staff_id,
                    guest_count: sessionData.guest_count,
                    status: 'open',
                    notes: validated.notes ?? sessionData.notes,
                    metadata: {
                        ...(sessionData.metadata ?? {}),
                        transferred_from_session_id: sessionData.id,
                        transferred_at: now,
                    },
                })
                .select('*')
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('tables')
                .update({ status: 'available' })
                .eq('id', sessionData.table_id)
                .eq('restaurant_id', restaurantId),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('tables')
                .update({ status: 'occupied' })
                .eq('id', validated.toTableId)
                .eq('restaurant_id', restaurantId),
        ]);

        await auditTableSession(supabase, restaurantId, {
            sessionId: sessionData.id,
            userId: user.id,
            action: 'transferred',
        });

        return apiSuccess({
            previous_session_id: sessionData.id,
            new_session: newSession,
        });
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'transferSession',
        });
    }
}
