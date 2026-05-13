import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { enforcePilotAccess } from '@/lib/api/pilotGate';

const UpdateServiceRequestSchema = z.object({
    status: z.enum(['pending', 'in_progress', 'completed']),
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pending: ['in_progress', 'completed'],
    in_progress: ['completed'],
    completed: [],
};

function canTransition(currentStatus: string | null, nextStatus: string) {
    if (!currentStatus) {
        return false;
    }
    return (ALLOWED_TRANSITIONS[currentStatus] ?? []).includes(nextStatus);
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ requestId: string }> }
) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const parsedBody = await parseJsonBody(request, UpdateServiceRequestSchema);
    if (!parsedBody.success) {
        return parsedBody.response;
    }

    const { requestId } = await context.params;
    const { data: requestRow, error: requestFetchError } = await auth.supabase
        .from('service_requests')
        .select('id, restaurant_id, status')
        .eq('id', requestId)
        .maybeSingle();

    if (requestFetchError) {
        return apiError(
            'Failed to load service request',
            500,
            'SERVICE_REQUEST_FETCH_FAILED',
            requestFetchError.message
        );
    }

    if (!requestRow) {
        return apiError('Service request not found', 404, 'SERVICE_REQUEST_NOT_FOUND');
    }
    if (!requestRow.restaurant_id) {
        return apiError(
            'Service request is missing restaurant context',
            400,
            'INVALID_SERVICE_REQUEST_CONTEXT'
        );
    }

    const pilotGateResponse = enforcePilotAccess(requestRow.restaurant_id, request.method);
    if (pilotGateResponse) {
        return pilotGateResponse;
    }

    const { data: staff, error: staffError } = await auth.supabase
        .from('restaurant_staff')
        .select('id')
        .eq('restaurant_id', requestRow.restaurant_id)
        .eq('user_id', auth.user.id)
        .eq('is_active', true)
        .maybeSingle();

    if (staffError) {
        return apiError(
            'Failed to verify staff access',
            500,
            'STAFF_ACCESS_CHECK_FAILED',
            staffError.message
        );
    }
    if (!staff) {
        return apiError('Forbidden', 403, 'FORBIDDEN');
    }

    if (!canTransition(requestRow.status, parsedBody.data.status)) {
        return apiError(
            `Invalid status transition from "${requestRow.status}" to "${parsedBody.data.status}"`,
            409,
            'INVALID_TRANSITION'
        );
    }

    const now = new Date().toISOString();
    const updatePayload: { status: string; completed_at?: string } = {
        status: parsedBody.data.status,
    };
    if (parsedBody.data.status === 'completed') {
        updatePayload.completed_at = now;
    }

    const { data: updatedRequest, error: updateError } = await auth.supabase
        .from('service_requests')
        .update(updatePayload)
        .eq('id', requestRow.id)
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, table_number, request_type, status, notes, completed_at, idempotency_key, created_at'
        )
        .single();

    if (updateError || !updatedRequest) {
        return apiError(
            'Failed to update service request',
            500,
            'SERVICE_REQUEST_UPDATE_FAILED',
            updateError?.message
        );
    }

    const { error: auditError } = await writeAuditLog(auth.supabase, {
        restaurant_id: requestRow.restaurant_id,
        user_id: auth.user.id,
        action: 'service_request_status_updated',
        entity_type: 'service_request',
        entity_id: requestRow.id,
        old_value: { status: requestRow.status },
        new_value: { status: parsedBody.data.status },
        metadata: { source: 'merchant_dashboard_orders_queue' },
    });
    if (auditError) {
        console.warn('[PATCH /api/service-requests/:id] audit insert failed:', auditError.message);
    }

    return apiSuccess(updatedRequest);
}
