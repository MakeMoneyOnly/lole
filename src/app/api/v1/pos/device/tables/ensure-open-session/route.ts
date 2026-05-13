/**
 * POST /api/device/tables/ensure-open-session
 * Ensure an open table_session exists for a table in device mode.
 * Requires X-Device-Token header.
 */
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getDeviceContext } from '@/lib/api/authz';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { parseJsonBody } from '@/lib/api/validation';

const EnsureOpenSessionSchema = z.object({
    table_id: z.string().uuid().optional(),
    table_number: z.string().trim().min(1).optional(),
    notes: z.string().trim().max(300).optional(),
});

export async function POST(request: Request) {
    const ctx = await getDeviceContext(request);
    if (!ctx.ok) return ctx.response;

    const parsed = await parseJsonBody(request, EnsureOpenSessionSchema);
    if (!parsed.success) return parsed.response;

    const { table_id, table_number, notes } = parsed.data;
    if (!table_id && !table_number) {
        return apiError('table_id or table_number is required', 400, 'TABLE_SELECTOR_REQUIRED');
    }

    const admin = createServiceRoleClient();
    let tableQuery = admin
        .from('tables')
        .select('id, table_number')
        .eq('restaurant_id', ctx.restaurantId);

    if (table_id) {
        tableQuery = tableQuery.eq('id', table_id);
    } else if (table_number) {
        tableQuery = tableQuery.eq('table_number', table_number);
    }

    const { data: table, error: tableError } = await tableQuery.maybeSingle();
    if (tableError) {
        return apiError('Failed to fetch table', 500, 'TABLE_FETCH_FAILED', tableError.message);
    }
    if (!table) {
        return apiError('Table not found', 404, 'TABLE_NOT_FOUND');
    }

    const { data: existingOpen, error: existingError } = await admin
        .from('table_sessions')
        .select('id, status, opened_at')
        .eq('restaurant_id', ctx.restaurantId)
        .eq('table_id', table.id)
        .eq('status', 'open')
        .maybeSingle();

    if (existingError) {
        return apiError(
            'Failed to check open table session',
            500,
            'TABLE_SESSION_FETCH_FAILED',
            existingError.message
        );
    }

    if (existingOpen) {
        return apiSuccess({
            table_id: table.id,
            table_number: table.table_number,
            session: existingOpen,
            created: false,
        });
    }

    const { data: created, error: createError } = await admin
        .from('table_sessions')
        .insert({
            restaurant_id: ctx.restaurantId,
            table_id: table.id,
            guest_count: 1,
            status: 'open',
            notes: notes ?? 'Auto-opened from waiter settlement recovery',
        })
        .select('id, status, opened_at')
        .single();

    if (createError) {
        if (createError.code === '23505') {
            const { data: racedOpen, error: racedOpenError } = await admin
                .from('table_sessions')
                .select('id, status, opened_at')
                .eq('restaurant_id', ctx.restaurantId)
                .eq('table_id', table.id)
                .eq('status', 'open')
                .maybeSingle();

            if (racedOpenError || !racedOpen) {
                return apiError(
                    'Failed to recover open table session',
                    500,
                    'TABLE_SESSION_RECOVERY_FAILED',
                    racedOpenError?.message ?? createError.message
                );
            }

            return apiSuccess({
                table_id: table.id,
                table_number: table.table_number,
                session: racedOpen,
                created: false,
            });
        }

        return apiError(
            'Failed to create open table session',
            500,
            'TABLE_SESSION_CREATE_FAILED',
            createError.message
        );
    }

    return apiSuccess({
        table_id: table.id,
        table_number: table.table_number,
        session: created,
        created: true,
    });
}
