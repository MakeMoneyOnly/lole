import { N8nClient, N8nWebhookResponse } from './n8nClient';
import { loleEvent, loleEventName } from '../events/contracts';
import { AppError } from '../errors';

export interface WorkflowHandlerOptions {
    client: N8nClient;
    validate?: boolean;
    notifyOnError?: boolean;
}

export interface WorkflowResult {
    success: boolean;
    event: string;
    webhookResponse?: N8nWebhookResponse;
    error?: string;
}

export type EventHandler = (
    event: loleEvent<loleEventName>,
    client: N8nClient
) => Promise<WorkflowResult>;

const DEFAULT_BATCH_SIZE = 50;

export class WorkflowRegistry {
    private handlers: Map<string, EventHandler> = new Map();
    private client: N8nClient;

    constructor(client: N8nClient) {
        this.client = client;
    }

    register(eventName: string, handler: EventHandler): void {
        this.handlers.set(eventName, handler);
    }

    async handle(event: loleEvent<loleEventName>): Promise<WorkflowResult> {
        const handler = this.handlers.get(event.name);

        if (!handler) {
            return {
                success: false,
                event: event.name,
                error: `No handler registered for event: ${event.name}`,
            };
        }

        try {
            return await handler(event, this.client);
        } catch (error) {
            return {
                success: false,
                event: event.name,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    getRegisteredEvents(): string[] {
        return Array.from(this.handlers.keys());
    }
}

export class OrderWorkflowHandler {
    static create(client: N8nClient): EventHandler {
        return async (event: loleEvent<loleEventName>): Promise<WorkflowResult> => {
            const payload = event.payload as Record<string, unknown>;

            const response = await client.triggerWorkflow('order.event', {
                order_id: payload.order_id,
                restaurant_id: payload.restaurant_id,
                status: payload.status || 'created',
                items: payload.items || [],
                customer: payload.customer,
                total_amount: payload.total_amount,
            });

            return {
                success: response.success,
                event: `order.${event.name}`,
                webhookResponse: response,
                error: response.error,
            };
        };
    }
}

export class PaymentWorkflowHandler {
    static create(client: N8nClient): EventHandler {
        return async (event: loleEvent<loleEventName>): Promise<WorkflowResult> => {
            const payload = event.payload as Record<string, unknown>;

            const response = await client.triggerWorkflow('payment.event', {
                payment_id: payload.payment_id,
                order_id: payload.order_id,
                restaurant_id: payload.restaurant_id,
                status: payload.status,
                amount: payload.amount,
                provider: payload.provider,
                provider_transaction_id: payload.provider_transaction_id,
            });

            return {
                success: response.success,
                event: `payment.${event.name}`,
                webhookResponse: response,
                error: response.error,
            };
        };
    }
}

export class NotificationWorkflowHandler {
    static create(client: N8nClient): EventHandler {
        return async (event: loleEvent<loleEventName>): Promise<WorkflowResult> => {
            const payload = event.payload as Record<string, unknown>;

            const response = await client.triggerWorkflow('notification.event', {
                notification_id: payload.notification_id,
                restaurant_id: payload.restaurant_id,
                guest_phone: payload.guest_phone,
                notification_type: payload.notification_type,
                channel: payload.channel,
                status: event.name.split('.')[1] || 'unknown',
                message: {
                    en: payload.message_en,
                    am: payload.message_am,
                },
            });

            return {
                success: response.success,
                event: `notification.${event.name}`,
                webhookResponse: response,
                error: response.error,
            };
        };
    }
}

export class MenuWorkflowHandler {
    static create(client: N8nClient): EventHandler {
        return async (event: loleEvent<loleEventName>): Promise<WorkflowResult> => {
            const payload = event.payload as Record<string, unknown>;

            const response = await client.triggerWorkflow('menu.event', {
                restaurant_id: payload.restaurant_id,
                menu_id: payload.menu_id,
                updated_items: payload.updated_items || [],
                operation: payload.operation || 'update',
            });

            return {
                success: response.success,
                event: `menu.${event.name}`,
                webhookResponse: response,
                error: response.error,
            };
        };
    }
}

export function createBatchHandler(
    client: N8nClient,
    event: loleEvent<loleEventName>,
    dataArray: Record<string, unknown>[],
    batchSize: number = DEFAULT_BATCH_SIZE
): Promise<WorkflowResult> {
    const batches: Record<string, unknown>[][] = [];

    for (let i = 0; i < dataArray.length; i += batchSize) {
        batches.push(dataArray.slice(i, i + batchSize));
    }

    return client.triggerBatchWorkflow(`${event.name}.batch`, dataArray).then(
        response => ({
            success: response.success,
            event: `${event.name}.batch`,
            webhookResponse: response,
            error: response.error,
        }),
        error => ({
            success: false,
            event: `${event.name}.batch`,
            error: error instanceof Error ? error.message : 'Batch processing failed',
        })
    );
}

export function createErrorHandler(
    client: N8nClient,
    error: Error,
    event: loleEvent<loleEventName>,
    context?: Record<string, unknown>
): Promise<WorkflowResult> {
    return client
        .triggerWorkflow('error.trigger', {
            error_name: error.name,
            error_message: error.message,
            error_stack: error.stack,
            event_name: event.name,
            event_payload: event.payload,
            context,
        })
        .then(
            response => ({
                success: response.success,
                event: 'error.trigger',
                webhookResponse: response,
                error: response.error,
            }),
            handlerError => ({
                success: false,
                event: 'error.trigger',
                error:
                    handlerError instanceof Error ? handlerError.message : 'Error handler failed',
            })
        );
}

export function createDefaultRegistry(client: N8nClient): WorkflowRegistry {
    const registry = new WorkflowRegistry(client);

    registry.register('order.created', OrderWorkflowHandler.create(client));
    registry.register('order.status_changed', OrderWorkflowHandler.create(client));
    registry.register('order.completed', OrderWorkflowHandler.create(client));
    registry.register('order.cancelled', OrderWorkflowHandler.create(client));
    registry.register('payment.completed', PaymentWorkflowHandler.create(client));
    registry.register('payment.failed', PaymentWorkflowHandler.create(client));
    registry.register('notification.queued', NotificationWorkflowHandler.create(client));
    registry.register('notification.sent', NotificationWorkflowHandler.create(client));
    registry.register('notification.failed', NotificationWorkflowHandler.create(client));
    registry.register('menu.updated', MenuWorkflowHandler.create(client));

    return registry;
}

export async function processEventWithWorkflow(
    event: loleEvent<loleEventName>,
    registry: WorkflowRegistry,
    onError?: (error: Error, event: loleEvent<loleEventName>) => void
): Promise<WorkflowResult> {
    try {
        return await registry.handle(event);
    } catch (error) {
        const appError =
            error instanceof AppError ? error : new AppError(500, 'Workflow processing failed');

        if (onError) {
            onError(appError, event);
        }

        return {
            success: false,
            event: event.name,
            error: appError.message,
        };
    }
}
