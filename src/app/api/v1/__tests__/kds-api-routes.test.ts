import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { GET as getKdsQueue } from '@/app/api/v1/merchant/operations/kds/queue/route';
import { POST as postKdsItemAction } from '@/app/api/v1/merchant/operations/kds/items/[kdsItemId]/action/route';

vi.mock('@/lib/api/authz', () => ({
    getAuthenticatedUser: vi.fn(),
    getAuthorizedRestaurantContext: vi.fn(),
    getDeviceContext: vi.fn(),
}));

const getAuthenticatedUserMock = vi.mocked(getAuthenticatedUser);
const getAuthorizedRestaurantContextMock = vi.mocked(getAuthorizedRestaurantContext);

const VALID_RESTAURANT_ID = '12345678-1234-4234-8234-123456789012';

type FakeRecord = Record<string, unknown>;
function makeFakeDb(
    options: {
        orders?: unknown[];
        externalOrders?: unknown[];
        orderItems?: unknown[];
        kdsItems?: unknown[];
    } = {}
): {
    from: (table: string) => {
        select: ReturnType<typeof vi.fn>;
        eq: ReturnType<typeof vi.fn>;
        in: ReturnType<typeof vi.fn>;
        order: ReturnType<typeof vi.fn>;
        limit: ReturnType<typeof vi.fn>;
    };
} {
    const orders = options.orders ?? [];
    const externalOrders = options.externalOrders ?? [];
    const orderItems = options.orderItems ?? [];
    const kdsItems = options.kdsItems ?? [];

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
                          : [];
            const builder = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                in: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({ data, error: null }),
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
        restaurantId: VALID_RESTAURANT_ID,
        supabase: db,
    } as any);
}

describe('KDS API routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /api/v1/merchant/operations/kds/queue returns 401 when unauthorized', async () => {
        setAuthUnauthorized();

        const response = await getKdsQueue(
            new Request('http://localhost/api/v1/merchant/operations/kds/queue')
        );

        expect(response.status).toBe(401);
    });

    it('GET /api/v1/merchant/operations/kds/queue returns 500 for invalid query', async () => {
        setAuthAndContextOk(makeFakeDb({}));

        const response = await getKdsQueue(
            new Request(
                'http://localhost/api/v1/merchant/operations/kds/queue?limit=0&station=invalid'
            )
        );

        expect(response.status).toBe(500);
    });

    it('GET /api/v1/merchant/operations/kds/queue applies station and SLA filters', async () => {
        const now = Date.now();
        const thirtyFiveMinutesAgo = new Date(now - 35 * 60_000).toISOString();
        const tenMinutesAgo = new Date(now - 10 * 60_000).toISOString();

        const db = makeFakeDb({
            orders: [
                {
                    id: 'order-bar-1',
                    order_number: 'ORD-1001',
                    table_number: 'B1',
                    created_at: thirtyFiveMinutesAgo,
                    acknowledged_at: null,
                    status: 'preparing',
                    items: [],
                },
                {
                    id: 'order-kitchen-1',
                    order_number: 'ORD-1002',
                    table_number: 'K2',
                    created_at: tenMinutesAgo,
                    acknowledged_at: null,
                    status: 'pending',
                    items: [],
                },
            ],
            kdsItems: [
                {
                    id: 'kds-1',
                    order_id: 'order-bar-1',
                    order_item_id: 'item-1',
                    name: 'Iced Latte',
                    quantity: 1,
                    notes: null,
                    station: 'bar',
                    status: 'in_progress',
                    modifiers: [],
                },
                {
                    id: 'kds-2',
                    order_id: 'order-kitchen-1',
                    order_item_id: 'item-2',
                    name: 'Burger',
                    quantity: 1,
                    notes: null,
                    station: 'kitchen',
                    status: 'queued',
                    modifiers: [],
                },
            ],
            externalOrders: [],
        });
        setAuthAndContextOk(db);

        const response = await getKdsQueue(
            new Request(
                'http://localhost/api/v1/merchant/operations/kds/queue?station=bar&sla_status=breached&sla_minutes=30&limit=10'
            )
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(payload.data.orders)).toBe(true);
        for (const order of payload.data.orders as Array<Record<string, unknown>>) {
            expect(order.station).toBe('bar');
            expect(order.slaStatus).toBe('breached');
        }
    });

    it('GET /api/v1/merchant/operations/kds/queue returns all orders with correct pagination', async () => {
        const now = Date.now();
        const twentyMinutesAgo = new Date(now - 20 * 60_000).toISOString();
        const fifteenMinutesAgo = new Date(now - 15 * 60_000).toISOString();

        const db = makeFakeDb({
            orders: [
                {
                    id: 'order-1',
                    order_number: 'ORD-2001',
                    table_number: 'A1',
                    created_at: twentyMinutesAgo,
                    acknowledged_at: null,
                    status: 'pending',
                    items: [{ id: 'it-1', name: 'Fries', quantity: 1 }],
                },
                {
                    id: 'order-2',
                    order_number: 'ORD-2002',
                    table_number: 'A2',
                    created_at: fifteenMinutesAgo,
                    acknowledged_at: null,
                    status: 'pending',
                    items: [{ id: 'it-2', name: 'Pizza', quantity: 1 }],
                },
            ],
            externalOrders: [],
        });
        setAuthAndContextOk(db);

        const response = await getKdsQueue(
            new Request(
                'http://localhost/api/v1/merchant/operations/kds/queue?limit=50&station=all'
            )
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.data.orders).toHaveLength(2);
        expect(payload.data.orders[0].id).toBe('order-1');
        expect(payload.data.orders[1].id).toBe('order-2');
        expect(payload.data.cursor.has_more).toBe(false);
    });

    it('POST /api/v1/merchant/operations/kds/items/:id/action returns 401 when unauthorized', async () => {
        setAuthUnauthorized();

        const response = await postKdsItemAction(
            new Request(
                'http://localhost/api/v1/merchant/operations/kds/items/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/action',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'start' }),
                }
            ),
            { params: Promise.resolve({ kdsItemId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) }
        );

        expect(response.status).toBe(401);
    });

    it('POST /api/v1/merchant/operations/kds/items/:id/action returns 400 for invalid payload', async () => {
        setAuthAndContextOk(makeFakeDb({}));

        const response = await postKdsItemAction(
            new Request(
                'http://localhost/api/v1/merchant/operations/kds/items/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/action',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'invalid-action' }),
                }
            ),
            { params: Promise.resolve({ kdsItemId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) }
        );

        expect(response.status).toBe(400);
    });

    it('POST /api/v1/merchant/operations/kds/items/:id/action returns 400 for invalid idempotency key', async () => {
        setAuthAndContextOk(makeFakeDb({}));

        const response = await postKdsItemAction(
            new Request(
                'http://localhost/api/v1/merchant/operations/kds/items/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/action',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-idempotency-key': 'bad-key',
                    },
                    body: JSON.stringify({ action: 'start' }),
                }
            ),
            { params: Promise.resolve({ kdsItemId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) }
        );

        expect(response.status).toBe(400);
    });
});
