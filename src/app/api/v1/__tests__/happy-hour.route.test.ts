import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';

vi.mock('@/lib/api/authz', () => ({
    getAuthenticatedUser: vi.fn(),
    getAuthorizedRestaurantContext: vi.fn(),
}));

const getAuthenticatedUserMock = vi.mocked(getAuthenticatedUser);
const getAuthorizedRestaurantContextMock = vi.mocked(getAuthorizedRestaurantContext);

function setAuthUnauthorized() {
    getAuthenticatedUserMock.mockResolvedValue({
        ok: false,
        response: apiError('Unauthorized', 401, 'UNAUTHORIZED'),
    } as any);
}

function setAuthAndContextOk(supabase: any = {}) {
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

function _makeHappyHourSupabase() {
    const happyHourChain: any = {
        select: vi.fn(() => Promise.resolve({ data: [], error: null })),
        insert: vi.fn(() => Promise.resolve({ data: { id: 'hh-1' }, error: null })),
    };

    return {
        from: vi.fn((table: string) => {
            if (table === 'happy_hour_schedules') return happyHourChain;
            return {};
        }),
    } as any;
}

describe('Happy Hour API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /api/happy-hour returns 401 when unauthorized', async () => {
        const { GET } = await import('@/app/api/v1/merchant/marketing/happy-hour/route');
        setAuthUnauthorized();

        const response = await GET();

        expect(response.status).toBe(401);
    });

    it('POST /api/happy-hour returns 401 when unauthorized', async () => {
        const { POST } = await import('@/app/api/v1/merchant/marketing/happy-hour/route');
        setAuthUnauthorized();

        const response = await POST(
            new Request('http://localhost/api/v1/merchant/marketing/happy-hour', { method: 'POST' })
        );

        expect(response.status).toBe(401);
    });

    it('POST /api/happy-hour returns 400 for invalid time range', async () => {
        const { POST } = await import('@/app/api/v1/merchant/marketing/happy-hour/route');
        setAuthAndContextOk();

        const response = await POST(
            new Request('http://localhost/api/v1/merchant/marketing/happy-hour', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Test Happy Hour',
                    schedule_start_time: '18:00',
                    schedule_end_time: '16:00', // Invalid: before start
                    discount_percentage: 10,
                }),
            })
        );

        expect(response.status).toBe(400);
    });

    it('POST /api/happy-hour returns 400 when no discount provided', async () => {
        const { POST } = await import('@/app/api/v1/merchant/marketing/happy-hour/route');
        setAuthAndContextOk();

        const response = await POST(
            new Request('http://localhost/api/v1/merchant/marketing/happy-hour', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Test Happy Hour',
                    schedule_start_time: '14:00',
                    schedule_end_time: '18:00',
                }),
            })
        );

        expect(response.status).toBe(400);
    });
});
