import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { insertServiceRequest } from '@/lib/supabase/queries';
import { resolveGuestContext } from '@/lib/security/guestContext';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthorizedRestaurantContext, getAuthenticatedUser } from '@/lib/api/authz';
import { parseQuery } from '@/lib/api/validation';

const CreateServiceRequestSchema = z.object({
    guest_context: z.object({
        slug: z.string().min(1),
        table: z.string().min(1),
        sig: z.string().min(1),
        exp: z.union([z.string(), z.number()]),
    }),
    request_type: z.enum(['waiter', 'bill', 'cutlery', 'other']),
    notes: z.string().max(500, 'Notes too long').optional(),
});

const ListServiceRequestsQuerySchema = z.object({
    status: z.string().optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).optional().default(100),
    offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export async function GET(request: NextRequest) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const parsed = parseQuery(
        {
            status: request.nextUrl.searchParams.get('status') ?? undefined,
            search: request.nextUrl.searchParams.get('search') ?? undefined,
            limit: request.nextUrl.searchParams.get('limit') ?? undefined,
            offset: request.nextUrl.searchParams.get('offset') ?? undefined,
        },
        ListServiceRequestsQuerySchema
    );
    if (!parsed.success) {
        return parsed.response;
    }

    let query = context.supabase
        .from('service_requests')
        .select('*', { count: 'exact' })
        .eq('restaurant_id', context.restaurantId)
        .order('created_at', { ascending: false })
        .range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);

    if (parsed.data.status && parsed.data.status !== 'all') {
        query = query.eq('status', parsed.data.status);
    }

    if (parsed.data.search) {
        const search = parsed.data.search.trim();
        if (search.length > 0) {
            query = query.or(
                `table_number.ilike.%${search}%,request_type.ilike.%${search}%,notes.ilike.%${search}%`
            );
        }
    }

    const { data, error, count } = await query;
    if (error) {
        return apiError(
            'Failed to load service requests',
            500,
            'SERVICE_REQUESTS_FETCH_FAILED',
            error.message
        );
    }

    return apiSuccess({
        requests: data ?? [],
        total: count ?? 0,
    });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = CreateServiceRequestSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid request payload', details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        const guestContext = await resolveGuestContext(supabase, parsed.data.guest_context);
        if (!guestContext.valid) {
            return NextResponse.json(
                { error: guestContext.reason },
                { status: guestContext.status }
            );
        }

        const adminSupabase = createServiceRoleClient();
        const { data, error } = await insertServiceRequest(adminSupabase, {
            restaurant_id: guestContext.data.restaurantId,
            table_number: guestContext.data.tableNumber,
            request_type: parsed.data.request_type,
            notes: parsed.data.notes,
        });

        if (error || !data) {
            return NextResponse.json(
                { error: error?.message ?? 'Failed to create service request' },
                { status: 400 }
            );
        }

        if (parsed.data.request_type === 'bill') {
            const { error: tableStateError } = await adminSupabase
                .from('tables')
                .update({
                    status: 'bill_requested',
                    updated_at: new Date().toISOString(),
                })
                .eq('restaurant_id', guestContext.data.restaurantId)
                .eq('table_number', guestContext.data.tableNumber)
                .neq('status', 'available');

            if (tableStateError) {
                console.warn(
                    '[POST /api/service-requests] failed to promote table to bill_requested:',
                    tableStateError.message
                );
            }
        }

        const { error: auditError } = await adminSupabase.from('audit_logs').insert({
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
            new_value: {
                status: data.status,
            },
        });
        if (auditError) {
            console.warn('[POST /api/service-requests] audit insert failed:', auditError.message);
        }

        return NextResponse.json({ data }, { status: 201 });
    } catch (error) {
        console.error('[POST /api/service-requests] failed:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
