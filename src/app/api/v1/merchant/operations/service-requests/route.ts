/**
 * Service Requests API Routes
 *
 * RESTful endpoints for service request management.
 * - GET /api/v1/merchant/operations/service-requests - List service requests (staff)
 */

import { listRequests } from '@/features/operations/service-requests/api';
import { apiError, apiSuccess } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { insertServiceRequest } from '@/lib/supabase/queries';
import { resolveGuestContext } from '@/lib/security/guestContext';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const log = logger.child('service-requests');

const CreateServiceRequestSchema = z.object({
    guest_context: z.object({
        slug: z.string().min(1),
        table: z.string().min(1),
        sig: z.string().min(1),
        exp: z.union([z.string(), z.number()]),
    }),
    request_type: z.enum(['waiter', 'bill', 'cutlery', 'other']),
    notes: z.string().max(500).optional(),
});

/**
 * GET /api/v1/merchant/operations/service-requests
 * List service requests for a restaurant
 */
export const GET = listRequests;

/**
 * POST /api/v1/merchant/operations/service-requests
 * Create a service request (guest endpoint)
 */
export async function POST(request: Request): Promise<Response> {
    try {
        const body = await request.json();
        const parsed = CreateServiceRequestSchema.safeParse(body);

        if (!parsed.success) {
            return apiError(
                'Invalid request payload',
                400,
                'INVALID_PAYLOAD',
                parsed.error.flatten()
            );
        }

        const supabase = await createClient();
        const guestContext = await resolveGuestContext(supabase, parsed.data.guest_context);
        if (!guestContext.valid) {
            return apiError(guestContext.reason, guestContext.status, 'INVALID_GUEST_CONTEXT');
        }

        const adminSupabase = createServiceRoleClient();
        const { data, error } = await insertServiceRequest(adminSupabase, {
            restaurant_id: guestContext.data.restaurantId,
            table_number: guestContext.data.tableNumber,
            request_type: parsed.data.request_type,
            notes: parsed.data.notes,
        });

        if (error || !data) {
            return apiError(
                error?.message ?? 'Failed to create service request',
                400,
                'CREATE_FAILED'
            );
        }

        if (parsed.data.request_type === 'bill') {
            await adminSupabase
                .from('tables')
                .update({ status: 'bill_requested', updated_at: new Date().toISOString() })
                .eq('restaurant_id', guestContext.data.restaurantId)
                .eq('table_number', guestContext.data.tableNumber)
                .neq('status', 'available')
                .then(({ error: tableStateError }) => {
                    if (tableStateError)
                        log.warn('failed to promote table', { message: tableStateError.message });
                });
        }

        await adminSupabase.from('audit_logs').insert({
            restaurant_id: guestContext.data.restaurantId,
            action: 'service_request_created_guest',
            entity_type: 'service_request',
            entity_id: data.id,
            metadata: {
                table_number: guestContext.data.tableNumber,
                request_type: parsed.data.request_type,
                source: 'guest_web',
                slug: guestContext.data.slug,
            },
            new_value: { status: data.status },
        });

        return apiSuccess(data, 201);
    } catch (error) {
        log.error('failed', error);
        return apiError('Internal server error', 500, 'INTERNAL_ERROR');
    }
}
