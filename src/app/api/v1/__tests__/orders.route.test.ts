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

const mockSupabaseClient = (restaurantId: string | null) => {
    mocks.from.mockImplementation(() => ({
        select: () => ({
            eq: () => ({
                eq: () => ({
                    order: () => ({
                        limit: () => ({
                            maybeSingle: () =>
                                Promise.resolve({
                                    data: restaurantId
                                        ? { user_id: 'user-1', restaurant_id: restaurantId }
                                        : null,
                                    error: null,
                                }),
                        }),
                    }),
                }),
            }),
        }),
    }));
};

// Dynamic import after mocks are set up
let GET: (req: NextRequest) => Promise<Response>;
let POST: (req: NextRequest) => Promise<Response>;

beforeAll(async () => {
    const mod = await import('@/app/api/v1/merchant/operations/orders/route');
    GET = mod.GET;
    POST = mod.POST;
});

describe('Orders API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.enforcedPilotAccess.mockReturnValue(null);
        mocks.trackedApiMetric.mockResolvedValue(undefined);
        mocks.prepareOrderDiscount.mockResolvedValue({
            discount: null,
            calculation: { subtotal: 500, discountAmount: 0, total: 500, applied: false },
        });
        mocks.orderCreateRateLimiter.mockResolvedValue(null);
        mockSupabaseClient('rest-1');
    });

    describe('GET /api/v1/merchant/operations/orders', () => {
        it('returns 401 when user is not authenticated', async () => {
            mocks.getUser.mockResolvedValue({
                data: { user: null },
                error: new Error('Not authenticated'),
            });

            const response = await GET(new NextRequest('http://localhost/api/v1/merchant/operations/orders?limit=10'));

            expect(response.status).toBe(401);
            const body = await response.json();
            expect(body.error.code).toBe('UNAUTHORIZED');
        });

        it('returns 400 for invalid query parameters', async () => {
            mocks.getUser.mockResolvedValue({
                data: { user: { id: 'user-1' } },
                error: null,
            });

            const response = await GET(
                new NextRequest('http://localhost/api/v1/merchant/operations/orders?limit=not-a-number')
            );

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error.code).toBe('INVALID_QUERY');
        });
    });

    describe('POST /api/v1/merchant/operations/orders', () => {
        it('returns 400 for missing required fields', async () => {
            const response = await POST(
                new NextRequest('http://localhost/api/v1/merchant/operations/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        guest_context: { slug: 'my-rest', table: '', sig: '', exp: 0 },
                        items: [],
                        total_price: 0,
                    }),
                })
            );

            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.error.code).toBe('VALIDATION_ERROR');
        });

        it('returns 429 when rate limited', async () => {
            const { NextResponse } = await import('next/server');
            mocks.orderCreateRateLimiter.mockResolvedValue(
                NextResponse.json(
                    { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
                    { status: 429 }
                )
            );

            const response = await POST(
                new NextRequest('http://localhost/api/v1/merchant/operations/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-idempotency-key': '550e8400-e29b-41d4-a716-446655440000',
                    },
                    body: JSON.stringify({
                        guest_context: {
                            slug: 'my-rest',
                            table: 'T1',
                            sig: 'abc123...',
                            exp: 9999999999,
                        },
                        items: [{ id: 'item-1', name: 'Test', quantity: 1, price: 100 }],
                        total_price: 100,
                        order_type: 'dine_in',
                    }),
                })
            );

            expect(response.status).toBe(429);
        });
    });
});
