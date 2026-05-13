import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';

const CreateSupportTicketSchema = z.object({
    subject: z.string().trim().min(3).max(140),
    description: z.string().trim().min(5).max(5000),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
    diagnostics_json: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const url = new URL(request.url);
    const limitRaw = Number.parseInt(url.searchParams.get('limit') ?? '20', 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 100)) : 20;

    const { data, error } = await (context.supabase as SupabaseClient<Database>)
        .from('support_tickets')
        .select('id, subject, description, priority, status, source, created_at, updated_at')
        .eq('restaurant_id', context.restaurantId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        return apiError(
            'Failed to fetch support tickets',
            500,
            'SUPPORT_TICKETS_FETCH_FAILED',
            error.message
        );
    }

    return apiSuccess({ tickets: data ?? [] });
}

export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const parsed = await parseJsonBody(request, CreateSupportTicketSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { data, error } = await (context.supabase as SupabaseClient<Database>)
        .from('support_tickets')
        .insert({
            restaurant_id: context.restaurantId,
            source: 'merchant_dashboard',
            subject: parsed.data.subject,
            description: parsed.data.description,
            priority: parsed.data.priority,
            status: 'open',
            diagnostics_json: (parsed.data.diagnostics_json ?? {}) as Json,
            created_by: auth.user.id,
        })
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, subject, description, priority, source, status, diagnostics_json, created_by, created_at, updated_at'
        )
        .single();

    if (error) {
        return apiError(
            'Failed to create support ticket',
            500,
            'SUPPORT_TICKET_CREATE_FAILED',
            error.message
        );
    }

    await writeAuditLog(context.supabase as SupabaseClient<Database>, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'support_ticket_created',
        entity_type: 'support_ticket',
        entity_id: data.id,
        metadata: {
            priority: data.priority,
            source: data.source,
        },
        new_value: {
            status: data.status,
            subject: data.subject,
        },
    });

    return apiSuccess(data, 201);
}
