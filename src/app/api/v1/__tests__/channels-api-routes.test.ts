import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { writeAuditLog } from '@/lib/api/audit';

import { GET as getChannelsSummary } from '@/app/api/v1/merchant/marketing/channels/summary/route';
import {
    GET as getOnlineOrderingSettings,
    PATCH as patchOnlineOrderingSettings,
} from '@/app/api/v1/merchant/marketing/channels/online-ordering/settings/route';
import { POST as postDeliveryConnect } from '@/app/api/v1/merchant/marketing/channels/delivery/connect/route';
import { GET as getDeliveryOrders } from '@/app/api/v1/merchant/marketing/channels/delivery/orders/route';
import { POST as postDeliveryAck } from '@/app/api/v1/merchant/marketing/channels/delivery/orders/[externalOrderId]/ack/route';

vi.mock('@/lib/api/authz', () => ({
    getAuthenticatedUser: vi.fn(),
    getAuthorizedRestaurantContext: vi.fn(),
}));

vi.mock('@/lib/api/audit', () => ({
    writeAuditLog: vi.fn().mockResolvedValue({ error: null }),
}));

const getAuthenticatedUserMock = vi.mocked(getAuthenticatedUser);
const getAuthorizedRestaurantContextMock = vi.mocked(getAuthorizedRestaurantContext);
const writeAuditLogMock = vi.mocked(writeAuditLog);

function setAuthUnauthorized(): React.JSX.Element {
    getAuthenticatedUserMock.mockResolvedValue({
        ok: false,
        response: apiError('Unauthorized', 401, 'UNAUTHORIZED'),
    } as any);
}
function setAuthAndContextOk(): React.JSX.Element | void {
    getAuthenticatedUserMock.mockResolvedValue({
        ok: true,
        user: { id: 'user-1' },
        supabase: {},
    } as any);
    getAuthorizedRestaurantContextMock.mockResolvedValue({
        ok: true,
        restaurantId: 'resto-1',
        supabase,
    } as any);
}

describe('Channels API routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /api/v1/merchant/marketing/channels/summary returns 401 when unauthorized', async () => {
        setAuthUnauthorized();

        const response = await getChannelsSummary();

        expect(response.status).toBe(401);
    });

    it('PATCH /api/v1/merchant/marketing/channels/online-ordering/settings returns 400 for empty payload', async () => {
        setAuthAndContextOk();

        const response = await patchOnlineOrderingSettings(
            new Request(
                'http://localhost/api/v1/merchant/marketing/channels/online-ordering/settings',
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                }
            )
        );

        expect(response.status).toBe(400);
    });

    it('GET /api/v1/merchant/marketing/channels/online-ordering/settings returns 401 when unauthorized', async () => {
        setAuthUnauthorized();

        const response = await getOnlineOrderingSettings();

        expect(response.status).toBe(401);
    });

    it('POST /api/v1/merchant/marketing/channels/delivery/connect returns 400 for invalid payload', async () => {
        setAuthAndContextOk();

        const response = await postDeliveryConnect(
            new Request('http://localhost/api/v1/merchant/marketing/channels/delivery/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: 'bad-provider' }),
            })
        );

        expect(response.status).toBe(400);
    });

    it('POST /api/v1/merchant/marketing/channels/delivery/connect accepts telebirr_food rollout config', async () => {
        const supabase = {
            from: vi.fn(() => {
                const chain: Record<string, ReturnType<typeof vi.fn>> = {};
                chain.upsert = vi.fn(() => chain);
                chain.select = vi.fn(() => chain);
                chain.single = vi.fn().mockResolvedValue({
                    data: {
                        id: 'partner-telebirr',
                        provider: 'telebirr_food',
                        status: 'connected',
                        display_name: 'Telebirr Food',
                    },
                    error: null,
                });
                return chain;
            }),
        };
        setAuthAndContextOk(supabase);

        const response = await postDeliveryConnect(
            new Request('http://localhost/api/v1/merchant/marketing/channels/delivery/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: 'telebirr_food' }),
            })
        );
        const payload = await response.json();

        expect(response.status).toBe(201);
        expect(payload.data.partner).toMatchObject({
            id: 'partner-telebirr',
            provider: 'telebirr_food',
        });
        expect(writeAuditLogMock).toHaveBeenCalledOnce();
    });

    it('GET /api/v1/merchant/marketing/channels/delivery/orders returns 400 for invalid query', async () => {
        setAuthAndContextOk();

        const response = await getDeliveryOrders(
            new Request(
                'http://localhost/api/v1/merchant/marketing/channels/delivery/orders?limit=0',
                { method: 'GET' }
            )
        );

        expect(response.status).toBe(400);
    });

    it('POST /api/v1/merchant/marketing/channels/delivery/orders/:id/ack returns 400 for invalid id', async () => {
        setAuthAndContextOk();

        const response = await postDeliveryAck(
            new Request(
                'http://localhost/api/v1/merchant/marketing/channels/delivery/orders/not-a-uuid/ack',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                }
            ),
            { params: Promise.resolve({ externalOrderId: 'not-a-uuid' }) }
        );

        expect(response.status).toBe(400);
    });

    it('POST /api/v1/merchant/marketing/channels/delivery/orders/:id/ack returns 400 for invalid idempotency key', async () => {
        setAuthAndContextOk();

        const response = await postDeliveryAck(
            new Request(
                'http://localhost/api/v1/merchant/marketing/channels/delivery/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/ack',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-idempotency-key': 'invalid-key',
                    },
                    body: JSON.stringify({}),
                }
            ),
            { params: Promise.resolve({ externalOrderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) }
        );

        expect(response.status).toBe(400);
    });
});
