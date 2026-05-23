import { tenantContext } from '../context/tenant-context';
import { AppError } from '../errors';

export interface N8nWebhookPayload {
    event: string;
    timestamp: string;
    tenant_id: string;
    data: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

export interface N8nWebhookResponse {
    success: boolean;
    workflow_id?: string;
    execution_id?: string;
    error?: string;
}

export interface N8nBatchPayload {
    event: string;
    timestamp: string;
    tenant_id: string;
    data: Record<string, unknown>[];
    metadata?: Record<string, unknown>;
}

export interface N8nClientConfig {
    baseUrl: string;
    webhookPath: string;
    timeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
}

export class N8nClient {
    private config: Required<N8nClientConfig>;

    constructor(config: N8nClientConfig) {
        this.config = {
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            ...config,
        };
    }

    private getTenantHeaders(): Record<string, string> {
        const context = tenantContext.getStore();
        return {
            'x-tenant-id': context?.restaurantId || 'system',
            'x-request-id': context?.requestId || crypto.randomUUID(),
        };
    }

    async triggerWorkflow(
        event: string,
        data: Record<string, unknown>,
        metadata?: Record<string, unknown>
    ): Promise<N8nWebhookResponse> {
        const context = tenantContext.getStore();
        const payload: N8nWebhookPayload = {
            event,
            timestamp: new Date().toISOString(),
            tenant_id: context?.restaurantId || 'system',
            data,
            metadata,
        };

        return this.sendWebhook(payload);
    }

    async triggerBatchWorkflow(
        event: string,
        data: Record<string, unknown>[],
        metadata?: Record<string, unknown>
    ): Promise<N8nWebhookResponse> {
        const context = tenantContext.getStore();
        const payload: N8nBatchPayload = {
            event,
            timestamp: new Date().toISOString(),
            tenant_id: context?.restaurantId || 'system',
            data,
            metadata: {
                ...metadata,
                batch_size: data.length,
            },
        };

        return this.sendBatchWebhook(payload);
    }

    private async sendWebhook(payload: N8nWebhookPayload): Promise<N8nWebhookResponse> {
        const url = `${this.config.baseUrl}${this.config.webhookPath}/${payload.event}`;
        const headers = {
            'Content-Type': 'application/json',
            ...this.getTenantHeaders(),
        };

        let lastError: Error | null = null;

        for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(this.config.timeout),
                });

                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Unknown error');
                    throw new AppError(
                        response.status,
                        `n8n webhook failed for event ${payload.event}`,
                        `n8n returned ${response.status}: ${errorText}`,
                        'N8N_WEBHOOK_ERROR'
                    );
                }

                const result = await response.json();
                return {
                    success: true,
                    workflow_id: result.workflow_id,
                    execution_id: result.execution_id,
                };
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < this.config.retryAttempts - 1) {
                    await this.delay(this.config.retryDelay * Math.pow(2, attempt));
                }
            }
        }

        return {
            success: false,
            error: lastError?.message || 'Failed to trigger n8n workflow',
        };
    }

    private async sendBatchWebhook(payload: N8nBatchPayload): Promise<N8nWebhookResponse> {
        const url = `${this.config.baseUrl}${this.config.webhookPath}/batch/${payload.event}`;
        const headers = {
            'Content-Type': 'application/json',
            ...this.getTenantHeaders(),
        };

        let lastError: Error | null = null;

        for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                    signal: AbortSignal.timeout(this.config.timeout),
                });

                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Unknown error');
                    throw new AppError(
                        response.status,
                        `n8n batch webhook failed for event ${payload.event}`,
                        `n8n returned ${response.status}: ${errorText}`,
                        'N8N_BATCH_WEBHOOK_ERROR'
                    );
                }

                const result = await response.json();
                return {
                    success: true,
                    workflow_id: result.workflow_id,
                    execution_id: result.execution_id,
                };
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < this.config.retryAttempts - 1) {
                    await this.delay(this.config.retryDelay * Math.pow(2, attempt));
                }
            }
        }

        return {
            success: false,
            error: lastError?.message || 'Failed to trigger n8n batch workflow',
        };
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static createDefault(): N8nClient {
        return new N8nClient({
            baseUrl: process.env.N8N_BASE_URL || 'http://localhost:5678',
            webhookPath: process.env.N8N_WEBHOOK_PATH || '/webhook',
        });
    }
}

export function validateN8nPayload(payload: unknown): payload is Record<string, unknown> {
    if (typeof payload !== 'object' || payload === null) {
        return false;
    }
    return true;
}

export function transformForN8n(data: Record<string, unknown>): Record<string, unknown> {
    const context = tenantContext.getStore();
    return {
        ...data,
        _tenant_id: context?.restaurantId,
        _trace_id: context?.requestId,
    };
}
