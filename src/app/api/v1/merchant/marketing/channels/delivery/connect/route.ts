import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { isIdempotencyKeyValid, resolveIdempotencyKey } from '@/lib/api/idempotency';
import type { Json } from '@/types/database';

const DeliveryConnectSchema = z.object({
    provider: z.enum(['beu', 'deliver_addis', 'zmall', 'telebirr_food', 'esoora', 'custom_local']),
    display_name: z.string().trim().min(2).max(80).optional(),
    credentials_ref: z.string().trim().min(3).max(200).optional(),
    settings_json: z.record(z.string(), z.unknown()).optional(),
});

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

    const parsed = await parseJsonBody(request, DeliveryConnectSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const payload = {
        restaurant_id: context.restaurantId,
        provider: parsed.data.provider,
        display_name: parsed.data.display_name ?? parsed.data.provider,
        status: 'connected' as const,
        credentials_ref: parsed.data.credentials_ref ?? null,
        settings_json: (parsed.data.settings_json ?? {}) as Json,
        last_sync_at: new Date().toISOString(),
        created_by: auth.user.id,
    };

    const { data, error } = await context.supabase
        .from('delivery_partners')
        .upsert(payload, { onConflict: 'restaurant_id,provider' })
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, provider, display_name, status, credentials_ref, settings_json, api_key, last_sync_at, created_by, created_at, updated_at'
        )
        .single();

    if (error) {
        return apiError(
            'Failed to connect delivery partner',
            500,
            'DELIVERY_PARTNER_CONNECT_FAILED',
            error.message
        );
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'delivery_partner_connected',
        entity_type: 'delivery_partner',
        entity_id: data.id,
        new_value: {
            provider: data.provider,
            status: data.status,
            display_name: data.display_name,
        },
        metadata: {
            source: 'merchant_dashboard',
            idempotency_key: idempotencyKey,
        },
    });

    return apiSuccess(
        {
            partner: data,
            idempotency_key: idempotencyKey,
        },
        201
    );
}
