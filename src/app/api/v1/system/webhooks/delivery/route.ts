import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError, apiSuccess } from '@/lib/api/response';
import { writeAuditLog } from '@/lib/api/audit';
import { AggregatorService } from '@/lib/delivery/aggregator';
import { getStoreGatewayService } from '@/lib/gateway/service';
import { z } from 'zod';
import type { Json } from '@/types/database';

/**
 * Inbound Webhook Endpoint for Delivery Partners
 *
 * POST /api/webhooks/delivery
 *
 * Receives order webhooks from external delivery partners (Beu, Zmall, Deliver Addis, etc.)
 * and normalizes them into the external_orders table.
 *
 * Headers:
 * - X-Provider: The delivery provider (beu, zmall, deliver_addis, telebirr_food, esoora, custom_local)
 * - X-API-Key: The integration API key for the restaurant
 * - X-Signature: HMAC signature of the payload (optional, for verification)
 */

// Webhook payload schema (flexible to accommodate different providers)
const WebhookPayloadSchema = z.object({
    // Standard fields
    order_id: z.string().optional(),
    external_order_id: z.string().optional(),
    customer_name: z.string().optional(),
    customer_phone: z.string().optional(),
    total: z.number().optional(),
    total_amount: z.number().optional(),
    currency: z.string().default('ETB'),
    items: z.array(z.unknown()).optional(),
    delivery_address: z.any().optional(),
    notes: z.string().optional(),
    status: z.string().optional(),
    created_at: z.string().optional(),
    // Allow additional provider-specific fields
    metadata: z.record(z.string(), z.unknown()).optional(),
});

type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// Provider configurations
const PROVIDER_CONFIGS = {
    beu: {
        name: 'Beu',
        color: '#FF6B00', // Orange
        orderPrefix: 'BEU',
    },
    zmall: {
        name: 'Zmall',
        color: '#00A651', // Green
        orderPrefix: 'ZML',
    },
    deliver_addis: {
        name: 'Deliver Addis',
        color: '#2196F3', // Blue
        orderPrefix: 'DA',
    },
    telebirr_food: {
        name: 'Telebirr Food',
        color: '#EAB308', // Amber
        orderPrefix: 'TBF',
    },
    esoora: {
        name: 'Esoora',
        color: '#9C27B0', // Purple
        orderPrefix: 'ESR',
    },
    custom_local: {
        name: 'Custom Local',
        color: '#607D8B', // Grey
        orderPrefix: 'LOC',
    },
} as const;

type Provider = keyof typeof PROVIDER_CONFIGS;

function createDeliveryAggregatorService() {
    return new AggregatorService({
        publishLocalEvent: async event => {
            const gateway = getStoreGatewayService();
            if (!gateway) {
                return;
            }

            await gateway.publishCommand({
                type: event.type,
                aggregate: event.aggregate,
                aggregateId: event.aggregateId,
                payload: event.payload,
                restaurantId: event.restaurantId,
                locationId: event.locationId,
            });
        },
    });
}

/**
 * Normalize order status from different providers to our standard status
 */
function normalizeStatus(status: string | undefined): string {
    const statusMap: Record<string, string> = {
        // Common statuses
        pending: 'pending',
        new: 'pending',
        confirmed: 'confirmed',
        accepted: 'confirmed',
        preparing: 'preparing',
        cooking: 'preparing',
        ready: 'ready',
        picked_up: 'picked_up',
        on_the_way: 'on_the_way',
        delivered: 'delivered',
        completed: 'delivered',
        cancelled: 'cancelled',
        canceled: 'cancelled',
        rejected: 'rejected',
    };

    return statusMap[status?.toLowerCase() ?? 'pending'] ?? 'pending';
}

/**
 * Generate a unique provider order ID if not provided
 */
function generateProviderOrderId(provider: Provider): string {
    const prefix = PROVIDER_CONFIGS[provider].orderPrefix;
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
}

export async function POST(request: NextRequest) {
    const startTime = Date.now();

    // Extract headers
    const provider = request.headers.get('X-Provider')?.toLowerCase() as Provider | null;
    const apiKey = request.headers.get('X-API-Key');
    // Signature validation can be added later for enhanced security
    // const signature = request.headers.get('X-Signature');

    // Validate provider
    if (!provider || !PROVIDER_CONFIGS[provider]) {
        return apiError(
            'Invalid or missing X-Provider header. Supported: beu, zmall, deliver_addis, telebirr_food, esoora, custom_local',
            400,
            'INVALID_PROVIDER'
        );
    }

    // Validate API key
    if (!apiKey) {
        return apiError('Missing X-API-Key header', 401, 'MISSING_API_KEY');
    }

    // Parse and validate payload
    let payload: WebhookPayload;
    try {
        const body = await request.json();
        const parsed = WebhookPayloadSchema.safeParse(body);
        if (!parsed.success) {
            return apiError(
                'Invalid webhook payload',
                400,
                'INVALID_PAYLOAD',
                parsed.error.flatten()
            );
        }
        payload = parsed.data;
    } catch {
        return apiError('Failed to parse request body', 400, 'INVALID_JSON');
    }

    const supabase = await createClient();

    // Find restaurant by API key
    // The API key should be stored in delivery_partners.credentials_ref or settings_json
    const { data: partner, error: partnerError } = await supabase
        .from('delivery_partners')
        .select('id, restaurant_id, settings_json, credentials_ref')
        .eq('provider', provider)
        .eq('status', 'connected')
        .maybeSingle();

    if (partnerError) {
        console.error('Failed to query delivery partner:', partnerError);
        return apiError('Internal server error', 500, 'DATABASE_ERROR');
    }

    if (!partner) {
        return apiError(
            'No active delivery partner found for this provider',
            404,
            'PARTNER_NOT_FOUND'
        );
    }

    // Validate API key against stored credentials
    const settings = partner.settings_json as Record<string, unknown> | null;
    const storedApiKey = (settings?.api_key as string) ?? partner.credentials_ref;

    if (!storedApiKey || storedApiKey !== apiKey) {
        await writeAuditLog(supabase, {
            restaurant_id: partner.restaurant_id,
            action: 'webhook_auth_failed',
            entity_type: 'delivery_partner',
            entity_id: partner.id,
            metadata: {
                provider,
                reason: 'invalid_api_key',
            },
        });

        return apiError('Invalid API key', 401, 'INVALID_API_KEY');
    }

    // Generate or extract order ID
    const providerOrderId =
        payload.order_id ?? payload.external_order_id ?? generateProviderOrderId(provider);
    const totalAmount = payload.total ?? payload.total_amount ?? 0;
    const normalizedStatus = normalizeStatus(payload.status);

    // Check for duplicate order
    const { data: existingOrder } = await supabase
        .from('external_orders')
        .select('id, provider_order_id')
        .eq('restaurant_id', partner.restaurant_id)
        .eq('provider', provider)
        .eq('provider_order_id', providerOrderId)
        .maybeSingle();

    if (existingOrder) {
        // Update existing order instead of creating duplicate
        const { data: updatedOrder, error: updateError } = await supabase
            .from('external_orders')
            .update({
                normalized_status: normalizedStatus,
                payload_json: payload as unknown as Json,
                updated_at: new Date().toISOString(),
            })
            .eq('id', existingOrder.id)
            .select()
            .single();

        if (updateError) {
            console.error('Failed to update external order:', updateError);
            return apiError('Failed to update order', 500, 'UPDATE_FAILED');
        }

        return apiSuccess({
            message: 'Order updated',
            order_id: updatedOrder.id,
            provider_order_id: providerOrderId,
            status: normalizedStatus,
            duplicate: true,
        });
    }

    // Create new external order
    const { data: newOrder, error: createError } = await supabase
        .from('external_orders')
        .insert({
            restaurant_id: partner.restaurant_id,
            delivery_partner_id: partner.id,
            provider: provider,
            provider_order_id: providerOrderId,
            source_channel: provider,
            normalized_status: normalizedStatus,
            total_amount: totalAmount,
            currency: payload.currency ?? 'ETB',
            payload_json: payload as unknown as Json,
        })
        .select()
        .single();

    if (createError) {
        console.error('Failed to create external order:', createError);
        return apiError('Failed to create order', 500, 'CREATE_FAILED', createError.message);
    }

    const aggregatorService = createDeliveryAggregatorService();
    const aggregatorResult = await aggregatorService.receiveAndBroadcastOrder(
        supabase as never,
        partner.restaurant_id,
        partner.id,
        {
            external_order_id: providerOrderId,
            external_order_number: payload.external_order_id ?? undefined,
            raw_order_data: payload as unknown as Record<string, unknown>,
            customer_name: payload.customer_name ?? undefined,
            customer_phone: payload.customer_phone ?? undefined,
            delivery_address:
                typeof payload.delivery_address === 'string' ? payload.delivery_address : undefined,
            delivery_notes: payload.notes ?? undefined,
            items: Array.isArray(payload.items)
                ? payload.items.flatMap(item => {
                      if (!item || typeof item !== 'object') {
                          return [];
                      }

                      const candidate = item as Record<string, unknown>;
                      const name =
                          typeof candidate.name === 'string'
                              ? candidate.name
                              : typeof candidate.item_name === 'string'
                                ? candidate.item_name
                                : 'Unknown Item';
                      const quantity = Number(candidate.quantity ?? 1);
                      const price = Number(
                          candidate.price ?? candidate.unit_price ?? candidate.total_price ?? 0
                      );
                      const notes =
                          typeof candidate.notes === 'string'
                              ? candidate.notes
                              : typeof candidate.special_instructions === 'string'
                                ? candidate.special_instructions
                                : undefined;

                      return [
                          {
                              name,
                              quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
                              price: Number.isFinite(price) ? price : 0,
                              ...(notes ? { notes } : {}),
                          },
                      ];
                  })
                : [],
            subtotal: totalAmount,
            delivery_fee: 0,
            platform_fee: 0,
            total: totalAmount,
            placed_at: payload.created_at ?? undefined,
        }
    );

    if (!aggregatorResult.success && aggregatorResult.error !== 'Order already exists') {
        console.error('Failed to inject webhook order into aggregator runtime:', aggregatorResult);
    }

    // Check if auto-accept is enabled
    const { data: restaurant } = await supabase
        .from('restaurants')
        .select('settings')
        .eq('id', partner.restaurant_id)
        .maybeSingle();

    const settings2 = (restaurant?.settings ?? {}) as Record<string, unknown>;
    const channels = (settings2.channels ?? {}) as Record<string, unknown>;
    const onlineOrdering = (channels.online_ordering ?? {}) as Record<string, unknown>;
    const autoAccept = onlineOrdering.auto_accept_orders === true;

    // Log the webhook
    await writeAuditLog(supabase, {
        restaurant_id: partner.restaurant_id,
        action: 'external_order_received',
        entity_type: 'external_order',
        entity_id: newOrder.id,
        metadata: {
            provider,
            provider_order_id: providerOrderId,
            total_amount: totalAmount,
            currency: payload.currency ?? 'ETB',
            status: normalizedStatus,
            auto_accept: autoAccept,
            runtime_injected:
                aggregatorResult.success || aggregatorResult.error === 'Order already exists',
            aggregator_order_id: aggregatorResult.order?.id ?? null,
            processing_time_ms: Date.now() - startTime,
        },
    });

    // Return success response
    return apiSuccess(
        {
            message: 'Order received successfully',
            order_id: newOrder.id,
            provider_order_id: providerOrderId,
            status: normalizedStatus,
            auto_accepted: autoAccept,
            runtime_injected:
                aggregatorResult.success || aggregatorResult.error === 'Order already exists',
            aggregator_order_id: aggregatorResult.order?.id ?? null,
            processing_time_ms: Date.now() - startTime,
        },
        201
    );
}
