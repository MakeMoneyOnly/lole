import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '@/lib/api/response';
import { GET as getApiMetrics } from '@/app/api/v1/merchant/insights/analytics/api-metrics/route';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';

vi.mock('@/lib/api/authz', () => ({
    getAuthenticatedUser: vi.fn(),
    getAuthorizedRestaurantContext: vi.fn(),
}));

const getAuthenticatedUserMock = vi.mocked(getAuthenticatedUser);
const getAuthorizedRestaurantContextMock = vi.mocked(getAuthorizedRestaurantContext);

function unauthorizedResponse(): React.JSX.Element {
    return apiError('Unauthorized', 401, 'UNAUTHORIZED');
}
function buildAuditLogsQuery(): React.JSX.Element | void {
    const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        gte: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
    };
    return chain;
}

describe('GET /api/v1/merchant/insights/api-metrics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 when not authenticated', async () => {
        getAuthenticatedUserMock.mockResolvedValue({
            ok: false,
            response: unauthorizedResponse(),
        } as any);

        const response = await getApiMetrics(
            new Request('http://localhost/api/v1/merchant/insights/api-metrics?range=week')
        );

        expect(response.status).toBe(401);
    });

    it('aggregates p95 latency and error rate by endpoint', async () => {
        const rows = [
            {
                created_at: '2026-02-17T10:00:00.000Z',
                metadata: {
                    endpoint: '/api/v1/merchant/operations/orders',
                    duration_ms: 120,
                    is_error: false,
                },
            },
            {
                created_at: '2026-02-17T10:05:00.000Z',
                metadata: {
                    endpoint: '/api/v1/merchant/operations/orders',
                    duration_ms: 480,
                    is_error: true,
                },
            },
            {
                created_at: '2026-02-17T10:10:00.000Z',
                metadata: {
                    endpoint: '/api/v1/merchant/operations/orders',
                    duration_ms: 320,
                    is_error: false,
                },
            },
        ];

        getAuthenticatedUserMock.mockResolvedValue({
            ok: true,
            user: { id: 'user-1' },
        } as any);
        getAuthorizedRestaurantContextMock.mockResolvedValue({
            ok: true,
            restaurantId: 'resto-1',
            supabase: {
                from: vi.fn(() => buildAuditLogsQuery(rows)),
            },
        } as any);

        const response = await getApiMetrics(
            new Request('http://localhost/api/v1/merchant/insights/api-metrics?range=week')
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        const ordersEntry = payload.data.endpoints.find(
            (entry: any) => entry.endpoint === '/api/v1/merchant/operations/orders'
        );
        expect(ordersEntry).toBeTruthy();
        expect(ordersEntry.requests).toBe(3);
        expect(ordersEntry.errors).toBe(1);
        expect(ordersEntry.error_rate_percent).toBe(33.33);
        expect(ordersEntry.latency_ms.p95).toBe(480);
        expect(ordersEntry.slo.latency_status).toBe('breach');
        expect(ordersEntry.slo.error_status).toBe('breach');
        expect(payload.data.trend.length).toBeGreaterThan(0);
    });
});
