import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { POST as postKdsPrint } from '@/app/api/v1/merchant/operations/kds/orders/[orderId]/print/route';

vi.mock('@/lib/api/authz', () => ({
    getAuthenticatedUser: vi.fn(),
    getAuthorizedRestaurantContext: vi.fn(),
}));

vi.mock('@/lib/api/audit', () => ({
    writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const getAuthenticatedUserMock = vi.mocked(getAuthenticatedUser);
const getAuthorizedRestaurantContextMock = vi.mocked(getAuthorizedRestaurantContext);

function createSupabaseMock(): React.JSX.Element {
    return {
        from: vi.fn((table: string) => {
            if (table === 'orders') {
                const query: any = {
                    select: vi.fn(() => query),
                    eq: vi.fn(() => query),
                    maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                            restaurant_id: 'resto-1',
                            order_number: 'ORD-123',
                            table_number: 'T-1',
                        },
                        error: null,
                    }),
                };
                return query;
            }

            if (table === 'restaurants') {
                const query: any = {
                    select: vi.fn(() => query),
                    eq: vi.fn(() => query),
                    maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                            settings: {
                                kds: {
                                    print_policy: {
                                        mode: 'fallback',
                                        provider: 'log',
                                        copies: 1,
                                    },
                                },
                            },
                        },
                        error: null,
                    }),
                };
                return query;
            }

            if (table === 'kds_order_items') {
                const query: any = {
                    select: vi.fn(() => query),
                    eq: vi.fn(() => query),
                    order: vi.fn().mockResolvedValue({
                        data: [
                            {
                                name: 'Kitfo',
                                quantity: 1,
                                station: 'kitchen',
                                notes: null,
                                status: 'queued',
                            },
                        ],
                        error: null,
                    }),
                };
                return query;
            }

            return {
                insert: vi.fn().mockResolvedValue({ data: null, error: null }),
            } as any;
        }),
    } as any;
}

describe('KDS printer route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('POST /api/v1/merchant/operations/kds/orders/:id/print returns 401 when unauthorized', async () => {
        getAuthenticatedUserMock.mockResolvedValue({
            ok: false,
            response: apiError('Unauthorized', 401, 'UNAUTHORIZED'),
        } as any);

        const response = await postKdsPrint(
            new Request(
                'http://localhost/api/v1/merchant/operations/kds/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/print',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: 'manual_print' }),
                }
            ),
            { params: Promise.resolve({ orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) }
        );

        expect(response.status).toBe(401);
    });

    it('POST /api/v1/merchant/operations/kds/orders/:id/print dispatches log fallback when enabled', async () => {
        getAuthenticatedUserMock.mockResolvedValue({
            ok: true,
            user: { id: 'user-1' },
        } as any);
        getAuthorizedRestaurantContextMock.mockResolvedValue({
            ok: true,
            restaurantId: 'resto-1',
            supabase: createSupabaseMock(),
        } as any);

        const response = await postKdsPrint(
            new Request(
                'http://localhost/api/v1/merchant/operations/kds/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/print',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason: 'manual_print' }),
                }
            ),
            { params: Promise.resolve({ orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) }
        );

        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.data.printed).toBe(true);
        expect(body.data.provider).toBe('log');
    });
});
