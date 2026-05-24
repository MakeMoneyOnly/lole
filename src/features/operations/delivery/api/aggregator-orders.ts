import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { AggregatorOrderSchema, type AggregatorOrderResponse } from '../contracts';
import type { Json } from '@/types/database';
import type { Database } from '@/types/database';

const PROVIDER_CONFIGS = {
    beu: { name: 'Beu', orderPrefix: 'BEU' },
    zmall: { name: 'Zmall', orderPrefix: 'ZML' },
    deliver_addis: { name: 'Deliver Addis', orderPrefix: 'DA' },
    telebirr_food: { name: 'Telebirr Food', orderPrefix: 'TBF' },
    esoora: { name: 'Esoora', orderPrefix: 'ESR' },
    custom_local: { name: 'Custom Local', orderPrefix: 'LOC' },
} as const;

type DeliveryProvider = keyof typeof PROVIDER_CONFIGS;

function generateProviderOrderId(provider: DeliveryProvider): string {
    const prefix = PROVIDER_CONFIGS[provider].orderPrefix;
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

export async function aggregatorOrdersHandler(request: NextRequest): Promise<Response> {
    try {
        const auth = await requireMerchantAuth(request);

        if (!auth.ok) {
            return auth.response;
        }

        const { supabase, restaurantId } = auth;

        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return apiError('Invalid JSON body', 400, 'INVALID_JSON');
        }

        const rawCommand = {
            ...body,
        };

        const validated = AggregatorOrderSchema.parse(rawCommand);
        const { provider, externalOrderId, total, currency } = validated;

        // Generate or extract order ID
        const providerOrderId = externalOrderId ?? generateProviderOrderId(provider);

        // Check for duplicate order
        const { data: existingOrder } = await supabase
            .from('external_orders')
            .select('id, provider_order_id')
            .eq('restaurant_id', restaurantId)
            .eq('provider', provider)
            .eq('provider_order_id', providerOrderId)
            .maybeSingle();

        if (existingOrder) {
            return apiSuccess({
                message: 'Order already exists',
                order_id: existingOrder.id,
                provider_order_id: providerOrderId,
                duplicate: true,
            });
        }

        // Create new external order - store all data in payload_json
        const { data: newOrder, error: createError } = await supabase
            .from('external_orders')
            .insert({
                restaurant_id: restaurantId,
                provider,
                provider_order_id: providerOrderId,
                source_channel: provider,
                normalized_status: 'pending',
                total_amount: total,
                currency,
                payload_json: body as unknown as Json,
            } satisfies Database['public']['Tables']['external_orders']['Insert'])
            .select()
            .single();

        if (createError) {
            return apiError(
                'Failed to create external order',
                500,
                'EXTERNAL_ORDER_CREATE_FAILED',
                createError.message
            );
        }

        // Build response matching the schema
        const response: AggregatorOrderResponse = {
            id: newOrder.id,
            restaurant_id: newOrder.restaurant_id,
            provider: newOrder.provider as
                | 'beu'
                | 'zmall'
                | 'deliver_addis'
                | 'telebirr_food'
                | 'esoora'
                | 'custom_local',
            provider_order_id: newOrder.provider_order_id,
            normalized_status: newOrder.normalized_status,
            total_amount: newOrder.total_amount,
            currency: newOrder.currency,
            customer_name: null,
            customer_phone: null,
            source_channel: newOrder.source_channel,
            created_at: newOrder.created_at,
            updated_at: newOrder.updated_at,
        };

        return apiSuccess({ order: response }, 201);
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'aggregatorOrders',
        });
    }
}
