import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';

const UpdateProgramSchema = z.object({
    name: z.string().trim().min(2).max(120).optional(),
    points_rule_json: z.record(z.string(), z.unknown()).optional(),
    tier_rule_json: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
});

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ programId: string }> }
) {
    const { programId } = await params;
    const auth = await getAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p2' });
    if (!context.ok) return context.response;

    const parsed = await parseJsonBody(request, UpdateProgramSchema);
    if (!parsed.success) return parsed.response;

    const db = context.supabase as SupabaseClient<Database>;

    const { data: program, error: fetchError } = await db
        .from('loyalty_programs')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, points_rule_json, tier_rule_json, status, created_at, updated_at'
        )
        .eq('id', programId)
        .eq('restaurant_id', context.restaurantId)
        .single();

    if (fetchError || !program) {
        return apiError('Program not found', 404, 'LOYALTY_PROGRAM_NOT_FOUND');
    }

    const updateData = {
        ...parsed.data,
        points_rule_json: parsed.data.points_rule_json
            ? (parsed.data.points_rule_json as Json)
            : undefined,
        tier_rule_json: parsed.data.tier_rule_json
            ? (parsed.data.tier_rule_json as Json)
            : undefined,
        updated_at: new Date().toISOString(),
    };
    const { data, error } = await db
        .from('loyalty_programs')
        .update(updateData)
        .eq('id', programId)
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, points_rule_json, tier_rule_json, status, created_at, updated_at'
        )
        .single();

    if (error) {
        return apiError(
            'Failed to update program',
            500,
            'LOYALTY_PROGRAM_UPDATE_FAILED',
            error.message
        );
    }

    await writeAuditLog(context.supabase as SupabaseClient<Database>, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'loyalty_program_updated',
        entity_type: 'loyalty_program',
        entity_id: programId,
        old_value: program,
        new_value: data,
        metadata: { source: 'merchant_dashboard' },
    });

    return apiSuccess({ program: data });
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ programId: string }> }
) {
    const { programId } = await params;

    const auth = await getAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p2' });
    if (!context.ok) return context.response;

    const db = context.supabase as SupabaseClient<Database>;

    const { error } = await db
        .from('loyalty_programs')
        .delete()
        .eq('id', programId)
        .eq('restaurant_id', context.restaurantId);

    if (error) {
        return apiError(
            'Failed to delete program',
            500,
            'LOYALTY_PROGRAM_DELETE_FAILED',
            error.message
        );
    }

    await writeAuditLog(context.supabase as SupabaseClient<Database>, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'loyalty_program_deleted',
        entity_type: 'loyalty_program',
        entity_id: programId,
        metadata: { source: 'merchant_dashboard' },
    });

    return apiSuccess({ deleted: true });
}
