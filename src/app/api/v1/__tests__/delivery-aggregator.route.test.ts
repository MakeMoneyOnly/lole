import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as postDeliveryAggregatorOrder } from '@/app/api/v1/merchant/operations/delivery/aggregator/orders/route';
import {
    AggregatorService,
    getActivePartners,
    receiveExternalOrder,
} from '@/lib/delivery/aggregator';
import { redisRateLimiters } from '@/lib/security';

const { receiveAndBroadcastOrderMock, auditInsertMock, createClientMock } = vi.hoisted(() => ({
    receiveAndBroadcastOrderMock: vi.fn(),
    auditInsertMock: vi.fn().mockResolvedValue({ error: null }),
    createClientMock: vi.fn(),
}));

createClientMock.mockImplementation(() => ({
    from: vi.fn(() => ({
        insert: auditInsertMock,
    })),
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: createClientMock,
}));

vi.mock('@/lib/security', () => ({
    redisRateLimiters: {
        mutation: vi.fn(),
    },
}));

vi.mock('@/lib/delivery/aggregator', async importOriginal => {
    const actual = await importOriginal<typeof import('@/lib/delivery/aggregator')>();
    return {
        ...actual,
        AggregatorService: vi.fn(function MockAggregatorService() {
            return {
                receiveAndBroadcastOrder: receiveAndBroadcastOrderMock,
            };
        }),
        getActivePartners: vi.fn(),
        receiveExternalOrder: vi.fn(),
    };
});

describe('delivery aggregator orders route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(redisRateLimiters.mutation).mockResolvedValue(null);
        vi.mocked(getActivePartners).mockResolvedValue([
            {
                id: 'partner-1',
                partner_name: 'beu',
            },
        ] as never);
        receiveAndBroadcastOrderMock.mockResolvedValue({
            success: true,
            order: {
                id: 'agg-order-1',
            },
        });
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SECRET_KEY = 'service-role-key';
    });

    it('uses AggregatorService so inbound orders hit runtime broadcast path', async () => {
        const response = await postDeliveryAggregatorOrder(
            new Request('http://localhost/api/v1/system/delivery/aggregator/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-delivery-platform': 'beu',
                    'x-restaurant-id': '11111111-1111-1111-1111-111111111111',
                },
                body: JSON.stringify({
                    id: 'ext-1001',
                    order_number: 'BEU-1001',
                    customer_name: 'Abel',
                    items: [
                        {
                            name: 'Shiro',
                            quantity: 2,
                            price: 120,
                        },
                    ],
                    subtotal: 240,
                    delivery_fee: 30,
                    total: 270,
                    created_at: '2026-04-29T08:00:00.000Z',
                }),
            }) as never
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(AggregatorService).toHaveBeenCalledOnce();
        expect(receiveAndBroadcastOrderMock).toHaveBeenCalledWith(
            expect.anything(),
            '11111111-1111-1111-1111-111111111111',
            'partner-1',
            expect.objectContaining({
                external_order_id: 'ext-1001',
                total: 270,
            })
        );
        expect(receiveExternalOrder).not.toHaveBeenCalled();
        expect(payload.data.aggregatorOrderId).toBe('agg-order-1');
    });

    it('normalizes Telebirr Food headers before resolving the configured partner', async () => {
        vi.mocked(getActivePartners).mockResolvedValue([
            {
                id: 'partner-telebirr',
                partner_name: 'telebirr_food',
            },
        ] as never);

        const response = await postDeliveryAggregatorOrder(
            new Request('http://localhost/api/v1/system/delivery/aggregator/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-delivery-platform': 'Telebirr Food',
                    'x-restaurant-id': '11111111-1111-1111-1111-111111111111',
                },
                body: JSON.stringify({
                    id: 'ext-2001',
                    order_number: 'TBF-2001',
                    customer_name: 'Lulit',
                    items: [
                        {
                            name: 'Kitfo',
                            quantity: 1,
                            price: 320,
                        },
                    ],
                    subtotal: 320,
                    delivery_fee: 40,
                    total: 360,
                    created_at: '2026-04-29T09:00:00.000Z',
                }),
            }) as never
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(receiveAndBroadcastOrderMock).toHaveBeenCalledWith(
            expect.anything(),
            '11111111-1111-1111-1111-111111111111',
            'partner-telebirr',
            expect.objectContaining({
                external_order_id: 'ext-2001',
                total: 360,
            })
        );
        expect(payload.data.platform).toBe('telebirr_food');
    });
});
