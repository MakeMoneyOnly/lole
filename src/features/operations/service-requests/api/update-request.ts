import { apiError, apiSuccess } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { UpdateServiceRequestSchema } from '../contracts';
import { auditServiceRequest } from '../../shared/audit-helpers';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pending: ['in_progress', 'completed'],
    in_progress: ['completed'],
    completed: [],
};

function canTransition(currentStatus: string, nextStatus: string): boolean {
    if (!currentStatus) {
        return false;
    }
    return (ALLOWED_TRANSITIONS[currentStatus] ?? []).includes(nextStatus);
}

interface ServiceRequest {
    id: string;
    restaurant_id: string;
    status: string;
}

export async function updateRequestHandler(
    request: Request,
    context: { params: Promise<{ requestId: string }> }
): Promise<Response> {
    try {
        const auth = await requireMerchantAuth(request);

        if (!auth.ok) {
            return auth.response;
        }

        const { supabase, restaurantId, user } = auth;
        const resolvedParams = await context.params;
        const requestId = resolvedParams.requestId;

        const { data: requestRow, error: requestFetchError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
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
        if (!(requestRow as ServiceRequest).restaurant_id) {
            return apiError(
                'Service request is missing restaurant context',
                400,
                'INVALID_SERVICE_REQUEST_CONTEXT'
            );
        }

        const body = await request.json();
        const validated = UpdateServiceRequestSchema.pick({ status: true }).parse({
            restaurantId,
            requestId,
            status: body.status,
            staffId: user.id,
        });

        if (!canTransition((requestRow as ServiceRequest).status ?? '', validated.status)) {
            return apiError(
                `Invalid status transition from "${(requestRow as ServiceRequest).status}" to "${validated.status}"`,
                409,
                'INVALID_TRANSITION'
            );
        }

        const now = new Date().toISOString();
        const updatePayload: { status: string; completed_at?: string } = {
            status: validated.status,
        };
        if (validated.status === 'completed') {
            updatePayload.completed_at = now;
        }

        const { data: updatedRequest, error: updateError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('service_requests')
                .update(updatePayload)
                .eq('id', (requestRow as ServiceRequest).id)
                .select('*')
                .single();

        if (updateError || !updatedRequest) {
            return apiError(
                'Failed to update service request',
                500,
                'SERVICE_REQUEST_UPDATE_FAILED',
                updateError?.message
            );
        }

        await auditServiceRequest(supabase, (requestRow as ServiceRequest).restaurant_id, {
            requestId: (requestRow as ServiceRequest).id,
            userId: user.id,
            action: 'updated',
        });

        return apiSuccess(updatedRequest);
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'updateRequest',
        });
    }
}
