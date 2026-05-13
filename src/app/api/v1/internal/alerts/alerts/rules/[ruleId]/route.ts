import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { isIdempotencyKeyValid, resolveIdempotencyKey } from '@/lib/api/idempotency';
import type { Json } from '@/types/database';

const RuleIdSchema = z.string().uuid();

const AlertRulePatchSchema = z
    .object({
        name: z.string().trim().min(2).max(120).optional(),
        severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
        enabled: z.boolean().optional(),
        condition_json: z.record(z.string(), z.unknown()).optional(),
        target_json: z.record(z.string(), z.unknown()).optional(),
    })
    .refine(value => Object.keys(value).length > 0, {
        message: 'At least one field is required',
    });

export async function PATCH(
    request: Request,
    routeContext: { params: Promise<{ ruleId: string }> }
) {
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

    const parsedBody = await parseJsonBody(request, AlertRulePatchSchema);
    if (!parsedBody.success) {
        return parsedBody.response;
    }

    const { ruleId } = await routeContext.params;
    const parsedRuleId = RuleIdSchema.safeParse(ruleId);
    if (!parsedRuleId.success) {
        return apiError(
            'Invalid alert rule id',
            400,
            'INVALID_ALERT_RULE_ID',
            parsedRuleId.error.flatten()
        );
    }

    const { data: existing, error: fetchError } = await context.supabase
        .from('alert_rules')
        .select('id, name, severity, enabled, condition_json, target_json')
        .eq('id', parsedRuleId.data)
        .eq('restaurant_id', context.restaurantId)
        .maybeSingle();

    if (fetchError) {
        return apiError(
            'Failed to load alert rule',
            500,
            'ALERT_RULE_FETCH_FAILED',
            fetchError.message
        );
    }
    if (!existing) {
        return apiError('Alert rule not found', 404, 'ALERT_RULE_NOT_FOUND');
    }

    const updatePayload = {
        ...parsedBody.data,
        condition_json: parsedBody.data.condition_json as Json | undefined,
        target_json: parsedBody.data.target_json as Json | undefined,
    };

    const { data: updated, error: updateError } = await context.supabase
        .from('alert_rules')
        .update(updatePayload)
        .eq('id', parsedRuleId.data)
        .eq('restaurant_id', context.restaurantId)
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, severity, enabled, condition_json, target_json, created_at, updated_at'
        )
        .single();

    if (updateError) {
        return apiError(
            'Failed to update alert rule',
            500,
            'ALERT_RULE_UPDATE_FAILED',
            updateError.message
        );
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'alert_rule_updated',
        entity_type: 'alert_rule',
        entity_id: updated.id,
        old_value: existing as unknown as Json,
        new_value: updated as unknown as Json,
        metadata: {
            source: 'merchant_dashboard',
            idempotency_key: idempotencyKey,
        },
    });

    return apiSuccess({ rule: updated, idempotency_key: idempotencyKey });
}
