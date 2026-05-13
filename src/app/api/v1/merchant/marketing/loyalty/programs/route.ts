import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { isIdempotencyKeyValid, resolveIdempotencyKey } from '@/lib/api/idempotency';
import { isSchemaNotReadyError } from '@/lib/api/schemaFallback';
import type { Json } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const CreateProgramSchema = z.object({
    name: z.string().trim().min(2).max(120),
    points_rule_json: z.record(z.string(), z.unknown()).optional(),
    tier_rule_json: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
});

export async function GET() {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p2' });
    if (!context.ok) {
        return context.response;
    }

    const db = context.supabase as SupabaseClient<Database>;

    const { data, error } = await db
        .from('loyalty_programs')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, points_rule_json, tier_rule_json, status, created_by, created_at, updated_at'
        )
        .eq('restaurant_id', context.restaurantId)
        .order('created_at', { ascending: false });

    if (error) {
        if (isSchemaNotReadyError(error)) {
            return apiSuccess({ programs: [] });
        }
        return apiError(
            'Failed to fetch loyalty programs',
            500,
            'LOYALTY_PROGRAMS_FETCH_FAILED',
            error.message
        );
    }

    return apiSuccess({ programs: data ?? [] });
}

export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p2' });
    if (!context.ok) {
        return context.response;
    }

    const explicitIdempotencyKey = request.headers.get('x-idempotency-key');
    if (explicitIdempotencyKey && !isIdempotencyKeyValid(explicitIdempotencyKey)) {
        return apiError('Invalid idempotency key', 400, 'INVALID_IDEMPOTENCY_KEY');
    }
    const idempotencyKey = resolveIdempotencyKey(explicitIdempotencyKey);

    const db = context.supabase as SupabaseClient<Database>;

    const parsed = await parseJsonBody(request, CreateProgramSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const payload = {
        restaurant_id: context.restaurantId,
        name: parsed.data.name,
        points_rule_json: (parsed.data.points_rule_json ?? {
            points_per_currency_unit: 1,
            currency_unit: 1,
        }) as Json,
        tier_rule_json: (parsed.data.tier_rule_json ?? {}) as Json,
        status: parsed.data.status ?? 'draft',
        created_by: auth.user.id,
    };

    const { data, error } = await db
        .from('loyalty_programs')
        .insert(payload)
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, points_rule_json, tier_rule_json, status, created_by, created_at, updated_at'
        )
        .single();

    if (error) {
        return apiError(
            'Failed to create loyalty program',
            500,
            'LOYALTY_PROGRAM_CREATE_FAILED',
            error.message
        );
    }

    await writeAuditLog(context.supabase as SupabaseClient<Database>, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'loyalty_program_created',
        entity_type: 'loyalty_program',
        entity_id: data.id,
        new_value: {
            name: data.name,
            status: data.status,
            points_rule_json: data.points_rule_json,
        },
        metadata: {
            source: 'merchant_dashboard',
            idempotency_key: idempotencyKey,
        },
    });

    return apiSuccess({ program: data, idempotency_key: idempotencyKey }, 201);
}
