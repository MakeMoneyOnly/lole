import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { apiError } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { GET as getListOrders } from '@/app/api/v1/merchant/operations/orders/route';
import { GET as getKdsQueue } from '@/app/api/v1/merchant/operations/kds/queue/route';
import {
    GET as listWaitlist,
    POST as createWaitlistEntry,
} from '@/app/api/v1/merchant/operations/waitlist/route';
import { POST as notifyWaitlistEntry } from '@/app/api/v1/merchant/operations/waitlist/[id]/notify/route';
import { POST as openTableSession } from '@/app/api/v1/merchant/operations/table-sessions/open/route';
import { POST as closeTableSession } from '@/app/api/v1/merchant/operations/table-sessions/[sessionId]/close/route';
import { POST as transferTableSession } from '@/app/api/v1/merchant/operations/table-sessions/[sessionId]/transfer/route';
import { GET as listServiceRequests } from '@/app/api/v1/merchant/operations/service-requests/route';
import { PATCH as updateServiceRequestById } from '@/app/api/v1/merchant/operations/service-requests/[requestId]/route';
import {
    GET as listTipPools,
    POST as createTipPool,
} from '@/app/api/v1/merchant/operations/tip-pools/route';
import { POST as createPaymentSession } from '@/app/api/v1/merchant/operations/payments/sessions/route';
import { GET as getAggregatorOrders } from '@/app/api/v1/merchant/operations/delivery/aggregator/orders/route';
import {
    GET as calculateDeliveryFee,
    POST as calculateDeliveryFeePost,
} from '@/app/api/v1/merchant/operations/delivery/fee/route';

vi.mock('@/lib/api/authz', () => ({
    getAuthenticatedUser: vi.fn(),
    getAuthorizedRestaurantContext: vi.fn(),
    getDeviceContext: vi.fn(),
}));

const getAuthenticatedUserMock = vi.mocked(getAuthenticatedUser);
const getAuthorizedRestaurantContextMock = vi.mocked(getAuthorizedRestaurantContext);

type FakeRecord = Record<string, unknown>;

interface FakeDbOptions {
    orders?: FakeRecord[];
    externalOrders?: FakeRecord[];
    orderItems?: FakeRecord[];
    kdsItems?: FakeRecord[];
    waitlistEntries?: FakeRecord[];
    serviceRequests?: FakeRecord[];
    tipPools?: FakeRecord[];
    tableSessions?: FakeRecord[];
}

function makeFakeDb(options: FakeDbOptions = {}): {
    from: (table: string) => {
        select: ReturnType<typeof vi.fn>;
        eq: ReturnType<typeof vi.fn>;
        in: ReturnType<typeof vi.fn>;
        order: ReturnType<typeof vi.fn>;
        limit: ReturnType<typeof vi.fn>;
        range: ReturnType<typeof vi.fn>;
        or: ReturnType<typeof vi.fn>;
        single: ReturnType<typeof vi.fn>;
        insert: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        delete: ReturnType<typeof vi.fn>;
        count: ReturnType<typeof vi.fn>;
    };
} {
    const {
        orders = [],
        externalOrders = [],
        orderItems = [],
        kdsItems = [],
        waitlistEntries = [],
        serviceRequests = [],
        tipPools = [],
        tableSessions = [],
    } = options;

    return {
        from: (table: string) => {
            const data =
                table === 'orders'
                    ? orders
                    : table === 'external_orders'
                      ? externalOrders
                      : table === 'order_items'
                        ? orderItems
                        : table === 'kds_order_items'
                          ? kdsItems
                          : table === 'waitlist_entries'
                            ? waitlistEntries
                            : table === 'service_requests'
                              ? serviceRequests
                              : table === 'tip_pools'
                                ? tipPools
                                : table === 'table_sessions'
                                  ? tableSessions
                                  : [];
            const builder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                in: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({ data, error: null }),
                range: vi.fn().mockResolvedValue({ data, error: null, count: data.length }),
                or: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: data[0] ?? null, error: null }),
                insert: vi.fn().mockResolvedValue({ data: [{ id: 'new-id' }], error: null }),
                update: vi.fn().mockReturnThis(),
                delete: vi.fn().mockReturnThis(),
                count: vi.fn(),
            };
            return builder;
        },
    };
}

function setAuthUnauthorized(): void {
    getAuthenticatedUserMock.mockResolvedValue({
        ok: false,
        response: apiError('Unauthorized', 401, 'UNAUTHORIZED'),
    } as any);
}

function setAuthAndContextOk(db: ReturnType<typeof makeFakeDb>): void {
    getAuthenticatedUserMock.mockResolvedValue({
        ok: true,
        user: { id: 'user-1' },
        supabase: db,
    } as any);
    getAuthorizedRestaurantContextMock.mockResolvedValue({
        ok: true,
        restaurantId: '00000000-0000-4000-8000-000000000001',
        supabase: db,
    } as any);
}

function createRequest(url: string, init?: RequestInit): NextRequest {
    return new NextRequest(url, init as any);
}

describe('Operations Handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // List Orders Handler
    describe('GET /api/v1/merchant/operations/orders', () => {
        it('returns 401 when unauthorized', async () => {
            setAuthUnauthorized();

            const response = await getListOrders(
                createRequest('http://localhost/api/v1/merchant/operations/orders')
            );

            expect(response.status).toBe(401);
        });

        it('returns 200 with orders list on success', async () => {
            const db = makeFakeDb({
                orders: [
                    {
                        id: 'order-1',
                        order_number: 'ORD-1001',
                        table_number: 'A1',
                        status: 'pending',
                        created_at: new Date().toISOString(),
                    },
                ],
            });
            setAuthAndContextOk(db);

            const response = await getListOrders(
                createRequest('http://localhost/api/v1/merchant/operations/orders')
            );

            expect(response.status).toBe(200);
        });
    });

    // KDS Queue Handler
    describe('GET /api/v1/merchant/operations/kds/queue', () => {
        it('returns 401 when unauthorized', async () => {
            setAuthUnauthorized();

            const response = await getKdsQueue(
                createRequest('http://localhost/api/v1/merchant/operations/kds/queue')
            );

            expect(response.status).toBe(401);
        });

        it('returns 200 with filtered orders by station', async () => {
            const db = makeFakeDb({
                orders: [
                    {
                        id: 'order-1',
                        order_number: 'ORD-1001',
                        table_number: 'A1',
                        created_at: new Date().toISOString(),
                        acknowledged_at: null,
                        status: 'pending',
                        items: [{ name: 'Burger', quantity: 1, station: 'kitchen' }],
                    },
                ],
            });
            setAuthAndContextOk(db);

            const response = await getKdsQueue(
                createRequest(
                    'http://localhost/api/v1/merchant/operations/kds/queue?station=kitchen&limit=10'
                )
            );

            expect(response.status).toBe(200);
        });
    });

    // Waitlist Handlers
    describe('GET /api/v1/merchant/operations/waitlist', () => {
        it('returns 401 when unauthorized', async () => {
            setAuthUnauthorized();

            const response = await listWaitlist(
                createRequest('http://localhost/api/v1/merchant/operations/waitlist')
            );

            expect(response.status).toBe(401);
        });

        it('returns 200 with waitlist entries on success', async () => {
            const db = makeFakeDb({
                waitlistEntries: [
                    {
                        id: 'entry-1',
                        restaurant_id: 'resto-1',
                        guest_name: 'John Doe',
                        guest_phone: '555-1234',
                        guest_count: 4,
                        status: 'waiting',
                        created_at: new Date().toISOString(),
                    },
                ],
            });
            setAuthAndContextOk(db);

            const response = await listWaitlist(
                createRequest('http://localhost/api/v1/merchant/operations/waitlist')
            );

            expect(response.status).toBe(200);
        });
    });

    describe('POST /api/v1/merchant/operations/waitlist', () => {
        it('returns 401 when unauthorized', async () => {
            setAuthUnauthorized();

            const response = await createWaitlistEntry(
                createRequest('http://localhost/api/v1/merchant/operations/waitlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ guest_name: 'John', guest_count: 2 }),
                })
            );

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/v1/merchant/operations/waitlist/[id]/notify', () => {
        it('returns 401 when unauthorized', async () => {
            setAuthUnauthorized();

            const response = await notifyWaitlistEntry(
                createRequest(
                    'http://localhost/api/v1/merchant/operations/waitlist/entry-1/notify',
                    {
                        method: 'POST',
                    }
                ),
                { params: Promise.resolve({ id: 'entry-1' }) }
            );

            expect(response.status).toBe(401);
        });
    });

    // Table Sessions Handlers
    describe('POST /api/v1/merchant/operations/table-sessions/open', () => {
        it('returns 401 when unauthorized', async () => {
            setAuthUnauthorized();

            const response = await openTableSession(
                createRequest('http://localhost/api/v1/merchant/operations/table-sessions/open', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ table_number: 'A1' }),
                })
            );

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/v1/merchant/operations/table-sessions/[sessionId]/close', () => {
        it('returns 401 when unauthorized', async () => {
            setAuthUnauthorized();

            const response = await closeTableSession(
                createRequest(
                    'http://localhost/api/v1/merchant/operations/table-sessions/session-1/close',
                    {
                        method: 'POST',
                    }
                ),
                { params: Promise.resolve({ sessionId: 'session-1' }) }
            );

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/v1/merchant/operations/table-sessions/[sessionId]/transfer', () => {
        it('returns 401 when unauthorized', async () => {
            setAuthUnauthorized();

            const response = await transferTableSession(
                createRequest(
                    'http://localhost/api/v1/merchant/operations/table-sessions/session-1/transfer',
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ to_table: 'B1' }),
                    }
                ),
                { params: Promise.resolve({ sessionId: 'session-1' }) }
            );

            expect(response.status).toBe(401);
        });
    });

    // Service Requests Handlers
    describe('GET /api/v1/merchant/operations/service-requests', () => {
        it('returns 401 when unauthorized', async () => {
            setAuthUnauthorized();

            const response = await listServiceRequests(
                createRequest('http://localhost/api/v1/merchant/operations/service-requests')
            );

            expect(response.status).toBe(401);
        });
    });

    describe('PATCH /api/v1/merchant/operations/service-requests/[requestId]', () => {
        it('returns 401 when unauthorized', async () => {
            setAuthUnauthorized();

            const response = await updateServiceRequestById(
                createRequest(
                    'http://localhost/api/v1/merchant/operations/service-requests/req-1',
                    {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'resolved' }),
                    }
                ),
                { params: Promise.resolve({ requestId: 'req-1' }) }
            );

            expect(response.status).toBe(401);
        });
    });

    // Tip Pools Handlers
    describe('GET /api/v1/merchant/operations/tip-pools', () => {
        it('returns 401 when unauthorized', async () => {
            setAuthUnauthorized();

            const response = await listTipPools(
                createRequest('http://localhost/api/v1/merchant/operations/tip-pools')
            );

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/v1/merchant/operations/tip-pools', () => {
        it('returns 401 when unauthorized', async () => {
            setAuthUnauthorized();

            const response = await createTipPool(
                createRequest('http://localhost/api/v1/merchant/operations/tip-pools', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: 'Pool 1', shares: [] }),
                })
            );

            expect(response.status).toBe(401);
        });
    });

    // Payments Handlers
    describe('POST /api/v1/merchant/operations/payments/sessions', () => {
        it('returns 400 for invalid guest context', async () => {
            const response = await createPaymentSession(
                createRequest('http://localhost/api/v1/merchant/operations/payments/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                })
            );

            expect(response.status).toBe(400);
        });
    });

    // Delivery Handlers
    describe('GET /api/v1/merchant/operations/delivery/aggregator/orders', () => {
        it('returns 400 when restaurant ID is missing', async () => {
            const response = await getAggregatorOrders(
                createRequest(
                    'http://localhost/api/v1/merchant/operations/delivery/aggregator/orders'
                )
            );

            expect(response.status).toBe(400);
        });
    });

    describe('GET /api/v1/merchant/operations/delivery/fee', () => {
        it('returns 200 with fee calculation', async () => {
            const response = await calculateDeliveryFee(
                createRequest(
                    'http://localhost/api/v1/merchant/operations/delivery/fee?restaurantId=00000000-0000-4000-8000-000000000001&deliveryArea=Bole'
                )
            );

            expect(response.status).toBe(200);
        });
    });

    describe('POST /api/v1/merchant/operations/delivery/fee', () => {
        it('returns 200 with fee calculation', async () => {
            const response = await calculateDeliveryFeePost(
                createRequest(
                    'http://localhost/api/v1/merchant/operations/delivery/fee?restaurantId=00000000-0000-4000-8000-000000000001&deliveryArea=Bole',
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount: 100 }),
                    }
                )
            );

            expect(response.status).toBe(200);
        });
    });
});
