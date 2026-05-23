import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    from: vi.fn(),
    publishEvent: vi.fn(),
    createServiceRoleClient: vi.fn(),
    createOrder: vi.fn(),
    validateOrderItems: vi.fn(),
    checkDuplicateOrder: vi.fn(),
    checkRateLimit: vi.fn(),
    generateGuestFingerprint: vi.fn(),
    generateIdempotencyKey: vi.fn(),
    resolveGuestContext: vi.fn(),
    enforcedPilotAccess: vi.fn(),
    trackedApiMetric: vi.fn(),
    prepareOrderDiscount: vi.fn(),
    orderCreateRateLimiter: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() =>
        Promise.resolve({
            auth: { getUser: mocks.getUser },
            from: mocks.from,
        })
    ),
}));

vi.mock('@/lib/supabase/service-role', () => ({
    createServiceRoleClient: mocks.createServiceRoleClient,
}));

vi.mock('@/lib/events/runtime', () => ({
    publishEvent: mocks.publishEvent,
}));

vi.mock('@/lib/services/orderService', () => ({
    createOrder: mocks.createOrder,
    validateOrderItems: mocks.validateOrderItems,
    checkDuplicateOrder: mocks.checkDuplicateOrder,
    checkRateLimit: mocks.checkRateLimit,
    generateGuestFingerprint: mocks.generateGuestFingerprint,
    generateIdempotencyKey: mocks.generateIdempotencyKey,
}));

vi.mock('@/lib/security/guestContext', () => ({
    resolveGuestContext: mocks.resolveGuestContext,
}));

vi.mock('@/lib/api/pilotGate', () => ({
    enforcePilotAccess: mocks.enforcedPilotAccess,
}));

vi.mock('@/lib/api/metrics', () => ({
    trackApiMetric: mocks.trackedApiMetric,
}));

vi.mock('@/lib/discounts/service', () => ({
    prepareOrderDiscount: mocks.prepareOrderDiscount,
}));

vi.mock('@/lib/security', () => ({
    redisRateLimiters: {
        orderCreate: () => mocks.orderCreateRateLimiter(),
    },
}));

vi.mock('@/lib/api/route-utils', () => ({
    resolveRestaurantIdForUser: vi.fn().mockResolvedValue({
        restaurantId: '550e8400-e29b-41d4-a716-446655440000',
        error: null,
    }),
}));

vi.mock('@/features/operations/shared/auth-middleware', () => ({
    requireMerchantAuth: vi.fn().mockResolvedValue({
        ok: true,
        supabase: {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                range: vi.fn().mockResolvedValue({ data: [], error: null }),
                insert: vi.fn().mockResolvedValue({ error: null }),
            }),
        },
        restaurantId: '550e8400-e29b-41d4-a716-446655440000',
        user: { id: 'user-1', email: 'test@test.com' },
    }),
}));

let GET: (req: NextRequest) => Promise<Response>;
let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
    const mod = await import('@/app/api/v1/merchant/operations/orders/route');
    GET = mod.GET;
    POST = mod.POST;
});

describe('Orders API', () => {
    const mockedGetUser = vi.mocked(mocks.getUser);
    const mockedCreateOrder = vi.mocked(mocks.createOrder);

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.enforcedPilotAccess.mockReturnValue(null);
        mocks.trackedApiMetric.mockResolvedValue(undefined);
        mocks.prepareOrderDiscount.mockResolvedValue({
            discount: null,
            calculation: { subtotal: 500, discountAmount: 0, total: 500, applied: false },
        });
        mocks.orderCreateRateLimiter.mockResolvedValue(null);
        mockedGetUser.mockResolvedValue({
            data: { user: { id: 'user-1', email: 'test@test.com' } },
            error: null,
        });
        mockedCreateOrder.mockResolvedValue({
            success: true,
            order: { id: '550e8400-e29b-41d4-a716-446655440001', status: 'pending' },
        });
    });

    describe('GET /api/v1/merchant/operations/orders', () => {
        it('returns orders when authenticated', async () => {
            const response = await GET(
                new NextRequest('http://localhost/api/v1/merchant/operations/orders?limit=10')
            );

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.data).toBeDefined();
        });
    });

    describe('POST /api/v1/merchant/operations/orders', () => {
        it('creates an order with valid data', async () => {
            const response = await POST(
                new NextRequest('http://localhost/api/v1/merchant/operations/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-idempotency-key': '550e8400-e29b-41d4-a716-446655440000',
                    },
                    body: JSON.stringify({
                        restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
                        table_number: 'T1',
                        items: [
                            {
                                id: '550e8400-e29b-41d4-a716-446655440002',
                                name: 'Test',
                                quantity: 1,
                                price: 100,
                            },
                        ],
                        total_price: 100,
                        idempotency_key: '550e8400-e29b-41d4-a716-446655440001',
                    }),
                })
            );

            expect(response.status).toBe(201);
        });

        it('returns 400 for empty items array', async () => {
            const response = await POST(
                new NextRequest('http://localhost/api/v1/merchant/operations/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-idempotency-key': '550e8400-e29b-41d4-a716-446655440000',
                    },
                    body: JSON.stringify({
                        restaurant_id: '550e8400-e29b-41d4-a716-446655440000',
                        table_number: 'T1',
                        items: [],
                        total_price: 100,
                        idempotency_key: '550e8400-e29b-41d4-a716-446655440001',
                    }),
                })
            );

            expect(response.status).toBe(400);
        });
    });
});
