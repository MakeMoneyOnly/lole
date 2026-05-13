import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { isIdempotencyKeyValid, resolveIdempotencyKey } from '@/lib/api/idempotency';
import type { Json } from '@/types/database';

const AlertRuleSchema = z.object({
    name: z.string().trim().min(2).max(120),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    enabled: z.boolean().optional(),
    condition_json: z.record(z.string(), z.unknown()),
    target_json: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    const { data, error } = await context.supabase
        .from('alert_rules')
        .select('id, name, severity, enabled, condition_json, target_json, created_at, updated_at')
        .eq('restaurant_id', context.restaurantId)
        .order('created_at', { ascending: false });

    if (error) {
        return apiError(
            'Failed to fetch alert rules',
            500,
            'ALERT_RULES_FETCH_FAILED',
            error.message
        );
    }

    return apiSuccess({ rules: data ?? [] });
}

export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    const explicitIdempotencyKey = request.headers.get('x-idempotency-key');
    if (explicitIdempotencyKey && !isIdempotencyKeyValid(explicitIdempotencyKey)) {
        return apiError('Invalid idempotency key', 400, 'INVALID_IDEMPOTENCY_KEY');
    }
    const idempotencyKey = resolveIdempotencyKey(explicitIdempotencyKey);

    const parsed = await parseJsonBody(request, AlertRuleSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const payload = {
        restaurant_id: context.restaurantId,
        name: parsed.data.name,
        severity: parsed.data.severity,
        enabled: parsed.data.enabled ?? true,
        condition_json: parsed.data.condition_json as Json,
        target_json: (parsed.data.target_json ?? {}) as Json,
    };

    const { data: inserted, error: insertError } = await context.supabase
        .from('alert_rules')
        .insert(payload)
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, severity, enabled, condition_json, target_json, created_at, updated_at'
        )
        .single();

    if (insertError) {
        return apiError(
            'Failed to create alert rule',
            500,
            'ALERT_RULE_CREATE_FAILED',
            insertError.message
        );
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'alert_rule_created',
        entity_type: 'alert_rule',
        entity_id: inserted.id,
        metadata: {
            source: 'merchant_dashboard',
            idempotency_key: idempotencyKey,
        },
        new_value: inserted as unknown as Json,
    });

    return apiSuccess({ rule: inserted, idempotency_key: idempotencyKey }, 201);
}
