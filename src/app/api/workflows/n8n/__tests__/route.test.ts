import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
    validateN8nPayloadMock: vi.fn(),
    createDefaultRegistryMock: vi.fn(),
    tenantRunMock: vi.fn(),
    createloleEventMock: vi.fn(),
    loggerChildMock: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    })),
    loggerInfoMock: vi.fn(),
    loggerWarnMock: vi.fn(),
    loggerErrorMock: vi.fn(),
    n8nClientCreateDefaultMock: vi.fn(),
    n8nClientTriggerWorkflowMock: vi.fn(),
    n8nClientTriggerBatchWorkflowMock: vi.fn(),
}));

vi.mock('@/lib/automation/n8nClient', () => ({
    N8nClient: Object.assign(
        vi.fn().mockImplementation(() => ({
            triggerWorkflow: mocks.n8nClientTriggerWorkflowMock,
            triggerBatchWorkflow: mocks.n8nClientTriggerBatchWorkflowMock,
        })),
        { createDefault: mocks.n8nClientCreateDefaultMock }
    ),
    validateN8nPayload: mocks.validateN8nPayloadMock,
}));

vi.mock('@/lib/automation', () => ({
    createDefaultRegistry: mocks.createDefaultRegistryMock,
    N8nClient: Object.assign(
        vi.fn().mockImplementation(() => ({
            triggerWorkflow: mocks.n8nClientTriggerWorkflowMock,
            triggerBatchWorkflow: mocks.n8nClientTriggerBatchWorkflowMock,
        })),
        { createDefault: mocks.n8nClientCreateDefaultMock }
    ),
    validateN8nPayload: mocks.validateN8nPayloadMock,
}));

vi.mock('@/lib/context/tenant-context', () => ({
    tenantContext: {
        run: mocks.tenantRunMock,
        getStore: vi.fn(),
    },
    createMockContext: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        child: mocks.loggerChildMock,
        info: mocks.loggerInfoMock,
        warn: mocks.loggerWarnMock,
        error: mocks.loggerErrorMock,
    },
}));

vi.mock('@/lib/events/contracts', () => ({
    createloleEvent: mocks.createloleEventMock,
}));

let GET: (req: NextRequest) => Promise<Response>;
let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
    const mod = await import('@/app/api/workflows/n8n/route');
    GET = mod.GET;
    POST = mod.POST;
});

describe('n8n webhook route', () => {
    const mockRegistryInstance = {
        handle: vi.fn(),
        getRegisteredEvents: vi.fn(() => [
            'order.created',
            'order.status_changed',
            'order.completed',
            'order.cancelled',
            'payment.completed',
            'payment.failed',
            'notification.queued',
            'notification.sent',
            'notification.failed',
            'menu.updated',
        ]),
    };

    const mockN8nClientInstance = {
        triggerWorkflow: mocks.n8nClientTriggerWorkflowMock,
        triggerBatchWorkflow: mocks.n8nClientTriggerBatchWorkflowMock,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.validateN8nPayloadMock.mockImplementation((payload) => typeof payload === 'object' && payload !== null);
        mocks.createDefaultRegistryMock.mockReturnValue(mockRegistryInstance);
        mocks.tenantRunMock.mockImplementation((_ctx, fn) => fn());
        mocks.n8nClientCreateDefaultMock.mockReturnValue(mockN8nClientInstance);
        mocks.createloleEventMock.mockImplementation((name, payload) => ({
            id: 'event-id',
            version: 1,
            name,
            occurred_at: new Date().toISOString(),
            trace_id: 'trace-id',
            payload,
        }));
    });

    describe('GET /api/workflows/n8n', () => {
        it('returns status ok and supported events', async () => {
            const response = await GET(new NextRequest('http://localhost/api/workflows/n8n'));
            const body = await response.json();

            expect(response.status).toBe(200);
            expect(body.data.status).toBe('ok');
            expect(body.data.endpoint).toBe('/api/workflows/n8n');
            expect(body.data.supported_events).toEqual([
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
        });
    });

    describe('POST /api/workflows/n8n', () => {
        it('returns 400 for invalid payload when body is null', async () => {
            const response = await POST(
                new NextRequest('http://localhost/api/workflows/n8n', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: 'invalid json',
                })
            );

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error.code).toBe('INVALID_PAYLOAD');
        });

        it('returns 400 for invalid payload when body is not an object', async () => {
            const response = await POST(
                new NextRequest('http://localhost/api/workflows/n8n', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify('not an object'),
                })
            );

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error.code).toBe('INVALID_PAYLOAD');
        });

        it('returns 400 for missing required event field', async () => {
            const response = await POST(
                new NextRequest('http://localhost/api/workflows/n8n', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tenant_id: '00000000-0000-0000-0000-000000000000',
                        data: {},
                    }),
                })
            );

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error.code).toBe('INVALID_PAYLOAD');
        });

        it('returns 200 for unrecognized event with success false', async () => {
            const mockResult = {
                success: false,
                event: 'invalid.event',
                error: 'No handler registered for event: invalid.event',
            };

            mockRegistryInstance.handle.mockResolvedValue(mockResult);

            const response = await POST(
                new NextRequest('http://localhost/api/workflows/n8n', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'invalid.event',
                        tenant_id: '00000000-0000-0000-0000-000000000000',
                        data: {},
                    }),
                })
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.data.success).toBe(false);
        });

        it('successfully processes order.created event', async () => {
            const mockResult = {
                success: true,
                event: 'order.created',
                webhookResponse: {
                    success: true,
                    workflow_id: 'workflow-123',
                    execution_id: 'exec-456',
                },
            };

            mockRegistryInstance.handle.mockResolvedValue(mockResult);

            const response = await POST(
                new NextRequest('http://localhost/api/workflows/n8n', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'order.created',
                        tenant_id: '00000000-0000-0000-0000-000000000000',
                        data: {
                            order_id: 'order-123',
                            restaurant_id: 'rest-456',
                        },
                    }),
                })
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.data.success).toBe(true);
            expect(body.data.event).toBe('order.created');
            expect(body.data.execution_id).toBe('exec-456');
            expect(body.data.workflow_id).toBe('workflow-123');
        });

        it('successfully processes payment.completed event', async () => {
            const mockResult = {
                success: true,
                event: 'payment.completed',
                webhookResponse: {
                    success: true,
                    workflow_id: 'workflow-789',
                    execution_id: 'exec-101',
                },
            };

            mockRegistryInstance.handle.mockResolvedValue(mockResult);

            const response = await POST(
                new NextRequest('http://localhost/api/workflows/n8n', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'payment.completed',
                        tenant_id: '00000000-0000-0000-0000-000000000000',
                        data: {
                            payment_id: 'pay-123',
                            order_id: 'order-456',
                            amount: 100,
                        },
                    }),
                })
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.data.success).toBe(true);
            expect(body.data.event).toBe('payment.completed');
        });

        it('returns success false when workflow handler fails', async () => {
            const mockResult = {
                success: false,
                event: 'order.created',
                error: 'No handler registered for event: order.created',
            };

            mockRegistryInstance.handle.mockResolvedValue(mockResult);

            const response = await POST(
                new NextRequest('http://localhost/api/workflows/n8n', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'order.created',
                        tenant_id: '00000000-0000-0000-0000-000000000000',
                        data: {
                            order_id: 'order-123',
                        },
                    }),
                })
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.data.success).toBe(false);
            expect(body.data.error).toBe('No handler registered for event: order.created');
        });

        it('returns 500 on unexpected error', async () => {
            mockRegistryInstance.handle.mockRejectedValue(new Error('Unexpected error'));

            const response = await POST(
                new NextRequest('http://localhost/api/workflows/n8n', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'order.created',
                        tenant_id: '00000000-0000-0000-0000-000000000000',
                        data: {},
                    }),
                })
            );

            expect(response.status).toBe(500);
            const body = await response.json();
            expect(body.error.code).toBe('INTERNAL_ERROR');
        });
    });
});