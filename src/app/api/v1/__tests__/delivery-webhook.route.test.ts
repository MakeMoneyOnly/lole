import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/v1/system/webhooks/delivery/route';
import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/api/audit';
import { AggregatorService } from '@/lib/delivery/aggregator';

const {
    maybeSingleMock,
    insertMock,
    receiveAndBroadcastOrderMock,
    publishCommandMock,
    createClientMock,
} = vi.hoisted(() => ({
    maybeSingleMock: vi.fn(),
    insertMock: vi.fn(),
    receiveAndBroadcastOrderMock: vi.fn(),
    publishCommandMock: vi.fn(),
    createClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: createClientMock,
}));

vi.mock('@/lib/api/audit', () => ({
    writeAuditLog: vi.fn(),
}));

vi.mock('@/lib/delivery/aggregator', () => ({
    AggregatorService: vi.fn(function MockAggregatorService() {
        return {
            receiveAndBroadcastOrder: receiveAndBroadcastOrderMock,
        };
    }),
}));

vi.mock('@/lib/gateway/service', () => ({
    getStoreGatewayService: () => ({
        publishCommand: publishCommandMock,
    }),
}));

describe('delivery webhook route', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        maybeSingleMock
            .mockResolvedValueOnce({
                data: {
                    id: 'partner-1',
                    restaurant_id: 'rest-1',
                    settings_json: { api_key: 'secret-key' },
                    credentials_ref: null,
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: null,
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    settings: {
                        channels: {
                            online_ordering: {
                                auto_accept_orders: true,
                            },
                        },
                    },
                },
                error: null,
            });

        insertMock.mockReturnValue({
            select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                    data: {
                        id: 'ext-order-1',
                    },
                    error: null,
                }),
            })),
        });

        receiveAndBroadcastOrderMock.mockResolvedValue({
            success: true,
            order: {
                id: 'agg-order-1',
            },
        });

        createClientMock.mockResolvedValue({
            from: vi.fn((table: string) => {
                if (table === 'delivery_partners') {
                    return {
                        select: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                eq: vi.fn(() => ({
                                    maybeSingle: maybeSingleMock,
                                })),
                            })),
                        })),
                    };
                }

                if (table === 'external_orders') {
                    return {
                        select: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                eq: vi.fn(() => ({
                                    eq: vi.fn(() => ({
                                        maybeSingle: maybeSingleMock,
                                    })),
                                })),
                            })),
                        })),
                        insert: insertMock,
                    };
                }

                if (table === 'restaurants') {
                    return {
                        select: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                maybeSingle: maybeSingleMock,
                            })),
                        })),
                    };
                }

                throw new Error(`Unexpected table ${table}`);
            }),
        } as never);
    });

    it('keeps legacy external order write and injects webhook orders through aggregator runtime', async () => {
        const response = await POST(
            new Request('http://localhost/api/v1/system/webhooks/delivery', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Provider': 'beu',
                    'X-API-Key': 'secret-key',
                },
                body: JSON.stringify({
                    order_id: 'BEU-1001',
                    customer_name: 'Abel',
                    total: 150,
                    items: [{ name: 'Kitfo', quantity: 2, price: 75 }],
                    status: 'new',
                    created_at: '2026-04-30T10:00:00.000Z',
                }),
            }) as never
        );
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(insertMock).toHaveBeenCalledOnce();
        expect(AggregatorService).toHaveBeenCalledOnce();
        expect(receiveAndBroadcastOrderMock).toHaveBeenCalledWith(
            expect.anything(),
            'rest-1',
            'partner-1',
            expect.objectContaining({
                external_order_id: 'BEU-1001',
                customer_name: 'Abel',
                items: [
                    expect.objectContaining({
                        name: 'Kitfo',
                        quantity: 2,
                        price: 75,
                    }),
                ],
                total: 150,
            })
        );
        expect(body.data).toMatchObject({
            runtime_injected: true,
            aggregator_order_id: 'agg-order-1',
        });
        expect(writeAuditLog).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                action: 'external_order_received',
                metadata: expect.objectContaining({
                    runtime_injected: true,
                }),
            })
        );
    });
});
