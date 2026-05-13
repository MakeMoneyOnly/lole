import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { POST as postKdsHandoff } from '@/app/api/v1/merchant/operations/kds/orders/[orderId]/handoff/route';

vi.mock('@/lib/api/authz', () => ({
    getAuthenticatedUser: vi.fn(),
    getAuthorizedRestaurantContext: vi.fn(),
}));

const getAuthenticatedUserMock = vi.mocked(getAuthenticatedUser);
const getAuthorizedRestaurantContextMock = vi.mocked(getAuthorizedRestaurantContext);

function makeDbWithRole(role: string | null) {
    return {
        from: (table: string) => {
            if (table === 'restaurant_staff') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    maybeSingle: vi.fn().mockResolvedValue({
                        data: role ? { role } : null,
                        error: null,
                    }),
                };
            }

            return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
        },
    };
}

describe('POST /api/v1/merchant/operations/kds/orders/:id/handoff', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 when unauthorized', async () => {
        getAuthenticatedUserMock.mockResolvedValue({
            ok: false,
            response: apiError('Unauthorized', 401, 'UNAUTHORIZED'),
        } as any);

        const response = await postKdsHandoff(
            new Request(
                'http://localhost/api/v1/merchant/operations/kds/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/handoff',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'bump' }),
                }
            ),
            { params: Promise.resolve({ orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) }
        );

        expect(response.status).toBe(401);
    });

    it('returns 403 for non-expeditor roles', async () => {
        getAuthenticatedUserMock.mockResolvedValue({
            ok: true,
            user: { id: 'user-1' },
            supabase: {},
        } as any);
        getAuthorizedRestaurantContextMock.mockResolvedValue({
            ok: true,
            restaurantId: 'resto-1',
            supabase: makeDbWithRole('kitchen'),
        } as any);

        const response = await postKdsHandoff(
            new Request(
                'http://localhost/api/v1/merchant/operations/kds/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/handoff',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'bump' }),
                }
            ),
            { params: Promise.resolve({ orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) }
        );

        expect(response.status).toBe(403);
    });
});
