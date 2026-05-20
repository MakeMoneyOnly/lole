import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import {
    GET as getLoyaltyPrograms,
    POST as postLoyaltyPrograms,
} from '@/app/api/v1/merchant/marketing/loyalty/programs/route';
import { POST as postLoyaltyAdjust } from '@/app/api/v1/merchant/marketing/loyalty/accounts/[accountId]/adjust/route';
import {
    GET as getGiftCards,
    POST as postGiftCards,
} from '@/app/api/v1/merchant/marketing/gift-cards/route';
import { POST as postGiftCardRedeem } from '@/app/api/v1/merchant/marketing/gift-cards/[giftCardId]/redeem/route';
import {
    GET as getCampaigns,
    POST as postCampaigns,
} from '@/app/api/v1/merchant/marketing/campaigns/route';
import { POST as postCampaignLaunch } from '@/app/api/v1/merchant/marketing/campaigns/[campaignId]/launch/route';

vi.mock('@/lib/api/authz', () => ({
    getAuthenticatedUser: vi.fn(),
    getAuthorizedRestaurantContext: vi.fn(),
}));

const getAuthenticatedUserMock = vi.mocked(getAuthenticatedUser);
const getAuthorizedRestaurantContextMock = vi.mocked(getAuthorizedRestaurantContext);

function setAuthUnauthorized(): void {
    getAuthenticatedUserMock.mockResolvedValue({
        ok: false,
        response: apiError('Unauthorized', 401, 'UNAUTHORIZED'),
    } as any);
}
function setAuthAndContextOk(): void {
    getAuthenticatedUserMock.mockResolvedValue({
        ok: true,
        user: { id: 'user-1' },
        supabase: {},
    } as any);
    getAuthorizedRestaurantContextMock.mockResolvedValue({
        ok: true,
        restaurantId: 'resto-1',
        supabase: {},
    } as any);
}

function _makeSupabase(): any {
    return {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
            })),
        })),
    };
}

describe('P2 revenue API routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('GET /api/v1/merchant/marketing/loyalty/programs returns 401 when unauthorized', async () => {
        setAuthUnauthorized();

        const response = await getLoyaltyPrograms(new Request('http://localhost/api/v1/merchant/marketing/loyalty/programs'));

        expect(response.status).toBe(401);
    });

    it('POST /api/loyalty/programs returns 400 for invalid payload', async () => {
        setAuthAndContextOk();

        const response = await postLoyaltyPrograms(
            new Request('http://localhost/api/v1/merchant/marketing/loyalty/programs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: '' }),
            })
        );

        expect(response.status).toBe(400);
    });

    it('POST /api/loyalty/accounts/:id/adjust returns 400 for invalid id', async () => {
        setAuthAndContextOk();

        const response = await postLoyaltyAdjust(
            new Request(
                'http://localhost/api/v1/merchant/marketing/loyalty/accounts/not-a-uuid/adjust',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ points_delta: 10, reason: 'promo' }),
                }
            ),
            { params: Promise.resolve({ accountId: 'not-a-uuid' }) }
        );

        expect(response.status).toBe(400);
    });

    it('GET /api/gift-cards returns 401 when unauthorized', async () => {
        setAuthUnauthorized();

        const response = await getGiftCards(
            new Request('http://localhost/api/v1/merchant/marketing/gift-cards')
        );

        expect(response.status).toBe(401);
    });

    it('POST /api/gift-cards returns 400 for invalid payload', async () => {
        setAuthAndContextOk();

        const response = await postGiftCards(
            new Request('http://localhost/api/v1/merchant/marketing/gift-cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initial_balance: 0 }),
            })
        );

        expect(response.status).toBe(400);
    });

    it('POST /api/gift-cards/:id/redeem returns 400 for invalid idempotency key', async () => {
        setAuthAndContextOk();

        const response = await postGiftCardRedeem(
            new Request(
                'http://localhost/api/v1/merchant/marketing/gift-cards/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/redeem',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-idempotency-key': 'bad-key',
                    },
                    body: JSON.stringify({ amount: 50 }),
                }
            ),
            { params: Promise.resolve({ giftCardId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) }
        );

        expect(response.status).toBe(400);
    });

    it('GET /api/campaigns returns 401 when unauthorized', async () => {
        setAuthUnauthorized();

        const response = await getCampaigns(
            new Request('http://localhost/api/v1/merchant/marketing/campaigns')
        );

        expect(response.status).toBe(401);
    });

    it('POST /api/campaigns returns 400 for invalid payload', async () => {
        setAuthAndContextOk();

        const response = await postCampaigns(
            new Request('http://localhost/api/v1/merchant/marketing/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'a' }),
            })
        );

        expect(response.status).toBe(400);
    });

    it('POST /api/campaigns/:id/launch returns 400 for invalid campaign id', async () => {
        setAuthAndContextOk();

        const response = await postCampaignLaunch(
            new Request('http://localhost/api/v1/merchant/marketing/campaigns/not-a-uuid/launch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            }),
            { params: Promise.resolve({ campaignId: 'not-a-uuid' }) }
        );

        expect(response.status).toBe(400);
    });
});
