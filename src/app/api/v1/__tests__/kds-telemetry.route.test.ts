import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { writeAuditLog } from '@/lib/api/audit';
import {
    GET as getKdsTelemetry,
    POST as postKdsTelemetry,
} from '@/app/api/v1/merchant/operations/kds/telemetry/route';

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
function makeFakeDb(options?: { orders?: any[]; heartbeats?: any[] }): any {
    const orders = options?.orders ?? [];
    const heartbeats = options?.heartbeats ?? [];

    return {
        from: (table: string) => {
            if (table === 'orders') {
                const chain: any = {
                    select: vi.fn(() => chain),
                    eq: vi.fn(() => chain),
                    in: vi.fn().mockResolvedValue({ data: orders, error: null }),
                };
                return chain;
            }

            const chain: any = {
                select: vi.fn(() => chain),
                eq: vi.fn(() => chain),
                gte: vi.fn(() => chain),
                order: vi.fn(() => chain),
                limit: vi.fn().mockResolvedValue({ data: heartbeats, error: null }),
            };
            return chain;
        },
    };
}

function setAuthUnauthorized(): void {
    getAuthenticatedUserMock.mockResolvedValue({
        ok: false,
        response: apiError('Unauthorized', 401, 'UNAUTHORIZED'),
    } as any);
}
function setAuthAndContextOk(db?: any): void {
    getAuthenticatedUserMock.mockResolvedValue({
        ok: true,
        user: { id: 'user-1' },
    } as any);
    getAuthorizedRestaurantContextMock.mockResolvedValue({
        ok: true,
        restaurantId: 'resto-1',
        supabase: db,
    } as any);
}

describe('KDS telemetry API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /api/v1/merchant/insights/kds/telemetry returns 401 when unauthorized', async () => {
        setAuthUnauthorized();

        const response = await getKdsTelemetry(
            new Request('http://localhost/api/v1/merchant/insights/kds/telemetry?sla_minutes=30')
        );

        expect(response.status).toBe(401);
    });

    it('GET /api/v1/merchant/insights/kds/telemetry returns queue lag and websocket health', async () => {
        const now = Date.now();
        setAuthAndContextOk(
            makeFakeDb({
                orders: [
                    {
                        id: 'order-1',
                        status: 'preparing',
                        created_at: new Date(now - 45 * 60_000).toISOString(),
                    },
                    {
                        id: 'order-2',
                        status: 'pending',
                        created_at: new Date(now - 12 * 60_000).toISOString(),
                    },
                ],
                heartbeats: [
                    {
                        created_at: new Date(now - 30_000).toISOString(),
                        metadata: {
                            realtime_connected: true,
                            station: 'kitchen',
                        },
                    },
                ],
            })
        );

        const response = await getKdsTelemetry(
            new Request('http://localhost/api/v1/merchant/insights/kds/telemetry?sla_minutes=30')
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.data.queue_lag.active_tickets).toBe(2);
        expect(payload.data.sla.breached_tickets).toBe(1);
        expect(payload.data.websocket.healthy).toBe(true);
        expect(payload.data.websocket.status).toBe('healthy');
        expect(payload.data.websocket.connected_stations).toContain('kitchen');
    });

    it('POST /api/v1/merchant/insights/kds/telemetry writes heartbeat audit row', async () => {
        setAuthAndContextOk(makeFakeDb({}));

        const response = await postKdsTelemetry(
            new Request('http://localhost/api/v1/merchant/insights/kds/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    station: 'bar',
                    realtime_connected: false,
                    queue_size: 3,
                    breached_tickets: 1,
                }),
            })
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.data.received).toBe(true);
        expect(writeAuditLogMock).toHaveBeenCalledOnce();
        expect(writeAuditLogMock.mock.calls[0]?.[1]).toMatchObject({
            action: 'kds_ws_heartbeat',
            metadata: {
                station: 'bar',
                realtime_connected: false,
                queue_size: 3,
                breached_tickets: 1,
            },
        });
    });

    it('POST /api/v1/merchant/insights/kds/telemetry accepts grill station heartbeats for expanded routing', async () => {
        setAuthAndContextOk(makeFakeDb({}));

        const response = await postKdsTelemetry(
            new Request('http://localhost/api/v1/merchant/insights/kds/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    station: 'grill',
                    realtime_connected: true,
                    queue_size: 4,
                    breached_tickets: 0,
                }),
            })
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.data.received).toBe(true);
        expect(writeAuditLogMock.mock.calls.at(-1)?.[1]).toMatchObject({
            metadata: expect.objectContaining({
                station: 'grill',
            }),
        });
    });
});
