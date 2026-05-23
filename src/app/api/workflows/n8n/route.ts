import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess, handleApiError } from '@/lib/api/response';
import { N8nClient, validateN8nPayload } from '@/lib/automation';
import { createDefaultRegistry, WorkflowRegistry, WorkflowResult } from '@/lib/automation';
import { tenantContext } from '@/lib/context/tenant-context';
import { logger } from '@/lib/logger';
import { createloleEvent, loleEvent } from '@/lib/events/contracts';

const N8nWebhookSchema = z.object({
    event: z.string(),
    timestamp: z.string().datetime().optional(),
    tenant_id: z.string().uuid().optional(),
    data: z.record(z.string(), z.unknown()),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

const EventTypeSchema = z.enum([
    'order.created',
    'order.status_changed',
    'order.completed',
    'order.cancelled',
    'payment.completed',
    'payment.failed',
    'menu.updated',
    'notification.queued',
    'notification.sent',
    'notification.failed',
]);

type N8nWebhookEvent = z.infer<typeof EventTypeSchema>;

const webhookLogger = logger.child('n8n-webhook');

export async function POST(request: NextRequest): Promise<Response> {
    const startTime = Date.now();
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

    try {
        webhookLogger.info('Received n8n webhook request', { requestId });

        const body = await request.json().catch(() => null);
        if (!validateN8nPayload(body)) {
            webhookLogger.warn('Invalid n8n payload received', {
                requestId,
                bodyType: typeof body,
            });
            return apiError('Invalid payload', 400, 'INVALID_PAYLOAD');
        }

        const parsed = N8nWebhookSchema.safeParse(body);
        if (!parsed.success) {
            webhookLogger.warn('Payload validation failed', {
                requestId,
                errors: parsed.error.flatten(),
            });
            return apiError(
                'Invalid webhook payload',
                400,
                'INVALID_PAYLOAD',
                parsed.error.flatten()
            );
        }

        const { event, data, metadata, tenant_id, timestamp } = parsed.data;
        webhookLogger.info('Processing n8n webhook event', { requestId, event, tenant_id });

        const client = N8nClient.createDefault();

        const eventName = event as N8nWebhookEvent;
        const eventPayload = data;

        const loleEventPayload = createloleEvent(eventName, {
            ...eventPayload,
            tenant_id: tenant_id || eventPayload.tenant_id || 'system',
            webhook_timestamp: timestamp,
            webhook_metadata: metadata,
        });

        const registry = createDefaultRegistry(client);
        const result = await processEventWithRegistry(loleEventPayload, registry, {
            tenant_id,
            requestId,
        });

        const duration = Date.now() - startTime;
        webhookLogger.info('Webhook processed', {
            requestId,
            event: eventName,
            success: result.success,
            duration,
        });

        return apiSuccess({
            success: result.success,
            event,
            execution_id: result.webhookResponse?.execution_id,
            workflow_id: result.webhookResponse?.workflow_id,
            error: result.error,
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        webhookLogger.error('Webhook processing error', error, { requestId, duration });
        return handleApiError(error, {
            operation: 'n8n-webhook',
            restaurantId: 'system',
        });
    }
}

interface ProcessContext {
    tenant_id?: string;
    requestId?: string;
}

async function processEventWithRegistry(
    event: loleEvent,
    registry: WorkflowRegistry,
    context: ProcessContext
): Promise<WorkflowResult> {
    const tenantId = context.tenant_id || 'system';

    return tenantContext.run({ restaurantId: tenantId, requestId: context.requestId }, async () => {
        const result = await registry.handle(event);
        return result;
    });
}

export async function GET(request: NextRequest): Promise<Response> {
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
    webhookLogger.info('n8n webhook info request', { requestId });

    return apiSuccess({
        status: 'ok',
        endpoint: '/api/workflows/n8n',
        supported_events: EventTypeSchema.options,
    });
}
