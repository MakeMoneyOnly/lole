/**
 * POST /api/device/tables/bill-request
 * Mark a table as bill requested and create/update a bill service request.
 * Requires X-Device-Token header.
 */
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getDeviceContext } from '@/lib/api/authz';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { parseJsonBody } from '@/lib/api/validation';

const BillRequestSchema = z.object({
    table_id: z.string().uuid().optional(),
    table_number: z.string().trim().min(1).optional(),
    notes: z.string().trim().max(300).optional(),
});

export async function POST(request: Request) {
    const ctx = await getDeviceContext(request);
    if (!ctx.ok) return ctx.response;

    const parsed = await parseJsonBody(request, BillRequestSchema);
    if (!parsed.success) return parsed.response;

    const { table_id, table_number, notes } = parsed.data;
    if (!table_id && !table_number) {
        return apiError('table_id or table_number is required', 400, 'TABLE_SELECTOR_REQUIRED');
    }

    const admin = createServiceRoleClient();
    let tableQuery = admin
        .from('tables')
        .select('id, table_number, status')
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

    const tableStatus = String(table.status ?? 'available');
    if (tableStatus === 'available') {
        return apiError(
            'Cannot request bill for an available table',
            409,
            'BILL_REQUEST_INVALID_TABLE_STATE'
        );
    }

    const now = new Date().toISOString();
    const { data: existingBillRequest } = await admin
        .from('service_requests')
        .select('id, status')
        .eq('restaurant_id', ctx.restaurantId)
        .eq('table_number', table.table_number)
        .eq('request_type', 'bill')
        .in('status', ['pending', 'acknowledged'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!existingBillRequest) {
        await admin.from('service_requests').insert({
            restaurant_id: ctx.restaurantId,
            table_number: table.table_number,
            request_type: 'bill',
            status: 'pending',
            notes: notes ?? 'Bill requested via waiter POS',
        });
    }

    const { error: tableUpdateError } = await admin
        .from('tables')
        .update({
            status: 'bill_requested',
            updated_at: now,
        })
        .eq('id', table.id)
        .eq('restaurant_id', ctx.restaurantId);

    if (tableUpdateError) {
        return apiError(
            'Failed to mark table as bill requested',
            500,
            'TABLE_BILL_REQUEST_UPDATE_FAILED',
            tableUpdateError.message
        );
    }

    return apiSuccess({
        table_id: table.id,
        table_number: table.table_number,
        status: 'bill_requested',
    });
}
