import { apiError, apiSuccess } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { CloseTableSessionSchema } from '../contracts';
import { auditTableSession } from '../../shared/audit-helpers';

interface TableSession {
    id: string;
    restaurant_id: string;
    table_id: string;
    status: 'open' | 'closed' | 'transferred';
    notes: string | null;
}

export async function closeSessionHandler(
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

        const { data: session, error: sessionError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('table_sessions')
                .select('*')
                .eq('id', sessionId)
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

        const body = await request.json().catch(() => ({}));
        const { notes } = CloseTableSessionSchema.pick({ notes: true }).parse(body);

        const now = new Date().toISOString();
        const { data: closedSession, error: closeError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('table_sessions')
                .update({
                    status: 'closed',
                    closed_at: now,
                    notes: notes ?? (session as TableSession).notes,
                })
                .eq('id', (session as TableSession).id)
                .select('*')
                .single();

        if (closeError) {
            return apiError(
                'Failed to close table session',
                500,
                'TABLE_SESSION_CLOSE_FAILED',
                closeError.message
            );
        }

        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
            .from('tables')
            .update({ status: 'available' })
            .eq('id', (session as TableSession).table_id)
            .eq('restaurant_id', restaurantId);

        await auditTableSession(supabase, restaurantId, {
            sessionId: (session as TableSession).id,
            userId: user.id,
            action: 'closed',
        });

        return apiSuccess(closedSession as TableSession);
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'closeSession',
        });
    }
}
